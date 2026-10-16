import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  fetchSystem,
  fetchTasks,
  fetchCalendar,
  fetchMemory,
  fetchConversations,
  fetchResearch,
  fetchAI,
  fetchNotifications,
  onDashboardEvent,
  type DashboardEventKind,
  type DashboardData,
  type DashboardSystem,
  type DashboardTasks,
  type DashboardCalendar,
  type DashboardMemory,
  type DashboardConversations,
  type DashboardResearch,
  type DashboardAI,
  type DashboardNotifications,
} from "@/lib/dashboard-service";

const POLL_MS = 20_000;

const EMPTY_SYSTEM: DashboardSystem = {
  engine: "initializing",
  latencyMs: null,
  uptimeSeconds: 0,
  uptimeLabel: "0m",
  startTime: Date.now(),
  healthScore: 100,
  healthStatus: "healthy",
};
const EMPTY_TASKS: DashboardTasks = { pending: 0, completed: 0, overdue: 0, dueToday: 0, total: 0 };
const EMPTY_CALENDAR: DashboardCalendar = {
  todays: [],
  tomorrow: [],
  upcoming: [],
  nextReminder: null,
  daysRemaining: null,
  hasEvents: false,
};
const EMPTY_MEMORY: DashboardMemory = {
  stored: 0,
  important: 0,
  recentlyLearned: 0,
  lastUpdated: null,
  usagePct: 0,
  source: "local",
};
const EMPTY_CONVERSATIONS: DashboardConversations = {
  items: [],
  total: 0,
  pinnedCount: 0,
  archivedCount: 0,
  lastActivity: null,
  requiresAuth: false,
};
const EMPTY_RESEARCH: DashboardResearch = {
  current: 0,
  completed: 0,
  savedDocuments: 0,
  total: 0,
  sessions: [],
};
const EMPTY_AI: DashboardAI = {
  openRouterAvailable: false,
  localAvailable: false,
  providerStatus: "unavailable",
  activeModel: null,
  activeMode: "balanced",
  lastSuccessfulRequest: null,
  failedRequests: 0,
  rateLimited: false,
  health: "offline",
  models: [],
};
const EMPTY_NOTIFICATIONS: DashboardNotifications = { items: [], unread: 0 };

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function invalidateFor(kind: DashboardEventKind, qc: QueryClient, userId: string | null) {
  const map: Partial<Record<DashboardEventKind, unknown[][]>> = {
    system: [["dashboard", "system"]],
    tasks: [["dashboard", "tasks"]],
    calendar: [["dashboard", "calendar"]],
    memory: [["dashboard", "memory", userId]],
    conversations: [["dashboard", "conversations", userId]],
    research: [["dashboard", "research"]],
    ai: [["dashboard", "ai"]],
    notifications: [["dashboard", "notifications"]],
  };
  if (kind === "all") {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    return;
  }
  const keys = map[kind];
  keys?.forEach((k) => qc.invalidateQueries({ queryKey: k as string[] }));
}

export interface SliceState {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
}

export interface UseDashboardResult extends DashboardData {
  mounted: boolean;
  userId: string | null;
  lastSynced: number;
  systemState: SliceState;
  tasksState: SliceState;
  calendarState: SliceState;
  memoryState: SliceState;
  conversationsState: SliceState;
  researchState: SliceState;
  aiState: SliceState;
  notificationsState: SliceState;
  refetchAll: () => void;
}

export function useDashboard(): UseDashboardResult {
  const qc = useQueryClient();
  const mounted = useMounted();
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;

  const system = useQuery({
    queryKey: ["dashboard", "system"],
    queryFn: fetchSystem,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const tasks = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: fetchTasks,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const calendar = useQuery({
    queryKey: ["dashboard", "calendar"],
    queryFn: fetchCalendar,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const memory = useQuery({
    queryKey: ["dashboard", "memory", userId],
    queryFn: () => fetchMemory(userId),
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const conversations = useQuery({
    queryKey: ["dashboard", "conversations", userId],
    queryFn: () => fetchConversations(userId),
    enabled: mounted,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const research = useQuery({
    queryKey: ["dashboard", "research"],
    queryFn: fetchResearch,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const ai = useQuery({
    queryKey: ["dashboard", "ai"],
    queryFn: fetchAI,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const notifications = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: fetchNotifications,
    enabled: mounted,
    refetchInterval: POLL_MS,
    staleTime: 10_000,
  });

  const [lastSynced, setLastSynced] = useState(0);

  useEffect(() => {
    if (system.dataUpdatedAt) setLastSynced(system.dataUpdatedAt);
  }, [system.dataUpdatedAt]);

  useEffect(() => {
    const off = onDashboardEvent((kind) => {
      invalidateFor(kind, qc, userId);
      setLastSynced(Date.now());
    });
    return off;
  }, [qc, userId]);

  useEffect(() => {
    if (!userId) return;
    const channels = [
      supabase
        .channel(`dashboard-conversations-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `user_id=eq.${userId}` },
          () => {
            qc.invalidateQueries({ queryKey: ["dashboard", "conversations", userId] });
            setLastSynced(Date.now());
          },
        )
        .subscribe(),
      supabase
        .channel(`dashboard-memories-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "memories", filter: `user_id=eq.${userId}` },
          () => {
            qc.invalidateQueries({ queryKey: ["dashboard", "memory", userId] });
            setLastSynced(Date.now());
          },
        )
        .subscribe(),
    ];
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [qc, userId]);

  return useMemo<UseDashboardResult>(
    () => ({
      system: system.data ?? EMPTY_SYSTEM,
      tasks: tasks.data ?? EMPTY_TASKS,
      calendar: calendar.data ?? EMPTY_CALENDAR,
      memory: memory.data ?? EMPTY_MEMORY,
      conversations: conversations.data ?? EMPTY_CONVERSATIONS,
      research: research.data ?? EMPTY_RESEARCH,
      ai: ai.data ?? EMPTY_AI,
      notifications: notifications.data ?? EMPTY_NOTIFICATIONS,
      mounted,
      userId,
      lastSynced,
      systemState: { isLoading: system.isLoading, isError: system.isError, error: system.error },
      tasksState: { isLoading: tasks.isLoading, isError: tasks.isError, error: tasks.error },
      calendarState: {
        isLoading: calendar.isLoading,
        isError: calendar.isError,
        error: calendar.error,
      },
      memoryState: { isLoading: memory.isLoading, isError: memory.isError, error: memory.error },
      conversationsState: {
        isLoading: conversations.isLoading,
        isError: conversations.isError,
        error: conversations.error,
      },
      researchState: {
        isLoading: research.isLoading,
        isError: research.isError,
        error: research.error,
      },
      aiState: { isLoading: ai.isLoading, isError: ai.isError, error: ai.error },
      notificationsState: {
        isLoading: notifications.isLoading,
        isError: notifications.isError,
        error: notifications.error,
      },
      refetchAll: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
    }),
    [
      system.data,
      system.isLoading,
      system.isError,
      system.error,
      tasks.data,
      tasks.isLoading,
      tasks.isError,
      tasks.error,
      calendar.data,
      calendar.isLoading,
      calendar.isError,
      calendar.error,
      memory.data,
      memory.isLoading,
      memory.isError,
      memory.error,
      conversations.data,
      conversations.isLoading,
      conversations.isError,
      conversations.error,
      research.data,
      research.isLoading,
      research.isError,
      research.error,
      ai.data,
      ai.isLoading,
      ai.isError,
      ai.error,
      notifications.data,
      notifications.isLoading,
      notifications.isError,
      notifications.error,
      mounted,
      userId,
      lastSynced,
      qc,
    ],
  );
}
