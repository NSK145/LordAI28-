import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { StudyPlatform } from "@/components/study/StudyPlatform";

export const studySearchSchema = z.object({
  view: z
    .enum([
      "dashboard",
      "concepts",
      "practice",
      "tutor",
      "flashcards",
      "exams",
      "planner",
      "progress",
      "ai-entry",
    ])
    .optional()
    .default("dashboard"),
  concept: z.string().optional(),
  prompt: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/_authenticated/study")({
  validateSearch: studySearchSchema,
  component: Study,
});

function Study() {
  return <StudyPlatform />;
}
