/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText, streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse } from "@/lib/api-error";
import type { Question, TutorMode, LearningConcept, Mastery } from "@/lib/learning/types";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-provider";

async function resolveConcept(db: any, conceptId: string): Promise<LearningConcept | null> {
  const { data: catalog } = await db
    .from("learning_concepts")
    .select("*")
    .eq("id", conceptId)
    .maybeSingle();
  if (catalog) {
    return {
      ...catalog,
      is_custom: false,
    } as LearningConcept;
  }
  const { data: custom } = await db
    .from("learning_user_concepts")
    .select("*")
    .eq("id", conceptId)
    .maybeSingle();
  if (!custom) return null;
  return {
    ...custom,
    is_custom: true,
  } as LearningConcept;
}

function getOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  return createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  });
}

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("question"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptId: z.string().min(1),
    difficulty: z.number().int().min(1).max(5).optional(),
    topic: z.string().optional(),
    questionType: z.enum(["mcq", "numerical", "short_answer", "diagram", "essay"]).optional(),
  }),
  z.object({
    action: z.literal("plan"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptIds: z.array(z.string().min(1)).min(1).max(12),
    weeklyMinutes: z.number().int().min(30).max(1680).optional(),
    examDate: z.string().optional(),
    syllabus: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("flashcards"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptId: z.string().min(1),
    count: z.number().int().min(1).max(20).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    action: z.literal("exam"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptIds: z.array(z.string().min(1)).min(1).max(20),
    examType: z.enum(["mock", "chapter", "full_syllabus", "custom", "timed_quiz"]).optional(),
    questionCount: z.number().int().min(5).max(50).optional(),
    timeLimitMinutes: z.number().int().min(5).max(180).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    action: z.literal("tutor"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptId: z.string().optional(),
    mode: z
      .enum(["socratic", "direct", "hint", "worked_example", "simplified", "analogy", "diagnostic"])
      .optional(),
    userMessage: z.string().min(1),
    conversationHistory: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      )
      .max(20)
      .optional(),
    subject: z.string().optional(),
    explanationDepth: z.enum(["concise", "standard", "detailed"]).optional(),
    gradeBand: z.enum(["middle", "high"]).optional(),
    curriculum: z.string().optional(),
    sourceContext: z.string().optional(),
  }),
  z.object({
    action: z.literal("summary"),
    language: z.enum(["English", "Spanish", "French", "Hindi", "Arabic"]).optional(),
    conceptId: z.string().min(1),
    sourceText: z.string().min(50),
    format: z.enum(["summary", "key_points", "cheat_sheet", "flashcards"]).optional(),
  }),
  z.object({
    action: z.literal("revision_schedule"),
    conceptIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    action: z.literal("memory_extract"),
    sessionId: z.string().min(1),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      )
      .min(1),
  }),
  z.object({
    action: z.literal("auto_study"),
    conceptId: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(120).optional(),
    focus: z.string().optional(),
  }),
]);

const QuestionSchema = z.object({
  prompt: z.string(),
  choices: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  hint: z.string(),
  explanation: z.string(),
  rubric: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function buildQuestionPrompt(
  concept: LearningConcept,
  mastery: Mastery | undefined,
  difficulty: number,
  topic: string | undefined,
  questionType: "mcq" | "numerical" | "short_answer" | "diagram" | "essay",
): string {
  const diffLabels = ["", "introductory", "foundational", "standard", "advanced", "mastery"];
  const diffLabel = diffLabels[difficulty] ?? "standard";
  const masteryLevel = mastery ? Math.round(mastery.score * 100) : 35;
  const focus = topic ? ` on "${topic}"` : "";

  const typeInstructions = {
    mcq: `Create a ${diffLabel} multiple-choice question with 4 options. Only one is correct.`,
    numerical: `Create a ${diffLabel} numerical problem requiring a calculated answer. Return the exact answer in the explanation.`,
    short_answer: `Create a ${diffLabel} short-answer question requiring a 1-3 sentence explanation.`,
    diagram: `Create a ${diffLabel} diagram-based question. Describe the diagram in the prompt and ask a question about it.`,
    essay: `Create a ${diffLabel} essay-style question requiring a structured multi-paragraph response.`,
  };

  return `You are a ${diffLabel}-level ${concept.framework} assessment designer for ${concept.subject} (${concept.grade_band} school).

Concept: ${concept.title} (${concept.standard_code})
Description: ${concept.description}
Prerequisites: ${concept.prerequisites.join(", ") || "none"}
Student mastery estimate: ${masteryLevel}%
Difficulty requested: ${diffLabel}${focus}

${typeInstructions[questionType]}

Return STRICT JSON only. No markdown, no extra text.
{
  "prompt": "Full question text",
  "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctIndex": 0,
  "hint": "One-sentence hint without giving the answer",
  "explanation": "Clear explanation of why the answer is correct and why others are wrong",
  "rubric": "Brief rubric for grading",
  "metadata": { "keyConcepts": [], "commonMisconceptions": [] }
}`;
}

async function generateAIQuestion(
  concept: LearningConcept,
  mastery: Mastery | undefined,
  difficulty: number,
  topic: string | undefined,
  questionType: "mcq" | "numerical" | "short_answer" | "diagram" | "essay",
  language?: string,
): Promise<Question> {
  const provider = getOpenRouterProvider();

  const { text } = await generateText({
    model: provider(OPENROUTER_DEFAULT_MODEL),
    system: `You are a ${["", "introductory", "foundational", "standard", "advanced", "mastery"][difficulty] ?? "standard"}-level ${concept.framework} assessment designer. Output ONLY strict JSON. No markdown. No extra text.${language ? ` Write all student-facing text in ${language}; keep JSON keys unchanged.` : ""}`,
    messages: [
      {
        role: "user",
        content: buildQuestionPrompt(concept, mastery, difficulty, topic, questionType),
      },
    ],
    maxOutputTokens: 800,
    temperature: 0.4,
    maxRetries: 2,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return JSON");

  const parsed = QuestionSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) throw new Error("AI output failed schema validation");

  return {
    id: crypto.randomUUID(),
    conceptId: concept.id,
    prompt: parsed.data.prompt,
    choices: parsed.data.choices,
    correctIndex: parsed.data.correctIndex,
    hint: parsed.data.hint,
    explanation: parsed.data.explanation,
    difficulty: difficulty as Question["difficulty"],
    rubric: parsed.data.rubric ?? "Concept understanding",
    aiGenerated: true,
    questionType,
    metadata: parsed.data.metadata,
  };
}

function fallbackQuestion(
  concept: LearningConcept,
  difficulty: number,
  topic: string | undefined,
  questionType: "mcq" | "numerical" | "short_answer" | "diagram" | "essay",
): Question {
  const diffLabels = ["", "introductory", "foundational", "standard", "advanced", "mastery"];
  const diffLabel = diffLabels[difficulty] ?? "standard";
  const focus = topic ? ` on "${topic}"` : "";

  const templates: Record<string, Question> = {
    mcq: {
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
      difficulty: difficulty as Question["difficulty"],
      rubric: "Award credit for explanation and correct application, not recall alone.",
      aiGenerated: false,
      questionType: "mcq",
    },
    numerical: {
      id: crypto.randomUUID(),
      conceptId: concept.id,
      prompt: `Solve a ${diffLabel} numerical problem related to ${concept.title}${focus}. Show your work.`,
      choices: ["Numerical answer required"],
      correctIndex: 0,
      hint: `Identify the known variables and the formula that relates them to ${concept.title}${focus}.`,
      explanation: `The solution requires applying the core formula for ${concept.title} with the given values.`,
      difficulty: difficulty as Question["difficulty"],
      rubric: "Correct formula selection, substitution, and arithmetic.",
      aiGenerated: false,
      questionType: "numerical",
    },
    short_answer: {
      id: crypto.randomUUID(),
      conceptId: concept.id,
      prompt: `Explain ${concept.title}${focus} in your own words. Give one concrete example.`,
      choices: ["Short answer required"],
      correctIndex: 0,
      hint: `Start with a definition, then describe a real-world situation where ${concept.title} applies.`,
      explanation: `A good answer defines the concept clearly and provides a relevant, original example.`,
      difficulty: difficulty as Question["difficulty"],
      rubric: "Clear definition + accurate, original example.",
      aiGenerated: false,
      questionType: "short_answer",
    },
    diagram: {
      id: crypto.randomUUID(),
      conceptId: concept.id,
      prompt: `A diagram shows [description of diagram related to ${concept.title}${focus}]. What does this diagram illustrate about ${concept.title}?`,
      choices: ["Diagram analysis required"],
      correctIndex: 0,
      hint: `Look for the key components labeled in the diagram and how they relate to ${concept.title}.`,
      explanation: `The diagram visualizes the core mechanism of ${concept.title}. The correct interpretation identifies the relationship shown.`,
      difficulty: difficulty as Question["difficulty"],
      rubric: "Identifies the illustrated principle and explains the diagram's key elements.",
      aiGenerated: false,
      questionType: "diagram",
    },
    essay: {
      id: crypto.randomUUID(),
      conceptId: concept.id,
      prompt: `Write a structured response: Define ${concept.title}${focus}, explain its significance, and describe two applications with examples.`,
      choices: ["Essay response required"],
      correctIndex: 0,
      hint: `Organize as: 1) Definition 2) Significance 3) Application 1 4) Application 2.`,
      explanation: `A complete answer covers all four parts with accurate content and clear examples.`,
      difficulty: difficulty as Question["difficulty"],
      rubric: "Definition, significance, and two distinct applications with examples.",
      aiGenerated: false,
      questionType: "essay",
    },
  };

  return templates[questionType] ?? templates.mcq;
}

async function generatePlan(
  conceptIds: string[],
  weeklyMinutes: number,
  examDate: string | undefined,
  syllabus: string[] | undefined,
  supabase: any,
) {
  const concepts = await Promise.all(conceptIds.map((id) => resolveConcept(supabase, id)));
  const validConcepts = concepts.filter((c): c is LearningConcept => c !== null);

  const now = new Date();
  const examDeadline = examDate ? new Date(examDate) : new Date(now.getTime() + 30 * 86400000);
  const weeksAvailable = Math.max(
    1,
    Math.ceil((examDeadline.getTime() - now.getTime()) / (7 * 86400000)),
  );
  const minutesPerWeek = Math.min(
    weeklyMinutes,
    Math.floor(weeklyMinutes / weeksAvailable) * weeksAvailable,
  );

  const tasks = validConcepts.slice(0, 10).map((concept, index) => {
    const week = index % weeksAvailable;
    const taskType = index % 3 === 2 ? "review" : index % 3 === 1 ? "learn" : "practice";
    return {
      conceptId: concept.id,
      taskType,
      estimatedMinutes: Math.max(
        10,
        Math.round(minutesPerWeek / Math.min(validConcepts.length, 5)),
      ),
      dueAt: new Date(now.getTime() + week * 7 * 86400000 + index * 86400000).toISOString(),
    };
  });

  return { title: "Adaptive study plan", tasks, aiGenerated: true };
}

async function generateFlashcards(
  concept: LearningConcept,
  mastery: Mastery | undefined,
  count: number,
  difficulty: number,
  supabase: any,
  language?: string,
) {
  const provider = getOpenRouterProvider();
  const diffLabels = ["", "introductory", "foundational", "standard", "advanced", "mastery"];
  const diffLabel = diffLabels[difficulty] ?? "standard";

  const { text } = await generateText({
    model: provider(OPENROUTER_DEFAULT_MODEL),
    system: `You are a ${diffLabel}-level ${concept.framework} flashcard creator. Output ONLY strict JSON array. No markdown. No extra text.${language ? ` Write all card text in ${language}; keep JSON keys unchanged.` : ""}`,
    messages: [
      {
        role: "user",
        content: `Create ${count} flashcards for: "${concept.title}" (${concept.description}).
Grade: ${concept.grade_band}, Curriculum: ${concept.framework}, Difficulty: ${diffLabel}.
Front: concise question. Back: one-line answer.
Format: [{"front":"...","back":"..."}]`,
      },
    ],
    maxOutputTokens: 1500,
    temperature: 0.5,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI did not return JSON array");
  return JSON.parse(jsonMatch[0]);
}

async function generateExam(
  conceptIds: string[],
  examType: string,
  questionCount: number,
  timeLimitMinutes: number | undefined,
  difficulty: number,
  supabase: any,
  language?: string,
) {
  const concepts = await Promise.all(conceptIds.map((id) => resolveConcept(supabase, id)));
  const validConcepts = concepts.filter((c): c is LearningConcept => c !== null);

  const questions: Array<{
    concept_id: string;
    question: Question;
    question_type: "mcq";
    difficulty: number;
    points: number;
    order_index: number;
  }> = [];
  if (validConcepts.length === 0) {
    return {
      title: `${examType.charAt(0).toUpperCase() + examType.slice(1)} exam`,
      questions,
      timeLimitSeconds: timeLimitMinutes ? timeLimitMinutes * 60 : null,
    };
  }

  for (const [conceptIndex, concept] of validConcepts.entries()) {
    const masteryResult = await supabase
      .from("learning_mastery")
      .select("*")
      .eq("concept_id", concept.id)
      .maybeSingle();
    const mastery = masteryResult.data;

    const questionsForConcept =
      Math.floor(questionCount / validConcepts.length) +
      (conceptIndex < questionCount % validConcepts.length ? 1 : 0);
    for (let i = 0; i < questionsForConcept; i++) {
      let question: Question;
      try {
        question = await generateAIQuestion(
          concept,
          mastery,
          difficulty,
          undefined,
          "mcq",
          language,
        );
      } catch {
        if (language)
          throw new Error("Could not generate exam questions in the selected language.");
        question = fallbackQuestion(concept, difficulty, undefined, "mcq");
      }
      questions.push({
        concept_id: concept.id,
        question,
        question_type: "mcq" as const,
        difficulty,
        points: 1,
        order_index: questions.length,
      });
    }
  }

  return {
    title: `${examType.charAt(0).toUpperCase() + examType.slice(1)} exam`,
    questions,
    timeLimitSeconds: timeLimitMinutes ? timeLimitMinutes * 60 : null,
  };
}

async function generateTutorResponse(
  mode: TutorMode,
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  subject: string,
  concept: LearningConcept | null,
  explanationDepth: "concise" | "standard" | "detailed",
  gradeBand: "middle" | "high",
  curriculum: string,
  sourceContext: string | undefined,
  language?: string,
): Promise<{ answer: string; sourcesUsed: string[] }> {
  const provider = getOpenRouterProvider();

  const modeInstructions: Record<TutorMode, string> = {
    socratic:
      "Use the Socratic method. Ask guiding questions. Never give the direct answer immediately. Lead the student to discover the answer through reasoning.",
    direct:
      "Provide a clear, direct explanation. Answer the question fully but encourage follow-up.",
    hint: "Give only a single, short hint. Do not explain the full answer.",
    worked_example:
      "Provide a complete step-by-step worked example. Label it as AI-generated. Encourage the student to try a similar problem.",
    simplified:
      "Explain in simpler language with an everyday analogy. Avoid jargon. Use concrete examples.",
    analogy:
      "Explain primarily through a relatable real-world analogy. Connect the analogy back to the concept.",
    diagnostic:
      "Ask one diagnostic question to check understanding. Do not teach. Do not give the answer.",
  };

  const depthGuidance = {
    concise: "Keep responses brief (2-3 sentences max). Focus on the essential point.",
    standard: "Provide a balanced explanation with key details and one example.",
    detailed: "Give a thorough explanation with multiple examples, derivations, and connections.",
  };

  const systemPrompt = [
    `You are LORD, a safe and encouraging ${gradeBand}-school ${curriculum} ${subject} tutor.`,
    `Teaching mode: ${modeInstructions[mode]}`,
    `Explanation depth: ${depthGuidance[explanationDepth]}`,
    language ? `Write the complete explanation in ${language}.` : "",
    `Current concept: ${concept?.title ?? "not selected"} - ${concept?.description ?? "N/A"}`,
    "Guidelines:",
    "- Use short, clear chunks. Ask one useful question before giving a final answer unless the student explicitly asks to check work.",
    "- Offer a hint, concrete example, and a one-question understanding check.",
    "- Never claim certainty when it is unwarranted.",
    "- Label any worked example as AI-generated and encourage the student to check course-specific requirements.",
    sourceContext
      ? `PRIVATE STUDENT MATERIALS (use only when relevant and cite the source):\n${sourceContext}`
      : "No private study material is selected for this answer.",
    conversationHistory.length > 0
      ? `RECENT CONVERSATION:\n${conversationHistory
          .slice(-6)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n")}`
      : "",
    `Student message: ${userMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await generateText({
    model: provider(OPENROUTER_DEFAULT_MODEL),
    system: systemPrompt,
    messages: [],
    maxOutputTokens: 1500,
    temperature: 0.6,
  });

  return { answer: text, sourcesUsed: [] };
}

async function generateSummary(
  concept: LearningConcept,
  sourceText: string,
  format: "summary" | "key_points" | "cheat_sheet" | "flashcards",
  language?: string,
): Promise<string> {
  const provider = getOpenRouterProvider();

  const formatInstructions = {
    summary:
      "Write a clear, structured summary (3-5 paragraphs) covering the main ideas, key formulas, and important concepts.",
    key_points: "Extract 8-12 bullet-point key points. Each point should be one concise sentence.",
    cheat_sheet:
      "Create a compact cheat sheet with: 1) Key formulas 2) Definitions 3) Common pitfalls 4) Quick reference table. Format in markdown.",
    flashcards:
      'Generate 10 flashcards. Front: question. Back: answer. Format as JSON: [{"front":"...","back":"..."}]',
  };

  const { text } = await generateText({
    model: provider(OPENROUTER_DEFAULT_MODEL),
    system: `You are a ${concept.framework} study material creator. Output only the requested format. No extra commentary.${language ? ` Write student-facing content in ${language}; preserve any required JSON keys.` : ""}`,
    messages: [
      {
        role: "user",
        content: `Source material:\n${sourceText.slice(0, 15000)}\n\nConcept: ${concept.title} (${concept.standard_code})\n${formatInstructions[format]}`,
      },
    ],
    maxOutputTokens: 2000,
    temperature: 0.3,
  });

  return text;
}

async function generateRevisionSchedule(conceptIds: string[], supabase: any) {
  const schedules = [];

  for (const conceptId of conceptIds) {
    const { data: mastery } = await supabase
      .from("learning_mastery")
      .select("*")
      .eq("concept_id", conceptId)
      .maybeSingle();

    const score = mastery?.score ?? 0.35;
    const confidence = mastery?.confidence ?? 0.2;

    // Forgetting curve: Ebbinghaus-based intervals
    // Initial intervals: 1 day, 3 days, 7 days, 14 days, 30 days, 60 days
    // Adjusted by mastery score and confidence
    const baseIntervals = [1, 3, 7, 14, 30, 60];
    const masteryFactor = Math.max(0.5, Math.min(2, 1 / Math.max(0.1, score)));
    const confidenceFactor = Math.max(0.7, Math.min(1.5, 1 / Math.max(0.1, confidence)));

    const nextInterval = Math.round(baseIntervals[0] * masteryFactor * confidenceFactor);
    const nextReview = new Date(Date.now() + nextInterval * 86400000).toISOString();

    const retentionEstimate = Math.max(0.1, Math.min(0.95, score * confidence * 1.2));

    schedules.push({
      concept_id: conceptId,
      mastery_score: score,
      confidence,
      retention_estimate: retentionEstimate,
      next_review_at: nextReview,
      review_interval_days: nextInterval,
      ease_factor: 2.5,
      consecutive_successes: 0,
      consecutive_failures: 0,
    });
  }

  return { schedules };
}

async function extractMemories(
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<
  Array<{
    memory_type: "conversation" | "mistake" | "strength" | "preference" | "goal" | "misconception";
    concept_id: string | null;
    content: Record<string, unknown>;
    summary: string;
    importance: number;
    confidence: number;
    tags: string[];
  }>
> {
  const provider = getOpenRouterProvider();

  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const { text } = await generateText({
    model: provider(OPENROUTER_DEFAULT_MODEL),
    system: `You are a learning memory extractor. Analyze the conversation and extract structured memories. Output ONLY a JSON array of memory objects. No markdown. No extra text.`,
    messages: [
      {
        role: "user",
        content: `Conversation:\n${conversation}\n\nExtract memories as JSON array with this exact shape:
[{
  "memory_type": "conversation|mistake|strength|preference|goal|misconception",
  "concept_id": "string|null",
  "content": {},
  "summary": "string",
  "importance": 0.0-1.0,
  "confidence": 0.0-1.0,
  "tags": ["string"]
}]`,
      },
    ],
    maxOutputTokens: 2000,
    temperature: 0.3,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/learning/session")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid learning request.", requestId);

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
          if (parsed.data.action === "question") {
            const concept = await resolveConcept(db, parsed.data.conceptId);
            if (!concept)
              return apiErrorResponse(
                404,
                "NOT_FOUND",
                "Learning concept was not found.",
                requestId,
              );

            const { data: mastery } = await db
              .from("learning_mastery")
              .select("*")
              .eq("user_id", userId)
              .eq("concept_id", concept.id)
              .maybeSingle();

            let question: Question;
            try {
              question = await generateAIQuestion(
                concept,
                mastery,
                parsed.data.difficulty ?? 2,
                parsed.data.topic,
                parsed.data.questionType ?? "mcq",
                parsed.data.language,
              );
            } catch {
              if (parsed.data.language) {
                return apiErrorResponse(
                  503,
                  "AI_UPSTREAM_ERROR",
                  "Could not generate a practice question in the selected language. Please retry.",
                  requestId,
                );
              }
              question = fallbackQuestion(
                concept,
                parsed.data.difficulty ?? 2,
                parsed.data.topic,
                parsed.data.questionType ?? "mcq",
              );
            }

            return Response.json({ question, aiGenerated: question.aiGenerated });
          }

          if (parsed.data.action === "plan") {
            const plan = await generatePlan(
              parsed.data.conceptIds,
              parsed.data.weeklyMinutes ?? 180,
              parsed.data.examDate,
              parsed.data.syllabus,
              db,
            );
            return Response.json(plan);
          }

          if (parsed.data.action === "flashcards") {
            const concept = await resolveConcept(db, parsed.data.conceptId);
            if (!concept)
              return apiErrorResponse(404, "NOT_FOUND", "Concept not found.", requestId);

            const { data: mastery } = await db
              .from("learning_mastery")
              .select("*")
              .eq("user_id", userId)
              .eq("concept_id", concept.id)
              .maybeSingle();

            const cards = await generateFlashcards(
              concept,
              mastery,
              parsed.data.count ?? 8,
              parsed.data.difficulty ?? 3,
              db,
              parsed.data.language,
            );
            return Response.json({ cards, aiGenerated: true });
          }

          if (parsed.data.action === "exam") {
            const exam = await generateExam(
              parsed.data.conceptIds,
              parsed.data.examType ?? "chapter",
              parsed.data.questionCount ?? 10,
              parsed.data.timeLimitMinutes,
              parsed.data.difficulty ?? 3,
              db,
              parsed.data.language,
            );
            return Response.json(exam);
          }

          if (parsed.data.action === "tutor") {
            let concept: LearningConcept | null = null;
            if (parsed.data.conceptId) {
              concept = await resolveConcept(db, parsed.data.conceptId);
            }

            const result = await generateTutorResponse(
              parsed.data.mode ?? "socratic",
              parsed.data.userMessage,
              parsed.data.conversationHistory ?? [],
              parsed.data.subject ?? "Mathematics",
              concept,
              parsed.data.explanationDepth ?? "standard",
              parsed.data.gradeBand ?? "high",
              parsed.data.curriculum ?? "CBSE",
              parsed.data.sourceContext,
              parsed.data.language,
            );

            return Response.json(result);
          }

          if (parsed.data.action === "summary") {
            const concept = await resolveConcept(db, parsed.data.conceptId);
            if (!concept)
              return apiErrorResponse(404, "NOT_FOUND", "Concept not found.", requestId);

            const result = await generateSummary(
              concept,
              parsed.data.sourceText,
              parsed.data.format ?? "summary",
              parsed.data.language,
            );
            return Response.json({ content: result, format: parsed.data.format });
          }

          if (parsed.data.action === "revision_schedule") {
            const result = await generateRevisionSchedule(parsed.data.conceptIds, db);
            return Response.json(result);
          }

          if (parsed.data.action === "memory_extract") {
            const memories = await extractMemories(parsed.data.sessionId, parsed.data.messages);
            return Response.json({ memories });
          }

          if (parsed.data.action === "auto_study") {
            const conceptId = parsed.data.conceptId;
            const durationMinutes = parsed.data.durationMinutes ?? 25;
            const focus = parsed.data.focus;

            let concept: LearningConcept | null = null;
            if (conceptId) {
              concept = await resolveConcept(db, conceptId);
            }

            if (!concept) {
              const { data: masteryRows } = await db
                .from("learning_mastery")
                .select("concept_id, score")
                .eq("user_id", userId)
                .order("score", { ascending: true })
                .limit(1);

              if (masteryRows && masteryRows.length > 0) {
                concept = await resolveConcept(db, masteryRows[0].concept_id);
              } else {
                const { data: conceptRows } = await db
                  .from("learning_concepts")
                  .select("*")
                  .limit(1)
                  .maybeSingle();
                if (conceptRows) {
                  concept = conceptRows as LearningConcept;
                }
              }
            }

            if (!concept) {
              return apiErrorResponse(
                404,
                "NOT_FOUND",
                "No concept found for study session.",
                requestId,
              );
            }

            const { data: mastery } = await db
              .from("learning_mastery")
              .select("*")
              .eq("user_id", userId)
              .eq("concept_id", concept.id)
              .maybeSingle();

            const sessionPlan = {
              conceptId: concept.id,
              conceptTitle: concept.title,
              subject: concept.subject,
              durationMinutes,
              phases: [
                {
                  type: "learn",
                  duration: Math.round(durationMinutes * 0.3),
                  description: `Learn the fundamentals of ${concept.title}`,
                },
                {
                  type: "practice",
                  duration: Math.round(durationMinutes * 0.4),
                  description: `Practice problems on ${concept.title}`,
                },
                {
                  type: "review",
                  duration: Math.round(durationMinutes * 0.3),
                  description: `Review and summarize ${concept.title}`,
                },
              ],
              recommendedDifficulty: mastery
                ? Math.max(1, Math.min(5, Math.round(mastery.score * 5)))
                : 2,
              masteryBefore: mastery?.score ?? 0.35,
              focus: focus ?? concept.title,
            };

            const { error: sessionError } = await db.from("learning_sessions").insert({
              user_id: userId,
              concept_id: concept.id,
              title: `Auto Study: ${concept.title}`,
              status: "active",
              subject: concept.subject,
              topic: focus ?? concept.title,
            });

            if (sessionError) {
              console.error("Failed to create auto study session:", sessionError);
            }

            return Response.json({ sessionPlan, aiGenerated: true });
          }

          return apiErrorResponse(400, "INVALID_ACTION", "Unknown action.", requestId);
        } catch (err) {
          console.error("Learning session error:", err);
          return apiErrorResponse(
            500,
            "INTERNAL_ERROR",
            "Learning service unavailable.",
            requestId,
          );
        }
      },
    },
  },
});
