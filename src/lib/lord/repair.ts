import type { ToolResult } from "./types";

export type FailureCategory =
  | "compilation-error"
  | "type-error"
  | "lint-error"
  | "test-failure"
  | "runtime-exception"
  | "timeout"
  | "dependency-missing"
  | "permission-failure"
  | "network-failure"
  | "tool-failure"
  | "unknown";

export interface FailureAnalysis {
  category: FailureCategory;
  confidence: number;
  rootCause: string;
  likelyFiles: string[];
  suggestedStrategy: string;
}

export interface PatchCandidate {
  path: string;
  expected: string;
  replacement: string;
  rationale: string;
  correctness: number;
  confidence: number;
  testLikelihood: number;
}

export interface ScoredPatchCandidate {
  candidate: PatchCandidate;
  score: number;
  metrics: {
    correctness: number;
    minimality: number;
    confidence: number;
    blastRadius: number;
    testLikelihood: number;
  };
}

export interface RepairProposal {
  analysis: FailureAnalysis;
  candidates: PatchCandidate[];
}

export interface FailureMemoryEntry {
  failure: FailureAnalysis;
  patch: PatchCandidate;
  outcome:
    | "rejected"
    | "applied-validation-pending"
    | "applied-validation-failed"
    | "applied-validation-passed";
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function extractPaths(text: string): string[] {
  const paths = new Set<string>();
  for (const match of text.matchAll(/(?:[A-Za-z]:)?(?:[./\w-]+\/)?[\w.-]+\.(?:tsx?|jsx?|mjs|cjs|json)/g)) {
    paths.add(match[0].replaceAll("\\", "/").slice(0, 300));
    if (paths.size === 20) break;
  }
  return [...paths];
}

export function classifyFailure(
  result: Pick<ToolResult, "message" | "errorCode" | "data">,
): FailureAnalysis {
  const message = result.message.slice(0, 12_000);
  const dataOutput = result.data?.output;
  const detail = typeof dataOutput === "string" ? dataOutput.slice(0, 12_000) : "";
  const text = `${result.errorCode ?? ""} ${message} ${detail}`.toLowerCase();
  let category: FailureCategory = "unknown";
  let confidence = 0.42;

  if (includesAny(text, ["timeout", "timed out", "etimedout"])) {
    category = "timeout";
    confidence = 0.97;
  } else if (includesAny(text, ["permission", "eacces", "eperm", "path_denied", "denied"])) {
    category = "permission-failure";
    confidence = 0.93;
  } else if (
    includesAny(text, ["enotfound", "cannot find module", "module not found", "dependency missing"])
  ) {
    category = "dependency-missing";
    confidence = 0.9;
  } else if (includesAny(text, ["network", "econnreset", "eai_again", "rate limit", "fetch failed"])) {
    category = "network-failure";
    confidence = 0.87;
  } else if (includesAny(text, ["typescript", "ts####", "type error", "type '" , "is not assignable"])) {
    category = "type-error";
    confidence = 0.88;
  } else if (includesAny(text, ["eslint", "lint", "prettier"])) {
    category = "lint-error";
    confidence = 0.85;
  } else if (includesAny(text, ["vitest", "jest", "playwright", "cypress", "test failed", "assertion" ])) {
    category = "test-failure";
    confidence = 0.84;
  } else if (includesAny(text, ["syntaxerror", "parse error", "unexpected token", "compilation error", "build failed"])) {
    category = "compilation-error";
    confidence = 0.82;
  } else if (includesAny(text, ["runtime", "uncaught", "exception", "referenceerror", "typeerror"])) {
    category = "runtime-exception";
    confidence = 0.75;
  } else if (result.errorCode || message) {
    category = "tool-failure";
    confidence = 0.55;
  }

  const strategies: Record<FailureCategory, string> = {
    "compilation-error": "Limit the repair to the reported syntax/build diagnostics.",
    "type-error": "Change only the affected declarations, types, or call sites.",
    "lint-error": "Apply the smallest lint or formatting correction in the reported files.",
    "test-failure": "Inspect the failing test and its directly imported implementation only.",
    "runtime-exception": "Trace the reported runtime frame to its owning module and handle that case.",
    timeout: "Reduce the validation scope or address the specific hanging operation; do not repeat unchanged.",
    "dependency-missing": "Check existing dependencies and imports; do not install packages automatically.",
    "permission-failure": "Stop and request the required permission; do not retry the blocked action.",
    "network-failure": "Retry only the network/tool operation when it is safe; do not change source code.",
    "tool-failure": "Inspect the tool result and retry only if the tool marks the failure recoverable.",
    unknown: "Use targeted repository context and independent reflection before proposing any patch.",
  };
  const rootCause = message.replace(/\s+/g, " ").trim().slice(0, 1_000) || "No failure detail was returned.";

  return {
    category,
    confidence,
    rootCause,
    likelyFiles: extractPaths(`${message}\n${detail}`),
    suggestedStrategy: strategies[category],
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function scorePatchCandidate(
  candidate: PatchCandidate,
  relevantFiles: readonly string[],
  dependencyHotspots: ReadonlyMap<string, number> = new Map(),
): ScoredPatchCandidate {
  const editSize = candidate.expected.length + candidate.replacement.length;
  const minimality = clamp(1 - editSize / 8_000);
  const fileIsRelevant = relevantFiles.includes(candidate.path);
  const blastRadius = fileIsRelevant
    ? 1 / (1 + Math.max(0, dependencyHotspots.get(candidate.path) ?? 0) / 10)
    : 0.2;
  const metrics = {
    correctness: clamp(candidate.correctness),
    minimality,
    confidence: clamp(candidate.confidence),
    blastRadius,
    testLikelihood: clamp(candidate.testLikelihood),
  };
  const score =
    metrics.correctness * 0.3 +
    metrics.minimality * 0.2 +
    metrics.confidence * 0.2 +
    metrics.blastRadius * 0.15 +
    metrics.testLikelihood * 0.15;
  return { candidate, score, metrics };
}

export function rankPatchCandidates(
  candidates: readonly PatchCandidate[],
  relevantFiles: readonly string[],
  previouslyFailed: readonly FailureMemoryEntry[] = [],
  dependencyHotspots: ReadonlyMap<string, number> = new Map(),
): ScoredPatchCandidate[] {
  const failedStrategies = new Set(
    previouslyFailed
      .filter((entry) =>
        entry.outcome === "rejected" || entry.outcome === "applied-validation-failed",
      )
      .map((entry) => `${entry.patch.path}\0${entry.patch.expected}\0${entry.patch.replacement}`),
  );
  return candidates
    .filter(
      (candidate) =>
        candidate.path.length > 0 &&
        candidate.expected.length > 0 &&
        candidate.expected !== candidate.replacement &&
        candidate.expected.length <= 4_000 &&
        candidate.replacement.length <= 4_000 &&
        !failedStrategies.has(`${candidate.path}\0${candidate.expected}\0${candidate.replacement}`),
    )
    .map((candidate) => scorePatchCandidate(candidate, relevantFiles, dependencyHotspots))
    .sort((left, right) => right.score - left.score);
}

export function parseRepairProposal(
  value: unknown,
  allowedFiles: readonly string[],
  fallbackAnalysis: FailureAnalysis,
): RepairProposal {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { analysis: fallbackAnalysis, candidates: [] };
  }
  const record = value as Record<string, unknown>;
  const rawAnalysis = record.analysis;
  let analysis = fallbackAnalysis;
  if (rawAnalysis && typeof rawAnalysis === "object" && !Array.isArray(rawAnalysis)) {
    const raw = rawAnalysis as Record<string, unknown>;
    const allowedCategories: FailureCategory[] = [
      "compilation-error",
      "type-error",
      "lint-error",
      "test-failure",
      "runtime-exception",
      "timeout",
      "dependency-missing",
      "permission-failure",
      "network-failure",
      "tool-failure",
      "unknown",
    ];
    if (
      allowedCategories.includes(raw.category as FailureCategory) &&
      typeof raw.rootCause === "string" &&
      typeof raw.suggestedStrategy === "string"
    ) {
      const likelyFiles = Array.isArray(raw.likelyFiles)
        ? raw.likelyFiles.filter(
            (file): file is string => typeof file === "string" && allowedFiles.includes(file),
          )
        : [];
      analysis = {
        category: raw.category as FailureCategory,
        confidence: clamp(Number(raw.confidence)),
        rootCause: raw.rootCause.slice(0, 1_000),
        likelyFiles: [...new Set(likelyFiles)].slice(0, 20),
        suggestedStrategy: raw.suggestedStrategy.slice(0, 500),
      };
    }
  }

  if (!Array.isArray(record.candidates)) return { analysis, candidates: [] };
  const candidates = record.candidates.flatMap((item): PatchCandidate[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      !allowedFiles.includes(candidate.path) ||
      typeof candidate.expected !== "string" ||
      typeof candidate.replacement !== "string" ||
      typeof candidate.rationale !== "string"
    ) {
      return [];
    }
    return [
      {
        path: candidate.path,
        expected: candidate.expected.slice(0, 4_001),
        replacement: candidate.replacement.slice(0, 4_001),
        rationale: candidate.rationale.slice(0, 500),
        correctness: clamp(Number(candidate.correctness)),
        confidence: clamp(Number(candidate.confidence)),
        testLikelihood: clamp(Number(candidate.testLikelihood)),
      },
    ];
  });
  return { analysis, candidates: candidates.slice(0, 3) };
}

export function selectValidationScripts(
  files: readonly string[],
  availableScripts: readonly string[],
): string[] {
  const available = new Set(availableScripts);
  const extensions = files.map((file) => file.toLowerCase());
  const selected = new Set<string>();
  const isTypeScript = extensions.some((file) => /\.tsx?$/.test(file));
  const touchesUi = extensions.some((file) => /\.(tsx|jsx|vue)$/.test(file));
  const touchesTests = extensions.some((file) => /\.(test|spec)\.[^.]+$/.test(file));
  const touchesBackend = extensions.some((file) => /(^|\/)(api|server|database|db)(\/|\.)/.test(file));

  if (isTypeScript && available.has("typecheck")) selected.add("typecheck");
  if ((touchesTests || touchesUi || touchesBackend) && available.has("test")) selected.add("test");
  if ((touchesUi || touchesBackend) && available.has("lint")) selected.add("lint");
  if (selected.size === 0 && available.has("test")) selected.add("test");
  if (selected.size === 0 && available.has("build")) selected.add("build");
  return [...selected];
}