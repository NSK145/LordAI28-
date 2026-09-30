import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgentProgress } from "@/lib/lord/types";

async function lordFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Request failed (${res.status})`);
  }
  return json;
}

export interface StatusResponse {
  success: boolean;
  connections: Record<string, string>;
  activity: Array<{ id: string; ts: number; level: string; message: string; source?: string }>;
  tools: Array<{ name: string; category: string; risk: string }>;
  configured: { ai: boolean; esp32: boolean; screen: boolean };
}

export function useStatus() {
  return useQuery({
    queryKey: ["lord", "status"],
    queryFn: () => lordFetch<StatusResponse>("/api/lord/status"),
    refetchInterval: 4000,
  });
}

export function useToolCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { tool: string; params?: Record<string, unknown> }) =>
      lordFetch<{
        success: boolean;
        message?: string;
        data?: Record<string, unknown>;
        error?: string;
      }>("/api/lord/tool", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lord", "status"] });
      qc.invalidateQueries({ queryKey: ["lord", "activity"] });
    },
  });
}

export interface AgentResult {
  status: "completed" | "needs-confirmation" | "error";
  planId?: string;
  intent: string;
  steps: Array<{
    id: string;
    tool: string;
    params: Record<string, unknown>;
    risk: string;
    intent: string;
    status: string;
    result?: { success: boolean; message: string };
  }>;
  summary?: string;
  error?: string;
}

async function lordAgentFetch(
  vars: { command?: string; planId?: string; approvedStepIds?: string[] | "all" },
  onProgress?: (progress: AgentProgress) => void,
): Promise<AgentResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch("/api/lord/agent/execute", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(vars),
  });

  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(json.error?.message ?? `Request failed (${response.status})`);
    return json as AgentResult;
  }

  if (!response.body) throw new Error("Agent progress stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AgentResult | null = null;
  const readBlock = (block: string) => {
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim()) as
        | { type: "progress"; progress: AgentProgress }
        | { type: "result"; result: AgentResult }
        | { type: "error"; message: string };
      if (event.type === "progress") onProgress?.(event.progress);
      else if (event.type === "result") finalResult = event.result;
      else throw new Error(event.message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) readBlock(block);
    if (done) break;
  }
  if (buffer.trim()) readBlock(buffer);
  if (!finalResult) throw new Error("Agent stream ended before returning a result.");
  return finalResult;
}

export function useAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      command?: string;
      planId?: string;
      approvedStepIds?: string[] | "all";
      onProgress?: (progress: AgentProgress) => void;
    }) => {
      const { onProgress, ...request } = vars;
      return lordAgentFetch(request, onProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lord", "status"] });
      qc.invalidateQueries({ queryKey: ["lord", "activity"] });
    },
  });
}

export function useStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { resume?: boolean }) =>
      lordFetch<{ success: boolean; message?: string }>("/api/lord/agent/stop", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lord", "status"] });
      qc.invalidateQueries({ queryKey: ["lord", "activity"] });
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["lord", "activity"],
    queryFn: () =>
      lordFetch<{ success: boolean; activity: StatusResponse["activity"] }>("/api/lord/activity"),
    refetchInterval: 4000,
  });
}
