/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse } from "@/lib/api-error";
import { runLordVision } from "@/lib/lord/llm";

const OCRRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("process"),
    sourceId: z.string().uuid(),
    mimeType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ]),
    filename: z.string().max(160).optional(),
    fileBase64: z.string().min(1).max(12 * 1024 * 1024),
  }),
  z.object({
    action: z.literal("status"),
    jobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("list"),
    status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
]);

export const Route = createFileRoute("/api/learning/ocr")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const parsed = OCRRequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid OCR request.", requestId);

        const auth = context as { userId?: string; supabase?: { from: (table: string) => any } };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(
            401,
            "AI_AUTH_ERROR",
            "Sign in to use learning tools.",
            requestId,
          );

        const db = auth.supabase;
        const userId = auth.userId;

        try {
          if (parsed.data.action === "process") {
            const embeddedDataUrl = parsed.data.fileBase64.match(
              /^data:(image\/[\w.+-]+|application\/pdf);base64,([\s\S]+)$/,
            );
            if (embeddedDataUrl && embeddedDataUrl[1] !== parsed.data.mimeType) {
              return apiErrorResponse(400, "INVALID_REQUEST", "Image MIME type does not match.", requestId);
            }
            const base64 = embeddedDataUrl?.[2] ?? parsed.data.fileBase64;
            if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
              return apiErrorResponse(400, "INVALID_REQUEST", "Invalid image data.", requestId);
            }
            const { data: job, error } = await db
              .from("learning_ocr_jobs")
              .insert({
                user_id: userId,
                source_id: parsed.data.sourceId,
                mime_type: parsed.data.mimeType,
                storage_path: `ocr/${userId}/${crypto.randomUUID()}`,
                status: "processing",
              })
              .select()
              .single();

            if (error) throw error;
            const startedAt = Date.now();
            try {
              const dataUrl = `data:${parsed.data.mimeType};base64,${base64}`;
              const isPdf = parsed.data.mimeType === "application/pdf";
              const fileName = (parsed.data.filename ?? "document.pdf")
                .replace(/[\\/]/g, "_")
                .slice(0, 120);
              const { text } = await runLordVision({
                ...(isPdf
                  ? { files: [{ filename: fileName, fileData: dataUrl }] }
                  : { images: [dataUrl] }),
                prompt:
                  "Transcribe all legible text in this document exactly. Preserve page order, headings, tables, and line breaks when possible. Include handwritten text when legible and mark uncertain words as [unclear]. Do not summarize or infer missing text. If no text is legible, say that no legible text was found.",
              });
              const extractedText = text.trim();
              const { data: completedJob, error: updateError } = await db
                .from("learning_ocr_jobs")
                .update({
                  status: "completed",
                  extracted_text: extractedText,
                  structured_data: { method: isPdf ? "pdf-parser" : "vision-model" },
                  completed_at: new Date().toISOString(),
                  processing_time_ms: Date.now() - startedAt,
                })
                .eq("id", job.id)
                .eq("user_id", userId)
                .select()
                .single();
              if (updateError) throw updateError;

              const { error: sourceError } = await db
                .from("learning_sources")
                .update({ extracted_text: extractedText })
                .eq("id", parsed.data.sourceId)
                .eq("user_id", userId);
              if (sourceError) throw sourceError;
              return Response.json({ job: completedJob });
            } catch (processingError) {
              const reason =
                processingError instanceof Error && processingError.message === "AI_NOT_CONFIGURED"
                  ? "Vision is not configured on the server."
                  : "Image text extraction failed. Please try again.";
              await db
                .from("learning_ocr_jobs")
                .update({
                  status: "failed",
                  error_message: reason,
                  completed_at: new Date().toISOString(),
                  processing_time_ms: Date.now() - startedAt,
                })
                .eq("id", job.id)
                .eq("user_id", userId);
              return Response.json({ job: { ...job, status: "failed", error_message: reason } });
            }
          }

          if (parsed.data.action === "status") {
            const { data, error } = await db
              .from("learning_ocr_jobs")
              .select("*")
              .eq("id", parsed.data.jobId)
              .eq("user_id", userId)
              .maybeSingle();

            if (error) throw error;
            if (!data) return apiErrorResponse(404, "NOT_FOUND", "OCR job not found.", requestId);
            return Response.json({ job: data });
          }

          if (parsed.data.action === "list") {
            let query = db
              .from("learning_ocr_jobs")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(parsed.data.limit);

            if (parsed.data.status) {
              query = query.eq("status", parsed.data.status);
            }

            const { data, error } = await query;
            if (error) throw error;
            return Response.json({ jobs: data ?? [] });
          }

          return apiErrorResponse(400, "INVALID_ACTION", "Unknown action.", requestId);
        } catch (err) {
          console.error("OCR error:", err);
          return apiErrorResponse(500, "INTERNAL_ERROR", "OCR service unavailable.", requestId);
        }
      },
    },
  },
});
