import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, FolderPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { HudPanel } from "../HudPanel";
import {
  buildFolderTree,
  ancestorFolderIds,
  getFolderColor,
  getFolderIcon,
  searchFoldersAndConversations,
  escapeRegExp,
  type FolderRow,
  type ConversationWithFolder,
} from "@/lib/folders";
import { type ConversationRow } from "@/lib/conversation-grouping";
import {
  foldersQueryKey,
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useMoveFolder,
  useMoveConversation,
  type FolderMutationsOptions,
} from "@/hooks/use-folders";
import { setActiveDrag, getActiveDrag, type DropPosition } from "./dnd";
import { FolderItem } from "./FolderItem";
import { FolderConversationItem } from "./FolderConversationItem";
import { FolderDialog } from "./FolderDialog";
import { SortableRootConversations } from "./SortableRootConversations";
import { useReorderConversations } from "@/hooks/use-reorder-conversations";

interface FolderSidebarProps {
  userId: string;
  conversationsQueryKey: readonly [string, string];
  /** Conversations enriched with folder_id (already patched from cache). */
  conversations: ConversationWithFolder[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  /** Patch a conversation's folder_id in the conversations cache (optimistic). */
  patchConversationFolder: (id: string, folderId: string | null) => void;
}

interface FlatRow {
  key: string;
  type: "folder" | "conversation";
  folderId?: string;
  conversationId?: string;
  depth: number;
}

export function FolderSidebar({
  userId,
  conversationsQueryKey,
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onPin,
  onFavorite,
  patchConversationFolder,
}: FolderSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [convDraft, setConvDraft] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<{
    folderId: string | null;
    position: DropPosition;
    conversationId?: string | null;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    editing: FolderRow | null;
  }>({ open: false, editing: null });
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const [dragFolderId, setDragFolderId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const mutationOpts: FolderMutationsOptions = useMemo(
    () => ({ userId, conversationsQueryKey, patchConversationFolder }),
    [userId, conversationsQueryKey, patchConversationFolder],
  );

  const createFolder = useCreateFolder(mutationOpts);
  const updateFolder = useUpdateFolder(mutationOpts);
  const deleteFolder = useDeleteFolder(mutationOpts);
  const moveFolder = useMoveFolder(mutationOpts);
  const moveConversation = useMoveConversation(mutationOpts);
  const { reorder: reorderConversations } = useReorderConversations({
    userId,
    conversationsQueryKey,
  });

  // Folders query (cached independently, normalized).
  const { data: foldersData } = useFolders(userId);
  const folders = foldersData ?? EMPTY_FOLDERS;

  // ---- Search ---------------------------------------------------------------
  const searchResult = useMemo(
    () => searchFoldersAndConversations(folders, conversations, search),
    [folders, conversations, search],
  );

  // Auto-expand folders that contain a search match.
  const effectiveExpanded = useMemo(() => {
    if (!search.trim()) return expanded;
    const next = { ...expanded };
    for (const id of searchResult.folderIds) next[id] = true;
    return next;
  }, [expanded, search, searchResult.folderIds]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ---- Tree ----------------------------------------------------------------
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  // Conversations grouped by folder.
  const convsByFolder = useMemo(() => {
    const map = new Map<string | null, ConversationWithFolder[]>();
    for (const c of conversations) {
      const list = map.get(c.folder_id) ?? [];
      list.push(c);
      map.set(c.folder_id, list);
    }
    return map;
  }, [conversations]);

  // Non-foldered conversations (rendered at the bottom with time grouping).
  const rootConversations = useMemo(() => convsByFolder.get(null) ?? [], [convsByFolder]);

  // ---- Drag handlers -------------------------------------------------------
  const handleDropFolder = useCallback(
    (targetFolderId: string, position: DropPosition, draggedId: string) => {
      const dragged = folders.find((f) => f.id === draggedId);
      if (!dragged) return;
      if (position === "inside") {
        const childDepth = depthOf(folders, targetFolderId) + 1;
        if (childDepth > 3) return; // MAX_FOLDER_DEPTH enforced defensively
        moveFolder.mutate({ id: draggedId, parent_id: targetFolderId, sort_order: 0 });
        setExpanded((p) => ({ ...p, [targetFolderId]: true }));
      } else {
        const targetParent = folders.find((f) => f.id === targetFolderId)?.parent_id ?? null;
        const siblings = folders
          .filter((f) => f.parent_id === targetParent && f.id !== draggedId)
          .sort((a, b) => a.sort_order - b.sort_order);
        const idx = siblings.findIndex((f) => f.id === targetFolderId);
        const before = position === "before" ? siblings[idx - 1] : siblings[idx];
        const after = position === "before" ? siblings[idx] : siblings[idx + 1];
        const newSort =
          before && after
            ? (before.sort_order + after.sort_order) / 2
            : before
              ? before.sort_order + 1
              : after
                ? after.sort_order - 1
                : 0;
        moveFolder.mutate({ id: draggedId, parent_id: targetParent, sort_order: newSort });
      }
      setDropTarget(null);
      setActiveDrag(null);
    },
    [folders, moveFolder],
  );

  const handleDropConversation = useCallback(
    (targetConvId: string, position: "before" | "after", draggedId: string) => {
      const target = conversations.find((c) => c.id === targetConvId);
      if (!target) return;
      const destFolder = target.folder_id;
      // Move dragged conversation into the same folder as the target.
      moveConversation.mutate({
        conversationId: draggedId,
        folder_id: destFolder,
        last_message_at: new Date().toISOString(),
      });
      setDropTarget(null);
      setActiveDrag(null);
    },
    [conversations, moveConversation],
  );

  // Drop a conversation onto a folder body (not on a specific conversation).
  const handleDropOnFolderBody = useCallback(
    (folderId: string, draggedConvId: string) => {
      moveConversation.mutate({
        conversationId: draggedConvId,
        folder_id: folderId,
        last_message_at: new Date().toISOString(),
      });
      setExpanded((p) => ({ ...p, [folderId]: true }));
      setDropTarget(null);
      setActiveDrag(null);
    },
    [moveConversation],
  );

  // Drop a conversation onto the root "No Folder" area.
  const handleDropOnRoot = useCallback(
    (draggedConvId: string) => {
      moveConversation.mutate({
        conversationId: draggedConvId,
        folder_id: null,
        last_message_at: new Date().toISOString(),
      });
      setDropTarget(null);
      setActiveDrag(null);
    },
    [moveConversation],
  );

  // Native HTML5 drop handlers for FOLDER drags landing on the root area
  // (the root list itself uses @dnd-kit, but folders still use native DnD).
  const onRootDragOver = useCallback((e: React.DragEvent) => {
    const drag = getActiveDrag();
    if (drag?.kind === "conversation") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ folderId: null, position: "inside" });
    }
  }, []);
  const onRootDrop = useCallback(
    (e: React.DragEvent) => {
      const drag = getActiveDrag();
      if (drag?.kind === "conversation") {
        e.preventDefault();
        handleDropOnRoot(drag.id);
      }
    },
    [handleDropOnRoot],
  );

  // ---- Folder CRUD ---------------------------------------------------------
  const openNewDialog = useCallback(() => setDialog({ open: true, editing: null }), []);
  const openEditDialog = useCallback(
    (folder: FolderRow) => setDialog({ open: true, editing: folder }),
    [],
  );
  const closeDialog = useCallback(() => setDialog({ open: false, editing: null }), []);

  const submitDialog = useCallback(
    (values: {
      name: string;
      color: string | null;
      icon: string | null;
      parentId: string | null;
    }) => {
      if (dialog.editing) {
        updateFolder.mutate({
          id: dialog.editing.id,
          name: values.name,
          color: values.color,
          icon: values.icon,
        });
      } else {
        createFolder.mutate({
          name: values.name,
          parent_id: values.parentId,
          color: values.color,
          icon: values.icon,
        });
      }
      closeDialog();
    },
    [dialog.editing, createFolder, updateFolder, closeDialog],
  );

  // ---- Conversation edit ---------------------------------------------------
  const convCommit = useCallback(() => {
    setEditingConvId((id) => {
      if (id && convDraft.trim()) onRename(id, convDraft.trim());
      return null;
    });
  }, [convDraft, onRename]);
  const convStartEdit = useCallback((c: ConversationWithFolder) => {
    setEditingConvId(c.id);
    setConvDraft(c.title);
  }, []);

  // ---- Keyboard navigation -------------------------------------------------
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    const walk = (nodes: ReturnType<typeof buildFolderTree>, depth: number) => {
      for (const node of nodes) {
        rows.push({ key: `f-${node.id}`, type: "folder", folderId: node.id, depth });
        if (effectiveExpanded[node.id]) {
          const convs = (convsByFolder.get(node.id) ?? []).sort(sortConvs);
          for (const c of convs) {
            rows.push({
              key: `c-${c.id}`,
              type: "conversation",
              conversationId: c.id,
              depth: depth + 1,
            });
          }
          walk(node.children, depth + 1);
        }
      }
    };
    walk(tree, 1);
    // Root conversations section.
    const root = (convsByFolder.get(null) ?? []).sort(sortConvs);
    for (const c of root) {
      rows.push({ key: `c-${c.id}`, type: "conversation", conversationId: c.id, depth: 0 });
    }
    return rows;
  }, [tree, effectiveExpanded, convsByFolder]);

  const onKeyDownNav = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingConvId) return; // let the input handle keys
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, flatRows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const row = flatRows[focusIndex];
        if (row?.type === "folder" && row.folderId) toggle(row.folderId);
        else if (row?.type === "conversation" && row.conversationId) onSelect(row.conversationId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const row = flatRows[focusIndex];
        if (row?.type === "folder" && row.folderId) deleteFolder.mutate(row.folderId);
        else if (row?.type === "conversation" && row.conversationId) onDelete(row.conversationId);
      } else if (e.key === "F2") {
        const row = flatRows[focusIndex];
        if (row?.type === "conversation" && row.conversationId) {
          const c = conversations.find((x) => x.id === row.conversationId);
          if (c) convStartEdit(c);
        }
      } else if (e.key === "Escape") {
        setFocusIndex(-1);
      }
    },
    [
      flatRows,
      focusIndex,
      toggle,
      onSelect,
      deleteFolder,
      onDelete,
      conversations,
      convStartEdit,
      editingConvId,
    ],
  );

  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector<HTMLElement>(`[data-row-index="${focusIndex}"]`);
      el?.focus();
    }
  }, [focusIndex]);

  const parentOptions = useMemo(() => treeToOptions(tree), [tree]);

  return (
    <HudPanel
      title="Workspace"
      subtitle="Folders & chats"
      className="flex h-full flex-col gap-3"
      action={
        <button
          onClick={openNewDialog}
          aria-label="New folder"
          className="rounded-xl border border-border bg-card/60 p-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      }
    >
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Plus className="h-3.5 w-3.5" />
        New Chat
      </button>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats & folders…"
          className="w-full rounded-xl border border-border bg-background/70 py-2.5 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div
        ref={listRef}
        className="custom-scrollbar flex-1 space-y-1 overflow-y-auto pr-1"
        onKeyDown={onKeyDownNav}
        tabIndex={-1}
      >
        {folders.length === 0 && rootConversations.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {search ? "No matches" : "No conversations yet"}
          </p>
        ) : (
          <>
            <FolderTreeView
              nodes={tree}
              depth={1}
              expanded={effectiveExpanded}
              searchResult={search ? searchResult : null}
              dropTarget={dropTarget}
              onToggle={toggle}
              onRenameFolder={openEditDialog}
              onDeleteFolder={(id) => deleteFolder.mutate(id)}
              onDropFolder={handleDropFolder}
              onDropConversation={handleDropConversation}
              onDropOnFolderBody={handleDropOnFolderBody}
              conversationsByFolder={convsByFolder}
              folders={folders}
              dragFolderId={dragFolderId}
              currentId={currentId}
              focusIndex={focusIndex}
              flatRows={flatRows}
              onSelectConv={onSelect}
              editingConvId={editingConvId}
              convDraft={convDraft}
              setConvDraft={setConvDraft}
              onConvStartEdit={convStartEdit}
              onConvCommitEdit={convCommit}
              onConvCancelEdit={() => setEditingConvId(null)}
              onConvDelete={onDelete}
              onConvPin={onPin}
              onConvFavorite={onFavorite}
              onFolderDragStart={(id) => setDragFolderId(id)}
              onFolderDragEnd={() => {
                setDragFolderId(null);
                setDropTarget(null);
              }}
              setDropTarget={setDropTarget}
            />

            {rootConversations.length > 0 && (
              <div onDragOver={onRootDragOver} onDrop={onRootDrop} className="space-y-3">
                <SortableRootConversations
                  conversations={rootConversations}
                  currentId={currentId}
                  searchResult={search ? searchResult.conversationIds : null}
                  editingConvId={editingConvId}
                  convDraft={convDraft}
                  setConvDraft={setConvDraft}
                  onSelectConv={onSelect}
                  onConvStartEdit={convStartEdit}
                  onConvCommitEdit={convCommit}
                  onConvCancelEdit={() => setEditingConvId(null)}
                  onConvDelete={onDelete}
                  onConvPin={onPin}
                  onConvFavorite={onFavorite}
                  onReorder={(orderedIds) => reorderConversations({ orderedIds })}
                  focusIndex={focusIndex}
                  flatRows={flatRows}
                />
              </div>
            )}
          </>
        )}
      </div>

      <FolderDialog
        open={dialog.open}
        initial={
          dialog.editing
            ? {
                name: dialog.editing.name,
                color: dialog.editing.color,
                icon: dialog.editing.icon,
                parentId: dialog.editing.parent_id,
              }
            : null
        }
        parentOptions={parentOptions}
        onSubmit={submitDialog}
        onCancel={closeDialog}
      />
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// Sub-views (memoized)
// ---------------------------------------------------------------------------

interface FolderTreeViewProps {
  nodes: ReturnType<typeof buildFolderTree>;
  depth: number;
  expanded: Record<string, boolean>;
  searchResult: ReturnType<typeof searchFoldersAndConversations> | null;
  dropTarget: {
    folderId: string | null;
    position: DropPosition;
    conversationId?: string | null;
  } | null;
  onToggle: (id: string) => void;
  onRenameFolder: (folder: FolderRow) => void;
  onDeleteFolder: (id: string) => void;
  onDropFolder: (folderId: string, position: DropPosition, draggedId: string) => void;
  onDropConversation: (
    targetConversationId: string,
    position: "before" | "after",
    draggedId: string,
  ) => void;
  onDropOnFolderBody: (folderId: string, draggedConvId: string) => void;
  conversationsByFolder: Map<string | null, ConversationWithFolder[]>;
  folders: FolderRow[];
  dragFolderId: string | null;
  currentId: string | null;
  focusIndex: number;
  flatRows: FlatRow[];
  onSelectConv: (id: string) => void;
  editingConvId: string | null;
  convDraft: string;
  setConvDraft: (v: string) => void;
  onConvStartEdit: (c: ConversationWithFolder) => void;
  onConvCommitEdit: () => void;
  onConvCancelEdit: () => void;
  onConvDelete: (id: string) => void;
  onConvPin: (id: string, pinned: boolean) => void;
  onConvFavorite: (id: string, favorite: boolean) => void;
  onFolderDragStart: (id: string) => void;
  onFolderDragEnd: () => void;
  setDropTarget: (
    t: { folderId: string | null; position: DropPosition; conversationId?: string | null } | null,
  ) => void;
}

const FolderTreeView = memo(function FolderTreeView({
  nodes,
  depth,
  expanded,
  searchResult,
  dropTarget,
  onToggle,
  onRenameFolder,
  onDeleteFolder,
  onDropFolder,
  onDropConversation,
  onDropOnFolderBody,
  conversationsByFolder,
  currentId,
  focusIndex,
  flatRows,
  onSelectConv,
  editingConvId,
  convDraft,
  setConvDraft,
  onConvStartEdit,
  onConvCommitEdit,
  onConvCancelEdit,
  onConvDelete,
  onConvPin,
  onConvFavorite,
  onFolderDragStart,
  onFolderDragEnd,
  setDropTarget,
  folders,
  dragFolderId,
}: FolderTreeViewProps) {
  const ancestorSet = useMemo(
    () => (dragFolderId ? ancestorFolderIds(folders, dragFolderId) : new Set<string>()),
    [dragFolderId, folders],
  );
  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const isExpanded = expanded[node.id] ?? false;
        const highlight = searchResult?.folderIds.has(node.id) ?? false;
        const isAncestorOfDrag =
          !!dragFolderId && (ancestorSet.has(node.id) || node.id === dragFolderId);
        const convs = (conversationsByFolder.get(node.id) ?? []).sort(sortConvs);
        const rowIndex = flatRows.findIndex((r) => r.key === `f-${node.id}`);
        const isFocused = focusIndex === rowIndex;

        // Drag-over handler for the folder body (drops conversations inside).
        const onBodyDragOver = (e: React.DragEvent) => {
          const drag = getActiveDrag();
          if (drag?.kind === "conversation") {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDropTarget({ folderId: node.id, position: "inside" });
          }
        };
        const onBodyDrop = (e: React.DragEvent) => {
          const drag = getActiveDrag();
          if (drag?.kind === "conversation") {
            e.preventDefault();
            e.stopPropagation();
            onDropOnFolderBody(node.id, drag.id);
          }
        };

        return (
          <div key={node.id}>
            <div
              data-row-index={rowIndex}
              tabIndex={isFocused ? 0 : -1}
              className={cn(highlight && "rounded-md ring-1 ring-primary/40")}
            >
              <FolderItem
                folder={node}
                depth={depth}
                expanded={isExpanded}
                canNestDeeper={depth < 3}
                isDropTarget={
                  dropTarget?.folderId === node.id && dropTarget.conversationId == null
                    ? dropTarget.position
                    : null
                }
                isAncestorOfDrag={isAncestorOfDrag}
                onToggle={onToggle}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onDropFolder={onDropFolder}
                onDragStartFolder={onFolderDragStart}
                onDragEndFolder={onFolderDragEnd}
              />
            </div>

            {isExpanded && (
              <div
                className="relative mt-1 space-y-1"
                style={{ marginLeft: depth * 12 + 8 }}
                onDragOver={onBodyDragOver}
                onDrop={onBodyDrop}
              >
                {convs.map((c) => {
                  const cRowIndex = flatRows.findIndex((r) => r.key === `c-${c.id}`);
                  return (
                    <div
                      key={c.id}
                      data-row-index={cRowIndex}
                      tabIndex={focusIndex === cRowIndex ? 0 : -1}
                    >
                      <FolderConversationItem
                        conv={c}
                        isCurrent={currentId === c.id}
                        isEditing={editingConvId === c.id}
                        draft={convDraft}
                        setDraft={setConvDraft}
                        onSelect={onSelectConv}
                        onStartEdit={onConvStartEdit}
                        onCommitEdit={onConvCommitEdit}
                        onCancelEdit={onConvCancelEdit}
                        onDelete={onConvDelete}
                        onPin={onConvPin}
                        onFavorite={onConvFavorite}
                        onDropConversation={onDropConversation}
                      />
                    </div>
                  );
                })}
                {convs.length === 0 && (
                  <p className="py-1 text-[10px] text-muted-foreground/70">Drop chats here</p>
                )}
              </div>
            )}

            {isExpanded && node.children.length > 0 && (
              <FolderTreeView
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                searchResult={searchResult}
                dropTarget={dropTarget}
                onToggle={onToggle}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onDropFolder={onDropFolder}
                onDropConversation={onDropConversation}
                onDropOnFolderBody={onDropOnFolderBody}
                conversationsByFolder={conversationsByFolder}
                folders={folders}
                dragFolderId={dragFolderId}
                currentId={currentId}
                focusIndex={focusIndex}
                flatRows={flatRows}
                onSelectConv={onSelectConv}
                editingConvId={editingConvId}
                convDraft={convDraft}
                setConvDraft={setConvDraft}
                onConvStartEdit={onConvStartEdit}
                onConvCommitEdit={onConvCommitEdit}
                onConvCancelEdit={onConvCancelEdit}
                onConvDelete={onConvDelete}
                onConvPin={onConvPin}
                onConvFavorite={onConvFavorite}
                onFolderDragStart={onFolderDragStart}
                onFolderDragEnd={onFolderDragEnd}
                setDropTarget={setDropTarget}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FOLDERS: FolderRow[] = [];

function sortConvs(a: ConversationRow, b: ConversationRow): number {
  const ta = new Date(a.last_message_at).getTime();
  const tb = new Date(b.last_message_at).getTime();
  return tb - ta;
}

function depthOf(folders: FolderRow[], id: string): number {
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  let depth = 1;
  let cursor = byId.get(id)?.parent_id ?? null;
  while (cursor) {
    depth += 1;
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
  return depth;
}

function treeToOptions(
  nodes: ReturnType<typeof buildFolderTree>,
): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  const walk = (ns: ReturnType<typeof buildFolderTree>, depth: number) => {
    for (const n of ns) {
      out.push({ id: n.id, name: n.name, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(nodes, 1);
  return out;
}

function ancestorFolderIdsFor(_id: string): Set<string> {
  return new Set();
}
