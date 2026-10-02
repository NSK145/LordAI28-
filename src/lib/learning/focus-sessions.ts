export interface FocusRecord {
  completedAt: string;
  minutes: number;
}

function key(userId: string) {
  return `study-focus-sessions:${userId}`;
}

export function getFocusRecords(userId: string): FocusRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is FocusRecord =>
        Boolean(
          item &&
          typeof item === "object" &&
          Number.isFinite(item.minutes) &&
          typeof item.completedAt === "string",
        ),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function recordFocusSession(userId: string, minutes: number): void {
  if (typeof localStorage === "undefined") return;
  const records = getFocusRecords(userId);
  records.unshift({ completedAt: new Date().toISOString(), minutes });
  try {
    localStorage.setItem(key(userId), JSON.stringify(records.slice(0, 100)));
  } catch {
    /* optional device storage */
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("lord:focus-session-complete", { detail: { userId } }));
}
