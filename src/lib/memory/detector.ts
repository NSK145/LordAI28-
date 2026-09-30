/**
 * Memory detection — the "intelligence" that decides what a user says is worth
 * remembering, and how confident we are.
 *
 * This is a client-side, dependency-free heuristic classifier. It is designed to
 * be fast, explainable, and safe:
 *   • It only proposes MEMORABLE, durable statements (identity, preferences,
 *     long-term facts, ongoing projects). It deliberately ignores ephemeral
 *     chit-chat, questions, and one-off requests.
 *   • It never proposes sensitive data (see `detectSensitive`).
 *   • Every candidate carries a confidence score so the caller can decide
 *     whether to auto-save (above threshold) or ask first (below).
 *
 * The heuristic is intentionally conservative: false negatives (forgetting
 * something) are far less harmful than false positives (remembering nonsense).
 */

import { detectSensitive, isSensitive, type DetectedMemory, type MemoryCategory } from "./types";

// First-person possessive / identity statements → User Profile.
const PROFILE_PATTERNS: Array<{ re: RegExp; weight: number; reason: string }> = [
  { re: /\bmy name (is|'s|s)\b/i, weight: 0.95, reason: "Shares your name" },
  { re: /\bi am (called|named)\b/i, weight: 0.9, reason: "Shares your name" },
  { re: /\bcall me\b/i, weight: 0.9, reason: "Shares what to call you" },
  { re: /\bmy (full name|nickname)\b/i, weight: 0.9, reason: "Shares your name" },
  { re: /\bi (live|am) in\b/i, weight: 0.9, reason: "Shares your location" },
  { re: /\bmy (city|country|town|state) (is|'s)\b/i, weight: 0.9, reason: "Shares your location" },
  {
    re: /\bi (study|am studying|am a student) (at|in|computer science|cs)\b/i,
    weight: 0.9,
    reason: "Shares your studies",
  },
  { re: /\bi'?m in (grade|class|year)\b/i, weight: 0.9, reason: "Shares your grade/year" },
  { re: /\bi (work|am working) (at|as|for)\b/i, weight: 0.85, reason: "Shares your job" },
  { re: /\bi am (\d{1,3})( years old)?\b/i, weight: 0.7, reason: "Shares your age" },
  { re: /\bi (speak|am learning|am from)\b/i, weight: 0.7, reason: "Shares about you" },
  { re: /\bmy (school|college|university)\b/i, weight: 0.85, reason: "Shares your school" },
  { re: /\bi'?m a\b/i, weight: 0.75, reason: "Shares your role" },
  { re: /\bmy birthday (is|'s)\b/i, weight: 0.95, reason: "Shares your birthday" },
];

// Preference statements → Preferences.
const PREFERENCE_PATTERNS: Array<{ re: RegExp; weight: number; reason: string }> = [
  { re: /\bi prefer\b/i, weight: 0.9, reason: "States a preference" },
  { re: /\bi like\b/i, weight: 0.8, reason: "States a preference" },
  { re: /\bi love\b/i, weight: 0.8, reason: "States a preference" },
  { re: /\bi hate\b/i, weight: 0.8, reason: "States a dislike" },
  { re: /\bi (don't|do not) like\b/i, weight: 0.85, reason: "States a dislike" },
  { re: /\balways\b/i, weight: 0.7, reason: "States a standing preference" },
  { re: /\bnever\b/i, weight: 0.7, reason: "States a standing preference" },
  { re: /\bplease (always|answer|respond|be)\b/i, weight: 0.85, reason: "States how to respond" },
  { re: /\b(prefer|use) (dark mode|light mode)\b/i, weight: 0.95, reason: "UI preference" },
  {
    re: /\b(answer|respond|reply) (briefly|concise|short|in (detail|bullet))\b/i,
    weight: 0.9,
    reason: "Response style preference",
  },
  {
    re: /\bmy favorite (language|ide|editor|tool|framework|browser)\b/i,
    weight: 0.92,
    reason: "States a favorite",
  },
  {
    re: /\bmy favourite (language|ide|editor|tool|framework|browser)\b/i,
    weight: 0.92,
    reason: "States a favorite",
  },
  {
    re: /\bi (use|use the|am on) (linux|windows|macos|mac|ios|android)\b/i,
    weight: 0.9,
    reason: "Shares your platform",
  },
  {
    re: /\bi (prefer|want|need) (python|typescript|javascript|rust|go)\b/i,
    weight: 0.88,
    reason: "Language preference",
  },
  {
    re: /\bkeep (it|responses) (short|brief|concise)\b/i,
    weight: 0.9,
    reason: "Response style preference",
  },
];

// Long-term facts / ongoing projects → Facts or Projects.
const FACT_PATTERNS: Array<{
  re: RegExp;
  weight: number;
  reason: string;
  category: MemoryCategory;
}> = [
  {
    re: /\bi'?m (building|creating|making|developing)\b/i,
    weight: 0.9,
    reason: "Ongoing project",
    category: "project",
  },
  {
    re: /\bi am (working on|preparing for|studying for)\b/i,
    weight: 0.9,
    reason: "Ongoing goal",
    category: "project",
  },
  { re: /\bi'?m preparing for\b/i, weight: 0.9, reason: "Ongoing goal", category: "project" },
  {
    re: /\bi'?m (learning|taking a course|enrolled)\b/i,
    weight: 0.85,
    reason: "Learning progress",
    category: "fact",
  },
  { re: /\bmy favorite language is\b/i, weight: 0.92, reason: "Long-term fact", category: "fact" },
  { re: /\bi'?m in grade\b/i, weight: 0.9, reason: "Long-term fact", category: "profile" },
  { re: /\bmy goal (is|'s)\b/i, weight: 0.9, reason: "States a goal", category: "project" },
  { re: /\bi (have|own|use) a\b/i, weight: 0.7, reason: "Long-term fact", category: "fact" },
  {
    re: /\bcurrently (working on|building|studying)\b/i,
    weight: 0.9,
    reason: "Ongoing project",
    category: "project",
  },
];

const TASK_PATTERNS = [
  {
    re: /\b(?:i'?ll|we'?ll|i will|we will|let'?s)\s+(?:finish|complete|continue|resume|work on)\b/i,
    weight: 0.88,
    reason: "Unfinished task",
    category: "project" as const,
    expiresInDays: 30,
  },
];

// Things that clearly should NOT be remembered.
const NON_MEMORY_PATTERNS: RegExp[] = [
  /\?$/, // questions
  /^(can you|could you|please|help|what|why|how|when|where|who|which|is|are|do|does|did|will|would|should|can|may|tell me|explain|write|generate|create|summarize|translate|code|fix|debug)/i,
  /\b(hey|hi|hello|thanks|thank you|ok|okay|sure|nice|cool|lol|haha|yo)\b/i,
];

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.\s]+$/, "").trim();
}

function cleanStatement(text: string): string {
  let t = stripTrailingPunctuation(text);
  // Cap length for storage sanity.
  if (t.length > 400) t = t.slice(0, 400).trim() + "…";
  return t;
}

/**
 * Detect candidate memories from a single user message.
 *
 * Returns an empty array when nothing worth remembering was said. Multiple
 * candidates can be returned (e.g. a message that states a name AND a preference).
 * Candidates are de-duplicated and the highest-scoring category wins per phrase.
 */
export function detectMemories(rawText: string): DetectedMemory[] {
  const text = (rawText || "").trim();
  if (!text || text.length < 3) return [];

  // Never remember sensitive data.
  if (isSensitive(text)) return [];
  if (detectSensitive(text)) return [];

  // Skip obvious non-memorable turns.
  if (NON_MEMORY_PATTERNS.some((re) => re.test(text))) {
    // Questions may still contain a fact in the middle ("my name is X, what do you think?").
    // So we only bail if the *entire* message is a question / request.
    const hasMemorySignal =
      PROFILE_PATTERNS.some((p) => p.re.test(text)) ||
      PREFERENCE_PATTERNS.some((p) => p.re.test(text)) ||
      FACT_PATTERNS.some((p) => p.re.test(text)) ||
      TASK_PATTERNS.some((p) => p.re.test(text));
    if (!hasMemorySignal) return [];
  }

  const candidates: DetectedMemory[] = [];

  const tryPatterns = (
    patterns: Array<{
      re: RegExp;
      weight: number;
      reason: string;
      category?: MemoryCategory;
      expiresInDays?: number;
    }>,
    fallbackCategory: MemoryCategory,
  ) => {
    for (const p of patterns) {
      const match = text.match(p.re);
      if (!match) continue;
      // Extract the meaningful clause. We take from the matched keyword to the
      // end, then trim at the first sentence boundary beyond ~12 words.
      const start = match.index ?? 0;
      let clause = text.slice(start);
      const sentenceEnd = clause.search(/[.!?]\s/);
      if (sentenceEnd > 0) clause = clause.slice(0, sentenceEnd + 1);
      const words = clause.split(/\s+/);
      if (words.length > 30) clause = words.slice(0, 30).join(" ") + "…";
      const content = cleanStatement(clause);
      if (content.length < 3) continue;
      // Extra safety: do not store the part that is just the trigger word.
      if (isSensitive(content)) continue;
      candidates.push({
        content,
        category: (p.category ?? fallbackCategory) as MemoryCategory,
        confidence: Math.min(0.99, p.weight),
        ...(p.expiresInDays
          ? {
              expiresAt: new Date(Date.now() + p.expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
            }
          : {}),
        reason: p.reason,
      });
    }
  };

  tryPatterns(PROFILE_PATTERNS, "profile");
  tryPatterns(PREFERENCE_PATTERNS, "preference");
  tryPatterns(FACT_PATTERNS, "fact");
  tryPatterns(TASK_PATTERNS, "project");

  if (candidates.length === 0) return [];

  // De-duplicate by content (keep highest confidence).
  const byContent = new Map<string, DetectedMemory>();
  for (const c of candidates) {
    const existing = byContent.get(c.content);
    if (!existing || c.confidence > existing.confidence) byContent.set(c.content, c);
  }

  return Array.from(byContent.values()).sort((a, b) => b.confidence - a.confidence);
}
