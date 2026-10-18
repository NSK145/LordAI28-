import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mobileNotifications, isNativeMobile } from "@/lib/mobile-native";
import { emitDashboardEvent } from "@/lib/dashboard-service";

export type TaskPriority = "low" | "med" | "high";
export interface TaskRecord {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  due_at: string | null;
  reminder_id: number | null;
  created_at: string;
  updated_at: string;
}
export interface TaskNotification {
  id: string;
  task_id: string;
  title: string;
  body: string;
  due_at: string;
  read_at: string | null;
  created_at: string;
}

function reminderId(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 2_000_000_000) + 1;
}

export async function scheduleTaskReminder(task: TaskRecord, enabled = true) {
  if (!task.due_at || task.done || !enabled) return;
  const at = new Date(task.due_at);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) return;
  if (isNativeMobile()) {
    const id = task.reminder_id ?? reminderId(task.id);
    try {
      const result = await mobileNotifications.scheduleReminder(
        "Task due",
        task.title,
        at,
        "/tasks",
        id,
      );
      if (result.scheduled && task.reminder_id !== id) {
        const { data, error } = await supabase
          .from("tasks")
          .update({ reminder_id: id })
          .eq("id", task.id)
          .eq("user_id", task.user_id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Task reminder could not be saved for this task.");
      }
    } catch (error) {
      console.warn("Could not schedule task reminder", error);
    }
  } else if (typeof window !== "undefined" && "Notification" in window) {
    // Browsers do not provide reliable background scheduling; the app creates an in-app
    // reminder when it next opens and is active.
  }
}

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTasks(await fetchUserTasks(userId));
      setError(null);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { tasks, loading, error, refresh };
}

export async function fetchUserTasks(userId: string): Promise<TaskRecord[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(
  userId: string,
  input: { title: string; priority: TaskPriority; due_at: string | null },
  notificationsEnabled: boolean,
) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      priority: input.priority,
      due_at: input.due_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  await scheduleTaskReminder(data, notificationsEnabled);
  emitDashboardEvent("tasks");
  return data;
}

export async function saveTask(
  id: string,
  patch: Partial<Pick<TaskRecord, "title" | "done" | "priority" | "due_at">>,
  notificationsEnabled: boolean,
) {
  const { data: previous } = await supabase
    .from("tasks")
    .select("reminder_id,due_at")
    .eq("id", id)
    .maybeSingle();
  if (previous?.reminder_id && isNativeMobile() && (patch.done || patch.due_at !== undefined)) {
    await mobileNotifications.cancel(previous.reminder_id).catch(() => undefined);
  }
  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
      ...(patch.done ? { reminder_id: null } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (!patch.done) {
    await scheduleTaskReminder(data, notificationsEnabled);
  }
  emitDashboardEvent("tasks");
  return data;
}

export async function deleteTask(task: TaskRecord) {
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) throw error;
  if (task.reminder_id && isNativeMobile())
    await mobileNotifications.cancel(task.reminder_id).catch(() => undefined);
  emitDashboardEvent("tasks");
}

export async function getTaskNotifications(userId: string) {
  const { data, error } = await supabase
    .from("task_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function createDueNotifications(userId: string, tasks: TaskRecord[]) {
  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("notifications_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (settings && !settings.notifications_enabled) return;
  const due = tasks.filter(
    (task) => !task.done && task.due_at && new Date(task.due_at).getTime() <= Date.now(),
  );
  if (!due.length) return;
  const { error } = await supabase.from("task_notifications").upsert(
    due.map((task) => ({
      user_id: userId,
      task_id: task.id,
      title: "Task due",
      body: task.title,
      due_at: task.due_at!,
    })),
    { onConflict: "task_id,due_at", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function markTaskNotificationRead(id: string, read: boolean) {
  const { error } = await supabase
    .from("task_notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}
