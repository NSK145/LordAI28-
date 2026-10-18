import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  singleResponse: { data: null as unknown, error: null as unknown },
  maybeResponse: { data: null as unknown, error: null as unknown },
  directResponse: { data: null as unknown, error: null as unknown },
  upsertResponse: { error: null as unknown },
  isNative: false,
  scheduleResponse: { scheduled: true },
  query: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.hoisted(() => {
  const query = mockState.query;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.delete = vi.fn(() => query);
  query.upsert = vi.fn(async () => mockState.upsertResponse);
  query.single = vi.fn(async () => mockState.singleResponse);
  query.maybeSingle = vi.fn(async () => mockState.maybeResponse);
  query.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(mockState.directResponse).then(resolve),
  );
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => mockState.query) },
}));
vi.mock("@/lib/mobile-native", () => ({
  isNativeMobile: () => mockState.isNative,
  mobileNotifications: {
    cancel: vi.fn(),
    scheduleReminder: vi.fn(async () => mockState.scheduleResponse),
  },
}));

import {
  createDueNotifications,
  createTask,
  deleteTask,
  fetchUserTasks,
  markTaskNotificationRead,
  saveTask,
  scheduleTaskReminder,
  type TaskRecord,
} from "./task-store";

const task: TaskRecord = {
  id: "task-1",
  user_id: "user-1",
  title: "Review release",
  done: false,
  priority: "high",
  due_at: null,
  reminder_id: null,
  created_at: "2026-10-18T00:00:00.000Z",
  updated_at: "2026-10-18T00:00:00.000Z",
};

describe("task persistence workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.singleResponse = { data: { ...task }, error: null };
    mockState.maybeResponse = { data: { reminder_id: null, due_at: null }, error: null };
    mockState.directResponse = { data: null, error: null };
    mockState.upsertResponse = { error: null };
    mockState.isNative = false;
  });

  it("creates a task through the authenticated backend and returns its saved row", async () => {
    const saved = await createTask(
      "user-1",
      { title: "  Review release  ", priority: "high", due_at: null },
      false,
    );
    expect(mockState.query.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      title: "Review release",
      priority: "high",
      due_at: null,
    });
    expect(saved.id).toBe("task-1");
  });

  it("retrieves only the selected user's tasks in newest-first order", async () => {
    mockState.directResponse = { data: [{ ...task }], error: null };
    const rows = await fetchUserTasks("user-1");
    expect(rows).toEqual([{ ...task }]);
    expect(mockState.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockState.query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("persists completion and removes any native reminder id", async () => {
    mockState.singleResponse = { data: { ...task, done: true, reminder_id: null }, error: null };
    await saveTask(task.id, { done: true }, false);
    expect(mockState.query.update).toHaveBeenCalledWith(
      expect.objectContaining({ done: true, reminder_id: null }),
    );
  });

  it("creates one due notification per task and marks notifications read", async () => {
    mockState.maybeResponse = { data: { notifications_enabled: true }, error: null };
    const dueTask = { ...task, due_at: new Date(Date.now() - 1000).toISOString() };
    await createDueNotifications("user-1", [dueTask]);
    expect(mockState.query.upsert).toHaveBeenCalledWith(
      [
        {
          user_id: "user-1",
          task_id: dueTask.id,
          title: "Task due",
          body: dueTask.title,
          due_at: dueTask.due_at,
        },
      ],
      { onConflict: "task_id,due_at", ignoreDuplicates: true },
    );
    await markTaskNotificationRead("notice-1", true);
    expect(mockState.query.update).toHaveBeenLastCalledWith({ read_at: expect.any(String) });
  });

  it("does not create due notifications when the user's preference is disabled", async () => {
    mockState.maybeResponse = { data: { notifications_enabled: false }, error: null };
    const dueTask = { ...task, due_at: new Date(Date.now() - 1000).toISOString() };
    await createDueNotifications("user-1", [dueTask]);
    expect(mockState.query.upsert).not.toHaveBeenCalled();
  });

  it("uses the enabled default when the user has no settings row", async () => {
    mockState.maybeResponse = { data: null, error: null };
    const dueTask = { ...task, due_at: new Date(Date.now() - 1000).toISOString() };
    await createDueNotifications("user-1", [dueTask]);
    expect(mockState.query.upsert).toHaveBeenCalled();
  });

  it("surfaces a missing notification preference column instead of writing notifications", async () => {
    const schemaError = {
      code: "42703",
      message: "column user_settings.notifications_enabled does not exist",
    };
    mockState.maybeResponse = { data: null, error: schemaError };
    const dueTask = { ...task, due_at: new Date(Date.now() - 1000).toISOString() };

    await expect(createDueNotifications("user-1", [dueTask])).rejects.toMatchObject(schemaError);
    expect(mockState.query.upsert).not.toHaveBeenCalled();
  });

  it("persists a scheduled reminder against the task owner", async () => {
    mockState.isNative = true;
    mockState.maybeResponse = { data: { id: task.id }, error: null };
    await scheduleTaskReminder({ ...task, due_at: new Date(Date.now() + 60_000).toISOString() });
    expect(mockState.query.update).toHaveBeenCalledWith({ reminder_id: expect.any(Number) });
    expect(mockState.query.eq).toHaveBeenCalledWith("id", task.id);
    expect(mockState.query.eq).toHaveBeenCalledWith("user_id", task.user_id);
  });

  it("deletes a task after backend confirmation", async () => {
    await deleteTask(task);
    expect(mockState.query.delete).toHaveBeenCalled();
    expect(mockState.query.eq).toHaveBeenCalledWith("id", task.id);
  });
});
