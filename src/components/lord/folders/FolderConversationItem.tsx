import { memo, useState } from "react";
import { MessageSquare, Pencil, Trash2, Pin, Check, X, MoreHorizontal, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationWithFolder } from "@/lib/folders";
import { setActiveDrag, getActiveDrag } from "./dnd";
import { FavoriteStar } from "../FavoriteStar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
            {pinned && (
              <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Pinned" />
            )}
          </button>
          <div className="hidden shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
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
        </div>
      )}
    </div>
  );
});
