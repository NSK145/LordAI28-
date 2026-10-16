import React, { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Image, FileText, Globe, Mic, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { MODEL_REGISTRY } from "@/lib/ai/models";

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  busy,
  onAttachClick,
  onImagesClick,
  onDocsClick,
  onToggleSearch,
  searchActive,
  modelId,
  onModelIdChange,
  onVoiceToggle,
  micActive,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onAttachClick: () => void;
  onImagesClick: () => void;
  onDocsClick: () => void;
  onToggleSearch: () => void;
  searchActive?: boolean;
  modelId: string;
  onModelIdChange: (modelId: string) => void;
  onVoiceToggle: () => void;
  micActive?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const newHeight = Math.min(ta.scrollHeight, 400);
    ta.style.height = `${newHeight}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="chat-composer mt-4 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="chat-composer-field relative flex-1 border border-white/10 px-4 py-3">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask LORD anything, or paste a prompt…"
            rows={1}
            className="min-h-[64px] w-full resize-none bg-transparent py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={onAttachClick}
              className="chat-composer-tool inline-flex items-center gap-1.5 rounded-full px-3 py-2"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach
            </button>
            <button
              type="button"
              onClick={onImagesClick}
              className="chat-composer-tool inline-flex items-center gap-1.5 rounded-full px-3 py-2"
            >
              <Image className="h-3.5 w-3.5" /> Images
            </button>
            <button
              type="button"
              onClick={onDocsClick}
              className="chat-composer-tool inline-flex items-center gap-1.5 rounded-full px-3 py-2"
            >
              <FileText className="h-3.5 w-3.5" /> Docs
            </button>
            <button
              type="button"
              onClick={onToggleSearch}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-2",
                searchActive
                  ? "border-primary/30 bg-primary/10 text-cyan-100"
                  : "chat-composer-tool",
              )}
            >
              <Globe className="h-3.5 w-3.5" /> Search
            </button>
            <button
              type="button"
              onClick={onVoiceToggle}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-2",
                micActive
                  ? "border-primary/30 bg-primary/15 text-cyan-100 shadow-[0_0_20px_rgba(79,141,255,0.12)]"
                  : "chat-composer-tool",
              )}
              aria-pressed={!!micActive}
            >
              <Mic className="h-3.5 w-3.5" /> {micActive ? "Listening" : "Voice"}
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("tools:toggle"))}
              className="chat-composer-tool inline-flex items-center gap-1.5 rounded-full px-3 py-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 6v.01M12 12v.01M12 18v.01"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Tools
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={modelId}
              onChange={(e) => onModelIdChange(e.target.value)}
              className="model-select rounded-2xl border border-border/60 bg-slate-950/65 px-3 py-2 text-sm text-foreground"
            >
              {MODEL_REGISTRY.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="chat-send-button inline-flex h-14 w-14 items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
