export interface NativeSecureStore {
  get(options: { key: string }): Promise<{ value?: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

export interface AuthKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createSupabaseAuthStorage(options: {
  native: boolean;
  secure?: NativeSecureStore;
  local?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): AuthKeyValueStorage {
  const local = options.local;
  const getSecure = () => {
    if (!options.native) return undefined;
    if (!options.secure) throw new Error("Android secure session storage is unavailable.");
    return options.secure;
  };
  return {
    async getItem(key) {
      const secure = getSecure();
      if (!secure) return local?.getItem(key) ?? null;
      const stored = await secure.get({ key });
      if (typeof stored.value === "string") return stored.value;

      // Migrate existing WebView sessions once so updating the app does not log
      // users out. The old unencrypted copy is removed after secure persistence.
      const previous = local?.getItem(key) ?? null;
      if (previous !== null) {
        await secure.set({ key, value: previous });
        local?.removeItem(key);
      }
      return previous;
    },
    async setItem(key, value) {
      const secure = getSecure();
      if (secure) {
        await secure.set({ key, value });
        local?.removeItem(key);
      } else {
        local?.setItem(key, value);
      }
    },
    async removeItem(key) {
      const secure = getSecure();
      if (secure) await secure.remove({ key });
      local?.removeItem(key);
    },
  };
}
