import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, Image as ImageIcon, FileText, AudioLines, Video, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttachmentKind } from "./types";
import { Capacitor } from "@capacitor/core";

interface AttachmentItem {
  kind: AttachmentKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accept: string;
}

const ITEMS: AttachmentItem[] = [
  { kind: "file", label: "Upload File", icon: Paperclip, accept: "*/*" },
  { kind: "image", label: "Upload Image", icon: ImageIcon, accept: "image/*" },
  { kind: "pdf", label: "Upload PDF", icon: FileText, accept: "application/pdf" },
  { kind: "audio", label: "Upload Audio", icon: AudioLines, accept: "audio/*" },
  { kind: "video", label: "Upload Video", icon: Video, accept: "video/*" },
];

export function AttachmentMenu({
  open,
  onClose,
  onFiles,
  onCamera,
}: {
  open: boolean;
  onClose: () => void;
  onFiles: (files: FileList) => void;
  onCamera?: () => void;
}) {
  const inputs = useRef<Partial<Record<AttachmentKind, HTMLInputElement | null>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
    e.target.value = "";
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute bottom-full left-0 mb-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,20,28,0.92)] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          {Capacitor.isNativePlatform() && onCamera && (
            <button
              type="button"
              onClick={onCamera}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-cyan-300">
                <Camera className="h-4 w-4" />
              </span>
              <span className="font-medium">Take a photo</span>
            </button>
          )}
          {ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.kind}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <input
                  ref={(el) => {
                    inputs.current[item.kind] = el;
                  }}
                  type="file"
                  accept={item.accept}
                  multiple={item.kind === "image" || item.kind === "pdf"}
                  className="hidden"
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => inputs.current[item.kind]?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
