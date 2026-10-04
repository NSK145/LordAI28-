import { Capacitor } from "@capacitor/core";

export function normalizeNativeApiBaseUrl(configured: string | undefined): string {
  const value = configured?.trim().replace(/\/+$/, "") ?? "";
  if (!value) return "";
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an absolute HTTPS URL.");
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("The Android app requires VITE_API_BASE_URL to use HTTPS.");
  }
  return endpoint.origin;
}

export const getApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return normalizeNativeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  }
  return "";
};
