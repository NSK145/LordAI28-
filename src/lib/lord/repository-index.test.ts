import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRepositoryIndexer } from "./repository-index";

const temporaryRoots: string[] = [];

function makeRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lord-repository-index-"));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, "src", "routes", "api"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "ignored"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "sample-app",
      description: "Sample dashboard",
      packageManager: "pnpm@9.0.0",
      dependencies: { react: "^19.0.0", "@supabase/supabase-js": "^2.0.0" },
      devDependencies: {
        vitest: "^4.0.0",
        jest: "^30.0.0",
        "@playwright/test": "^1.0.0",
        cypress: "^15.0.0",
        mocha: "^11.0.0",
      },
      scripts: { test: "vitest run" },
    }),
  );
  fs.writeFileSync(path.join(root, ".env"), "PRIVATE_TOKEN=do-not-index-this-value\n");
  fs.writeFileSync(path.join(root, ".env.example"), "PUBLIC_API_URL=\n");
  fs.writeFileSync(
    path.join(root, "src", "lib", "auth.ts"),
    "export function loginUser() { return true; }\n",
  );
  fs.writeFileSync(
    path.join(root, "src", "components", "Login.tsx"),
    'import { loginUser } from "../lib/auth";\nexport function Login() { return loginUser(); }\n',
  );
  fs.writeFileSync(
    path.join(root, "src", "routes", "api", "auth.ts"),
    'export const route = "/api/auth";\nconst endpoint = process.env.AUTH_ENDPOINT;\n',
  );
  fs.writeFileSync(
    path.join(root, "node_modules", "ignored", "index.js"),
    "export const ignored = true;",
  );
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("repository index", () => {
  it("builds project, route, API, environment-name, and component-import metadata without reading secrets", () => {
    const root = makeRepository();
    const graph = createRepositoryIndexer().analyze(root, "login authentication");
    const serialized = JSON.stringify(graph);

    expect(graph.project).toMatchObject({
      name: "sample-app",
      packageManager: "pnpm",
      frameworks: ["React"],
      testFrameworks: ["Vitest", "Jest", "Playwright", "Cypress", "Mocha"],
      databases: ["Supabase"],
    });
    expect(graph.apiRoutes).toContain("/api/auth");
    expect(graph.environmentVariables).toEqual(
      expect.arrayContaining(["AUTH_ENDPOINT", "PUBLIC_API_URL"]),
    );
    expect(graph.componentEdges).toContainEqual({
      from: "src/components/Login.tsx",
      to: "src/lib/auth.ts",
    });
    expect(graph.possibleUnusedExports).toContainEqual({
      symbol: "route",
      file: "src/routes/api/auth.ts",
    });
    expect(graph.relevantFiles.map((file) => file.path)).toContain("src/components/Login.tsx");
    expect(serialized).not.toContain("do-not-index-this-value");
    expect(graph.cache.indexedFiles).toBe(5);
  });

  it("reuses unchanged files and incrementally tracks changed and deleted paths", () => {
    const root = makeRepository();
    const indexer = createRepositoryIndexer();
    const first = indexer.analyze(root, "login");
    const second = indexer.analyze(root, "login");

    expect(first.cache.updatedFiles).toBe(5);
    expect(second.cache.updatedFiles).toBe(0);
    expect(second.cache.reusedFiles).toBe(5);

    const changed = path.join(root, "src", "lib", "auth.ts");
    fs.writeFileSync(changed, "export function loginUser() { return false; }\n");
    fs.utimesSync(changed, new Date(), new Date(Date.now() + 2_000));
    fs.rmSync(path.join(root, "src", "routes", "api", "auth.ts"));
    const third = indexer.analyze(root, "login");

    expect(third.cache.updatedFiles).toBe(1);
    expect(third.cache.removedFiles).toBe(1);
    expect(third.apiRoutes).toEqual([]);
  });

  it("clears cached roots on request", () => {
    const root = makeRepository();
    const indexer = createRepositoryIndexer();
    indexer.analyze(root, "login");
    indexer.clear(root);

    expect(indexer.analyze(root, "login").cache.updatedFiles).toBe(5);
  });

  it("does not replace cached data when a scan is cancelled", () => {
    const root = makeRepository();
    const indexer = createRepositoryIndexer();
    indexer.analyze(root, "login");
    const controller = new AbortController();
    controller.abort();

    expect(() => indexer.analyze(root, "login", controller.signal)).toThrow("cancelled");
    expect(indexer.analyze(root, "login").cache.updatedFiles).toBe(0);
  });
});
