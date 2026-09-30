import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { PROVIDER_CONFIG } from "@/config/lord-config";

export const Route = createFileRoute("/api/canvas/stream")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ context, request }) => {
        try {
          const authContext = context as { userId?: string } | undefined;
          const userId = authContext?.userId;
          if (!userId) {
            return Response.json(
              { error: { code: "auth", message: "Unauthorized" } },
              { status: 401 },
            );
          }

          const body = await request.json();
          const {
            prompt,
            artifactType,
            language,
            context: ctx,
          } = body as {
            prompt: string;
            artifactType: string;
            language?: string;
            context?: string;
            userId: string;
          };

          if (!prompt || !artifactType) {
            return Response.json(
              { error: { code: "validation", message: "Missing required fields" } },
              { status: 400 },
            );
          }

          const systemPrompts: Record<string, string> = {
            document:
              "You are a professional document writer. Produce clean, well-structured documents.",
            markdown: "You are a markdown expert. Produce clean, well-formatted markdown.",
            rich_text: "You are a professional writer. Produce rich, engaging text content.",
            code: "You are an expert programmer. Produce clean, well-commented code. Output only code.",
            html: "You are an HTML expert. Produce valid, semantic HTML. Output only HTML.",
            react_component:
              "You are a React expert. Produce clean React components with TypeScript and Tailwind CSS. Output only code.",
            table: "You are a data expert. Produce a clean markdown table.",
            mermaid:
              "You are a diagram expert. Produce valid Mermaid diagram syntax. Output only the diagram code.",
            flowchart:
              "You are a flowchart expert. Produce valid Mermaid flowchart syntax. Output only the diagram code.",
            mind_map:
              "You are a mind mapping expert. Produce a valid Mermaid mindmap. Output only the mindmap code.",
            note: "You are a note-taking assistant. Produce concise, well-organized notes.",
            study_guide:
              "You are an educational content expert. Produce comprehensive study guides.",
            research_report: "You are a research analyst. Produce thorough research reports.",
          };

          const systemPrompt = systemPrompts[artifactType] ?? systemPrompts.markdown;
          const userPrompt = ctx ? `${prompt}\n\n${ctx}` : prompt;

          const geminiKey = process.env.GEMINI_API_KEY;
          const openaiKey = process.env.OPENAI_API_KEY;

          let model;
          if (geminiKey) {
            const geminiModels = PROVIDER_CONFIG.gemini.models;
            const gemini = createGoogleGenerativeAI({ apiKey: geminiKey });
            model = gemini(geminiModels[0] ?? "gemini-3.5-flash");
          } else if (openaiKey) {
            const openaiModels = PROVIDER_CONFIG.openai.models;
            const openai = createOpenAI({ apiKey: openaiKey });
            model = openai(openaiModels[0] ?? "gpt-4o-mini");
          } else {
            return Response.json(
              { error: { code: "configuration", message: "No AI provider configured" } },
              { status: 503 },
            );
          }

          const result = streamText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.7,
            maxOutputTokens: 4096,
          });

          return result.toTextStreamResponse({
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Artifact-Type": artifactType,
            },
          });
        } catch (error) {
          return Response.json(
            { error: { code: "internal", message: (error as Error).message } },
            { status: 500 },
          );
        }
      },
    },
  },
});
