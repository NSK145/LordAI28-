import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getTool } from "../registry";
import type { ToolContext } from "../types";
import { registerRepositoryTools, resolveRepositoryRoot } from "./repository";

const temporaryRoots: string[] = [];

function makeRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lord-repository-tool-"));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, "src", "routes", "api"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "tool-test" }));
  fs.writeFileSync(
    path.join(root, "src", "routes", "api", "users.ts"),
    "export const route = '/api/users';",
  );
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("repository analysis tool", () => {
  it("prefers a configured project root, then the current package root", () => {
    const root = makeRepository();
    expect(resolveRepositoryRoot([path.join(root, "empty")], root)).toBe(root);
    expect(resolveRepositoryRoot([root], path.dirname(root))).toBe(root);
  });

  it("exposes graph results through the existing tool interface", async () => {
    registerRepositoryTools();
    const tool = getTool("repository.analyze");
    expect(tool).toBeDefined();
    if (!tool) throw new Error("Repository tool was not registered.");
    const root = makeRepository();
    const context = {
      signal: new AbortController().signal,
      config: { allowedDirs: [root] },
    } as unknown as ToolContext;

    const result = await tool.execute({ query: "users API" }, context);

    expect(result.success).toBe(true);
    expect(result.data?.graph).toMatchObject({
      project: { name: "tool-test" },
      apiRoutes: expect.arrayContaining(["/api/users"]),
      cache: { indexedFiles: 2 },
    });
  });
});
