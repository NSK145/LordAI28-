import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

function filePath(key: string) {
  return `lord-offline/${encodeURIComponent(key)}.json`;
}

export async function writeMobileOfflineData(key: string, value: string): Promise<void> {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // A device can deny browser storage; the native private directory remains.
  }
  if (!Capacitor.isNativePlatform()) return;
  await Filesystem.writeFile({
    path: filePath(key),
    data: value,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

export async function readMobileOfflineData(key: string): Promise<string | null> {
  try {
    const browserCopy = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    if (browserCopy !== null) return browserCopy;
  } catch {
    // Continue to the app-private native copy.
  }
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await Filesystem.readFile({
      path: filePath(key),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return typeof result.data === "string" ? result.data : null;
  } catch {
    return null;
  }
}

export async function removeMobileOfflineData(key: string): Promise<void> {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    // Continue with native removal.
  }
  if (!Capacitor.isNativePlatform()) return;
  await Filesystem.deleteFile({ path: filePath(key), directory: Directory.Data }).catch(
    () => undefined,
  );
}
