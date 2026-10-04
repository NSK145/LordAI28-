import {
  readMobileOfflineData,
  removeMobileOfflineData,
  writeMobileOfflineData,
} from "./mobile-offline-storage";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CONVERSATIONS = 40;
const MAX_CACHED_THREADS = 8;
const MAX_MESSAGES_PER_THREAD = 30;
const MAX_MESSAGE_CHARS = 10_000;

export interface OfflineChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  [key: string]: unknown;
}

interface CacheRecord<T> {
  savedAt: number;
  data: T;
}

const conversationsKey = (userId: string) => `lord-offline-chat-${userId}-conversations`;
const threadKey = (userId: string, conversationId: string) =>
  `lord-offline-chat-${userId}-thread-${conversationId}`;

function parseFresh<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CacheRecord<T>;
    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > TTL_MS) return null;
    return value.data;
  } catch {
    return null;
  }
}

function readLocal<T>(key: string): T | null {
  try {
    return parseFresh<T>(typeof localStorage === "undefined" ? null : localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key: string, data: unknown) {
  const raw = JSON.stringify({ savedAt: Date.now(), data });
  void writeMobileOfflineData(key, raw).catch(() => undefined);
}

export function getOfflineConversations<T>(userId: string): T[] {
  const value = readLocal<T[]>(conversationsKey(userId));
  return Array.isArray(value) ? value : [];
}

export function getOfflineMessages<T = OfflineChatMessage>(
  userId: string,
  conversationId: string,
): T[] {
  const value = readLocal<T[]>(threadKey(userId, conversationId));
  return Array.isArray(value) ? value : [];
}

export async function hydrateOfflineConversations<T>(userId: string): Promise<T[]> {
  const value = readLocal<T[]>(conversationsKey(userId));
  if (value) return value;
  const raw = await readMobileOfflineData(conversationsKey(userId));
  const durable = parseFresh<T[]>(raw);
  return Array.isArray(durable) ? durable : [];
}

export async function hydrateOfflineMessages<T = OfflineChatMessage>(
  userId: string,
  conversationId: string,
): Promise<T[]> {
  const key = threadKey(userId, conversationId);
  const value = readLocal<T[]>(key);
  if (value) return value;
  const durable = parseFresh<T[]>(await readMobileOfflineData(key));
  return Array.isArray(durable) ? durable : [];
}

export function saveOfflineConversations<T>(userId: string, rows: T[]) {
  write(conversationsKey(userId), rows.slice(0, MAX_CONVERSATIONS));
}

export function saveOfflineMessages<
  T extends { id: string; role: string; content: string; created_at: string },
>(userId: string, conversationId: string, rows: T[]) {
  const normalized = rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-MAX_MESSAGES_PER_THREAD)
    .map((row) => ({ ...row, content: row.content.slice(0, MAX_MESSAGE_CHARS) }));
  write(threadKey(userId, conversationId), normalized);

  const threadIndexKey = `lord-offline-chat-${userId}-threads`;
  const existing = readLocal<string[]>(threadIndexKey) ?? [];
  const next = [conversationId, ...existing.filter((id) => id !== conversationId)].slice(
    0,
    MAX_CACHED_THREADS,
  );
  for (const staleId of existing.filter((id) => !next.includes(id))) {
    void removeMobileOfflineData(threadKey(userId, staleId)).catch(() => undefined);
  }
  write(threadIndexKey, next);
}
