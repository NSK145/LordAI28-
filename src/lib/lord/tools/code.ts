import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import type * as tsTypes from "typescript";
import { safeResolve } from "../fs-safe";
import { getLordConfig } from "../config";
import { registerTool } from "../registry";
import { fail, ok } from "../permissions";
import type { ToolContext, ToolResult } from "../types";
import { getRepositoryGraph } from "./repository";

// The TypeScript compiler package is CommonJS. Importing it statically makes
// Nitro bundle it as ESM, where its use of `__filename` crashes Vercel's
// serverless runtime. Load the production dependency through Node's native CJS
// loader instead. The type query is erased during compilation.
const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");

const SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".css",
  ".go",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".py",
  ".rs",
  ".sql",
  ".ts",
  ".tsx",
  ".vue",
]);
const MAX_SOURCE_BYTES = 32_000;
const VALIDATION_SCRIPTS = new Set(["test", "build", "lint", "typecheck"]);
const VALIDATION_TIMEOUT_MS = 120_000;
const MAX_VALIDATION_OUTPUT = 24_000;
const MAX_PATCH_BLOCK_BYTES = 4_000;
const PATCHABLE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export interface CodeReviewReport {
  bugs: string[];
  securityIssues: string[];
  performanceIssues: string[];
  missingTests: string[];
  readabilityImprovements: string[];
  architectureSuggestions: string[];
  confidence: number;
  riskLevel: "low" | "medium" | "high";
}

function isWithinRealAllowedDirectory(file: string): boolean {
  const realFile = fs.realpathSync(file);
  const allowed = getLordConfig().allowedDirs.map((dir) => fs.realpathSync(dir));
  return allowed.some((dir) => realFile === dir || realFile.startsWith(dir + path.sep));
}

export function redactSourceSecrets(source: string): string {
  return source
    .replace(
      /((?:["']?)[\w-]*(?:api[_-]?key|secret|password|token|credential)[\w-]*(?:["']?\s*[:=]\s*["'`]))[^"'`]{8,}(["'`])/gi,
      "$1[REDACTED]$2",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~-]{12,}\b/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]");
}

function parseReviewReport(text: string): CodeReviewReport | null {
  const json = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? text;
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const list = (key: string): string[] =>
      Array.isArray(record[key])
        ? record[key]
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().slice(0, 400))
            .filter(Boolean)
            .slice(0, 8)
        : [];
    const confidence = Number(record.confidence);
    const riskLevel = record.riskLevel;
    if (!Number.isFinite(confidence) || !["low", "medium", "high"].includes(String(riskLevel))) {
      return null;
    }
    return {
      bugs: list("bugs"),
      securityIssues: list("securityIssues"),
      performanceIssues: list("performanceIssues"),
      missingTests: list("missingTests"),
      readabilityImprovements: list("readabilityImprovements"),
      architectureSuggestions: list("architectureSuggestions"),
      confidence: Math.max(0, Math.min(1, confidence)),
      riskLevel: riskLevel as CodeReviewReport["riskLevel"],
    };
  } catch {
    return null;
  }
}

function formatReview(report: CodeReviewReport): string {
  const sections = [
    ["Bugs", report.bugs],
    ["Security", report.securityIssues],
    ["Performance", report.performanceIssues],
    ["Missing tests", report.missingTests],
    ["Readability", report.readabilityImprovements],
    ["Architecture", report.architectureSuggestions],
  ] as const;
  const findings = sections
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`);
  return [
    findings.length > 0 ? findings.join("\n\n") : "No concrete issues were identified.",
    `Risk: ${report.riskLevel}; confidence: ${Math.round(report.confidence * 100)}%.`,
  ].join("\n\n");
}

function findValidationScript(script: string): { root: string; command: string } | null {
  for (const allowedDir of getLordConfig().allowedDirs) {
    try {
      const root = fs.realpathSync(allowedDir);
      const manifestPath = path.join(root, "package.json");
      if (fs.lstatSync(manifestPath).isSymbolicLink()) continue;
      const value: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!value || typeof value !== "object") continue;
      const manifest = value as Record<string, unknown>;
      const scripts = manifest.scripts;
      if (
        !scripts ||
        typeof scripts !== "object" ||
        typeof (scripts as Record<string, unknown>)[script] !== "string"
      ) {
        continue;
      }
      const declaredManager =
        typeof manifest.packageManager === "string" ? manifest.packageManager.split("@")[0] : "";
      const manager = ["npm", "pnpm", "yarn", "bun"].includes(declaredManager)
        ? declaredManager
        : fs.existsSync(path.join(root, "pnpm-lock.yaml"))
          ? "pnpm"
          : fs.existsSync(path.join(root, "yarn.lock"))
            ? "yarn"
            : fs.existsSync(path.join(root, "bun.lock")) ||
                fs.existsSync(path.join(root, "bun.lockb"))
              ? "bun"
              : "npm";
      return { root, command: manager };
    } catch {
      continue;
    }
  }
  return null;
}

function redactCommandOutput(value: string): string {
  return value
    .replace(/(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]{12,}\b/gi, "Bearer [REDACTED]");
}

function findPatchTarget(targetPath: string): { file: string; root: string; relativePath: string } | null {
  const file = safeResolve(targetPath);
  if (!file || !fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100_000) return null;
  if (
    path.basename(file).startsWith(".") ||
    path.basename(file).toLowerCase().startsWith(".env") ||
    !PATCHABLE_EXTENSIONS.has(path.extname(file).toLowerCase())
  ) {
    return null;
  }
  const realFile = fs.realpathSync(file);
  const realRoots = getLordConfig().allowedDirs.map((directory) => fs.realpathSync(directory));
  const root = realRoots.find((directory) => realFile.startsWith(directory + path.sep));
  if (!root) return null;
  return {
    file: realFile,
    root,
    relativePath: path.relative(root, realFile).replaceAll(path.sep, "/"),
  };
}

function readCompilerOptions(root: string): tsTypes.CompilerOptions {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists);
  if (!configPath) return { allowJs: true, jsx: ts.JsxEmit.Preserve };
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return { allowJs: true, jsx: ts.JsxEmit.Preserve };
  return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options;
}

function validatePatchSource(
  source: string,
  target: { file: string; root: string; relativePath: string },
): string | null {
  const extension = path.extname(target.file).toLowerCase();
  const scriptKind =
    extension === ".tsx"
      ? ts.ScriptKind.TSX
      : extension === ".jsx"
        ? ts.ScriptKind.JSX
        : extension === ".js"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    target.file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const parseDiagnostics = (sourceFile as tsTypes.SourceFile & {
    parseDiagnostics: readonly tsTypes.Diagnostic[];
  }).parseDiagnostics;
  if (parseDiagnostics.length > 0) {
    return `Patch introduces a syntax error: ${ts.flattenDiagnosticMessageText(
      parseDiagnostics[0].messageText,
      " ",
    )}`;
  }

  const graph = getRepositoryGraph(target.root, target.relativePath);
  const options = readCompilerOptions(target.root);
  const host = ts.createCompilerHost(options);
  const importedFiles = ts.preProcessFile(source, true, true).importedFiles;
  const candidateEdges: Array<{ from: string; to: string }> = [];
  for (const imported of importedFiles) {
    const resolved = ts.resolveModuleName(imported.fileName, target.file, options, host).resolvedModule;
    if (!resolved) return `Patch introduces an unresolved import: ${imported.fileName}`;
    if (resolved.isExternalLibraryImport) continue;
    const resolvedPath = path.resolve(resolved.resolvedFileName);
    if (!resolvedPath.startsWith(target.root + path.sep)) continue;
    candidateEdges.push({
      from: target.relativePath,
      to: path.relative(target.root, resolvedPath).replaceAll(path.sep, "/"),
    });
  }

  const exportedNames = sourceFile.statements.flatMap((statement) => {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    const name = "name" in statement ? statement.name : undefined;
    return name && typeof name === "object" && ts.isIdentifier(name as tsTypes.Node)
      ? [(name as tsTypes.Identifier).text]
      : [];
  });
  const duplicate = exportedNames.find((symbol) =>
    graph.exportedSymbols.some(
      (existing) => existing.symbol === symbol && existing.file !== target.relativePath,
    ),
  );
  if (duplicate) return `Patch introduces duplicate exported symbol: ${duplicate}`;

  const edges = [
    ...graph.importEdges.filter((edge) => edge.from !== target.relativePath),
    ...candidateEdges,
  ];
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const reachesTarget = (start: string): boolean => {
    const visited = new Set<string>();
    const pending = [start];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === target.relativePath) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(adjacency.get(current) ?? []));
    }
    return false;
  };
  if (candidateEdges.some((edge) => reachesTarget(edge.to))) {
    return "Patch introduces a circular dependency.";
  }
  return null;
}

function previewExactPatch(params: Record<string, unknown>): ToolResult {
  const targetPath = String(params.path ?? "");
  const expected = typeof params.expected === "string" ? params.expected : "";
  const replacement = typeof params.replacement === "string" ? params.replacement : "";
  if (
    expected.length === 0 ||
    expected === replacement ||
    Buffer.byteLength(expected, "utf8") > MAX_PATCH_BLOCK_BYTES ||
    Buffer.byteLength(replacement, "utf8") > MAX_PATCH_BLOCK_BYTES
  ) {
    return fail("Patch must replace one non-empty block no larger than 4 KB.", {
      recoverable: false,
      errorCode: "PATCH_SIZE_DENIED",
    });
  }
  const target = findPatchTarget(targetPath);
  if (!target) {
    return fail("Patch target must be an existing supported source file inside an allowed root.", {
      recoverable: false,
      errorCode: "PATCH_TARGET_DENIED",
    });
  }
  const content = fs.readFileSync(target.file, "utf8");
  const firstIndex = content.indexOf(expected);
  if (firstIndex < 0 || content.indexOf(expected, firstIndex + expected.length) >= 0) {
    return fail("Patch context must match exactly once; no file was changed.", {
      recoverable: false,
      errorCode: "PATCH_CONTEXT_MISMATCH",
    });
  }
  const updated = `${content.slice(0, firstIndex)}${replacement}${content.slice(firstIndex + expected.length)}`;
  const unsafeReason = validatePatchSource(updated, target);
  if (unsafeReason) return fail(unsafeReason, { recoverable: false, errorCode: "PATCH_UNSAFE" });
  return ok(`Patch preflight passed for ${target.relativePath}.`, {
    path: target.file,
    relativePath: target.relativePath,
    patchBytes: Buffer.byteLength(expected, "utf8") + Buffer.byteLength(replacement, "utf8"),
  });
}

function applyExactPatch(params: Record<string, unknown>): ToolResult {
  const preview = previewExactPatch(params);
  if (!preview.success) return preview;
  const targetPath = String(params.path ?? "");
  const expected = typeof params.expected === "string" ? params.expected : "";
  const replacement = typeof params.replacement === "string" ? params.replacement : "";
  const target = findPatchTarget(targetPath);
  if (!target) return fail("Patch target changed after preflight.", { errorCode: "PATCH_TARGET_DENIED" });
  const content = fs.readFileSync(target.file, "utf8");
  const firstIndex = content.indexOf(expected);
  if (firstIndex < 0 || content.indexOf(expected, firstIndex + expected.length) >= 0) {
    return fail("Patch context changed after preflight; no file was changed.", {
      recoverable: false,
      errorCode: "PATCH_CONTEXT_MISMATCH",
    });
  }
  const updated = `${content.slice(0, firstIndex)}${replacement}${content.slice(firstIndex + expected.length)}`;

  const temporary = path.join(
    path.dirname(target.file),
    `.${path.basename(target.file)}.${crypto.randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, updated, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, target.file);
  } catch (error) {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // Best-effort temporary-file cleanup.
    }
    return fail(`Patch could not be applied: ${error instanceof Error ? error.message : "write failed"}`, {
      recoverable: false,
      errorCode: "PATCH_WRITE_FAILED",
    });
  }
  return ok(`Applied a bounded patch to ${target.relativePath}.`, {
    path: target.file,
    relativePath: target.relativePath,
    before: expected,
    after: replacement,
  });
}

function runValidationScript(script: string, root: string, command: string, signal: AbortSignal) {
  return new Promise<ToolResult>((resolve) => {
    let output = "";
    let settled = false;
    let timedOut = false;
    const timeout: { handle?: ReturnType<typeof setTimeout> } = {};
    const args = ["run", script];
    const finish = (result: ToolResult) => {
      if (settled) return;
      settled = true;
      if (timeout.handle) clearTimeout(timeout.handle);
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > MAX_VALIDATION_OUTPUT) output = output.slice(-MAX_VALIDATION_OUTPUT);
    };
    let child: ReturnType<typeof spawn>;
    const abort = () => {
      if (process.platform !== "win32" && child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
          return;
        } catch {
          // Fall back to terminating the direct child if process groups are unavailable.
        }
      }
      child.kill("SIGTERM");
    };
    try {
      child = spawn(command, args, {
        cwd: root,
        detached: process.platform !== "win32",
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          CI: process.env.CI,
          TMPDIR: process.env.TMPDIR,
          TEMP: process.env.TEMP,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish(
        fail(error instanceof Error ? error.message : "Could not start validation.", {
          recoverable: false,
          errorCode: "VALIDATION_START_FAILED",
        }),
      );
      return;
    }

    timeout.handle = setTimeout(() => {
      timedOut = true;
      abort();
    }, VALIDATION_TIMEOUT_MS);
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) =>
      finish(
        fail(`Could not run the ${script} validation script: ${error.message}`, {
          recoverable: false,
          errorCode: "VALIDATION_START_FAILED",
        }),
      ),
    );
    child.on("close", (code) => {
      const evidence = redactCommandOutput(output).trim().slice(-MAX_VALIDATION_OUTPUT);
      const detail = evidence ? `\n${evidence}` : "";
      if (timedOut) {
        finish(
          fail(`The ${script} validation script exceeded its two-minute limit.${detail}`, {
            recoverable: false,
            errorCode: "VALIDATION_TIMEOUT",
            data: { script, exitCode: code, output: evidence },
          }),
        );
      } else if (signal.aborted) {
        finish(
          fail(`The ${script} validation script was cancelled.${detail}`, {
            recoverable: false,
            errorCode: "VALIDATION_CANCELLED",
            data: { script, exitCode: code, output: evidence },
          }),
        );
      } else if (code === 0) {
        finish(
          ok(`The ${script} validation script passed.${detail}`, {
            script,
            exitCode: code,
            output: evidence,
          }),
        );
      } else {
        finish(
          fail(`The ${script} validation script failed with exit code ${String(code)}.${detail}`, {
            recoverable: false,
            errorCode: "VALIDATION_FAILED",
            data: { script, exitCode: code, output: evidence },
          }),
        );
      }
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

export function registerCodeTools(): void {
  registerTool({
    name: "code.analyze",
    category: "agent",
    description:
      "Read and review a source file for correctness, security, and maintainability using LORD's free-model router.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [
      { name: "path", type: "string", description: "Source file path", required: true },
      { name: "focus", type: "string", description: "Review focus", required: false },
    ],
    examples: ["Review src/App.tsx for bugs and accessibility issues."],
    async execute(params, ctx: ToolContext): Promise<ToolResult> {
      const file = safeResolve(String(params.path ?? ""));
      if (!file) return fail("Path outside allowed directories.", { errorCode: "PATH_DENIED" });
      if (
        path.basename(file).startsWith(".") ||
        path.basename(file).toLowerCase().startsWith(".env")
      ) {
        return fail("Hidden and environment files are not available to code analysis.", {
          errorCode: "FILE_TYPE_DENIED",
        });
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) {
        return fail("This file type is not supported for source analysis.", {
          errorCode: "FILE_TYPE_DENIED",
        });
      }

      try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES || !isWithinRealAllowedDirectory(file)) {
          return fail("File is not a small regular source file inside an allowed directory.", {
            errorCode: "FILE_DENIED",
          });
        }
        const source = redactSourceSecrets(fs.readFileSync(file, "utf8"));
        const { text, provider } = await ctx.llm({
          system:
            "You are LORD's evidence-based code reviewer. Report only issues directly supported by the supplied source; do not infer missing behavior or invent findings. Return strict JSON only with arrays bugs, securityIssues, performanceIssues, missingTests, readabilityImprovements, architectureSuggestions; confidence from 0 to 1; riskLevel low, medium, or high. Use empty arrays when no concrete finding is supported.",
          prompt: `Review ${path.basename(file)}${params.focus ? ` with focus on ${String(params.focus).slice(0, 200)}` : ""}.\n\nSource:\n\`\`\`\n${source}\n\`\`\``,
          mode: "reasoning",
          signal: ctx.signal,
        });
        const report = parseReviewReport(text);
        if (!report) {
          return fail("Code review returned an invalid structured report.", {
            recoverable: true,
            errorCode: "INVALID_REVIEW_REPORT",
          });
        }
        return ok("Code review completed.", {
          path: file,
          review: formatReview(report),
          report,
          provider: provider ?? "unknown",
        });
      } catch {
        return fail("Code analysis could not read or review the file.", {
          recoverable: true,
          errorCode: "ANALYSIS_FAILED",
        });
      }
    },
  });

  registerTool({
    name: "code.validate",
    category: "agent",
    description:
      "Run an existing test, build, lint, or typecheck package script inside an allowed project root. Executes project code and always requires explicit approval; does not install dependencies or accept shell commands.",
    risk: "high",
    requiresConfirmation: true,
    parameters: [
      {
        name: "script",
        type: "string",
        description: "Existing package script to run",
        required: true,
        enum: [...VALIDATION_SCRIPTS],
      },
    ],
    examples: ["Run the project's test script after the implementation."],
    async execute(params, ctx: ToolContext): Promise<ToolResult> {
      const script = String(params.script ?? "");
      if (!VALIDATION_SCRIPTS.has(script)) {
        return fail("Only test, build, lint, or typecheck scripts are allowed.", {
          recoverable: false,
          errorCode: "VALIDATION_SCRIPT_DENIED",
        });
      }
      const target = findValidationScript(script);
      if (!target) {
        return fail(`No allowed project root defines the ${script} package script.`, {
          recoverable: false,
          errorCode: "VALIDATION_SCRIPT_NOT_FOUND",
        });
      }
      return runValidationScript(script, target.root, target.command, ctx.signal);
    },
  });

  registerTool({
    name: "patch.preview",
    category: "agent",
    description:
      "Check a minimal source-block patch for exact context, syntax, imports, duplicate exports, and circular dependencies without writing files.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [
      { name: "path", type: "string", description: "Existing source file", required: true },
      { name: "expected", type: "string", description: "Exact source block to replace", required: true },
      { name: "replacement", type: "string", description: "Replacement block", required: true },
    ],
    async execute(params): Promise<ToolResult> {
      return previewExactPatch(params);
    },
  });

  registerTool({
    name: "patch.apply",
    category: "agent",
    description:
      "Apply one exact, bounded source-block replacement after syntax/import/duplicate-export/cycle checks. Always requires explicit approval.",
    risk: "high",
    requiresConfirmation: true,
    parameters: [
      { name: "path", type: "string", description: "Existing source file", required: true },
      { name: "expected", type: "string", description: "Exact source block to replace", required: true },
      { name: "replacement", type: "string", description: "Replacement block", required: true },
    ],
    examples: ["Replace one function block in src/auth.ts."],
    async execute(params): Promise<ToolResult> {
      return applyExactPatch(params);
    },
  });

  registerTool({
    name: "patch.rollback",
    category: "agent",
    description:
      "Reverse a previously applied exact source-block patch. Always requires explicit approval.",
    risk: "high",
    requiresConfirmation: true,
    parameters: [
      { name: "path", type: "string", description: "Patched source file", required: true },
      { name: "expected", type: "string", description: "Exact applied block", required: true },
      { name: "replacement", type: "string", description: "Original block", required: true },
    ],
    async execute(params): Promise<ToolResult> {
      return applyExactPatch(params);
    },
  });
}
