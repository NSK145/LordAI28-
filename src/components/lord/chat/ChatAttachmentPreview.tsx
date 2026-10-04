import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface ChatAttachmentReference {
  filename: string;
  mediaType: string;
  size: number;
  storagePath?: string;
  url?: string;
}

export function ChatAttachmentPreview({ attachment }: { attachment: ChatAttachmentReference }) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(attachment.url ?? "");
  const [visible, setVisible] = useState(Boolean(attachment.url));
  const [loadError, setLoadError] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isImage = attachment.mediaType.startsWith("image/");
  const isPdf = attachment.mediaType === "application/pdf";

  useEffect(() => {
    const target = buttonRef.current;
    if (visible || !target || !attachment.storagePath) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [attachment.storagePath, visible]);

  useEffect(() => {
    if (resolvedUrl || !visible || !attachment.storagePath) return;
    let active = true;
    void supabase.storage
      .from("chat-attachments")
      .createSignedUrl(attachment.storagePath, 300)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) setLoadError("Preview is unavailable. You can still refer to the attached file.");
        else setResolvedUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [attachment.storagePath, resolvedUrl, visible]);

  const Icon = isImage ? ImageIcon : FileText;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setVisible(true); setOpen(true); }}
        className="group flex max-w-full items-center gap-2 rounded-xl border border-white/15 bg-black/10 p-2 text-left transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label={`Preview ${attachment.filename}`}
      >
        {isImage && resolvedUrl ? (
          <img src={resolvedUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : isPdf && resolvedUrl ? (
          <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
            <iframe
              src={`${resolvedUrl}#page=1&view=FitH&toolbar=0`}
              title={`First page preview: ${attachment.filename}`}
              loading="lazy"
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none h-40 w-64 origin-top-left scale-[0.25]"
            />
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/15">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block max-w-[min(52vw,18rem)] truncate text-xs font-medium">{attachment.filename}</span>
          <span className="text-[10px] opacity-70">{isPdf ? "PDF · " : "Image · "}{(attachment.size / 1024).toFixed(0)} KB · Preview</span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90dvh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col overflow-hidden p-3 sm:p-5">
          <DialogTitle className="truncate pr-8 text-sm">{attachment.filename}</DialogTitle>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-black/20">
            {!resolvedUrl && !loadError && <LoaderCircle className="h-6 w-6 animate-spin text-cyan-200" aria-label="Loading preview" />}
            {loadError && <p role="status" className="px-4 text-center text-sm text-muted-foreground">{loadError}</p>}
            {resolvedUrl && isImage && <img src={resolvedUrl} alt={attachment.filename} className="max-h-full max-w-full object-contain" />}
            {resolvedUrl && isPdf && <iframe src={resolvedUrl} title={`PDF preview: ${attachment.filename}`} className="h-full min-h-0 w-full rounded-lg bg-white" />}
            {!isImage && !isPdf && <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
