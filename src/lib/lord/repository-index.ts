import fs from "node:fs";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".output",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);
const INDEXED_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".css",
  ".go",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".lock",
  ".lockb",
  ".md",
  ".mjs",
  ".mts",
  ".py",
  ".rs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);
const CONFIG_FILES = new Set([
  ".env.example",
  "components.json",
  "docker-compose.yml",
  "Dockerfile",
  "eslint.config.js",
  "package.json",
  "postcss.config.js",
  "tailwind.config.js",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
]);
const MAX_FILES = 12_000;
const MAX_SOURCE_BYTES = 300_000;
const MAX_IDENTIFIERS_PER_FILE = 1_200;

export interface RepositoryFileNode {
  readonly path: string;
  readonly kind: "api-route" | "route" | "component" | "test" | "config" | "source" | "document";
  readonly extension: string;
  readonly size: number;
  readonly modifiedAt: number;
  readonly imports: readonly string[];
  readonly symbols: readonly string[];
  readonly identifiers: readonly string[];
  readonly references: readonly string[];
  readonly environmentVariables: readonly string[];
}

export interface RepositoryGraph {
  readonly root: string;
  readonly generatedAt: string;
  readonly project: {
    readonly name: string | null;
    readonly description: string | null;
    readonly packageManager: string | null;
    readonly frameworks: readonly string[];
    readonly dependencies: readonly string[];
    readonly scripts: readonly string[];
    readonly testFrameworks: readonly string[];
    readonly databases: readonly string[];
  };
  readonly routes: readonly string[];
  readonly apiRoutes: readonly string[];
  readonly configurationFiles: readonly string[];
  readonly environmentVariables: readonly string[];
  readonly importEdges: readonly { from: string; to: string }[];
  readonly exportedSymbols: readonly { symbol: string; file: string }[];
  readonly componentEdges: readonly { from: string; to: string }[];
  readonly duplicateSymbols: readonly { symbol: string; files: readonly string[] }[];
  readonly possibleUnusedExports: readonly { symbol: string; file: string }[];
  readonly relevantFiles: readonly RepositoryFileNode[];
  readonly cache: {
    readonly indexedFiles: number;
    readonly updatedFiles: number;
    readonly reusedFiles: number;
    readonly removedFiles: number;
  };
}

interface CachedFile extends RepositoryFileNode {
  readonly fingerprint: string;
}

interface PackageManifest {
  name?: unknown;
  description?: unknown;
  packageManager?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  scripts?: unknown;
}

export interface RepositoryIndexer {
  analyze(root: string, query: string, signal?: AbortSignal): RepositoryGraph;
  clear(root?: string): void;
}

function isIndexable(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (/^\.env(?:\.|$)/i.test(basename) && basename !== ".env.example") return false;
  return INDEXED_EXTENSIONS.has(path.extname(basename).toLowerCase()) || CONFIG_FILES.has(basename);
}

function classifyFile(relativePath: string): RepositoryFileNode["kind"] {
  const normalized = relativePath.replaceAll(path.sep, "/");
  const basename = path.basename(relativePath).toLowerCase();
  if (/\.test\.[^.]+$|\.spec\.[^.]+$/.test(basename)) return "test";
  if (normalized.includes("/routes/api/") || normalized.includes("/api/")) return "api-route";
  if (normalized.includes("/routes/")) return "route";
  if (normalized.includes("/components/") && /\.(tsx|jsx|vue)$/.test(basename)) {
    return "component";
  }
  if (CONFIG_FILES.has(path.basename(relativePath))) return "config";
  if (/[.]md$/i.test(basename)) return "document";
  return "source";
}

function extractNode(root: string, relativePath: string, stat: fs.Stats): CachedFile {
  const absolutePath = path.join(root, relativePath);
  const basename = path.basename(relativePath);
  const safeMetadataOnly = basename === ".env.example";
  const content = stat.size <= MAX_SOURCE_BYTES ? fs.readFileSync(absolutePath, "utf8") : "";
  const imports = safeMetadataOnly ? [] : extractImports(content);
  const symbols = safeMetadataOnly ? [] : extractSymbols(content);
  const identifiers = safeMetadataOnly ? [] : extractIdentifiers(content);
  const references = safeMetadataOnly ? [] : extractReferences(content);
  const environmentVariables = safeMetadataOnly
    ? extractExampleEnvironmentNames(content)
    : extractEnvironmentNames(content);

  return {
    path: relativePath.replaceAll(path.sep, "/"),
    kind: classifyFile(relativePath),
    extension: path.extname(relativePath).toLowerCase(),
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    imports,
    symbols,
    identifiers,
    references,
    environmentVariables,
    fingerprint: `${stat.size}:${stat.mtimeMs}`,
  };
}

function extractImports(source: string): string[] {
  const imports = new Set<string>();
  const pattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) imports.add(match[1]);
  return [...imports];
}

function extractSymbols(source: string): string[] {
  const symbols = new Set<string>();
  const pattern =
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(pattern)) symbols.add(match[1]);
  return [...symbols];
}

function extractIdentifiers(source: string): string[] {
  const identifiers = new Set<string>();
  const pattern = /\b[A-Za-z_$][\w$]*\b/g;
  for (const match of source.matchAll(pattern)) {
    identifiers.add(match[0]);
    if (identifiers.size >= MAX_IDENTIFIERS_PER_FILE) break;
  }
  return [...identifiers];
}

function extractReferences(source: string): string[] {
  const declarationsRemoved = source.replace(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+[A-Za-z_$][\w$]*/g,
    " ",
  );
  return extractIdentifiers(declarationsRemoved);
}

function extractEnvironmentNames(source: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names];
}

function extractExampleEnvironmentNames(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter((name): name is string => Boolean(name));
}

function collectFiles(
  root: string,
  signal: AbortSignal | undefined,
): Array<{ relativePath: string; stat: fs.Stats }> {
  const files: Array<{ relativePath: string; stat: fs.Stats }> = [];
  const visit = (directory: string): void => {
    if (signal?.aborted || files.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (signal?.aborted || files.length >= MAX_FILES) return;
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(absolutePath);
        continue;
      }
      const relativePath = path.relative(root, absolutePath);
      if (!entry.isFile() || !isIndexable(relativePath)) continue;
      try {
        const stat = fs.statSync(absolutePath);
        if (stat.isFile()) files.push({ relativePath, stat });
      } catch {
        // Files disappearing during traversal are ignored and retried next pass.
      }
    }
  };
  visit(root);
  return files;
}

function readPackageManifest(root: string): PackageManifest {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return value && typeof value === "object" ? (value as PackageManifest) : {};
  } catch {
    return {};
  }
}

function stringKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function packageManager(
  manifest: PackageManifest,
  files: ReadonlyMap<string, CachedFile>,
): string | null {
  const declared = stringValue(manifest.packageManager);
  if (declared) return declared.split("@")[0];
  if (files.has("pnpm-lock.yaml")) return "pnpm";
  if (files.has("yarn.lock")) return "yarn";
  if (files.has("bun.lock") || files.has("bun.lockb")) return "bun";
  if (files.has("package-lock.json")) return "npm";
  return null;
}

function packageMetadata(manifest: PackageManifest, files: ReadonlyMap<string, CachedFile>) {
  const dependencies = [
    ...new Set([...stringKeys(manifest.dependencies), ...stringKeys(manifest.devDependencies)]),
  ].sort();
  const frameworks = ([
    ["React", dependencies.includes("react")],
    ["Vite", dependencies.includes("vite") || files.has("vite.config.ts")],
    ["TanStack Router", dependencies.includes("@tanstack/react-router")],
    ["Next.js", dependencies.includes("next")],
    ["Vue", dependencies.includes("vue")],
    ["Svelte", dependencies.includes("svelte")],
    ["Express", dependencies.includes("express")],
    ["Hono", dependencies.includes("hono")],
  ] as [string, boolean][])
    .filter(([, present]) => present)
    .map(([name]) => name as string);
  const testFrameworks = ([
    ["Vitest", dependencies.includes("vitest") || files.has("vitest.config.ts")],
    ["Jest", dependencies.includes("jest")],
    [
      "Playwright",
      dependencies.includes("playwright") || dependencies.includes("@playwright/test"),
    ],
    ["Cypress", dependencies.includes("cypress")],
    ["Mocha", dependencies.includes("mocha")],
  ] as [string, boolean][])
    .filter(([, present]) => present)
    .map(([name]) => name as string);
  const databases = ([
    [
      "Supabase",
      dependencies.some((item) => item.startsWith("@supabase/")) ||
        files.has("supabase/config.toml"),
    ],
    ["Prisma", dependencies.includes("prisma") || dependencies.includes("@prisma/client")],
    ["Drizzle", dependencies.some((item) => item.startsWith("drizzle-orm"))],
    ["PostgreSQL", dependencies.includes("pg")],
    ["SQLite", dependencies.includes("better-sqlite3") || dependencies.includes("sqlite3")],
  ] as [string, boolean][])
    .filter(([, present]) => present)
    .map(([name]) => name as string);
  const scripts = stringKeys(manifest.scripts).sort();
  return {
    name: stringValue(manifest.name),
    description: stringValue(manifest.description),
    packageManager: packageManager(manifest, files),
    frameworks,
    dependencies,
    scripts,
    testFrameworks,
    databases,
  };
}

function resolveImport(
  from: string,
  request: string,
  filePaths: ReadonlySet<string>,
): string | null {
  let base: string;
  if (request.startsWith("@/")) base = path.posix.join("src", request.slice(2));
  else if (request.startsWith("~/")) base = request.slice(2);
  else if (request.startsWith("."))
    base = path.posix.normalize(path.posix.join(path.posix.dirname(from), request));
  else return null;

  const candidates = [
    base,
    ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".vue", ".json", ".css"].map(
      (extension) => `${base}${extension}`,
    ),
    ...[".ts", ".tsx", ".js", ".jsx"].map((extension) =>
      path.posix.join(base, `index${extension}`),
    ),
  ];
  return candidates.find((candidate) => filePaths.has(candidate)) ?? null;
}

function relevance(node: RepositoryFileNode, query: string): number {
  const words = query.toLowerCase().match(/[a-z0-9_$-]{2,}/g) ?? [];
  const haystack = `${node.path} ${node.symbols.join(" ")} ${node.imports.join(" ")}`.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

export function createRepositoryIndexer(): RepositoryIndexer {
  const caches = new Map<string, Map<string, CachedFile>>();

  return {
    analyze(rootPath, query, signal) {
      const root = path.resolve(rootPath);
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error("Repository root is not an accessible directory.");
      }
      const previous = caches.get(root) ?? new Map<string, CachedFile>();
      const current = new Map<string, CachedFile>();
      let updatedFiles = 0;
      let reusedFiles = 0;

      const discoveredFiles = collectFiles(root, signal);
      if (signal?.aborted) throw new Error("Repository analysis was cancelled.");

      for (const { relativePath, stat } of discoveredFiles) {
        if (signal?.aborted) break;
        const key = relativePath.replaceAll(path.sep, "/");
        const fingerprint = `${stat.size}:${stat.mtimeMs}`;
        const cached = previous.get(key);
        if (cached?.fingerprint === fingerprint) {
          current.set(key, cached);
          reusedFiles++;
        } else {
          current.set(key, extractNode(root, relativePath, stat));
          updatedFiles++;
        }
      }
      if (signal?.aborted) throw new Error("Repository analysis was cancelled.");

      const removedFiles = [...previous.keys()].filter((key) => !current.has(key)).length;
      caches.set(root, current);
      const manifest = readPackageManifest(root);
      const filePaths = new Set(current.keys());
      const nodes = [...current.values()];
      const routes = nodes
        .filter((node) => node.kind === "route" || node.kind === "api-route")
        .map((node) => `/${node.path.replace(/^src\/routes\//, "").replace(/\.(tsx?|jsx?)$/, "")}`)
        .filter((route) => !route.includes("routeTree.gen") && !route.includes("__root"))
        .sort();
      const apiRoutes = routes.filter((route) => route.includes("/api/"));
      const importEdges = nodes.flatMap((node) =>
        node.imports.flatMap((request) => {
          const target = resolveImport(node.path, request, filePaths);
          return target ? [{ from: node.path, to: target }] : [];
        }),
      );
      const componentEdges = importEdges.filter(
        (edge) =>
          current.get(edge.from)?.kind === "component" || current.get(edge.to)?.kind === "component",
      );
      const symbolOwners = new Map<string, string[]>();
      const referenced = new Set<string>();
      for (const node of nodes) {
        for (const symbol of node.symbols) {
          const owners = symbolOwners.get(symbol) ?? [];
          owners.push(node.path);
          symbolOwners.set(symbol, owners);
        }
        for (const identifier of node.references) referenced.add(identifier);
      }
      const duplicateSymbols = [...symbolOwners]
        .filter(([, owners]) => owners.length > 1)
        .map(([symbol, owners]) => ({ symbol, files: owners }));
      const exportedSymbols = [...symbolOwners].flatMap(([symbol, owners]) =>
        owners.map((file) => ({ symbol, file })),
      );
      const possibleUnusedExports = nodes
        .filter((node) => !/(^|\/)(index|main|app)\.[^.]+$/i.test(node.path))
        .flatMap((node) =>
          node.symbols
            .filter((symbol) => !referenced.has(symbol))
            .map((symbol) => ({ symbol, file: node.path })),
        )
        .slice(0, 100);
      const rankedNodes = nodes
        .map((node) => ({ node, score: relevance(node, query) }))
        .sort((a, b) => b.score - a.score || a.node.path.localeCompare(b.node.path));
      const matchingNodes = rankedNodes.filter(({ score }) => score > 0).slice(0, 20);
      const relevantFiles = (
        matchingNodes.length > 0 ? matchingNodes : rankedNodes.slice(0, 12)
      ).map(({ node }) => node);
      const metadata = packageMetadata(manifest, current);

      return {
        root,
        generatedAt: new Date().toISOString(),
        project: metadata,
        routes,
        apiRoutes,
        configurationFiles: nodes
          .filter((node) => node.kind === "config")
          .map((node) => node.path)
          .sort(),
        environmentVariables: [
          ...new Set(nodes.flatMap((node) => node.environmentVariables)),
        ].sort(),
        importEdges,
        exportedSymbols,
        componentEdges,
        duplicateSymbols,
        possibleUnusedExports,
        relevantFiles,
        cache: {
          indexedFiles: current.size,
          updatedFiles,
          reusedFiles,
          removedFiles,
        },
      };
    },
    clear(rootPath) {
      if (rootPath) caches.delete(path.resolve(rootPath));
      else caches.clear();
    },
  };
}
