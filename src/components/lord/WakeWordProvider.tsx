import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { createWakeEngine, type WakeEngine } from "@/lib/voice";
import { getSpeechRecognitionConstructor } from "@/lib/voice/webspeech-wake-engine";
import { monitoring } from "@/lib/monitoring-service";
import type { LordMode } from "@/lib/modes";
import {
  VoicePipeline,
  type VoiceMessage,
  type VoicePipelineStatus,
} from "@/lib/voice/voice-pipeline";

export type VoiceAssistantState =
  | "disabled"
  | "requesting_permission"
  | "wake_listening"
  | "activated"
  | "command_listening"
  | "processing"
  | "speaking"
  | "error";

type LegacyWakeStatus =
  "off" | "listening" | "heard" | "thinking" | "speaking" | "error" | "unsupported";

interface WakeWordContextValue {
  enabled: boolean;
  supported: boolean;
  status: LegacyWakeStatus;
  state: VoiceAssistantState;
  errorMessage: string;
  transcript: string;
  wakePhrase: string;
  reply: string;
  messages: VoiceMessage[];
  activeConversationId: string | null;
  voiceOutputEnabled: boolean;
  voiceOutputSupported: boolean;
  toggle: () => void;
  enable: () => Promise<void>;
  stop: () => void;
  startTapToTalk: () => Promise<void>;
  submitText: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => void;
  stopSpeaking: () => void;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  clearMessages: () => void;
}

const WakeWordContext = createContext<WakeWordContextValue | undefined>(undefined);
const VOICE_OUTPUT_KEY = "lord-voice-output-enabled";

async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is unavailable in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function asLegacyStatus(state: VoiceAssistantState, supported: boolean): LegacyWakeStatus {
  switch (state) {
    case "requesting_permission":
    case "processing":
      return "thinking";
    case "wake_listening":
    case "command_listening":
      return "listening";
    case "activated":
      return "heard";
    case "speaking":
      return "speaking";
    case "error":
      return supported ? "error" : "unsupported";
    default:
      return "off";
  }
}

export function WakeWordProvider({
  children,
  mode = "balanced",
  autoSpeak = true,
  voiceRate = 1,
}: {
  children: ReactNode;
  mode?: LordMode;
  autoSpeak?: boolean;
  voiceRate?: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceAssistantState>("disabled");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [wakePhrase, setWakePhrase] = useState("");
  const [reply, setReply] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [voiceOutputEnabled, setVoiceOutputState] = useState(autoSpeak);
  const [supported, setSupported] = useState(false);
  const [voiceOutputSupported, setVoiceOutputSupported] = useState(false);
  const voiceOutputOverrideRef = useRef(false);
  const engineRef = useRef<WakeEngine | null>(null);
  const pipelineRef = useRef<VoicePipeline | null>(null);
  const returnToWakeRef = useRef(false);
  const permissionRequestRef = useRef(0);
  const permissionInFlightRef = useRef(false);
  const enabledRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    setSupported(
      Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(getSpeechRecognitionConstructor()),
    );
    setVoiceOutputSupported("speechSynthesis" in window);
  }, []);

  const updateState = useCallback((next: VoiceAssistantState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const stop = useCallback(() => {
    permissionRequestRef.current += 1;
    permissionInFlightRef.current = false;
    enabledRef.current = false;
    returnToWakeRef.current = false;
    void engineRef.current?.stop();
    engineRef.current = null;
    pipelineRef.current?.stop();
    updateState("disabled");
  }, [updateState]);

  const setVoiceOutputEnabled = useCallback((enabled: boolean) => {
    voiceOutputOverrideRef.current = true;
    setVoiceOutputState(enabled);
    try {
      localStorage.setItem(VOICE_OUTPUT_KEY, String(enabled));
    } catch {
      // The preference remains available for this session if storage is blocked.
    }
    pipelineRef.current?.setVoiceOutput(enabled);
  }, []);

  const wirePipeline = useCallback(() => {
    if (pipelineRef.current) return pipelineRef.current;
    const pipeline = new VoicePipeline(mode, voiceOutputEnabled, voiceRate);
    pipeline.onStatusChange = (pipelineStatus: VoicePipelineStatus) => {
      if (pipelineStatus === "wake_listening") {
        if (enabledRef.current && returnToWakeRef.current) {
          void beginWakeListeningRef.current?.();
        } else {
          enabledRef.current = false;
          updateState("disabled");
        }
      } else {
        updateState(pipelineStatus);
      }
    };
    pipeline.onTranscript = setTranscript;
    pipeline.onResponse = setReply;
    pipeline.onError = (message) => {
      setErrorMessage(message);
      if (message) monitoring.logEvent({ type: "error", category: "voice", message });
    };
    pipeline.onMessagesChange = setMessages;
    pipeline.onConversationChange = (conversationId) => {
      setActiveConversationId(conversationId);
      if (conversationId) {
        void queryClient.invalidateQueries({ queryKey: ["voice-conversations"] });
      }
    };
    pipelineRef.current = pipeline;
    return pipeline;
  }, [mode, queryClient, updateState, voiceOutputEnabled, voiceRate]);

  const beginWakeListeningRef = useRef<(() => Promise<void>) | null>(null);
  const beginWakeListening = useCallback(async () => {
    if (!enabledRef.current || engineRef.current) return;
    setErrorMessage("");
    setTranscript("");
    try {
      const engine = await createWakeEngine(
        (phrase, command) => {
          engineRef.current = null;
          returnToWakeRef.current = true;
          setWakePhrase(phrase);
          setTranscript(phrase);
          setErrorMessage("");
          updateState("activated");
          if (location.pathname !== "/voice") void navigate({ to: "/voice" });
          const pipeline = wirePipeline();
          window.setTimeout(() => {
            if (!enabledRef.current) return;
            if (command) void pipeline.submitText(command);
            else pipeline.startListening();
          }, 250);
        },
        setTranscript,
        (message) => {
          engineRef.current = null;
          setErrorMessage(message);
          enabledRef.current = false;
          updateState("error");
        },
        () => {
          engineRef.current = null;
          setErrorMessage(
            "Continuous recognition stopped. Tap the microphone to retry, or use tap-to-talk.",
          );
          enabledRef.current = false;
          updateState("error");
        },
      );
      if (!enabledRef.current) {
        await engine.stop();
        return;
      }
      engineRef.current = engine;
      updateState("wake_listening");
    } catch (error) {
      enabledRef.current = false;
      setErrorMessage(error instanceof Error ? error.message : "Wake-word recognition failed.");
      updateState("error");
    }
  }, [location.pathname, navigate, updateState, wirePipeline]);
  beginWakeListeningRef.current = beginWakeListening;

  const enable = useCallback(async () => {
    if (enabledRef.current || permissionInFlightRef.current) return;
    if (!supported) {
      setErrorMessage(
        "Speech recognition is not supported here. Use the text command box instead.",
      );
      updateState("error");
      return;
    }
    permissionInFlightRef.current = true;
    const requestId = ++permissionRequestRef.current;
    updateState("requesting_permission");
    setErrorMessage("");
    try {
      await requestMicrophonePermission();
      if (requestId !== permissionRequestRef.current) return;
      enabledRef.current = true;
      returnToWakeRef.current = true;
      await beginWakeListening();
    } catch (error) {
      if (requestId !== permissionRequestRef.current) return;
      enabledRef.current = false;
      setErrorMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in browser settings, then retry."
          : error instanceof Error
            ? error.message
            : "Microphone access failed.",
      );
      updateState("error");
    } finally {
      if (requestId === permissionRequestRef.current) permissionInFlightRef.current = false;
    }
  }, [beginWakeListening, supported, updateState]);

  const startTapToTalk = useCallback(async () => {
    if (!supported) {
      setErrorMessage("Speech recognition is not supported. Use the text command box instead.");
      updateState("error");
      return;
    }
    if (!enabledRef.current) {
      if (permissionInFlightRef.current) return;
      permissionInFlightRef.current = true;
      const requestId = ++permissionRequestRef.current;
      updateState("requesting_permission");
      try {
        await requestMicrophonePermission();
        if (requestId !== permissionRequestRef.current) return;
      } catch (error) {
        if (requestId !== permissionRequestRef.current) return;
        setErrorMessage(error instanceof Error ? error.message : "Microphone access failed.");
        updateState("error");
        return;
      } finally {
        if (requestId === permissionRequestRef.current) permissionInFlightRef.current = false;
      }
      enabledRef.current = true;
      returnToWakeRef.current = false;
    } else {
      returnToWakeRef.current = stateRef.current === "wake_listening";
    }
    const wakeEngine = engineRef.current;
    engineRef.current = null;
    await wakeEngine?.stop();
    wirePipeline().startListening();
  }, [supported, updateState, wirePipeline]);

  const submitText = useCallback(
    (text: string) => {
      if (enabledRef.current && stateRef.current === "wake_listening") {
        returnToWakeRef.current = true;
        void engineRef.current?.stop();
        engineRef.current = null;
      }
      return wirePipeline().submitText(text);
    },
    [wirePipeline],
  );
  const retryLast = useCallback(() => wirePipeline().retryLast(), [wirePipeline]);
  const loadConversation = useCallback(
    async (conversationId: string) => {
      stop();
      setErrorMessage("");
      setWakePhrase("");
      try {
        await wirePipeline().loadConversation(conversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load voice history.";
        setErrorMessage(message);
        updateState("error");
      }
    },
    [stop, updateState, wirePipeline],
  );
  const startNewConversation = useCallback(() => {
    stop();
    wirePipeline().startNewConversation();
    setWakePhrase("");
    setErrorMessage("");
  }, [stop, wirePipeline]);
  const stopSpeaking = useCallback(() => pipelineRef.current?.stopSpeaking(), []);
  const clearMessages = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);
  const toggle = useCallback(() => {
    if (enabledRef.current || stateRef.current === "requesting_permission") stop();
    else void enable();
  }, [enable, stop]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOICE_OUTPUT_KEY);
      if (saved !== null) {
        voiceOutputOverrideRef.current = true;
        setVoiceOutputState(saved === "true" && voiceOutputSupported);
      } else if (!voiceOutputOverrideRef.current) {
        setVoiceOutputState(autoSpeak && voiceOutputSupported);
      }
    } catch {
      // Keep the setting supplied by the account profile.
    }
  }, [autoSpeak, voiceOutputSupported]);

  useEffect(() => {
    pipelineRef.current?.setVoiceOutput(voiceOutputEnabled);
  }, [voiceOutputEnabled]);

  useEffect(() => {
    if (enabledRef.current && location.pathname !== "/voice") {
      stop();
    }
  }, [location.pathname, stop]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && enabledRef.current) {
        stop();
        setErrorMessage(
          "Voice mode paused because this tab is in the background. Enable it again when you return.",
        );
        updateState("error");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [stop, updateState]);

  useEffect(
    () => () => {
      enabledRef.current = false;
      void engineRef.current?.stop();
      pipelineRef.current?.stop();
    },
    [],
  );

  const legacyStatus = asLegacyStatus(state, supported);
  const value: WakeWordContextValue = {
    enabled: enabledRef.current || state === "requesting_permission",
    supported,
    status: legacyStatus,
    state,
    errorMessage,
    transcript,
    wakePhrase,
    reply,
    messages,
    activeConversationId,
    voiceOutputEnabled,
    voiceOutputSupported,
    toggle,
    enable,
    stop,
    startTapToTalk,
    submitText,
    retryLast,
    loadConversation,
    startNewConversation,
    stopSpeaking,
    setVoiceOutputEnabled,
    clearMessages,
  };

  return <WakeWordContext.Provider value={value}>{children}</WakeWordContext.Provider>;
}

export function useWakeWord() {
  const context = useContext(WakeWordContext);
  if (!context) throw new Error("useWakeWord must be used within WakeWordProvider");
  return context;
}
