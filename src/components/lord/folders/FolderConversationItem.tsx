import { memo, useState } from "react";
import { MessageSquare, Pencil, Trash2, Pin, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationWithFolder } from "@/lib/folders";
import { setActiveDrag, getActiveDrag } from "./dnd";
import { FavoriteStar } from "../FavoriteStar";

interface FolderConversationItemProps {
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
  /** Called when this conversation row is used as a drop anchor. */
  onDropConversation: (
    targetConversationId: string,
    position: "before" | "after",
    draggedId: string,
  ) => void;
}

export const FolderConversationItem = memo(function FolderConversationItem({
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
  onDropConversation,
}: FolderConversationItemProps) {
  const pinned = conv.pinned ?? false;
  const favorite = conv.favorite ?? false;

  const guardDrop = (): boolean => {
    const drag = getActiveDrag();
    return !!drag && drag.kind === "conversation" && drag.id !== conv.id;
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!guardDrop()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = getActiveDrag();
    if (!drag || drag.kind !== "conversation" || drag.id === conv.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    onDropConversation(conv.id, position, drag.id);
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border px-2 py-2 text-sm transition-[border-color,background-color,box-shadow] duration-200",
        isCurrent
          ? "border-primary/35 bg-primary/[0.09]"
          : "border-transparent bg-transparent hover:border-border/70 hover:bg-white/[0.035]",
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isEditing ? (
        <div className="flex items-center gap-1">
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
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setActiveDrag({
                kind: "conversation",
                id: conv.id,
                sourceFolderId: conv.folder_id,
              });
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setActiveDrag(null)}
            className="flex min-h-7 min-w-0 flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing"
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{conv.title || "Untitled"}</span>
          </button>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              onClick={() => onPin(conv.id, !pinned)}
              aria-label={pinned ? `Unpin ${conv.title}` : `Pin ${conv.title}`}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg transition-colors duration-150 hover:bg-white/5",
                pinned ? "text-primary opacity-100" : "text-muted-foreground hover:text-primary",
              )}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <FavoriteStar
              active={favorite}
              onToggle={() => onFavorite(conv.id, !favorite)}
              title={conv.title}
            />
            <button
              onClick={() => onStartEdit(conv)}
              aria-label={`Rename ${conv.title}`}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(conv.id)}
              aria-label={`Delete ${conv.title}`}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
