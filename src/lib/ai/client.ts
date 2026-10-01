import { errorFromStatus, normalizeOpenRouterError, OpenRouterError } from "./errors";
import type { ChatMessage, OpenRouterRequest } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterClient {
  constructor(private readonly apiKey: string) {}

  async *streamChat(
    messages: readonly ChatMessage[],
    model: string,
    signal?: AbortSignal,
    maxTokens = 1400,
  ): AsyncGenerator<string> {
    const body: OpenRouterRequest = {
      model,
      messages: messages.map(({ role, content, images }) => ({
        role,
        content: images?.length
          ? [
              { type: "text" as const, text: content },
              ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
            ]
          : content,
      })),
      stream: true,
      max_tokens: maxTokens,
    };
    const requestBody = JSON.stringify(body);
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lordai.app",
      "X-Title": "LordAI",
    };

    console.info("OpenRouter request started", {
      url: OPENROUTER_URL,
      model,
      stream: body.stream,
      messageCount: messages.length,
      inputCharacters: messages.reduce((total, message) => total + message.content.length, 0),
    });

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: requestBody,
        signal,
      });
    } catch (error) {
      throw normalizeOpenRouterError(error);
    }

    if (!response.body) {
      logResponse(response);
      throw new OpenRouterError("network");
    }

    try {
      if (!response.ok) {
        const details = await readResponseBody(response.body);
        throw errorFromStatus(response.status, details);
      }

      yield* this.readStream(response.body);
    } catch (error) {
      throw normalizeOpenRouterError(error);
    } finally {
      logResponse(response);
    }
  }

  private async *readStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const token = parseSseLine(line);
          if (token === null) return;
          if (token) yield token;
        }
        if (done) return;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

async function readResponseBody(body: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(body).text().catch(() => "");
}

function logResponse(response: Response): void {
  console.info("OpenRouter response received", {
    status: response.status,
    statusText: response.statusText,
  });
}

function parseSseLine(line: string): string | null | undefined {
  const data = line.trim();
  if (!data.startsWith("data:")) return undefined;
  const payload = data.slice(5).trim();
  if (payload === "[DONE]") return null;

  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
      error?: { code?: number; message?: string };
    };
    if (parsed.error) {
      throw errorFromStatus(
        typeof parsed.error.code === "number" ? parsed.error.code : 503,
        parsed.error,
      );
    }
    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    throw new OpenRouterError("unavailable", undefined, error);
  }
}
