/* eslint-disable @typescript-eslint/no-explicit-any -- database schema is defined in types and client types regenerate after migration deployment. */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { nextMastery } from "./mastery";
import { classToGradeBand } from "./class";
import { getStudyLanguagePreference } from "./preferences";
import type {
  LearningConcept,
  Mastery,
  Question,
  LearningSnapshot,
  LearningProfile,
  LearningSource,
  LearningResource,
  LearningBoard,
  LearningSession,
  TutorMessage,
  LearningArtifact,
  LearningAttempt,
  LearningPlan,
  LearningPlanTask,
  LearningReminder,
  Flashcard,
  FlashcardReview,
  LearningNote,
  Exam,
  ExamQuestion,
  ExamAnswer,
  RevisionSchedule,
  LearningMemory,
  VoiceSession,
  OCRJob,
  Whiteboard,
  DailyGoal,
  WeeklyGoal,
  LearningAnalytics,
  LearningHistory,
} from "./types";

const db = supabase;

export async function getLearningSnapshot(userId: string): Promise<LearningSnapshot> {
  const results = await Promise.allSettled([
    db.from("learning_concepts").select("*").order("framework").order("title"),
    (db as any)
      .from("learning_user_concepts")
      .select("*")
      .eq("user_id", userId)
      .order("subject")
      .order("title"),
    db.from("learning_mastery").select("*").eq("user_id", userId),
    db
      .from("learning_plan_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("due_at")
      .limit(8),
    db
      .from("learning_boards")
      .select("*, learning_board_items(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("learning_resources")
      .select("*, learning_concepts(title)")
      .order("created_at", { ascending: false })
      .limit(12),
    db.from("learning_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("learning_sources")
      .select("id,name,mime_type,source_kind,extracted_text,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("learning_integrations").select("*").eq("user_id", userId),
    db
      .from("learning_sessions")
      .select("id,concept_id,title,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("learning_artifacts")
      .select("id,concept_id,session_id,artifact_type,title,content,ai_generated,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("learning_attempts")
      .select("id,concept_id,correct,score,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("learning_flashcards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("learning_flashcard_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("reviewed_at", { ascending: false })
      .limit(500),
    db
      .from("learning_notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("learning_exams")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("learning_revision_schedule")
      .select("*")
      .eq("user_id", userId)
      .order("next_review_at")
      .limit(50),
    db
      .from("learning_memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("learning_voice_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(20),
    db
      .from("learning_ocr_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("learning_whiteboards")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("learning_daily_goals")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30),
    db
      .from("learning_weekly_goals")
      .select("*")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(12),
    db
      .from("learning_analytics")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30),
    db
      .from("learning_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const failedQuery = results.find(
    (result) => result.status === "rejected" || (result.status === "fulfilled" && result.value.error),
  );
  if (failedQuery) {
    throw new Error("Some learning data could not be loaded. Please retry before continuing.");
  }

  const [
    concepts,
    userConcepts,
    mastery,
    tasks,
    boards,
    resources,
    profile,
    sources,
    integrations,
    sessions,
    artifacts,
    attempts,
    flashcards,
    flashcardReviews,
    notes,
    exams,
    revisionSchedule,
    memory,
    voiceSessions,
    ocrJobs,
    whiteboards,
    dailyGoals,
    weeklyGoals,
    analytics,
    history,
  ] = results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return { data: null as any, error: r.reason };
  });

  const safe = <T>(result: { data: T | null; error: any }): T => (result.data ?? []) as T;

  return {
    concepts: [
      ...(safe(concepts) as any[]).map((concept: any) => ({
        ...concept,
        framework: concept.framework as LearningConcept["framework"],
        grade_band: concept.grade_band as LearningConcept["grade_band"],
        is_custom: false,
      })),
      ...(safe(userConcepts) as any[]).map((concept: any) => ({
        ...concept,
        framework: concept.framework as LearningConcept["framework"],
        grade_band: concept.grade_band as LearningConcept["grade_band"],
        is_custom: true,
      })),
    ] as LearningConcept[],
    mastery: safe(mastery) as Mastery[],
    tasks: safe(tasks) as (LearningPlanTask & { learning_concepts?: { title: string } })[],
    boards: safe(boards) as LearningBoard[],
    resources: safe(resources) as LearningResource[],
    profile: (profile as any)?.data ?? null,
    sources: safe(sources) as LearningSource[],
    integrations: safe(integrations) as any[],
    sessions: safe(sessions) as LearningSession[],
    artifacts: safe(artifacts) as LearningArtifact[],
    attempts: safe(attempts) as LearningAttempt[],
    flashcards: safe(flashcards) as Flashcard[],
    flashcard_reviews: safe(flashcardReviews) as FlashcardReview[],
    notes: safe(notes) as LearningNote[],
    exams: safe(exams) as Exam[],
    revision_schedule: safe(revisionSchedule) as RevisionSchedule[],
    memory: safe(memory) as LearningMemory[],
    voice_sessions: safe(voiceSessions) as VoiceSession[],
    ocr_jobs: safe(ocrJobs) as OCRJob[],
    whiteboards: safe(whiteboards) as Whiteboard[],
    daily_goals: safe(dailyGoals) as DailyGoal[],
    weekly_goals: safe(weeklyGoals) as WeeklyGoal[],
    analytics: safe(analytics) as LearningAnalytics[],
    history: safe(history) as LearningHistory[],
  } as LearningSnapshot;
}

export async function createTutorSession(
  userId: string,
  conceptId: string | null,
  title: string,
  subject?: string | null,
  topic?: string | null,
) {
  const { data, error } = await db
    .from("learning_sessions")
    .insert({
      user_id: userId,
      concept_id: conceptId,
      title,
      subject: subject ?? null,
      topic: topic ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getLatestTutorSession(userId: string, conceptId: string | null) {
  let query = db
    .from("learning_sessions")
    .select("id,concept_id,title,status,subject,topic,created_at,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (conceptId) query = query.eq("concept_id", conceptId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTutorSessions(userId: string) {
  const { data, error } = await db
    .from("learning_sessions")
    .select("id,concept_id,title,status,subject,topic,created_at,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LearningSession[];
}

export async function searchTutorSessions(userId: string, query: string) {
  const { data, error } = await db
    .from("learning_sessions")
    .select("id,concept_id,title,status,subject,topic,created_at,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .ilike("title", `%${query}%`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LearningSession[];
}

export async function renameTutorSession(userId: string, sessionId: string, title: string) {
  const { error } = await db
    .from("learning_sessions")
    .update({ title })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteTutorSession(userId: string, sessionId: string) {
  const { error: messagesError } = await db
    .from("learning_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (messagesError) throw messagesError;
  const { error } = await db
    .from("learning_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function saveTutorMessage(
  userId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  sourceIds: string[] = [],
) {
  const idempotencyKey = `${sessionId}:${role}:${Date.now()}`;
  const { error } = await db.from("learning_messages").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      role,
      content,
      source_ids: sourceIds,
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key" },
  );
  if (error) throw error;
  const { error: sessionError } = await db
    .from("learning_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (sessionError) throw sessionError;
}

export async function getSessionMessages(userId: string, sessionId: string) {
  const { data, error } = await db
    .from("learning_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveArtifact(
  userId: string,
  input: {
    conceptId?: string | null;
    sessionId?: string | null;
    type: string;
    title: string;
    content: unknown;
    aiGenerated?: boolean;
  },
) {
  const { error } = await db.from("learning_artifacts").insert({
    user_id: userId,
    concept_id: input.conceptId ?? null,
    session_id: input.sessionId ?? null,
    artifact_type: input.type,
    title: input.title,
    content: input.content as any,
    ai_generated: input.aiGenerated ?? true,
  });
  if (error) throw error;
}

export async function saveProfile(userId: string, input: Record<string, unknown>) {
  const { error } = await db
    .from("learning_profiles")
    .upsert({ user_id: userId, ...input } as any, { onConflict: "user_id" });
  if (error) throw error;
}

export async function completeStudentOnboarding(userId: string, classNumber: number) {
  const gradeBand = classToGradeBand(classNumber) ?? "middle";

  const { data: existing, error: loadError } = await (db as any)
    .from("learning_profiles")
    .select("custom_subjects")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw loadError;

  const profile: Record<string, unknown> = {
    user_id: userId,
    grade_band: gradeBand,
    class: String(classNumber),
    curriculum: "CBSE",
    custom_subjects: existing?.custom_subjects ?? [],
  };
  const { error } = await db
    .from("learning_profiles")
    .upsert(profile as any, { onConflict: "user_id" });
  if (error) throw error;
}

export async function addCustomSubject(userId: string, subject: string, description = "") {
  const { data: existing, error: loadError } = await (db as any)
    .from("learning_profiles")
    .select("custom_subjects")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw loadError;
  const current: Array<{ name: string; description?: string }> =
    (existing?.custom_subjects as Array<{ name: string; description?: string }> | undefined) ?? [];
  if (!current.some((s) => s.name.toLowerCase() === subject.toLowerCase())) {
    current.push({ name: subject, description });
  }
  const { error } = await db
    .from("learning_profiles")
    .upsert({ user_id: userId, custom_subjects: current } as any, {
      onConflict: "user_id",
    });
  if (error) throw error;
}

export interface CustomConceptInput {
  subject: string;
  title: string;
  description?: string;
  standardCode?: string;
  chapter?: string;
  keywords?: string[];
  class?: string | null;
}

function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createCustomConcept(
  userId: string,
  input: CustomConceptInput,
): Promise<LearningConcept> {
  const id = `uc_${userId}_${slugify(input.subject)}_${slugify(input.title)}`;
  const gradeBand = classToGradeBand(input.class) ?? "middle";
  const { error } = await (db as any).from("learning_user_concepts").insert({
    id,
    user_id: userId,
    subject: input.subject,
    standard_code: input.standardCode ?? "",
    framework: "CBSE",
    grade_band: gradeBand,
    class: input.class ?? null,
    title: input.title,
    description: input.description ?? "",
    prerequisites: [],
    chapter: input.chapter ?? null,
    keywords: input.keywords ?? [],
    misconception_tags: [],
    estimated_study_minutes: 20,
    is_custom: true,
  });
  if (error) throw error;

  return {
    id,
    standard_code: input.standardCode ?? "",
    framework: "CBSE",
    subject: input.subject,
    grade_band: gradeBand,
    title: input.title,
    description: input.description ?? "",
    prerequisites: [],
    chapter: input.chapter ?? undefined,
    keywords: input.keywords ?? undefined,
    is_custom: true,
    class: input.class ?? null,
  };
}

export async function getCustomConcepts(userId: string): Promise<LearningConcept[]> {
  const { data, error } = await (db as any)
    .from("learning_user_concepts")
    .select("*")
    .eq("user_id", userId)
    .order("subject")
    .order("title");
  if (error) throw error;
  return (data ?? []).map((concept: any) => ({
    ...concept,
    framework: concept.framework as LearningConcept["framework"],
    grade_band: concept.grade_band as LearningConcept["grade_band"],
    is_custom: true,
  })) as LearningConcept[];
}

export async function recordAttempt(userId: string, question: Question, selectedIndex: number) {
  const correct = selectedIndex === question.correctIndex;
  const { data: current, error: lookupError } = await db
    .from("learning_mastery")
    .select("*")
    .eq("user_id", userId)
    .eq("concept_id", question.conceptId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const update = nextMastery(
    current as { score: number; confidence: number; evidence_count: number } | null,
    correct,
  );
  const [{ error: attemptError }, { error: masteryError }] = await Promise.all([
    db.from("learning_attempts").insert({
      user_id: userId,
      concept_id: question.conceptId,
      question: question as unknown as Json,
      answer: { selectedIndex },
      correct,
      score: correct ? 1 : 0,
      feedback: question.explanation,
    }),
    db
      .from("learning_mastery")
      .upsert(
        { user_id: userId, concept_id: question.conceptId, ...update },
        { onConflict: "user_id,concept_id" },
      ),
  ]);
  if (attemptError) throw attemptError;
  if (masteryError) throw masteryError;
  return { correct, mastery: update };
}

export async function saveEvidence(
  userId: string,
  input: {
    conceptId: string;
    sessionId: string | null;
    evidenceType: string;
    score?: number | null;
    note?: string | null;
  },
) {
  const { error } = await db.from("learning_evidence").insert({
    user_id: userId,
    concept_id: input.conceptId,
    session_id: input.sessionId,
    evidence_type: input.evidenceType,
    score: input.score ?? null,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export async function saveSourceChunks(userId: string, sourceId: string, chunks: string[]) {
  const rows = chunks.map((content, index) => ({
    user_id: userId,
    source_id: sourceId,
    chunk_index: index,
    content,
  }));
  const { error } = await db.from("learning_source_chunks").insert(rows);
  if (error) throw error;
}

export async function createBoard(userId: string, name: string) {
  const { data, error } = await db
    .from("learning_boards")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveToBoard(userId: string, boardId: string, resourceId: string) {
  const { error } = await db
    .from("learning_board_items")
    .upsert({ user_id: userId, board_id: boardId, resource_id: resourceId });
  if (error) throw error;
}

export async function completePlanTask(userId: string, taskId: string) {
  const { error } = await db
    .from("learning_plan_tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addConceptToPlan(userId: string, concept: { id: string; title: string }) {
  const { data: existing, error: existingError } = await db
    .from("learning_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  let planId = existing?.id as string | undefined;
  if (!planId) {
    const today = new Date();
    const { data, error } = await db
      .from("learning_plans")
      .insert({
        user_id: userId,
        title: "My adaptive study plan",
        starts_on: today.toISOString().slice(0, 10),
        ends_on: new Date(today.getTime() + 6 * 86_400_000).toISOString().slice(0, 10),
        generated_from: { source: "learning-dock" },
      })
      .select("id")
      .single();
    if (error) throw error;
    planId = data.id as string;
  }
  const { error } = await db.from("learning_plan_tasks").insert({
    user_id: userId,
    plan_id: planId,
    concept_id: concept.id,
    title: `Practice: ${concept.title}`,
    task_type: "practice",
    due_at: new Date().toISOString(),
    estimated_minutes: 20,
  });
  if (error) throw error;
}

// Flashcards
export async function generateFlashcards(
  userId: string,
  conceptId: string,
  count: number,
  sourceText?: string,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generate",
      conceptId,
      count,
      sourceText,
      language: getStudyLanguagePreference(),
    }),
  });
  if (!response.ok) throw new Error("Failed to generate flashcards");
  return response.json();
}

export async function reviewFlashcard(
  flashcardId: string,
  quality: number,
  responseTimeMs?: number,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "review", flashcardId, quality, responseTimeMs }),
  });
  if (!response.ok) throw new Error("Failed to review flashcard");
  return response.json();
}

export async function getDueFlashcards(userId: string, limit = 20) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "due", limit }),
  });
  if (!response.ok) throw new Error("Failed to get due flashcards");
  return response.json();
}

export async function listFlashcards(userId: string, conceptId?: string, limit = 50) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", conceptId, limit }),
  });
  if (!response.ok) throw new Error("Failed to list flashcards");
  return response.json();
}

// Exams
export async function createExam(
  userId: string,
  input: {
    conceptIds: string[];
    examType: "mock" | "chapter" | "full_syllabus" | "custom" | "timed_quiz";
    questionCount: number;
    timeLimitMinutes?: number;
    difficulty: number;
  },
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  });
  if (!response.ok) throw new Error("Failed to create exam");
  const result = await response.json();
  return result.exam;
}

export async function submitExamAnswer(
  examId: string,
  questionId: string,
  userAnswer: Record<string, unknown>,
  timeSpentSeconds?: number,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit_answer",
      examId,
      questionId,
      userAnswer,
      timeSpentSeconds,
    }),
  });
  if (!response.ok) throw new Error("Failed to submit answer");
  return response.json();
}

export async function completeExam(examId: string) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", examId }),
  });
  if (!response.ok) throw new Error("Failed to complete exam");
  return response.json();
}

export async function getExam(examId: string) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get", examId }),
  });
  if (!response.ok) throw new Error("Failed to get exam");
  return response.json();
}

export async function listExams(status?: string, limit = 20) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", status, limit }),
  });
  if (!response.ok) throw new Error("Failed to list exams");
  return response.json();
}

// Revision
export async function scheduleRevision(userId: string, conceptIds: string[]) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/revision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "schedule", conceptIds }),
  });
  if (!response.ok) throw new Error("Failed to schedule revision");
  return response.json();
}

export async function getDueRevision(userId: string, limit = 20) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/revision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "due", limit }),
  });
  if (!response.ok) throw new Error("Failed to get due revision");
  return response.json();
}

export async function completeRevision(userId: string, conceptId: string, quality: number) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/revision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", conceptId, quality }),
  });
  if (!response.ok) throw new Error("Failed to complete revision");
  return response.json();
}

// Voice
export async function startVoiceSession(
  userId: string,
  conceptId: string | undefined,
  mode: "stt" | "tts" | "conversational",
  language = "en",
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start_session", conceptId, mode, language }),
  });
  if (!response.ok) throw new Error("Failed to start voice session");
  return response.json();
}

export async function endVoiceSession(
  sessionId: string,
  transcript?: string,
  durationSeconds?: number,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "end_session", sessionId, transcript, durationSeconds }),
  });
  if (!response.ok) throw new Error("Failed to end voice session");
  return response.json();
}

// OCR
export async function processOCR(
  sourceId: string,
  mimeType: string,
  fileBase64: string,
  filename?: string,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "process", sourceId, mimeType, fileBase64, filename }),
  });
  if (!response.ok) throw new Error("Failed to process OCR");
  return response.json();
}

// Whiteboard
export async function createWhiteboard(
  userId: string,
  input: {
    conceptId?: string;
    sessionId?: string;
    title: string;
    canvasData: Record<string, unknown>;
  },
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  });
  if (!response.ok) throw new Error("Failed to create whiteboard");
  return response.json();
}

export async function updateWhiteboard(
  whiteboardId: string,
  canvasData: Record<string, unknown>,
  aiAnnotations?: Record<string, unknown>[],
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", whiteboardId, canvasData, aiAnnotations }),
  });
  if (!response.ok) throw new Error("Failed to update whiteboard");
  return response.json();
}

export async function annotateWhiteboard(
  whiteboardId: string,
  canvasData: Record<string, unknown>,
  instruction: string,
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "annotate", whiteboardId, canvasData, instruction }),
  });
  if (!response.ok) throw new Error("Failed to annotate whiteboard");
  return response.json();
}

export async function getWhiteboard(whiteboardId: string) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get", whiteboardId }),
  });
  if (!response.ok) throw new Error("Failed to get whiteboard");
  return response.json();
}

export async function listWhiteboards(conceptId?: string, limit = 20) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/whiteboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", conceptId, limit }),
  });
  if (!response.ok) throw new Error("Failed to list whiteboards");
  return response.json();
}

// Notes
export async function createNote(
  userId: string,
  input: {
    title: string;
    content?: Record<string, unknown>;
    contentText?: string;
    conceptId?: string;
    sessionId?: string;
    tags?: string[];
    isAiGenerated?: boolean;
  },
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  });
  if (!response.ok) throw new Error("Failed to create note");
  return response.json();
}

export async function generateNoteSummary(
  noteId: string,
  format: "summary" | "key_points" | "cheat_sheet" | "flashcards",
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate", noteId, format }),
  });
  if (!response.ok) throw new Error("Failed to generate note summary");
  return response.json();
}

export async function listNotes(conceptId?: string, sessionId?: string, limit = 20) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", conceptId, sessionId, limit }),
  });
  if (!response.ok) throw new Error("Failed to list notes");
  return response.json();
}

// Memory
export async function storeMemory(
  userId: string,
  input: {
    memoryType: "conversation" | "mistake" | "strength" | "preference" | "goal" | "misconception";
    conceptId?: string;
    sessionId?: string;
    content: Record<string, unknown>;
    summary?: string;
    importance?: number;
    confidence?: number;
    tags?: string[];
  },
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "store", ...input }),
  });
  if (!response.ok) throw new Error("Failed to store memory");
  return response.json();
}

export async function retrieveMemories(
  userId: string,
  options: {
    memoryType?: string;
    conceptId?: string;
    limit?: number;
  } = {},
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "retrieve", ...options }),
  });
  if (!response.ok) throw new Error("Failed to retrieve memories");
  return response.json();
}

// Analytics
export async function recordAnalytics(
  userId: string,
  input: {
    date: string;
    studyTimeSeconds: number;
    conceptsStudied: number;
    questionsAnswered: number;
    correctAnswers: number;
    tutorMessages: number;
    flashcardsReviewed: number;
    notesCreated: number;
    examsCompleted: number;
    voiceMinutes: number;
    whiteboardSessions: number;
    xpEarned: number;
  },
) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "record", ...input }),
  });
  if (!response.ok) throw new Error("Failed to record analytics");
  return response.json();
}

// AI Study Session
export async function startAutoStudy(conceptId?: string, durationMinutes = 25, focus?: string) {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/learning/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "auto_study", conceptId, durationMinutes, focus }),
  });
  if (!response.ok) throw new Error("Failed to start auto study session");
  return response.json();
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || "";
}
