import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceRecorder({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getRecognitionCtor() && window.isSecureContext);
  }, []);

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    setErrorMessage(null);
    if (!Ctor || !window.isSecureContext) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      if (text.trim()) setErrorMessage(null);
      onResult(text.trim());
    };
    rec.onend = () => setRecording(false);
    rec.onerror = (event) => {
      setRecording(false);
      const messages: Record<string, string> = {
        "not-allowed":
          "Microphone permission was denied. Allow access in your browser settings, then try again.",
        "service-not-allowed": "This browser does not allow its speech recognition service.",
        "audio-capture": "No microphone is available. Check your device and try again.",
        network: "Speech recognition is unavailable right now. Check your connection and retry.",
        "no-speech": "No speech was detected. Try speaking a little closer to your microphone.",
      };
      setErrorMessage(
        messages[event.error ?? ""] ?? "Voice input failed. Try again or type your message.",
      );
    };
    recRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setErrorMessage("Voice input could not start. Check microphone permission and try again.");
    }
  };

  const toggle = () => {
    if (recording) stop();
    else start();
  };

  useEffect(() => () => recRef.current?.stop(), []);

  return (
    <>
      <motion.button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={
          recording ? "Stop voice recording" : supported ? "Voice input" : "Voice input unavailable"
        }
        aria-pressed={recording}
        aria-describedby="voice-recorder-status"
        title={
          supported
            ? "Voice input uses your browser's speech recognition"
            : "Voice recognition requires a supported browser and secure connection"
        }
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          recording
            ? "bg-cyan-400/20 text-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.35)]"
            : "text-muted-foreground hover:bg-white/5 hover:text-cyan-200",
          (disabled || !supported) && "cursor-not-allowed opacity-50",
        )}
      >
        <Mic className="h-4 w-4" />
        {recording && (
          <span
            className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-0.5"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="w-0.5 rounded-full bg-cyan-300"
                animate={{ height: [3, 10, 4, 9, 3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              />
            ))}
          </span>
        )}
      </motion.button>
      <span id="voice-recorder-status" className="sr-only" role="status" aria-live="polite">
        {recording ? "Listening. Select the microphone again to stop." : ""}
      </span>
      {(errorMessage || !supported) && (
        <span className="max-w-44 text-[11px] leading-tight text-destructive" role="alert">
          {errorMessage ?? "Voice recognition is unavailable in this browser or connection."}
        </span>
      )}
    </>
  );
}
