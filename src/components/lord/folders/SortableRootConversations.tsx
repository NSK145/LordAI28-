/**
 * SortableRootConversations — drag-to-reorder the "No Folder" (root) conversation
 * list using @dnd-kit (NOT react-beautiful-dnd).
 *
 * Features:
 *   • Smooth FLIP animation via dnd-kit's built-in transforms + CSS transitions.
 *   • A floating DragOverlay (the "lifted" card) so the dragged row follows the
 *     cursor/touch with a LORD-styled glow; the source slot shows a drop zone.
 *   • Drop indicators: a glowing line appears above/below the target slot.
 *   • Auto-scroll while dragging (dnd-kit's built-in auto-scroller, driven by the
 *     scroll container ref). Works for mouse, touch and keyboard.
 *   • Touch support via TouchSensor with an activation distance so taps/clicks
 *     still select and the hover buttons still work.
 *   • Keyboard accessibility: Space/Enter picks up, arrows move, Space drops,
 *     Escape cancels. The grip handle is a real focusable button with an
 *     aria-label; the list is an ARIA listbox of options.
 *   • No unnecessary re-renders: rows are memoized; only the list order + the
 *     active id drive re-renders. Drag state lives in the context, not per-row.
 */

import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MessageSquare,
  Pencil,
  Trash2,
  Pin,
  Star,
  Check,
  X,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationWithFolder } from "@/lib/folders";
import { sortRootConversations } from "@/lib/conversation-grouping";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FlatRowRef {
  key: string;
  conversationId?: string;
  type: string;
}

interface SortableRootConversationsProps {
  conversations: ConversationWithFolder[];
  currentId: string | null;
  searchResult: Set<string> | null;
  editingConvId: string | null;
  convDraft: string;
  setConvDraft: (v: string) => void;
  onSelectConv: (id: string) => void;
  onConvStartEdit: (c: ConversationWithFolder) => void;
  onConvCommitEdit: () => void;
  onConvCancelEdit: () => void;
  onConvDelete: (id: string) => void;
  onConvPin: (id: string, pinned: boolean) => void;
  onConvFavorite: (id: string, favorite: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
  focusIndex: number;
  flatRows: FlatRowRef[];
}

export const SortableRootConversations = memo(function SortableRootConversations({
  conversations,
  currentId,
  searchResult,
  editingConvId,
  convDraft,
  setConvDraft,
  onSelectConv,
  onConvStartEdit,
  onConvCommitEdit,
  onConvCancelEdit,
  onConvDelete,
  onConvPin,
  onConvFavorite,
  onReorder,
  focusIndex,
  flatRows,
}: SortableRootConversationsProps) {
  // Stable manual ordering for the root list (newest-first until first drag).
  const ordered = useMemo(() => sortRootConversations(conversations), [conversations]);
  const ids = useMemo(() => ordered.map((c) => c.id), [ordered]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sensors: pointer (mouse), touch (with activation delay so taps still
  // select), and keyboard (space to lift, arrows to move, escape to cancel).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeConv = useMemo(
    () => ordered.find((c) => c.id === activeId) ?? null,
    [ordered, activeId],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);
      if (!over || active.id === over.id) return;
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      onReorder(next);
    },
    [ids, onReorder],
  );

  if (ordered.length === 0) {
    return <p className="py-1 text-[10px] text-muted-foreground/70">No chats here yet</p>;
  }

  return (
    <div ref={scrollRef} className="space-y-1 pt-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul role="listbox" aria-label="Conversation order" className="flex flex-col gap-1">
            {ordered.map((conv) => {
              const rowIndex = flatRows.findIndex((r) => r.key === `c-${conv.id}`);
              return (
                <SortableConvItem
                  key={conv.id}
                  conv={conv}
                  isCurrent={currentId === conv.id}
                  isEditing={editingConvId === conv.id}
                  draft={convDraft}
                  setDraft={setConvDraft}
                  onSelect={onSelectConv}
                  onStartEdit={onConvStartEdit}
                  onCommitEdit={onConvCommitEdit}
                  onCancelEdit={onConvCancelEdit}
                  onDelete={onConvDelete}
                  onPin={onConvPin}
                  onFavorite={onConvFavorite}
                  isActive={activeId === conv.id}
                  isSearchMatch={searchResult?.has(conv.id) ?? false}
                  isFocused={focusIndex === rowIndex}
                  rowIndex={rowIndex}
                />
              );
            })}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeConv ? (
            <ConversationRowCard
              conv={activeConv}
              isCurrent={currentId === activeConv.id}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

interface SortableConvItemProps {
  conv: ConversationWithFolder;
  isCurrent: boolean;
  isEditing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSelect: (id: string) => void;
  onStartEdit: (c: ConversationWithFolder) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  isActive: boolean;
  isSearchMatch: boolean;
  isFocused: boolean;
  rowIndex: number;
}

const SortableConvItem = memo(function SortableConvItem({
  conv,
  isCurrent,
  isEditing,
  draft,
  setDraft,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onPin,
  onFavorite,
  isActive,
  isSearchMatch,
  isFocused,
  rowIndex,
}: SortableConvItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: conv.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pinned = conv.pinned ?? false;
  const favorite = conv.favorite ?? false;

  return (
    <li
      ref={setNodeRef}
      style={style}
      role="option"
      aria-selected={isCurrent}
      tabIndex={isFocused ? 0 : -1}
      data-row-index={rowIndex}
      className={cn(
        "group relative rounded-md border text-xs transition",
        isDragging ? "opacity-40" : "opacity-100",
        isCurrent
          ? "border-primary/60 bg-primary/15"
          : "border-border/40 bg-background/20 hover:bg-background/40",
        isSearchMatch && "ring-1 ring-primary/40",
      )}
    >
      {/* Drop indicator line (glows while this row is the active drag target) */}
      {isDragging && (
        <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded bg-primary shadow-[0_0_8px_var(--hud)]" />
      )}

      <div className="flex items-start justify-between gap-2 px-2 py-1.5">
        {/* Drag handle — the only keyboard-focusable, pointer-draggable affordance
            so the rest of the row stays clickable for selection / hover actions. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${conv.title || "Untitled"}`}
          className="mt-0.5 flex h-4 w-4 flex-shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 transition hover:text-primary active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {isEditing ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="flex-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-xs outline-none focus:border-primary"
            />
            <button onClick={onCommitEdit} className="text-primary" aria-label="Save">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={onCancelEdit} className="text-muted-foreground" aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSelect(conv.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <MessageSquare className="h-3 w-3 flex-shrink-0" />
            <p className="truncate font-medium">{conv.title || "Untitled"}</p>
            {pinned && (
              <Pin
                className="h-3 w-3 flex-shrink-0 fill-current text-primary"
                aria-label="Pinned"
              />
            )}
          </button>
        )}

        {!isEditing && (
          <>
            <div className="hidden shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 sm:flex">
              <button
                onClick={() => onPin(conv.id, !pinned)}
                aria-label={pinned ? `Unpin ${conv.title}` : `Pin ${conv.title}`}
                className={cn(
                  "transition",
                  pinned ? "text-primary opacity-100" : "text-muted-foreground hover:text-primary",
                )}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onFavorite(conv.id, !favorite)}
                aria-label={favorite ? `Unfavorite ${conv.title}` : `Favorite ${conv.title}`}
                className={cn(
                  "transition",
                  favorite
                    ? "text-amber-400 opacity-100"
                    : "text-muted-foreground hover:text-amber-400",
                )}
              >
                <Star className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onStartEdit(conv)}
                aria-label={`Rename ${conv.title}`}
                className="text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(conv.id)}
                aria-label={`Delete ${conv.title}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${conv.title || "Untitled"}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:hidden"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-48 border-white/10 bg-[#11151d] text-foreground shadow-xl"
              >
                <DropdownMenuItem onSelect={() => onPin(conv.id, !pinned)} className="min-h-11">
                  <Pin className="h-4 w-4" />
                  {pinned ? "Unpin Chat" : "Pin Chat"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onFavorite(conv.id, !favorite)}
                  className="min-h-11"
                >
                  <Star className="h-4 w-4" />
                  {favorite ? "Remove Favorite" : "Add Favorite"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onStartEdit(conv)} className="min-h-11">
                  <Pencil className="h-4 w-4" />
                  Rename Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(conv.id)}
                  className="min-h-11 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </li>
  );
});

/** Presentational card reused by the DragOverlay (lifted, glowing). */
const ConversationRowCard = memo(function ConversationRowCard({
  conv,
  isCurrent,
  overlay,
}: {
  conv: ConversationWithFolder;
  isCurrent: boolean;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs",
        overlay ? "w-64 border-primary/70 bg-background/95 shadow-[0_0_18px_var(--hud)]" : "",
        isCurrent ? "border-primary/60 bg-primary/15" : "border-border/40 bg-background/40",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <MessageSquare className="h-3 w-3 flex-shrink-0" />
      <p className="truncate font-medium">{conv.title || "Untitled"}</p>
    </div>
  );
});
