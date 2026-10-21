import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(root, "public/game-export");
mkdirSync(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(root, "src/lib/games/engines/3d/runtime.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: resolve(outputDirectory, "three-runtime.js"),
});
