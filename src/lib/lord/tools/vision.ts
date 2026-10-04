// Vision analyzes screenshots and camera frames supplied by an authenticated
// client. Camera capture stays on the device; this server tool only receives a
// still image when the user asks for analysis.

import { registerTool } from "../registry";
import { ok, fail, notConfigured } from "../permissions";
import { runLordVision } from "../llm";
import type { ToolContext, ToolResult } from "../types";

function isDataUrl(v: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(v.trim());
}

export function registerVisionTools(): void {
  registerTool({
    name: "vision.analyze",
    category: "vision",
    description:
      "Analyze up to four screenshots or photos together and answer a question using a vision model.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [
      { name: "image", type: "string", description: "Optional single image as a base64 data URL", required: false },
      {
        name: "images",
        type: "string[]",
        description: "Up to four screenshots or photos for comparison and joint analysis",
        required: false,
      },
      {
        name: "question",
        type: "string",
        description: "What to analyze / ask about the image",
        required: false,
      },
    ],
    examples: [
      "What is on my screen?",
      "Read this error.",
      "Compare these screenshots and find what changed.",
    ],
    async execute(params, ctx: ToolContext): Promise<ToolResult> {
      const images = [
        ...(Array.isArray(params.images)
          ? params.images.filter((value): value is string => typeof value === "string")
          : []),
        ...(typeof params.image === "string" ? [params.image] : []),
      ];
      const question = String(params.question ?? "Describe what you see in detail.");
      if (images.length === 0 || images.length > 4 || images.some((image) => !isDataUrl(image))) {
        return fail("Provide one to four valid base64 image data URLs for analysis.", {
          errorCode: "BAD_IMAGE",
        });
      }
      if (images.reduce((total, image) => total + image.length, 0) > 12 * 1024 * 1024) {
        return fail("Combined image size is too large. Choose images totaling under about 9 MB.", {
          errorCode: "IMAGE_TOO_LARGE",
        });
      }
      try {
        ctx.log({ level: "info", source: "vision", message: "Analyzing image with vision model." });
        const { text, provider, modelId } = await runLordVision({ prompt: question, images });
        return ok("Vision analysis complete.", { analysis: text, provider, modelId });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "AI_NOT_CONFIGURED") {
          return notConfigured("Vision", "No AI provider with vision support is configured.");
        }
        return fail(`Vision analysis failed: ${msg}`, { errorCode: "VISION_ERROR" });
      }
    },
  });

  registerTool({
    name: "vision.webcam_status",
    category: "vision",
    description: "Explain that camera state is managed locally in the Vision panel.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [],
    examples: ["Is the camera on?"],
    async execute(_params, ctx: ToolContext): Promise<ToolResult> {
      ctx.log({
        level: "info",
        source: "vision",
        message: "Camera state is managed locally by the browser.",
      });
      return ok("Camera permission and stream state are managed locally by the browser.", {
        clientManaged: true,
      });
    },
  });

  registerTool({
    name: "vision.webcam_toggle",
    category: "vision",
    description:
      "Direct the user to the Vision panel to manage local camera access; the server cannot start a camera.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [
      { name: "on", type: "boolean", description: "true = ON, false = OFF", required: true },
    ],
    examples: ["Turn the camera on.", "Camera off."],
    async execute(params, ctx: ToolContext): Promise<ToolResult> {
      void params;
      ctx.log({
        level: "warn",
        source: "vision",
        message: "A server request cannot start or stop the browser camera.",
      });
      return fail("Use the Vision panel to start or stop the camera on this device.", {
        errorCode: "CLIENT_CAMERA_CONTROL",
      });
    },
  });
}
