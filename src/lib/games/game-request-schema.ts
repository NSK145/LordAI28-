import { z } from "zod";

export const GameRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    prompt: z.string().trim().min(8).max(1200),
    difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  }),
  z.object({
    action: z.literal("modify"),
    spec: z.unknown(),
    instruction: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("save"),
    id: z.string().uuid().optional(),
    spec: z.unknown(),
    prompt: z.string().max(1200),
    versions: z.array(z.unknown()).max(20).optional(),
  }),
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("get"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);
