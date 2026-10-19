import { describe, expect, it } from "vitest";
import { createGameHtml, validateGameSpec, type GameSpec } from "./game-runtime";
import JSZip from "jszip";
import { createGameZip } from "./game-export";

const spec: GameSpec = {
  schemaVersion: 1,
  title: "City Sprint",
  description: "Jump through the city.",
  genre: "runner",
  theme: "neon city",
  difficulty: "normal",
  objective: "Avoid obstacles and collect orbs.",
  controls: ["Space", "Touch"],
  seed: 17,
};

describe("constrained game runtime", () => {
  it("accepts a valid supported specification and rejects code-shaped genres", () => {
    expect(validateGameSpec(spec)).toBe(true);
    expect(validateGameSpec({ ...spec, genre: "<script>alert(1)</script>" })).toBe(false);
  });

  it("produces a self-contained playable canvas game without external sources", () => {
    const html = createGameHtml(spec);
    expect(html).toContain('<canvas id="game">');
    expect(html).toContain("function jump()");
    expect(html).toContain("function end()");
    expect(html).toContain("player.y+35>o.y");
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toContain("<script>alert");
  });

  it("exports a valid ZIP containing the playable runtime and project metadata", async () => {
    const blob = await createGameZip(spec, "neon city runner");
    const archive = await JSZip.loadAsync(blob);
    const html = await archive.file("index.html")?.async("string");
    const metadata = await archive.file("game.json")?.async("string");
    expect(html).toContain("function jump()");
    expect(JSON.parse(metadata ?? "{}")).toMatchObject({
      title: spec.title,
      originalPrompt: "neon city runner",
    });
    expect(await archive.file("README.md")?.async("string")).toContain(
      "no external asset or network dependencies",
    );
  });
});
