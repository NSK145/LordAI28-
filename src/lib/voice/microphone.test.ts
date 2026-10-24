import { afterEach, describe, expect, it, vi } from "vitest";
import {
  microphonePermissionError,
  requestVoiceMicrophonePermission,
} from "./microphone";

describe("voice microphone access", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests audio only on explicit invocation and immediately releases the stream", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    await requestVoiceMicrophonePermission();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("reports denial, missing devices, and microphone contention explicitly", () => {
    expect(
      microphonePermissionError(new DOMException("Denied", "NotAllowedError")),
    ).toContain("permission was denied");
    expect(
      microphonePermissionError(new DOMException("Missing", "NotFoundError")),
    ).toContain("No microphone");
    expect(
      microphonePermissionError(new DOMException("Busy", "NotReadableError")),
    ).toContain("microphone is busy");
  });

  it("does not claim permission when no media device API is available", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestVoiceMicrophonePermission()).rejects.toThrow(
      "Microphone access is unavailable",
    );
  });
});
