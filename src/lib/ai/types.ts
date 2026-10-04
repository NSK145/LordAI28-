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
  files?: readonly ChatFileInput[];
}

export interface ChatFileInput {
  filename: string;
  fileData: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: ReadonlyArray<{
    role: ChatRole;
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
          | { type: "file"; file: { filename: string; file_data: string } }
        >;
  }>;
  stream: true;
  max_tokens: number;
  plugins?: Array<{ id: "file-parser"; pdf: { engine: "cloudflare-ai" } }>;
}

export interface ChatResponse {
  text: string;
}

export interface ModelInfo extends AIModel {
  description?: string;
}
