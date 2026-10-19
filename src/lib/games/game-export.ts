import JSZip from "jszip";
import { createGameHtml, type GameSpec } from "./game-runtime";

export async function createGameZip(spec: GameSpec, originalPrompt: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("index.html", createGameHtml(spec));
  zip.file(
    "game.json",
    JSON.stringify({ ...spec, engine: "LORD 2D Runner 1", originalPrompt }, null, 2),
  );
  zip.file(
    "README.md",
    `# ${spec.title}\n\nOpen index.html in a modern browser. This game uses a self-contained canvas runtime and has no external asset or network dependencies.\n\nControls: Space, Up Arrow, W, or touch the game area to jump.\n`,
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
