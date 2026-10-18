import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");

describe("production Supabase migrations", () => {
  it("repairs every user setting column selected by the application without dropping data", () => {
    const migration = readFileSync(
      resolve(migrationsDirectory, "20261018010000_repair_user_settings_preferences.sql"),
      "utf8",
    );

    for (const [column, type, defaultValue] of [
      ["default_mode", "text", "'balanced'"],
      ["voice_rate", "numeric", "1"],
      ["auto_speak", "boolean", "true"],
      ["notifications_enabled", "boolean", "true"],
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `ADD COLUMN IF NOT EXISTS ${column} ${type} NOT NULL DEFAULT ${defaultValue}`,
          "i",
        ),
      );
    }
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)|DISABLE ROW LEVEL SECURITY/i);
  });

  it("creates task tables with owner-scoped RLS policies", () => {
    const migration = readFileSync(
      resolve(migrationsDirectory, "20261018000000_tasks_notifications.sql"),
      "utf8",
    );

    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.tasks/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.task_notifications/i);
    expect(migration).toMatch(/ALTER TABLE public\.tasks ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/ALTER TABLE public\.task_notifications ENABLE ROW LEVEL SECURITY/i);
    expect(migration.match(/CREATE POLICY/gi)).toHaveLength(3);
    expect(migration).toMatch(
      /CREATE POLICY "Users manage their own tasks" ON public\.tasks\s+FOR ALL TO authenticated USING \(auth\.uid\(\) = user_id\)/i,
    );
    expect(migration).toMatch(
      /CREATE POLICY "Users manage their own task notifications" ON public\.task_notifications\s+FOR ALL TO authenticated USING \(auth\.uid\(\) = user_id\)/i,
    );
  });
});
