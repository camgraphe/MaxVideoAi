import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dbSchema, getDb } from "@/db/client";
import { estimateCost, estimateToCents } from "@/lib/pricing";
import type { ProviderId } from "@/providers/types";

const { jobs, jobEvents } = dbSchema;

export type JobRow = typeof jobs.$inferSelect;
export type JobEventRow = typeof jobEvents.$inferSelect;

export interface JobModel {
  id: string;
  organizationId: string;
  createdBy: string | null;
  provider: ProviderId;
  engine: string;
  prompt: string;
  ratio: "9:16" | "16:9";
  durationSeconds: number;
  withAudio: boolean;
  quantity: number;
  presetId: string | null;
  seed: number | null;
  status: JobRow["status"];
  progress: number;
  costEstimateCents: number;
  costActualCents: number | null;
  durationActualSeconds: number | null;
  externalJobId: string | null;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  archiveUrl: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobEventModel {
  id: string;
  jobId: string;
  status: JobEventRow["status"];
  progress: number;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateJobInput {
  organizationId: string;
  createdBy: string;
  provider: ProviderId;
  engine: string;
  prompt: string;
  ratio: "9:16" | "16:9";
  durationSeconds: number;
  withAudio: boolean;
  quantity: number;
  seed?: number;
  presetId?: string;
  costEstimateCents?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateJobInput {
  status?: JobRow["status"];
  progress?: number;
  costActualCents?: number | null;
  durationActualSeconds?: number | null;
  externalJobId?: string | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  archiveUrl?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export function mapRowToModel(row: JobRow): JobModel {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdBy: row.createdBy ?? null,
    provider: row.provider,
    engine: row.engine,
    prompt: row.prompt,
    ratio: row.ratio,
    durationSeconds: row.durationSeconds,
    withAudio: row.withAudio,
    quantity: row.quantity,
    presetId: row.presetId ?? null,
    seed: null,
    status: row.status,
    progress: row.progress,
    costEstimateCents: row.costEstimateCents,
    costActualCents: row.costActualCents ?? null,
    durationActualSeconds: row.durationActualSeconds ?? null,
    externalJobId: row.externalJobId ?? null,
    outputUrl: row.outputUrl ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    archiveUrl: row.archiveUrl ?? null,
    error: row.error ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapEventRowToModel(row: JobEventRow): JobEventModel {
  return {
    id: row.id,
    jobId: row.jobId,
    status: row.status,
    progress: row.progress,
    message: row.message ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}

export function serializeJob(job: JobModel) {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    archiveUrl: job.archiveUrl,
  };
}

export type SerializedJob = ReturnType<typeof serializeJob>;

export function serializeEvent(event: JobEventModel) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
}

export type SerializedJobEvent = ReturnType<typeof serializeEvent>;

export async function createJobRecord(input: CreateJobInput): Promise<JobModel> {
  const db = getDb();
  const now = new Date();
  const metadata = input.metadata ?? {};
  const id = randomUUID();

  const resolutionFromMetadata =
    typeof metadata.resolution === "string" && metadata.resolution.length > 0
      ? (metadata.resolution as string)
      : undefined;

  const estimate =
    input.provider === "fal"
      ? estimateCost({
          engine: input.engine,
          durationSec: input.durationSeconds,
          resolution: resolutionFromMetadata ?? "720p",
          aspectRatio: input.ratio,
          audioEnabled: input.withAudio,
          quantity: input.quantity,
        })
      : null;

  const costEstimate = input.costEstimateCents ?? estimateToCents(estimate) ?? 0;

  const [row] = await db
    .insert(jobs)
    .values({
      id,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      provider: input.provider,
      engine: input.engine,
      prompt: input.prompt,
      ratio: input.ratio,
      durationSeconds: input.durationSeconds,
      withAudio: input.withAudio,
      quantity: input.quantity,
      presetId: input.presetId ?? null,
      status: "pending",
      progress: 0,
      costEstimateCents: costEstimate,
      metadata,
      archiveUrl: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapRowToModel(row);
}

export async function updateJobRecord(id: string, updates: UpdateJobInput): Promise<JobModel | null> {
  const db = getDb();
  const updatePayload: Partial<typeof jobs.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof updates.status !== "undefined") {
    updatePayload.status = updates.status;
  }
  if (typeof updates.progress !== "undefined") {
    updatePayload.progress = updates.progress;
  }
  if (typeof updates.costActualCents !== "undefined") {
    updatePayload.costActualCents = updates.costActualCents;
  }
  if (typeof updates.durationActualSeconds !== "undefined") {
    updatePayload.durationActualSeconds = updates.durationActualSeconds;
  }
  if (typeof updates.externalJobId !== "undefined") {
    updatePayload.externalJobId = updates.externalJobId;
  }
  if (typeof updates.outputUrl !== "undefined") {
    updatePayload.outputUrl = updates.outputUrl;
  }
  if (typeof updates.thumbnailUrl !== "undefined") {
    updatePayload.thumbnailUrl = updates.thumbnailUrl;
  }
  if (typeof updates.archiveUrl !== "undefined") {
    updatePayload.archiveUrl = updates.archiveUrl;
  }
  if (typeof updates.error !== "undefined") {
    updatePayload.error = updates.error;
  }
  if (typeof updates.metadata !== "undefined") {
    updatePayload.metadata = updates.metadata;
  }

  const [row] = await db.update(jobs).set(updatePayload).where(eq(jobs.id, id)).returning();
  return row ? mapRowToModel(row) : null;
}

export async function listJobs(): Promise<JobModel[]> {
  const db = getDb();
  const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  return rows.map(mapRowToModel);
}

export async function listJobsByOrganization(organizationId: string): Promise<JobModel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(desc(jobs.createdAt));
  return rows.map(mapRowToModel);
}

export async function getJobById(id: string): Promise<JobModel | null> {
  const db = getDb();
  const row = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
  });
  return row ? mapRowToModel(row) : null;
}

export async function getJobByExternalJobId(externalJobId: string): Promise<JobModel | null> {
  const db = getDb();
  const row = await db.query.jobs.findFirst({
    where: eq(jobs.externalJobId, externalJobId),
  });
  return row ? mapRowToModel(row) : null;
}

export async function insertJobEvent(input: {
  jobId: string;
  status: JobEventRow["status"];
  progress: number;
  message?: string;
  payload?: Record<string, unknown> | null;
}): Promise<JobEventModel> {
  const db = getDb();
  const [row] = await db
    .insert(jobEvents)
    .values({
      id: randomUUID(),
      jobId: input.jobId,
      status: input.status,
      progress: input.progress,
      message: input.message ?? null,
      payload: input.payload ?? null,
    })
    .returning();
  return mapEventRowToModel(row);
}

export async function listJobEvents(jobId: string): Promise<JobEventModel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.jobId, jobId))
    .orderBy(jobEvents.createdAt);
  return rows.map(mapEventRowToModel);
}
