import { motion } from "framer-motion";
import { File as FileIcon, FileText, Image as ImageIcon, AudioLines, Video, X } from "lucide-react";
import type { Attachment, AttachmentKind } from "./types";

function iconFor(kind: AttachmentKind) {
  switch (kind) {
    case "image":
      return ImageIcon;
    case "audio":
      return AudioLines;
    case "video":
      return Video;
    case "pdf":
      return FileText;
    default:
      return FileIcon;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const Icon = iconFor(attachment.kind);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative flex min-w-0 max-w-full items-center gap-2 rounded-2xl border border-cyan-400/20 bg-white/5 py-1.5 pl-2 pr-8 backdrop-blur sm:w-auto sm:rounded-full"
    >
      {attachment.previewUrl ? (
        <img src={attachment.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/10">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/90 sm:max-w-[180px]">{attachment.name}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-white/45">{formatSize(attachment.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.name}`}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
