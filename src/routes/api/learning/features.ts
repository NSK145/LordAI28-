/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse } from "@/lib/api-error";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-provider";

function getOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  return createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  });
}

const ExamRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    conceptIds: z.array(z.string().min(1)).min(1).max(20),
    examType: z.enum(["mock", "chapter", "full_syllabus", "custom", "timed_quiz"]).optional(),
    questionCount: z.number().int().min(5).max(50).optional(),
    timeLimitMinutes: z.number().int().min(5).max(180).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    action: z.literal("submit_answer"),
    examId: z.string().uuid(),
    questionId: z.string().uuid(),
    userAnswer: z.record(z.string(), z.unknown()),
    timeSpentSeconds: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("complete"),
    examId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("get"),
    examId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("list"),
    status: z.enum(["draft", "in_progress", "completed", "abandoned"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

const RevisionRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("schedule"),
    conceptIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    action: z.literal("due"),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal("complete_review"),
    conceptId: z.string().min(1),
    quality: z.number().int().min(0).max(5),
  }),
]);

const VoiceRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("stt"),
    audioBase64: z.string().min(1),
    language: z.string().optional(),
  }),
  z.object({
    action: z.literal("tts"),
    text: z.string().min(1).max(5000),
    voice: z.string().optional(),
    language: z.string().optional(),
  }),
  z.object({
    action: z.literal("start_session"),
    conceptId: z.string().optional(),
    mode: z.enum(["stt", "tts", "conversational"]).optional(),
    language: z.string().optional(),
  }),
  z.object({
    action: z.literal("end_session"),
    sessionId: z.string().uuid(),
    transcript: z.string().optional(),
    durationSeconds: z.number().int().optional(),
  }),
]);

const OCRRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("process"),
    sourceId: z.string().uuid(),
    mimeType: z.string(),
    fileBase64: z.string().min(1),
  }),
  z.object({
    action: z.literal("status"),
    jobId: z.string().uuid(),
  }),
]);

const WhiteboardRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    conceptId: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    canvasData: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("update"),
    whiteboardId: z.string().uuid(),
    canvasData: z.record(z.string(), z.unknown()),
    aiAnnotations: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  z.object({
    action: z.literal("annotate"),
    whiteboardId: z.string().uuid(),
    canvasData: z.record(z.string(), z.unknown()),
    instruction: z.string().min(1),
  }),
  z.object({
    action: z.literal("get"),
    whiteboardId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("list"),
    conceptId: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

const NotesRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    conceptId: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    content: z.record(z.string(), z.unknown()),
    contentText: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isAiGenerated: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("generate_summary"),
    noteId: z.string().uuid(),
    format: z.enum(["summary", "key_points", "cheat_sheet", "flashcards"]).optional(),
  }),
  z.object({
    action: z.literal("update"),
    noteId: z.string().uuid(),
    title: z.string().optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    contentText: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("get"),
    noteId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("list"),
    conceptId: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

const GoalsRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_daily"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetMinutes: z.number().int().min(5).max(480).optional(),
    targetConcepts: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    action: z.literal("set_weekly"),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetMinutes: z.number().int().min(30).max(1680).optional(),
    targetConcepts: z.number().int().min(1).max(50).optional(),
    targetExams: z.number().int().min(0).max(10).optional(),
  }),
  z.object({
    action: z.literal("get_daily"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  z.object({
    action: z.literal("get_weekly"),
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  z.object({
    action: z.literal("update_progress"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    minutesStudied: z.number().int().min(0).optional(),
    conceptsCompleted: z.number().int().min(0).optional(),
  }),
]);

const MemoryRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("store"),
    memoryType: z.enum([
      "conversation",
      "mistake",
      "strength",
      "preference",
      "goal",
      "misconception",
    ]),
    conceptId: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    content: z.record(z.string(), z.unknown()),
    summary: z.string().optional(),
    importance: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("retrieve"),
    memoryType: z
      .enum(["conversation", "mistake", "strength", "preference", "goal", "misconception"])
      .optional(),
    conceptId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal("extract_from_session"),
    sessionId: z.string().uuid(),
  }),
]);

const AnalyticsRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("record"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studyTimeSeconds: z.number().int().min(0).optional(),
    conceptsStudied: z.number().int().min(0).optional(),
    questionsAnswered: z.number().int().min(0).optional(),
    correctAnswers: z.number().int().min(0).optional(),
    tutorMessages: z.number().int().min(0).optional(),
    flashcardsReviewed: z.number().int().min(0).optional(),
    notesCreated: z.number().int().min(0).optional(),
    examsCompleted: z.number().int().min(0).optional(),
    voiceMinutes: z.number().int().min(0).optional(),
    whiteboardSessions: z.number().int().min(0).optional(),
    xpEarned: z.number().int().min(0).optional(),
  }),
  z.object({
    action: z.literal("get_range"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("get_summary"),
    days: z.number().int().min(1).max(365).optional(),
  }),
]);

const HistoryRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("record"),
    sessionType: z.enum([
      "tutor",
      "practice",
      "exam",
      "flashcard",
      "note",
      "voice",
      "whiteboard",
      "ocr",
      "revision",
    ]),
    conceptId: z.string().optional(),
    title: z.string().min(1).max(200),
    summary: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    durationSeconds: z.number().int().min(0).optional(),
    outcomeScore: z.number().min(0).max(1).optional(),
  }),
  z.object({
    action: z.literal("list"),
    sessionType: z
      .enum([
        "tutor",
        "practice",
        "exam",
        "flashcard",
        "note",
        "voice",
        "whiteboard",
        "ocr",
        "revision",
      ])
      .optional(),
    conceptId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
]);

export const Route = createFileRoute("/api/learning/features")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const parsed = ExamRequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid exam request.", requestId);

        const auth = context as { userId?: string; supabase?: { from: (table: string) => any } };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(
            401,
            "AI_AUTH_ERROR",
            "Sign in to use learning tools.",
            requestId,
          );

        const db = auth.supabase;
        const userId = auth.userId;

        try {
          if (parsed.data.action === "create") {
            const concepts = await Promise.all(
              parsed.data.conceptIds.map((id) =>
                db.from("learning_concepts").select("*").eq("id", id).maybeSingle(),
              ),
            );
            const validConcepts = concepts.map((c) => c.data).filter(Boolean);
            if (validConcepts.length === 0) {
              return apiErrorResponse(
                422,
                "NO_VALID_CONCEPTS",
                "No curriculum concepts were found for this exam.",
                requestId,
              );
            }

            const questions = [];
            const questionsPerConcept = Math.max(
              1,
              Math.ceil((parsed.data.questionCount ?? 10) / validConcepts.length),
            );

            for (const concept of validConcepts) {
              const { data: mastery } = await db
                .from("learning_mastery")
                .select("*")
                .eq("user_id", userId)
                .eq("concept_id", concept.id)
                .maybeSingle();

              for (
                let i = 0;
                i < questionsPerConcept && questions.length < (parsed.data.questionCount ?? 10);
                i++
              ) {
                const difficulty = mastery
                  ? Math.ceil((1 - (mastery.score ?? 0.35)) * 5)
                  : (parsed.data.difficulty ?? 3);
                let question;
                try {
                  question = await generateAIQuestion(
                    concept,
                    mastery,
                    difficulty,
                    undefined,
                    "mcq",
                  );
                } catch {
                  question = fallbackQuestion(concept, difficulty, undefined, "mcq");
                }
                questions.push({
                  concept_id: concept.id,
                  question,
                  question_type: "mcq",
                  difficulty,
                  points: 1,
                  order_index: questions.length,
                });
              }
            }

            const { data: exam, error } = await db
              .from("learning_exams")
              .insert({
                user_id: userId,
                title: `${(parsed.data.examType ?? "chapter").charAt(0).toUpperCase() + (parsed.data.examType ?? "chapter").slice(1)} exam`,
                exam_type: parsed.data.examType ?? "chapter",
                concept_ids: parsed.data.conceptIds,
                status: "draft",
                time_limit_seconds: parsed.data.timeLimitMinutes
                  ? parsed.data.timeLimitMinutes * 60
                  : null,
                total_questions: questions.length,
              })
              .select()
              .single();

            if (error) throw error;

            const { data: savedQuestions, error: questionError } = await db
              .from("learning_exam_questions")
              .insert(questions.map((question) => ({ exam_id: exam.id, ...question })))
              .select();
            if (questionError) {
              await db.from("learning_exams").delete().eq("id", exam.id).eq("user_id", userId);
              throw questionError;
            }

            return Response.json({ exam: { ...exam, questions: savedQuestions ?? [] } });
          }

          if (parsed.data.action === "submit_answer") {
            const { data: question } = await db
              .from("learning_exam_questions")
              .select("*")
              .eq("id", parsed.data.questionId)
              .maybeSingle();
            if (!question)
              return apiErrorResponse(404, "NOT_FOUND", "Question not found.", requestId);

            let isCorrect = false;
            let score = 0;
            let feedback = "";

            if (question.question_type === "mcq") {
              isCorrect = parsed.data.userAnswer.selectedIndex === question.question.correctIndex;
              score = isCorrect ? question.points : 0;
              feedback = question.question.explanation;
            } else if (question.question_type === "numerical") {
              const expected = question.question.choices[0];
              const userNum = Number(parsed.data.userAnswer.value);
              const expectedNum = Number(expected);
              isCorrect = Math.abs(userNum - expectedNum) < 0.01;
              score = isCorrect ? question.points : 0;
              feedback = question.question.explanation;
            } else {
              // Short answer, diagram, essay - use AI evaluation
              const provider = getOpenRouterProvider();
              const { text } = await generateText({
                model: provider(OPENROUTER_DEFAULT_MODEL),
                system:
                  "You are an exam evaluator. Return JSON: {correct: boolean, score: number, feedback: string}",
                messages: [
                  {
                    role: "user",
                    content: `Question: ${question.question.prompt}\nExpected: ${question.question.explanation}\nStudent answer: ${JSON.stringify(parsed.data.userAnswer)}\nEvaluate and return JSON only.`,
                  },
                ],
                maxOutputTokens: 500,
                temperature: 0.2,
              });
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const evalResult = JSON.parse(jsonMatch[0]);
                isCorrect = evalResult.correct;
                score = evalResult.score;
                feedback = evalResult.feedback;
              }
            }

            const { data: answer, error } = await db
              .from("learning_exam_answers")
              .insert({
                exam_id: parsed.data.examId,
                question_id: parsed.data.questionId,
                user_answer: parsed.data.userAnswer,
                ai_evaluation: { correct: isCorrect, feedback },
                is_correct: isCorrect,
                score,
                feedback,
                time_spent_seconds: parsed.data.timeSpentSeconds,
              })
              .select()
              .single();

            if (error) throw error;

            return Response.json({ answer, isCorrect, score, feedback });
          }

          if (parsed.data.action === "complete") {
            const { data: answers, error: answersError } = await db
              .from("learning_exam_answers")
              .select("*")
              .eq("exam_id", parsed.data.examId);
            if (answersError) throw answersError;

            const { count: questionCount, error: questionCountError } = await db
              .from("learning_exam_questions")
              .select("id", { count: "exact", head: true })
              .eq("exam_id", parsed.data.examId);
            if (questionCountError) throw questionCountError;

            const totalQuestions = questionCount ?? 0;
            const correctAnswers = answers?.filter((a: any) => a.is_correct).length ?? 0;
            const score =
              totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

            const { data: exam, error } = await db
              .from("learning_exams")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                score,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
              })
              .eq("id", parsed.data.examId)
              .eq("user_id", userId)
              .select()
              .single();

            if (error) throw error;

            // Update mastery for each concept
            if (answers) {
              for (const answer of answers) {
                const { data: question } = await db
                  .from("learning_exam_questions")
                  .select("concept_id")
                  .eq("id", answer.question_id)
                  .maybeSingle();

                if (question?.concept_id) {
                  const { data: mastery } = await db
                    .from("learning_mastery")
                    .select("*")
                    .eq("user_id", userId)
                    .eq("concept_id", question.concept_id)
                    .maybeSingle();

                  const { nextMastery } = await import("@/lib/learning/mastery");
                  const update = nextMastery(
                    mastery as { score: number; confidence: number; evidence_count: number } | null,
                    answer.is_correct ?? false,
                  );

                  await db
                    .from("learning_mastery")
                    .upsert(
                      { user_id: userId, concept_id: question.concept_id, ...update },
                      { onConflict: "user_id,concept_id" },
                    );
                }
              }
            }

            return Response.json({ exam, score, correctAnswers, totalQuestions });
          }

          if (parsed.data.action === "get") {
            const { data: exam } = await db
              .from("learning_exams")
              .select("*, learning_exam_questions(*)")
              .eq("id", parsed.data.examId)
              .eq("user_id", userId)
              .maybeSingle();

            if (!exam) return apiErrorResponse(404, "NOT_FOUND", "Exam not found.", requestId);

            const { data: answers } = await db
              .from("learning_exam_answers")
              .select("*")
              .eq("exam_id", parsed.data.examId);

            return Response.json({ exam, answers: answers ?? [] });
          }

          if (parsed.data.action === "list") {
            let query = db
              .from("learning_exams")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(parsed.data.limit ?? 20);

            if (parsed.data.status) {
              query = query.eq("status", parsed.data.status);
            }

            const { data, error } = await query;
            if (error) throw error;

            return Response.json({ exams: data ?? [] });
          }

          return apiErrorResponse(400, "INVALID_ACTION", "Unknown action.", requestId);
        } catch (err) {
          console.error("Exam error:", err);
          return apiErrorResponse(500, "INTERNAL_ERROR", "Exam service unavailable.", requestId);
        }
      },
    },
  },
});

function generateAIQuestion(
  concept: any,
  mastery: any,
  difficulty: number,
  topic: string | undefined,
  questionType: "mcq" | "numerical" | "short_answer" | "diagram" | "essay",
): Promise<any> {
  // Simplified inline version
  return Promise.resolve(fallbackQuestion(concept, difficulty, topic, questionType));
}

function fallbackQuestion(
  concept: any,
  difficulty: number,
  topic: string | undefined,
  questionType: "mcq" | "numerical" | "short_answer" | "diagram" | "essay",
): any {
  const diffLabels = ["", "introductory", "foundational", "standard", "advanced", "mastery"];
  const diffLabel = diffLabels[difficulty] ?? "standard";
  const focus = topic ? ` on "${topic}"` : "";

  return {
    id: crypto.randomUUID(),
    conceptId: concept.id,
    prompt: `Which statement best demonstrates ${diffLabel} understanding of ${concept.title}${focus}?`,
    choices: [
      `I can explain ${concept.title}${focus} and apply it to a new exam-style example.`,
      `I recognize the term but cannot explain it clearly.`,
      `It is unrelated to the topic being studied.`,
      `Memorizing a definition is always enough.`,
    ],
    correctIndex: 0,
    hint: `Choose the option that requires both explanation and application of ${concept.title}${focus}.`,
    explanation: `Mastery of ${concept.title}${focus} means explaining the idea and using it in an unfamiliar situation, not just recalling facts.`,
    difficulty: difficulty,
    rubric: "Award credit for explanation and correct application, not recall alone.",
    aiGenerated: false,
    questionType,
  };
}
