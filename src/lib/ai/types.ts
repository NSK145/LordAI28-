export interface AIModel {
  id: string;
  label: string;
  provider: string;
  supportsStreaming: boolean;
  supports: readonly ["chat"];
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  images?: readonly string[];
}

export interface OpenRouterRequest {
  model: string;
  messages: ReadonlyArray<{
    role: ChatRole;
    content:
      | string
      | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  }>;
  stream: true;
  max_tokens: number;
}

export interface ChatResponse {
  text: string;
}

export interface ModelInfo extends AIModel {
  description?: string;
}
