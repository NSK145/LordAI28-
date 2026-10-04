import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/lib/api-error";
import { runLordVision } from "@/lib/lord/llm";

const OCRRequest = z.object({
  filename: z.string().max(160),
  mimeType: z.union([
    z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
    z.literal("application/pdf"),
  ]),
  fileData: z.string().min(1).max(18 * 1024 * 1024),
});

export const Route = createFileRoute("/api/chat/ocr")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const parsed = OCRRequest.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid OCR request.", requestId);
        }
        const auth = context as { userId?: string; supabase?: SupabaseClient<Database> };
        if (!auth.userId || !auth.supabase) {
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in to use OCR.", requestId);
        }
        const match = parsed.data.fileData.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!match || match[1] !== parsed.data.mimeType) {
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid file data.", requestId);
        }
        const bytes = Buffer.from(match[2], "base64");
        if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
          return apiErrorResponse(413, "INVALID_REQUEST", "File exceeds the 12 MB limit.", requestId);
        }
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const contentSha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
        const cache = auth.supabase.from("chat_attachment_ocr_cache");
        const cached = await cache
          .select("extracted_text")
          .eq("user_id", auth.userId)
          .eq("content_sha256", contentSha256)
          .maybeSingle();
        if (!cached.error && cached.data) {
          return Response.json({ text: cached.data.extracted_text, cached: true });
        }

        try {
          const fileData = `data:${parsed.data.mimeType};base64,${match[2]}`;
          const isPdf = parsed.data.mimeType === "application/pdf";
          const { text } = await runLordVision({
            ...(isPdf
              ? { files: [{ filename: parsed.data.filename, fileData }] }
              : { images: [fileData] }),
            prompt: "Transcribe all legible text exactly. Preserve headings, line breaks, tables, and page order. Include handwriting when legible; mark uncertain words as [unclear]. Do not summarize or infer missing text.",
          });
          const extractedText = text.trim().slice(0, 24_000);
          if (extractedText) {
            await auth.supabase.from("chat_attachment_ocr_cache").upsert(
              {
                user_id: auth.userId,
                content_sha256: contentSha256,
                mime_type: parsed.data.mimeType,
                extracted_text: extractedText,
              },
              { onConflict: "user_id,content_sha256" },
            );
          }
          return Response.json({ text: extractedText, cached: false });
        } catch (error) {
          console.error("Chat OCR failed", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return apiErrorResponse(503, "AI_UPSTREAM_ERROR", "OCR could not process this file. Try again.", requestId);
        }
      },
    },
  },
});
