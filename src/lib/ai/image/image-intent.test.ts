import { describe, expect, it } from "vitest";
import { detectImageIntent, isInternalImageToolPayload } from "./image-intent";

describe("image intent detection", () => {
  it.each([
    "Generate a futuristic city",
    "Make this image look like anime",
    "Remove the background",
    "Upscale this image",
    "Create a logo",
    "Generate four variations",
    "A karate kid in the rain doing a handstand, make an aesthetic image",
    "Create an aesthetic wallpaper",
    "Draw a futuristic city",
    "Generate an image of a cat",
    "Generate a futuristic city",
  ])("recognizes %s", (prompt) => {
    expect(detectImageIntent(prompt)).toBe(true);
  });

  it.each([
    "Explain how to generate a futuristic city",
    "What is background removal?",
    "Describe anime image composition",
    "Can you make AI images?",
  ])("keeps explanatory requests in chat: %s", (prompt) => {
    expect(detectImageIntent(prompt)).toBe(false);
  });
});

describe("internal image tool protocol guard", () => {
  it("recognizes private tool markup", () => {
    expect(isInternalImageToolPayload('<dots_function_call><invoke name="image_generation">')).toBe(
      true,
    );
  });

  it("keeps ordinary assistant text", () => {
    expect(isInternalImageToolPayload("Here is a summary of image generation.")).toBe(false);
  });
});
