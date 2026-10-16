"use client";

import { MarkdownRenderer } from "./markdown/MarkdownRenderer";

export function RichMessage({ text }: { text: string }) {
  return (
    <MarkdownRenderer className="markdown-content prose prose-invert max-w-none">
      {text}
    </MarkdownRenderer>
  );
}
