import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canAccessWhatIfScenario } from "./permissions";

describe("What-If scenario permissions", () => {
  it("allows the owner and denies other authenticated users", () => {
    expect(canAccessWhatIfScenario("user-a", "user-a")).toBe(true);
    expect(canAccessWhatIfScenario("user-a", "user-b")).toBe(false);
  });

  it("requires row-level owner policies for saved scenario reads and writes", () => {
    const migration = readFileSync(
      new URL(
        "../../../supabase/migrations/20261024020000_lord_what_if_scenarios.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/for select\s+using\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
    expect(migration).toMatch(/for insert\s+with check\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  });
});
