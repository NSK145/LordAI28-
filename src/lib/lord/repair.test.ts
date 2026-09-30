import { describe, expect, it } from "vitest";
import {
  classifyFailure,
  parseRepairProposal,
  rankPatchCandidates,
  scorePatchCandidate,
  selectValidationScripts,
  type FailureMemoryEntry,
  type PatchCandidate,
} from "./repair";

describe("repair analysis", () => {
  it("classifies common validation and tool failures with targeted strategies", () => {
    expect(classifyFailure({ message: "TS2322: Type 'string' is not assignable to number in src/app.ts" }))
      .toMatchObject({
        category: "type-error",
        confidence: expect.any(Number),
        likelyFiles: ["src/app.ts"],
        suggestedStrategy: expect.stringContaining("types"),
      });
    expect(classifyFailure({ message: "Vitest assertion failed in src/app.test.ts" }).category).toBe(
      "test-failure",
    );
    expect(classifyFailure({ message: "Script exceeded timeout", errorCode: "VALIDATION_TIMEOUT" }).category)
      .toBe("timeout");
    expect(classifyFailure({ message: "Permission denied", errorCode: "PATH_DENIED" }).category).toBe(
      "permission-failure",
    );
    expect(classifyFailure({ message: "Unknown failure", errorCode: "UNEXPECTED" }).category).toBe(
      "tool-failure",
    );
  });

  it("scores minimal relevant patches above broader, unrelated changes", () => {
    const focused: PatchCandidate = {
      path: "src/auth.ts",
      expected: "return token;",
      replacement: "return token ?? '';",
      rationale: "Handle the missing token case.",
      correctness: 0.9,
      confidence: 0.9,
      testLikelihood: 0.9,
    };
    const broad: PatchCandidate = {
      ...focused,
      path: "src/other.ts",
      expected: "x".repeat(2_000),
      replacement: "y".repeat(2_000),
      correctness: 0.7,
      confidence: 0.7,
      testLikelihood: 0.5,
    };

    expect(scorePatchCandidate(focused, ["src/auth.ts"]).score).toBeGreaterThan(
      scorePatchCandidate(broad, ["src/auth.ts"]).score,
    );
    expect(rankPatchCandidates([broad, focused], ["src/auth.ts"])[0].candidate).toEqual(focused);
    const sharedUtility = { ...focused, path: "src/shared.ts" };
    expect(
      scorePatchCandidate(sharedUtility, ["src/shared.ts"], new Map([["src/shared.ts", 20]])).metrics
        .blastRadius,
    ).toBeLessThan(scorePatchCandidate(focused, ["src/auth.ts"]).metrics.blastRadius);
  });

  it("parses at most three candidate patches and drops paths outside targeted context", () => {
    const fallback = classifyFailure({ message: "Type mismatch in src/auth.ts" });
    const candidate = {
      path: "src/auth.ts",
      expected: "return null;",
      replacement: "return undefined;",
      rationale: "Match the nullable return contract.",
      correctness: 0.8,
      confidence: 0.9,
      testLikelihood: 0.7,
    };

    const proposal = parseRepairProposal(
      {
        analysis: { ...fallback, rootCause: "Incompatible return value." },
        candidates: [
          candidate,
          { ...candidate, path: "../outside.ts" },
          { ...candidate, expected: "a" },
          { ...candidate, expected: "b" },
          { ...candidate, expected: "c" },
        ],
      },
      ["src/auth.ts"],
      fallback,
    );

    expect(proposal.analysis.rootCause).toBe("Incompatible return value.");
    expect(proposal.candidates).toHaveLength(3);
    expect(proposal.candidates.every((item) => item.path === "src/auth.ts")).toBe(true);
  });

  it("excludes patches that previously failed validation", () => {
    const candidate: PatchCandidate = {
      path: "src/auth.ts",
      expected: "return null;",
      replacement: "return undefined;",
      rationale: "First attempt.",
      correctness: 0.9,
      confidence: 0.9,
      testLikelihood: 0.8,
    };
    const memory: FailureMemoryEntry = {
      failure: classifyFailure({ message: "Test failed in src/auth.test.ts" }),
      patch: candidate,
      outcome: "applied-validation-failed",
    };

    expect(rankPatchCandidates([candidate], [candidate.path], [memory])).toEqual([]);
  });

  it("selects only validation scripts relevant to changed files", () => {
    expect(
      selectValidationScripts(["src/lib/auth.ts"], ["test", "typecheck", "build", "lint"]),
    ).toEqual(["typecheck"]);
    expect(
      selectValidationScripts(
        ["src/routes/api/login.ts", "src/routes/api/login.test.ts"],
        ["test", "typecheck", "build", "lint"],
      ),
    ).toEqual(["typecheck", "test", "lint"]);
    expect(selectValidationScripts(["README.md"], ["test", "build"])).toEqual(["test"]);
    expect(selectValidationScripts(["README.md"], ["build"])).toEqual(["build"]);
  });
});