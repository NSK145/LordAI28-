import { Capacitor } from "@capacitor/core";
import { getApiBaseUrl } from "./api-config";

export type ConnectivityDecision = "unknown" | "online" | "offline";

export interface ConnectivitySample {
  navigatorOnline: boolean;
  backendReachable: boolean | null;
  nativeOnline?: boolean | null;
  consecutiveFailures: number;
}

/**
 * A failed API probe by itself is not proof that the device is offline.
 * Require an offline browser hint and repeated probe failures; any positive
 * reachability signal immediately clears an offline state.
 */
export function decideConnectivity(sample: ConnectivitySample): ConnectivityDecision {
  if (sample.navigatorOnline || sample.backendReachable === true) {
    return "online";
  }
  if (
    !sample.navigatorOnline &&
    sample.backendReachable === false &&
    sample.consecutiveFailures >= 2
  ) {
    return "offline";
  }
  return "unknown";
}

export async function probeBackendReachability(timeoutMs = 1_800): Promise<boolean | null> {
  if (typeof window === "undefined") return null;
  const apiBaseUrl = getApiBaseUrl();
  if (Capacitor.isNativePlatform() && !apiBaseUrl) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/api/health?connectivity=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
