import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, X, PauseCircle, SkipForward, RotateCw, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDueFlashcards, reviewFlashcard } from "@/lib/learning/client";
import { StudyHeader } from "../StudyHeader";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";
import type { LearningSnapshot, StudyView, Flashcard } from "../types";
import { toast } from "sonner";
import { mapDueFlashcards } from "@/lib/learning/flashcards";

interface FlashcardStudyProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  conceptId?: string;
  onNavigate: (view: StudyView) => void;
  onBack: () => void;
  refresh: () => void;
}

type FL = 0 | 1 | 2 | 3 | 4 | 5;
type StudyCard = Flashcard & { reviewId?: string };
const QUALITY_LABELS: Record<FL, string> = {
  0: "Blackout",
  1: "Incorrect",
  2: "Wrong",
  3: "Barely",
  4: "Almost",
  5: "Perfect",
};

const QUALITY_COLORS: Record<FL, string> = {
  0: "bg-slate-500",
  1: "bg-rose-500",
  2: "bg-orange-500",
  3: "bg-amber-500",
  4: "bg-emerald-400",
  5: "bg-emerald-500",
};

export function FlashcardStudy({
  snapshot,
  userId,
  onBack,
  onNavigate,
  refresh,
}: FlashcardStudyProps) {
  const { user } = useCurrentUser();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studied, setStudied] = useState(0);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !snapshot) return;

    const loadCards = async () => {
      setLoading(true);
      try {
        if (!navigator.onLine) {
          setCards(snapshot.flashcards ?? []);
          return;
        }
        const due = await getDueFlashcards(user.id, 30);
        setCards(mapDueFlashcards(due));
      } catch {
        setCards(snapshot.flashcards ?? []);
      } finally {
        setLoading(false);
      }
    };

    void loadCards();
  }, [user?.id, snapshot, isOnline]);

  const handleRate = useCallback(
    async (quality: FL) => {
      const reviewId = cards[currentIndex]?.reviewId;
      if (!user?.id || !reviewId || !isOnline) return;

      const card = cards[currentIndex];
      try {
        await reviewFlashcard(reviewId, quality, 2500);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Review was not saved: ${error.message}`
            : "Review could not be saved. Check your connection and retry.",
        );
        return;
      }

      setStudied((s) => s + 1);
      refresh();
      setFlipped(false);
      setShowRating(false);

      if (currentIndex < cards.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setCards([]);
      }
    },
    [user?.id, cards, currentIndex, refresh, isOnline],
  );

  const handleFlip = () => {
    if (!showRating) {
      setFlipped(!flipped);
      if (!flipped) {
        setShowRating(true);
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
      setShowRating(false);
    } else {
      setCards([]);
    }
  };

  const progress =
    cards.length > 0 ? (studied / (studied + (cards.length - currentIndex))) * 100 : 100;

  if (!snapshot || !user) {
    return (
      <div className="p-6">
        <StudyHeader
          view="flashcards"
          title="Flashcard Study"
          onBack={onBack}
          showBack
          icon={<Brain className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <StudyHeader
        view="flashcards"
        title="Spaced Repetition"
        subtitle="Flashcards due for review"
        onBack={onBack}
        showBack
        icon={<Brain className="h-6 w-6 text-primary" />}
      />

      {!isOnline && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
        >
          Offline study mode: cached flashcards are available to read. Ratings will be available
          after reconnecting.
        </p>
      )}

      {cards.length === 0 && !loading && (
        <EmptyState
          icon={<Brain className="h-8 w-8" />}
          title="No flashcards due"
          description="You have no flashcards scheduled for review today. Generate new ones from the Concept Library."
          action={
            <button
              onClick={() => onNavigate("concepts")}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Browse Concepts
            </button>
          }
        />
      )}

      {loading && <LoadingState message="Loading your flashcards…" />}

      {cards.length > 0 && !loading && (
        <>
          <div className="mb-4 h-2 w-full rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mx-auto max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.08 }}
                transition={{ duration: 0.3 }}
                className="relative h-64 cursor-pointer rounded-2xl border border-border/40 bg-card/50 p-8"
                onClick={handleFlip}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleFlip();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={
                  flipped
                    ? "Flashcard answer. Activate to show question."
                    : "Flashcard question. Activate to reveal answer."
                }
              >
                <div
                  className={cn(
                    "h-full w-full transition-transform duration-500",
                    flipped && "rotate-y-180",
                  )}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center p-6"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <h3 className="font-display text-center text-xl font-bold text-foreground">
                      {cards[currentIndex].front}
                    </h3>
                    <p className="mt-4 text-xs text-muted-foreground/60">Tap to reveal answer</p>
                  </div>
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center p-6"
                    style={{
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <p className="font-display text-center text-lg text-foreground">
                      {cards[currentIndex].back}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {showRating && isOnline && cards[currentIndex]?.reviewId && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-4 rounded-xl border border-border/40 bg-card/50 p-4"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  How well did you know this?
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {([0, 1, 2, 3, 4, 5] as FL[]).map((q) => (
                    <motion.button
                      key={q}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRate(q)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border border-border/20 py-2 text-xs font-medium transition-all",
                        `border-${QUALITY_COLORS[q].split(" ")[0].replace("bg-", "border-")}/30`,
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white",
                          QUALITY_COLORS[q],
                        )}
                      >
                        {q}
                      </span>
                      <span className="text-muted-foreground">{QUALITY_LABELS[q]}</span>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={handleSkip}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip card
                </button>
              </motion.div>
            )}

            {(!showRating || !isOnline || !cards[currentIndex]?.reviewId) && (
              <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
                <span>Tap to flip</span>
                <span>·</span>
                <span>{studied} reviewed</span>
              </div>
            )}
          </div>
        </>
      )}

      {cards.length > 0 && studied > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex justify-center"
        >
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="h-3 w-3" />
            Refresh session
          </button>
        </motion.div>
      )}
    </div>
  );
}
