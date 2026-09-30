import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isMemoryEnabled, isSensitive } from "@/lib/memory/types";
import type { AgentExecuteResult } from "./types";

function buildProjectOutcome(result: AgentExecuteResult): string {
  const projectChanges = result.steps.filter(
    (step) =>
      step.status === "done" &&
      ["files.write_text", "files.rename", "files.move", "files.organize_apply"].includes(
        step.tool,
      ),
  );
  if (
    result.status !== "completed" ||
    projectChanges.length === 0 ||
    result.steps.some((step) => step.status !== "done")
  ) {
    return "";
  }

  const actions = projectChanges
    .map((step) => step.intent.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (actions.length === 0) return "";
  return `Project work completed: ${result.intent.trim().slice(0, 160)}. Completed actions: ${actions.join("; ")}.`;
}

export async function persistProjectOutcome(
  client: SupabaseClient<Database>,
  userId: string,
  result: AgentExecuteResult,
): Promise<boolean> {
  const content = buildProjectOutcome(result).slice(0, 700);
  if (!content || isSensitive(content)) return false;

  try {
    const { data: settings, error: settingsError } = await client
      .from("memory_settings")
      .select("memory_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (settingsError || !isMemoryEnabled(settings)) return false;

    const { data: existing, error: lookupError } = await client
      .from("memories")
      .select("id")
      .eq("user_id", userId)
      .eq("content", content)
      .maybeSingle();
    if (lookupError || existing) return false;

    const { error: insertError } = await client.from("memories").insert({
      user_id: userId,
      content,
      category: "project",
      confidence: 0.8,
      importance: 0.65,
      source: "auto",
      pinned: false,
      archived: false,
      expires_at: null,
      tags: ["agent", "project-outcome"],
    });
    return !insertError;
  } catch {
    return false;
  }
}
