import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip,
  Sparkles,
  ArrowUp,
  Square,
  Calendar as CalendarIcon,
  Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment, AttachmentKind, ChatSubmitPayload, ToolId } from "./types";
import { FileChip } from "./FileChip";
import { ActiveToolBadge } from "./ActiveToolBadge";
import { SuggestionChips } from "./SuggestionChips";
import { AttachmentMenu } from "./AttachmentMenu";
import { ToolsMenu } from "./ToolsMenu";
import { VoiceRecorder } from "./VoiceRecorder";
import { CalendarModal } from "@/components/lord/CalendarModal";
import { toast } from "sonner";
import { mobileCamera, mobileHaptics } from "@/lib/mobile-native";

type OpenMenu = "attach" | "tools" | null;

function kindOf(file: File): AttachmentKind {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf") return "pdf";
  return "file";
}

const MAX_HEIGHT = 160;
const MIN_HEIGHT = 44;
const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_MULTIMODAL_ATTACHMENTS = 4;
const MAX_MULTIMODAL_BYTES = 12 * 1024 * 1024;

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  webSearch,
  onWebSearchChange,
  processingLabel,
  resetKey = 0,
  resetAttachmentIds = [],
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (payload: ChatSubmitPayload) => void | boolean | Promise<void | boolean>;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  processingLabel?: string | null;
  resetKey?: number;
  resetAttachmentIds?: readonly string[];
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [dragging, setDragging] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const previewUrlsRef = useRef(new Set<string>());
  const lastResetKeyRef = useRef(resetKey);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    const ids = new Set(resetAttachmentIds);
    attachmentsRef.current.forEach((attachment) => {
      if (ids.has(attachment.id) && attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
        previewUrlsRef.current.delete(attachment.previewUrl);
      }
    });
    setAttachments((current) => current.filter((attachment) => !ids.has(attachment.id)));
  }, [resetKey, resetAttachmentIds]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        )
      ) {
        e.preventDefault();
        taRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setOpenMenu((menu) => (menu === "attach" ? null : "attach"));
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const currentCount = attachments.length;
    let visualCount = attachments.filter((attachment) =>
      ["image", "pdf"].includes(attachment.kind),
    ).length;
    let visualBytes = attachments
      .filter((attachment) => ["image", "pdf"].includes(attachment.kind))
      .reduce((total, attachment) => total + attachment.size, 0);
    const candidates: File[] = [];
    for (const file of Array.from(files)) {
      if (currentCount + candidates.length >= MAX_ATTACHMENTS) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than the 20 MB attachment limit.`);
        continue;
      }
      const kind = kindOf(file);
      if (kind === "image" || kind === "pdf") {
        if (visualCount >= MAX_MULTIMODAL_ATTACHMENTS) {
          toast.error("You can attach up to four images or PDFs per message.");
          continue;
        }
        if (visualBytes + file.size > MAX_MULTIMODAL_BYTES) {
          toast.error("Images and PDFs must total 12 MB or less per message.");
          continue;
        }
        visualCount += 1;
        visualBytes += file.size;
      }
      candidates.push(file);
    }
    const next: Attachment[] = candidates.map((file) => {
      const kind = kindOf(file);
      const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
      if (previewUrl) previewUrlsRef.current.add(previewUrl);
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        kind,
        file,
        previewUrl,
      };
    });
    setAttachments((prev) => [...prev, ...next]);
  };

  const takePhoto = async () => {
    try {
      const file = await mobileCamera.takePhoto();
      addFiles([file]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open the camera.";
      if (!message.toLowerCase().includes("cancel")) toast.error(message);
    } finally {
      setOpenMenu(null);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
        previewUrlsRef.current.delete(found.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const handleSend = async () => {
    if (streaming) {
      onStop();
      return;
    }
    const text = value.trim();
    if (!text || disabled) return;
    void mobileHaptics.light();
    const sentValue = value;
    const sentAttachments = attachments;
    const sentIds = new Set(sentAttachments.map((attachment) => attachment.id));
    const accepted = await onSend({ text, attachments: sentAttachments, tool: activeTool });
    if (accepted === false) return;
    if (taRef.current?.value === sentValue) onChange("");
    sentAttachments.forEach((file) => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
        previewUrlsRef.current.delete(file.previewUrl);
      }
    });
    setAttachments((current) => current.filter((attachment) => !sentIds.has(attachment.id)));
  };

  const insertSuggestion = (s: string) => {
    onChange(s);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    const itemFiles = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && (item.type.startsWith("image/") || item.type === "application/pdf"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const pastedFiles = files.length ? files : itemFiles;
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  };

  const handleDrop = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleVoiceResult = (text: string) => {
    if (!text) return;
    const next = value.trim()
      ? `${value.trimEnd()}${value.endsWith(" ") ? "" : " "} ${text}`
      : text;
    onChange(next);
  };

  const showSuggestions = !streaming && !value.trim() && attachments.length === 0 && !activeTool;
  const hasImage = attachments.some((attachment) => attachment.kind === "image");
  const hasPdf = attachments.some((attachment) => attachment.kind === "pdf");
  const wantsOcr = /\b(ocr|extract(?:ing)? text|read(?:ing)? the text|transcrib(?:e|ing))\b/i.test(value);
  const multimodalBadge = wantsOcr && (hasImage || hasPdf)
    ? "OCR"
    : hasPdf
      ? "PDF"
      : hasImage
        ? "Vision"
        : null;

  return (
    <div ref={rootRef} className="w-full">
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            key="suggestions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <SuggestionChips onPick={insertSuggestion} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={handleDrop}
        animate={{ scale: dragging ? 1.01 : 1 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className={cn(
          "relative flex flex-col gap-2 rounded-3xl border bg-slate-950/75 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-200 md:px-4 md:py-2",
          attachments.length > 0 || activeTool ? "md:rounded-2xl" : "md:rounded-[26px]",
          dragging
            ? "border-primary/60 shadow-[0_0_0_2px_rgba(66,133,244,0.16),0_12px_32px_rgba(0,0,0,0.24)]"
            : "border-white/10 hover:border-white/15 focus-within:border-primary/40 focus-within:shadow-[0_0_0_2px_rgba(66,133,244,0.08),0_12px_32px_rgba(0,0,0,0.24)]",
        )}
      >
        <AnimatePresence>
          {(attachments.length > 0 || activeTool) && (
            <motion.div
              key="attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden"
            >
              {activeTool && (
                <ActiveToolBadge tool={activeTool} onClear={() => setActiveTool(null)} />
              )}
              {attachments.map((a) => (
                <FileChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {(processingLabel || multimodalBadge) && (
          <div className="flex min-h-5 items-center gap-2 px-1" aria-live="polite">
            {processingLabel && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-primary/90">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                {processingLabel}
              </span>
            )}
            {multimodalBadge && (
              <span
                className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-blue-100"
                aria-label={`${multimodalBadge} model selected from attached content`}
                title={`${multimodalBadge} model selected from attached content`}
              >
                {multimodalBadge}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-1.5">
          <div className="relative flex items-center gap-1">
            <motion.button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "attach" ? null : "attach"))}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Attach files"
              aria-expanded={openMenu === "attach"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                openMenu === "attach"
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-white/60 hover:bg-white/5 hover:text-cyan-200",
              )}
            >
              <Paperclip className="h-4 w-4 rotate-45" />
            </motion.button>
            <AttachmentMenu
              open={openMenu === "attach"}
              onClose={() => setOpenMenu(null)}
              onFiles={addFiles}
              onCamera={() => void takePhoto()}
            />

            <motion.button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "tools" ? null : "tools"))}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Open tools"
              aria-expanded={openMenu === "tools"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                openMenu === "tools" || activeTool
                  ? "bg-purple-500/15 text-purple-200"
                  : "text-white/60 hover:bg-white/5 hover:text-purple-200",
              )}
            >
              <Sparkles className="h-4 w-4" />
            </motion.button>
            <ToolsMenu
              open={openMenu === "tools"}
              onClose={() => setOpenMenu(null)}
              activeTool={activeTool}
              onSelect={(id) => setActiveTool((prev) => (prev === id ? null : id))}
            />
          </div>

          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            placeholder="Ask LordAI anything..."
            aria-label="Message LORD AI"
            aria-describedby="chat-input-hint"
            className="max-h-40 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/90 max-[480px]:order-first max-[480px]:basis-full"
          />
          <span id="chat-input-hint" className="sr-only">
            Press Enter to send, Shift plus Enter for a new line, Ctrl or Command plus Enter to send, or Ctrl or Command plus Shift plus U to open attachments. Press slash to focus the message box.
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={webSearch}
              aria-label={webSearch ? "Turn off web sources" : "Search the web and cite sources"}
              title={webSearch ? "Web sources on" : "Search web and cite sources"}
              onClick={() => onWebSearchChange(!webSearch)}
              className={cn(
                "flex h-9 items-center gap-1 rounded-full border px-2 text-xs transition focus-visible:ring-2 focus-visible:ring-cyan-400",
                webSearch
                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 text-white/60 hover:text-white",
              )}
            >
              <Globe2 className="h-3.5 w-3.5" /> Sources
            </button>
            <motion.button
              type="button"
              onClick={() => setCalendarOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Open calendar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-cyan-200"
            >
              <CalendarIcon className="h-4 w-4" />
            </motion.button>
            <VoiceRecorder onResult={handleVoiceResult} disabled={streaming || disabled} />
            <AnimatePresence mode="wait" initial={false}>
              {streaming ? (
                <motion.button
                  key="stop"
                  type="button"
                  onClick={onStop}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  aria-label="Stop generating"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
                >
                  <Square className="h-4 w-4 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  type="submit"
                  disabled={!value.trim() || disabled}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: !value.trim() || disabled ? 1 : 1.06 }}
                  whileTap={{ scale: !value.trim() || disabled ? 1 : 0.94 }}
                  aria-label="Send message"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition",
                    !value.trim() || disabled
                      ? "cursor-not-allowed bg-white/10 text-white/40"
                      : "bg-primary text-primary-foreground shadow-md hover:bg-primary/90",
                  )}
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.form>

      <CalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}
