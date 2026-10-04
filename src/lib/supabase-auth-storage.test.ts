import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthStorage, type NativeSecureStore } from "./supabase-auth-storage";

function makeLocal(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

function makeSecure(): NativeSecureStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async ({ key }) => ({ value: values.get(key) ?? null })),
    set: vi.fn(async ({ key, value }) => void values.set(key, value)),
    remove: vi.fn(async ({ key }) => void values.delete(key)),
  };
}

describe("Supabase auth storage", () => {
  it("stores native sessions in secure storage and removes stale WebView copies", async () => {
    const local = makeLocal();
    const secure = makeSecure();
    const storage = createSupabaseAuthStorage({ native: true, secure, local });

    await storage.setItem("auth-token", "session");

    expect(secure.values.get("auth-token")).toBe("session");
    expect(local.getItem("auth-token")).toBeNull();
    expect(await storage.getItem("auth-token")).toBe("session");
  });

  it("migrates an existing native WebView session to secure storage", async () => {
    const local = makeLocal({ "auth-token": "legacy-session" });
    const secure = makeSecure();
    const storage = createSupabaseAuthStorage({ native: true, secure, local });

    expect(await storage.getItem("auth-token")).toBe("legacy-session");
    expect(secure.values.get("auth-token")).toBe("legacy-session");
    expect(local.getItem("auth-token")).toBeNull();
  });

  it("keeps web auth storage in localStorage", async () => {
    const local = makeLocal();
    const storage = createSupabaseAuthStorage({ native: false, local });

    await storage.setItem("auth-token", "web-session");

    expect(local.getItem("auth-token")).toBe("web-session");
    expect(await storage.getItem("auth-token")).toBe("web-session");
  });

  it("never falls back to plaintext storage when native secure storage is missing", async () => {
    const local = makeLocal();
    const storage = createSupabaseAuthStorage({ native: true, local });

    await expect(storage.setItem("auth-token", "session")).rejects.toThrow(
      /secure session storage/,
    );
    expect(local.getItem("auth-token")).toBeNull();
  });
});
