import { z } from "zod";

export const jobStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);

export const jobParamsSchema = z.object({
  provider: z.enum(["veo", "fal"]),
  engine: z.string(),
  prompt: z.string().min(4),
  ratio: z.enum(["9:16", "16:9", "1:1", "21:9", "4:5", "5:4", "3:2", "2:3"]),
  durationSeconds: z.number().min(1).max(32),
  withAudio: z.boolean(),
  quantity: z.number().int().min(1).max(4).default(1),
  seed: z.number().int().optional(),
  presetId: z.string().optional(),
  modelId: z.string().optional(),
  negativePrompt: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const jobRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: z.enum(["veo", "fal"]),
  engine: z.string(),
  prompt: z.string(),
  params: jobParamsSchema,
  quantity: z.number().int().min(1).max(4).default(1),
  seed: z.number().int().nullable(),
  status: jobStatusSchema,
  progress: z.number().int().min(0).max(100),
  costEstimateCents: z.number().int().nonnegative(),
  costActualCents: z.number().int().nonnegative().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  externalJobId: z.string().nullable(),
  outputUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  archiveUrl: z.string().url().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;
export type JobParams = z.infer<typeof jobParamsSchema>;
