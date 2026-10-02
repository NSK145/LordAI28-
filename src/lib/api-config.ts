import { Capacitor } from "@capacitor/core";

export const getApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
    if (configured) {
      const endpoint = new URL(configured);
      if (endpoint.protocol !== "https:") {
        throw new Error("The Android app requires VITE_API_BASE_URL to use HTTPS.");
      }
      return endpoint.origin;
    }
  }
  return "";
};
