import { describe, expect, it } from "vitest";
import {
  WhatIfScenarioSchema,
  analyzeScenario,
  compareScenarios,
  type WhatIfScenario,
} from "./scenarios";

const scenario: WhatIfScenario = {
  title: "Architecture options",
  objective: "Choose an implementation approach",
  constraints: ["Small team"],
  assumptions: ["Costs are rough user estimates"],
  timeHorizonMonths: 12,
  priority: "cost",
  sensitivityPercent: 10,
  options: [
    {
      id: "38be7137-8412-412e-aa59-809e801e056d",
      name: "Build",
      approach: "Build core services in-house",
      benefits: ["Control"],
      disadvantages: ["More effort"],
      dependencies: ["Available engineers"],
      unresolvedQuestions: ["Can the team maintain it?"],
      sourceReferences: [],
      upfrontCost: 2000,
      monthlyCost: 100,
      effortHours: 300,
      risk: 3,
    },
    {
      id: "2ff3b7dc-5464-44c8-9af0-6dbac78093a9",
      name: "Buy",
      approach: "Adopt a managed service",
      benefits: ["Faster start"],
      disadvantages: ["Vendor dependence"],
      dependencies: ["Vendor availability"],
      unresolvedQuestions: ["What is the contract term?"],
      sourceReferences: [],
      upfrontCost: 500,
      monthlyCost: 250,
      effortHours: 80,
      risk: 2,
    },
  ],
};

describe("What-If Lab analysis", () => {
  it("calculates deterministic costs, ranks by the chosen priority, and explains sensitivity", () => {
    const result = analyzeScenario(scenario);

    expect(result.options.map(({ totalCost }) => totalCost)).toEqual([3200, 3500]);
    expect(result.recommendedOptionId).toBe(scenario.options[0]!.id);
    expect(result.recommendationReason).toContain("lowest estimated total cost");
    expect(result.drivers[0]).toMatchObject({
      variable: "Monthly cost",
      estimatedImpact: 210,
    });
    expect(result.method).toContain("No simulation or real-world testing was performed");
  });

  it("changes recommendation when the user selects a different priority", () => {
    expect(analyzeScenario({ ...scenario, priority: "effort" }).recommendedOptionId).toBe(
      scenario.options[1]!.id,
    );
    expect(analyzeScenario({ ...scenario, priority: "risk" }).recommendedOptionId).toBe(
      scenario.options[1]!.id,
    );
  });

  it("does not recommend an option when all numeric inputs tie", () => {
    const unestimated: WhatIfScenario = {
      ...scenario,
      options: scenario.options.map((option) => ({
        ...option,
        upfrontCost: 0,
        monthlyCost: 0,
        effortHours: 0,
        risk: 3,
      })),
    };
    const result = analyzeScenario(unestimated);

    expect(result.recommendedOptionId).toBeNull();
    expect(result.recommendationReason).toContain("There is no unique leader");
  });

  it("compares multiple scenarios using the same analysis method", () => {
    const comparison = compareScenarios([
      scenario,
      { ...scenario, title: "Short horizon", timeHorizonMonths: 3 },
    ]);

    expect(comparison).toHaveLength(2);
    expect(comparison[1]!.analysis.options[0]!.totalCost).toBe(2300);
  });

  it("preserves explicit assumptions and rejects invalid numeric inputs", () => {
    expect(WhatIfScenarioSchema.parse(scenario).assumptions).toEqual(scenario.assumptions);
    expect(
      WhatIfScenarioSchema.safeParse({
        ...scenario,
        timeHorizonMonths: 0,
      }).success,
    ).toBe(false);
    expect(
      WhatIfScenarioSchema.safeParse({
        ...scenario,
        options: [{ ...scenario.options[0], risk: 6 }, scenario.options[1]],
      }).success,
    ).toBe(false);
  });
});
