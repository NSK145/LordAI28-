import { useState } from "react";
import { AlertCircle, Image as ImageIcon, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface GeneratedChatImage {
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface ImageGenerationMessageData {
  status: "running" | "success" | "error";
  images?: GeneratedChatImage[];
  message?: string;
}

export function GeneratedImageMessage({ data }: { data: ImageGenerationMessageData }) {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  if (data.status === "running") {
    return (
      <div className="mt-3 flex min-h-44 w-full max-w-xl items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Creating your image…
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div
        role="status"
        className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{data.message || "Image generation failed. Please try again."}</span>
      </div>
    );
  }

  const images = (data.images ?? []).filter(
    (image) => typeof image.url === "string" && image.url.length > 0,
  );
  if (!images.length) {
    return (
      <div role="status" className="mt-3 text-sm text-muted-foreground">
        The image could not be displayed. Please try generating it again.
      </div>
    );
  }

  return (
    <div className="mt-3 w-full max-w-2xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((image, index) =>
          failedImages[index] ? (
            <div
              key={index}
              role="status"
              className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-muted-foreground"
            >
              <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" /> Image unavailable
            </div>
          ) : (
            <Dialog key={`${image.url}-${index}`}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="group block min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-left shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <img
                    src={image.url}
                    alt={image.alt || "AI generated image"}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    onError={() => setFailedImages((previous) => ({ ...previous, [index]: true }))}
                    className="h-auto max-h-[min(70vh,640px)] w-full object-contain transition-transform group-hover:scale-[1.01]"
                  />
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[95dvh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-auto border-white/10 bg-[#090b12] p-3 sm:p-5">
                <DialogTitle className="sr-only">Generated image preview</DialogTitle>
                <DialogDescription className="sr-only">
                  {image.alt || "AI generated image"}
                </DialogDescription>
                <img
                  src={image.url}
                  alt={image.alt || "AI generated image"}
                  className="mx-auto max-h-[85dvh] w-auto max-w-full rounded-xl object-contain"
                />
              </DialogContent>
            </Dialog>
          ),
        )}
      </div>
      {data.message && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {data.message}
        </p>
      )}
    </div>
  );
}
