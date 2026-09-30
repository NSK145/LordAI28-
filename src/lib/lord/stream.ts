import type { AgentExecuteResult, AgentProgress, AgentProgressCallback } from "./types";

export type AgentStreamEvent =
  | { type: "progress"; progress: AgentProgress }
  | { type: "result"; result: AgentExecuteResult }
  | { type: "error"; message: string };

export function createAgentProgressResponse(
  execute: (onProgress: AgentProgressCallback, signal: AbortSignal) => Promise<AgentExecuteResult>,
  requestSignal?: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const executionController = new AbortController();
  let closed = false;
  const abortFromRequest = () => executionController.abort();
  if (requestSignal?.aborted) abortFromRequest();
  else requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      void execute((progress) => send({ type: "progress", progress }), executionController.signal)
        .then((result) => send({ type: "result", result }))
        .catch(() => send({ type: "error", message: "Agent execution failed." }))
        .finally(() => {
          requestSignal?.removeEventListener("abort", abortFromRequest);
          if (closed) return;
          closed = true;
          controller.close();
        });
    },
    cancel() {
      closed = true;
      executionController.abort();
      requestSignal?.removeEventListener("abort", abortFromRequest);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
