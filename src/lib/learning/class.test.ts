import { describe, expect, it } from "vitest";
import type { LearningConcept } from "./types";
import { filterConceptsForClass } from "./class";

const concept = (overrides: Partial<LearningConcept>): LearningConcept => ({
  id: "generic",
  standard_code: "",
  framework: "CBSE",
  subject: "Science",
  grade_band: "high",
  title: "Concept",
  description: "",
  prerequisites: [],
  ...overrides,
});

describe("filterConceptsForClass", () => {
  const concepts = [
    concept({ id: "cbse-8-math-1", standard_code: "CBSE-8-MATH-1", grade_band: "middle" }),
    concept({ id: "cbse-10-math-1", standard_code: "CBSE-10-MATH-1" }),
    concept({ id: "ngss-hs", standard_code: "NGSS.HS" }),
    concept({ id: "custom", is_custom: true, grade_band: "elementary" }),
  ];

  it("matches explicit class concepts, grade-band concepts, and custom concepts", () => {
    expect(filterConceptsForClass(concepts, "10").map(({ id }) => id)).toEqual([
      "cbse-10-math-1",
      "ngss-hs",
      "custom",
    ]);
  });

  it("keeps the whole catalog when no class is selected", () => {
    expect(filterConceptsForClass(concepts, null)).toEqual(concepts);
  });
});
