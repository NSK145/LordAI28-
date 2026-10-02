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
import { ModelSelector } from "./ModelSelector";
import { VoiceRecorder } from "./VoiceRecorder";
import { CalendarModal } from "@/components/lord/CalendarModal";
import { toast } from "sonner";
import type { LordMode } from "@/lib/modes";
import type { ResponseStyle } from "@/lib/ai/response-style";

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

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  mode,
  onModeChange,
  responseStyle,
  onResponseStyleChange,
  webSearch,
  onWebSearchChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (payload: ChatSubmitPayload) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  mode: LordMode;
  onModeChange: (mode: LordMode) => void;
  responseStyle: ResponseStyle;
  onResponseStyleChange: (style: ResponseStyle) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [dragging, setDragging] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const previewUrlsRef = useRef(new Set<string>());

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
    const candidates = Array.from(files)
      .filter((file) => {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is larger than the 20 MB attachment limit.`);
          return false;
        }
        return true;
      })
      .slice(0, Math.max(0, MAX_ATTACHMENTS - currentCount));
    if (candidates.length < Array.from(files).filter((file) => file.size <= MAX_FILE_BYTES).length)
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
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

  const handleSend = () => {
    if (streaming) {
      onStop();
      return;
    }
    const text = value.trim();
    if (!text || disabled) return;
    onSend({ text, attachments, tool: activeTool });
    onChange("");
    attachments.forEach((file) => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
        previewUrlsRef.current.delete(file.previewUrl);
      }
    });
    setAttachments([]);
  };

  const insertSuggestion = (s: string) => {
    onChange(s);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
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
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={cn(
          "relative flex flex-col gap-2 rounded-3xl border bg-white/[0.04] px-3 py-2.5 backdrop-blur-2xl transition-shadow md:rounded-full md:px-4 md:py-2",
          dragging
            ? "border-cyan-400/60 shadow-[0_0_0_1px_rgba(0,255,255,0.4),0_0_40px_rgba(0,255,255,0.25)]"
            : "border-[rgba(0,255,255,0.12)] shadow-[0_0_0_1px_rgba(0,255,255,0.06),0_8px_40px_rgba(0,255,255,0.10)]",
        )}
      >
        <AnimatePresence>
          {(attachments.length > 0 || activeTool) && (
            <motion.div
              key="attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-2 overflow-hidden"
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

        <div className="flex items-end gap-1.5">
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
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/40"
          />
          <span id="chat-input-hint" className="sr-only">
            Press Enter to send, Shift plus Enter for a new line, or slash to focus the message box.
          </span>

          <div className="flex items-center gap-1.5">
            <ModelSelector value={mode} onChange={onModeChange} />
            <select
              aria-label="Response style"
              value={responseStyle}
              onChange={(event) => onResponseStyleChange(event.target.value as ResponseStyle)}
              className="h-9 max-w-28 rounded-full border border-white/10 bg-slate-900 px-2 text-xs text-white/75 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <option value="balanced">Balanced</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="step-by-step">Step by step</option>
            </select>
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
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-white shadow-[0_0_22px_rgba(0,255,255,0.4)]"
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
                      : "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_0_22px_rgba(0,255,255,0.45)]",
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
