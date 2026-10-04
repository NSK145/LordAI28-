export type LearningFramework = "CBSE" | "COMMON_CORE" | "NGSS";
export type GradeBand = "elementary" | "middle" | "high";
export type ExplanationDepth = "concise" | "standard" | "detailed";
export type LearningStyle = "visual" | "auditory" | "reading" | "kinesthetic" | "mixed";
export type PreferredPace = "slow" | "moderate" | "fast";

export type Question = {
  id: string;
  conceptId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  rubric: string;
  aiGenerated: boolean;
  questionType?: "mcq" | "numerical" | "short_answer" | "diagram" | "essay";
  metadata?: Record<string, unknown>;
};

export type Mastery = {
  concept_id: string;
  score: number;
  confidence: number;
  evidence_count: number;
  next_review_at: string | null;
  streak?: number;
  estimated_retention?: number;
  total_study_time_seconds?: number;
  last_session_type?: string;
  misconceptions?: string[];
  last_practiced_at?: string | null;
  updated_at?: string;
};

export type LearningConcept = {
  id: string;
  standard_code: string;
  framework: LearningFramework;
  subject: string;
  grade_band: GradeBand;
  title: string;
  description: string;
  prerequisites: string[];
  chapter?: string;
  misconception_tags?: string[];
  difficulty?: number;
  estimated_study_minutes?: number;
  keywords?: string[];
  learning_objectives?: string[];
  is_custom?: boolean;
  class?: string | null;
};

export type LearningProfile = {
  user_id: string;
  grade_band: GradeBand;
  curriculum: string;
  subjects: string[];
  goals: string[];
  interests: string[];
  preferred_language: string;
  explanation_depth: ExplanationDepth;
  reminders_enabled: boolean;
  weekly_minutes: number;
  learning_style?: LearningStyle;
  preferred_pace?: PreferredPace;
  notification_preferences?: Record<string, unknown>;
  timezone?: string;
  class?: string | null;
  custom_subjects?: Array<{ name: string; description?: string }>;
  created_at: string;
  updated_at: string;
};

export type LearningSource = {
  id: string;
  user_id: string;
  name: string;
  mime_type: string;
  storage_path: string | null;
  extracted_text: string | null;
  source_kind: "upload" | "paste" | "catalog";
  provenance_url: string | null;
  license: string | null;
  created_at: string;
};

export type LearningResource = {
  id: string;
  concept_id: string | null;
  source_id: string | null;
  user_id: string | null;
  title: string;
  summary: string;
  resource_type: "article" | "video" | "simulation" | "activity" | "ai-study";
  url: string | null;
  provenance: string;
  license: string | null;
  reviewed: boolean;
  created_at: string;
  youtube_video_id?: string;
  duration_seconds?: number;
  thumbnail_url?: string;
  chapter?: string;
  difficulty?: number;
  ai_generated?: boolean;
  citations?: Record<string, unknown>;
};

export type LearningBoard = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type LearningBoardItem = {
  board_id: string;
  resource_id: string;
  user_id: string;
  created_at: string;
};

export type LearningSession = {
  id: string;
  user_id: string;
  concept_id: string | null;
  title: string;
  status: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
  updated_at: string;
};

export type TutorMessage = {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  source_ids: string[];
  created_at: string;
};

export type LearningArtifact = {
  id: string;
  user_id: string;
  concept_id: string | null;
  session_id: string | null;
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
  ai_generated: boolean;
  created_at: string;
};

export type LearningAttempt = {
  id: string;
  user_id: string;
  concept_id: string;
  question: Question;
  answer: Record<string, unknown>;
  correct: boolean | null;
  score: number | null;
  misconception: string | null;
  feedback: string | null;
  created_at: string;
};

export type LearningPlan = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  daily_minutes: number | null;
  status: "active" | "paused" | "completed" | "archived";
  source: "manual" | "ai" | "mixed";
  generated_from: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LearningPlanTask = {
  id: string;
  plan_id: string;
  user_id: string;
  concept_id: string | null;
  title: string;
  description: string | null;
  task_type: "learn" | "practice" | "review" | "quiz" | "flashcards" | "custom";
  due_at: string;
  estimated_minutes: number;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "skipped";
  position: number;
  notes: string | null;
  created_at: string;
};

export type LearningReminder = {
  id: string;
  user_id: string;
  task_id: string | null;
  message: string;
  scheduled_for: string;
  delivered_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export type Flashcard = {
  id: string;
  user_id: string;
  concept_id: string | null;
  front: string;
  back: string;
  tags: string[];
  source_type: "ai-generated" | "user-created" | "imported";
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type FlashcardReview = {
  id: string;
  user_id: string;
  flashcard_id: string;
  quality: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  reviewed_at: string;
  response_time_ms: number | null;
};

export type LearningNote = {
  id: string;
  user_id: string;
  concept_id: string | null;
  session_id: string | null;
  title: string;
  content: Record<string, unknown>;
  content_text: string | null;
  ai_summary: string | null;
  ai_key_points: string[] | null;
  ai_cheat_sheet: string | null;
  tags: string[];
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: string;
  user_id: string;
  title: string;
  exam_type: "mock" | "chapter" | "full_syllabus" | "custom" | "timed_quiz";
  concept_ids: string[];
  status: "draft" | "in_progress" | "completed" | "abandoned";
  time_limit_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  total_questions: number;
  correct_answers: number;
  created_at: string;
  updated_at: string;
};

export type ExamQuestion = {
  id: string;
  exam_id: string;
  concept_id: string | null;
  question: Question;
  question_type: "mcq" | "numerical" | "short_answer" | "diagram" | "essay";
  difficulty: number;
  points: number;
  order_index: number;
};

export type ExamAnswer = {
  id: string;
  exam_id: string;
  question_id: string;
  user_answer: Record<string, unknown>;
  ai_evaluation: Record<string, unknown> | null;
  is_correct: boolean | null;
  score: number | null;
  feedback: string | null;
  time_spent_seconds: number | null;
  answered_at: string;
};

export type RevisionSchedule = {
  id: string;
  user_id: string;
  concept_id: string;
  mastery_score: number;
  confidence: number;
  retention_estimate: number;
  next_review_at: string;
  review_interval_days: number;
  ease_factor: number;
  consecutive_successes: number;
  consecutive_failures: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningMemory = {
  id: string;
  user_id: string;
  memory_type: "conversation" | "mistake" | "strength" | "preference" | "goal" | "misconception";
  concept_id: string | null;
  session_id: string | null;
  content: Record<string, unknown>;
  summary: string | null;
  importance: number;
  confidence: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type VoiceSession = {
  id: string;
  user_id: string;
  concept_id: string | null;
  mode: "stt" | "tts" | "conversational";
  language: string;
  duration_seconds: number | null;
  transcript: string | null;
  ai_response: string | null;
  status: "active" | "completed" | "failed";
  started_at: string;
  ended_at: string | null;
};

export type OCRJob = {
  id: string;
  user_id: string;
  source_id: string | null;
  storage_path: string;
  mime_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  extracted_text: string | null;
  structured_data: Record<string, unknown> | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
};

export type Whiteboard = {
  id: string;
  user_id: string;
  concept_id: string | null;
  session_id: string | null;
  title: string;
  canvas_data: Record<string, unknown>;
  ai_annotations: Record<string, unknown>[];
  thumbnail_url: string | null;
  is_collaborative: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyGoal = {
  id: string;
  user_id: string;
  date: string;
  target_minutes: number;
  actual_minutes: number;
  target_concepts: number;
  completed_concepts: number;
  streak_day: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type WeeklyGoal = {
  id: string;
  user_id: string;
  week_start: string;
  target_minutes: number;
  actual_minutes: number;
  target_concepts: number;
  completed_concepts: number;
  target_exams: number;
  completed_exams: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type LearningAnalytics = {
  id: string;
  user_id: string;
  date: string;
  study_time_seconds: number;
  concepts_studied: number;
  questions_answered: number;
  correct_answers: number;
  tutor_messages: number;
  flashcards_reviewed: number;
  notes_created: number;
  exams_completed: number;
  voice_minutes: number;
  whiteboard_sessions: number;
  xp_earned: number;
  created_at: string;
  updated_at: string;
};

export type LearningHistory = {
  id: string;
  user_id: string;
  session_type:
    | "tutor"
    | "practice"
    | "exam"
    | "flashcard"
    | "note"
    | "voice"
    | "whiteboard"
    | "ocr"
    | "revision";
  concept_id: string | null;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  duration_seconds: number | null;
  outcome_score: number | null;
  created_at: string;
};

export type LearningSnapshot = {
  concepts: LearningConcept[];
  mastery: Mastery[];
  tasks: (LearningPlanTask & { learning_concepts?: { title: string } })[];
  boards: LearningBoard[];
  resources: LearningResource[];
  profile: LearningProfile | null;
  sources: LearningSource[];
  integrations: Record<string, unknown>[];
  sessions: LearningSession[];
  artifacts: LearningArtifact[];
  attempts: LearningAttempt[];
  flashcards?: Flashcard[];
  flashcard_reviews?: FlashcardReview[];
  notes?: LearningNote[];
  exams?: Exam[];
  revision_schedule?: RevisionSchedule[];
  memory?: LearningMemory[];
  voice_sessions?: VoiceSession[];
  ocr_jobs?: OCRJob[];
  whiteboards?: Whiteboard[];
  daily_goals?: DailyGoal[];
  weekly_goals?: WeeklyGoal[];
  analytics?: LearningAnalytics[];
  history?: LearningHistory[];
};

export const AI_GENERATED_NOTICE =
  "AI-generated learning support. Check important answers against your course materials or a trusted source.";

export type TutorMode =
  "socratic" | "direct" | "hint" | "worked_example" | "simplified" | "analogy" | "diagnostic";

export type TutorSessionRow = LearningSession;

export type TutorContext = {
  page: string;
  workflow: string;
  conceptId?: string;
  subject?: string;
  explanationDepth?: ExplanationDepth;
  gradeBand?: GradeBand;
  curriculum?: string;
};

export type PracticeSession = {
  conceptId: string;
  difficulty: number;
  question: Question;
  attempts: number;
  startedAt: string;
};

export type PlanGenerationRequest = {
  conceptIds: string[];
  weeklyMinutes: number;
  examDate?: string;
  syllabus?: string[];
  planName?: string;
  startDate?: string;
  targetDate?: string;
  dailyMinutes?: number;
  subjects?: string[];
  preferredDays?: number[];
  difficulty?: "easy" | "medium" | "hard";
};

export type PlanTask = {
  conceptId: string;
  taskType: "learn" | "practice" | "review" | "quiz" | "flashcards" | "custom";
  estimatedMinutes: number;
  dueAt: string;
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
};

export type PlanInput = {
  title: string;
  description?: string;
  startDate: string;
  targetDate: string;
  dailyMinutes: number;
  subjects?: string[];
  preferredDays?: number[];
  difficulty?: "easy" | "medium" | "hard";
  examDate?: string;
  source?: "manual" | "ai" | "mixed";
  conceptIds?: string[];
  status?: "active" | "paused" | "completed" | "archived";
};

export type PlanTaskInput = {
  title: string;
  description?: string;
  conceptId?: string;
  taskType: "learn" | "practice" | "review" | "quiz" | "flashcards" | "custom";
  scheduledDate: string;
  estimatedMinutes: number;
  priority: "low" | "medium" | "high";
  notes?: string;
  position?: number;
};

export type AIProposedChange = {
  taskId?: string;
  action: "create" | "update" | "delete" | "reschedule" | "move" | "duplicate";
  field?: string;
  from?: unknown;
  to?: unknown;
  summary: string;
};

export type PlanOptimizationResult = {
  summary: string;
  health: {
    workload: "low" | "optimal" | "high" | "overloaded";
    coverage: "poor" | "fair" | "good" | "excellent";
    revision: "low" | "fair" | "good";
    weakTopics: number;
    deadline: "at_risk" | "on_track" | "ahead";
  };
  changes: AIProposedChange[];
  recommendations: string[];
  smartSuggestions?: string[];
};

export type PlanWithTasks = LearningPlan & {
  tasks: LearningPlanTask[];
  progress: {
    total: number;
    completed: number;
    percent: number;
    remainingMinutes: number;
  };
  dailyWorkload: Array<{
    date: string;
    scheduledMinutes: number;
    dailyTarget: number;
    overloaded: boolean;
    tasks: LearningPlanTask[];
  }>;
};

export type StudyMode = "ai" | "manual";

export interface AIMission {
  id: string;
  title: string;
  description: string;
  conceptIds: string[];
  tasks: Array<{
    type: "learn" | "practice" | "review" | "quiz" | "flashcards" | "tutor";
    conceptId: string | null;
    conceptTitle: string;
    estimatedMinutes: number;
    reason: string;
  }>;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface AIRecommendation {
  id: string;
  type:
    "forgotten" | "weak_topic" | "unfinished" | "upcoming" | "prerequisite" | "habit" | "deadline";
  conceptId: string | null;
  conceptTitle: string | null;
  message: string;
  action: { type: string; payload: Record<string, unknown> };
  urgency: number;
}

export interface DetectedTopic {
  subject: string | null;
  conceptId: string | null;
  conceptTitle: string | null;
  chapter: string | null;
  keywords: string[];
  intent:
    | "learn"
    | "practice"
    | "revise"
    | "quiz"
    | "flashcard"
    | "tutor"
    | "homework"
    | "assignment"
    | "exam_prep"
    | "general";
  confidence: number;
  difficulty: number;
  examRelated: boolean;
  deadlineHint: string | null;
}

export interface ConceptDependency {
  conceptId: string;
  conceptTitle: string;
  subject: string;
  mastery: number;
  status: "mastered" | "learning" | "introduced" | "not-started" | "blocked";
  unlocked: boolean;
  depth: number;
  prerequisites: string[];
}

export interface LearningJourneyEvent {
  id: string;
  date: string;
  type:
    "learned" | "practiced" | "mastered" | "exam" | "tutor" | "flashcard" | "milestone" | "streak";
  conceptId: string | null;
  conceptTitle: string | null;
  subject: string | null;
  description: string;
  xpEarned: number;
}

export interface LearnerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
  streak: number;
  longestStreak: number;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    xpReward: number;
    unlockedAt: string | null;
    progress: number;
    target: number;
  }>;
  recentXp: Array<{ amount: number; reason: string; timestamp: string }>;
}
