import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  History,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/lord/AppShell";
import { EnergyOrb } from "@/components/lord/EnergyOrb";
import { useWakeWord } from "@/components/lord/WakeWordProvider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { usePersistedState } from "@/lib/use-persisted-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({ meta: [{ title: "LORD AI — Voice Assistant" }] }),
  component: VoicePage,
});

function VoicePage() {
  const {
    enabled,
    supported,
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
    startTapToTalk,
    submitText,
    retryLast,
    loadConversation,
    startNewConversation,
    stopSpeaking,
    stop,
    setVoiceOutputEnabled,
  } = useWakeWord();
  const [subtitlesEnabled, setSubtitlesEnabled] = usePersistedState("voice-subtitles", true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [typedCommand, setTypedCommand] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stayAtBottomRef = useRef(true);
  const { data: userId } = useQuery({
    queryKey: ["voice-history-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });
  const historyQuery = useQuery({
    queryKey: ["voice-conversations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, last_message_at")
        .eq("user_id", userId!)
        .contains("metadata", { source: "voice" })
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stayAtBottomRef.current && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, transcript, reply]);

  const onTranscriptScroll = () => {
    const element = transcriptRef.current;
    if (!element) return;
    stayAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
  };

  const status = {
    disabled: "Ready when you are",
    requesting_permission: "Requesting microphone access",
    wake_listening: "Listening for ‘Hey, LORD’",
    activated: "LORD activated",
    command_listening: "Listening to your command",
    processing: "Thinking",
    speaking: "Speaking",
    error: "Voice assistant needs attention",
  }[state];

  const onSubmitText = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = typedCommand.trim();
    if (!command) return;
    setTypedCommand("");
    void submitText(command);
  };

  return (
    <AppShell>
      <main className="voice-assistant mx-auto flex min-h-[calc(100svh-10rem)] w-full max-w-5xl flex-col items-center px-2 pb-6 sm:px-4">
        <header className="flex w-full items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-200/20 bg-cyan-300/5 text-cyan-100">
              <span className="font-display text-sm font-semibold">L</span>
            </div>
            <div>
              <p className="font-display text-sm font-semibold tracking-[0.22em] text-foreground">
                LORD AI
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Voice interface
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/60 px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open voice chat history"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/60 px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={stop}
            >
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Close</span>
            </Link>
          </div>
        </header>

        <section className="flex w-full flex-1 flex-col items-center justify-center py-3 text-center">
          <div className="voice-orb-state" data-state={state}>
            <EnergyOrb />
          </div>
          <p
            className={cn(
              "mt-1 font-mono text-xs uppercase tracking-[0.22em] sm:text-sm",
              state === "error" ? "text-amber-200" : "text-cyan-100/90",
            )}
            aria-live="polite"
          >
            {status}
          </p>
          {state === "disabled" && (
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              Enable the microphone to listen for “Hey, LORD”. Voice recognition runs only while
              this page is open and active.
            </p>
          )}
          {!supported && (
            <p role="status" className="mt-2 max-w-md text-xs leading-relaxed text-amber-100/80">
              This browser does not provide speech recognition. You can still send commands using
              the text box below.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => (enabled ? toggle() : void enable())}
              disabled={!supported}
              aria-label={
                enabled
                  ? "Stop voice assistant and mute microphone"
                  : "Enable voice assistant microphone"
              }
              aria-pressed={enabled}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                enabled
                  ? "border-cyan-200/40 bg-cyan-200/10 text-cyan-100 hover:bg-cyan-200/15"
                  : "border-primary/50 bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {enabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {enabled ? "Mute microphone" : "Enable voice"}
            </button>
            <button
              type="button"
              onClick={() => void startTapToTalk()}
              disabled={!supported || state === "processing" || state === "speaking"}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Mic className="h-4 w-4" /> Tap to talk
            </button>
            {state === "speaking" && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-foreground/85 transition hover:border-primary/40"
              >
                <VolumeX className="h-4 w-4" /> Stop speaking
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => setSubtitlesEnabled((current) => !current)}
              aria-pressed={subtitlesEnabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Subtitles className="h-4 w-4" /> Subtitles {subtitlesEnabled ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
              disabled={!voiceOutputSupported}
              aria-pressed={voiceOutputEnabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
            >
              {voiceOutputEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              Spoken replies {voiceOutputEnabled ? "on" : "off"}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={startNewConversation}
                className="min-h-10 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                New voice chat
              </button>
            )}
          </div>
        </section>

        {errorMessage && (
          <section
            role="alert"
            className="mb-4 w-full max-w-2xl rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-100"
          >
            <p>{errorMessage}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state === "error" && supported && (
                <button
                  type="button"
                  onClick={() => void enable()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-100/25 px-3 text-xs hover:bg-amber-100/5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry microphone
                </button>
              )}
              {messages.some((message) => message.role === "user") && (
                <button
                  type="button"
                  onClick={() => void retryLast()}
                  className="min-h-10 rounded-lg border border-amber-100/25 px-3 text-xs hover:bg-amber-100/5"
                >
                  Retry last command
                </button>
              )}
            </div>
          </section>
        )}

        {subtitlesEnabled && (
          <section
            className="w-full max-w-3xl border-t border-border/40 pt-3"
            aria-label="Voice subtitles"
          >
            <div
              ref={transcriptRef}
              onScroll={onTranscriptScroll}
              className="max-h-56 space-y-3 overflow-y-auto px-1 py-2 sm:max-h-64"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {wakePhrase && (
                <p className="text-xs text-cyan-100/65">Wake phrase: “{wakePhrase}”</p>
              )}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[90%] text-left",
                    message.role === "user" ? "ml-auto" : "mr-auto",
                  )}
                >
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {message.role === "user" ? "You" : "LORD AI"}
                  </p>
                  <p className="whitespace-pre-wrap rounded-xl border border-border/40 bg-background/35 px-3 py-2 text-sm leading-relaxed text-foreground/90">
                    {message.text}
                  </p>
                </article>
              ))}
              {transcript && (state === "command_listening" || state === "wake_listening") && (
                <article className="ml-auto max-w-[90%] text-left">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {state === "wake_listening" ? "Wake recognition · live" : "You · live"}
                  </p>
                  <p className="whitespace-pre-wrap rounded-xl border border-cyan-200/15 bg-cyan-200/5 px-3 py-2 text-sm text-foreground/80">
                    {transcript}
                  </p>
                </article>
              )}
              {reply && state === "processing" && (
                <article className="mr-auto max-w-[90%] text-left">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    LORD AI · response
                  </p>
                  <p className="whitespace-pre-wrap rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-relaxed text-foreground/90">
                    {reply}
                  </p>
                </article>
              )}
              {!messages.length && !wakePhrase && !transcript && (
                <p className="py-5 text-center text-xs text-muted-foreground">
                  Your transcript and LORD’s actual responses will appear here.
                </p>
              )}
            </div>
          </section>
        )}

        <form onSubmit={onSubmitText} className="mt-3 flex w-full max-w-3xl items-center gap-2">
          <label className="sr-only" htmlFor="voice-text-fallback">
            Type a command
          </label>
          <input
            id="voice-text-fallback"
            value={typedCommand}
            onChange={(event) => setTypedCommand(event.target.value)}
            placeholder="Type a command if speech recognition is unavailable…"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border/50 bg-background/45 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/65 focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
          />
          <button
            type="submit"
            disabled={!typedCommand.trim() || state === "processing"}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-45"
          >
            Send
          </button>
        </form>

        <p className="mt-3 max-w-3xl text-center text-[10px] leading-relaxed text-muted-foreground/75">
          Recognition uses your browser’s speech service while this page is open. LORD AI receives
          the recognized text, not a raw microphone recording. Continuous wake recognition may stop
          in some browsers; use Tap to talk or text input if it does.
        </p>
      </main>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(88vw,24rem)] max-w-none flex-col border-border/70 bg-background/95 p-3 pt-12 sm:p-5 sm:pt-12"
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-200" /> Voice chat history
            </SheetTitle>
            <SheetDescription>Saved voice conversations from this account.</SheetDescription>
          </SheetHeader>
          <button
            type="button"
            onClick={() => {
              startNewConversation();
              setHistoryOpen(false);
            }}
            className="mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary/15 px-3 text-sm font-medium text-primary transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" /> New voice chat
          </button>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
            {historyQuery.isPending ? (
              <p className="px-2 py-5 text-center text-sm text-muted-foreground">
                Loading voice history…
              </p>
            ) : historyQuery.error ? (
              <div role="alert" className="rounded-xl border border-amber-200/20 p-3 text-sm">
                <p className="text-amber-100">Could not load voice history.</p>
                <button
                  type="button"
                  onClick={() => void historyQuery.refetch()}
                  className="mt-2 min-h-10 rounded-lg px-2 text-xs text-cyan-100 hover:bg-cyan-100/10"
                >
                  Try again
                </button>
              </div>
            ) : historyQuery.data?.length ? (
              historyQuery.data.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={state === "processing" || state === "speaking"}
                  onClick={() => {
                    void loadConversation(conversation.id);
                    setHistoryOpen(false);
                  }}
                  aria-current={activeConversationId === conversation.id ? "true" : undefined}
                  className={cn(
                    "block min-h-14 w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    activeConversationId === conversation.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-background/35 hover:border-primary/30 hover:bg-primary/5",
                  )}
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {conversation.title || "Voice conversation"}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {conversation.last_message_at
                      ? new Date(conversation.last_message_at).toLocaleString()
                      : "Saved conversation"}
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                <p className="text-sm text-foreground/85">No saved voice chats yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your conversations will appear here after your first voice command.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
