export const RESPONSE_STYLES = ["balanced", "concise", "detailed", "step-by-step"] as const;
export type ResponseStyle = (typeof RESPONSE_STYLES)[number];

export const RESPONSE_STYLE_INSTRUCTIONS: Record<ResponseStyle, string> = {
  balanced: "Use a clear, balanced level of detail suited to the request.",
  concise: "Be concise: give the direct answer and only the essential supporting detail.",
  detailed:
    "Explain the answer thoroughly with context, examples, and practical caveats where useful.",
  "step-by-step":
    "Explain multi-step work in a numbered sequence. For simple requests, answer directly without padding.",
};
