import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { usageEvents, jobs } from "@/db/tables";
import type { ProviderId } from "@/providers/types";
import { getDb } from "@/db/client";

export interface UsageEventRecord {
  id: string;
  jobId: string | null;
  meter: string;
  quantity: number;
  engine: string;
  provider: ProviderId;
  createdAt: Date;
  job?: {
    prompt: string;
    status: string;
    engine: string;
  } | null;
}

export interface RecordUsageEventInput {
  organizationId: string;
  jobId?: string;
  meter: string;
  quantity: number;
  engine: string;
  provider: ProviderId;
}

export async function recordUsageEvent(input: RecordUsageEventInput): Promise<void> {
  const db = getDb();

  await db.insert(usageEvents).values({
    id: randomUUID(),
    organizationId: input.organizationId,
    jobId: input.jobId ?? null,
    meter: input.meter,
    quantity: input.quantity.toString(),
    engine: input.engine,
    provider: input.provider,
  });
}

export interface ListUsageEventsParams {
  organizationId?: string;
  limit?: number;
}

export async function listUsageEvents(params: ListUsageEventsParams = {}): Promise<UsageEventRecord[]> {
  const db = getDb();
  const limit = params.limit ?? 50;

  const rows = await db
    .select({
      id: usageEvents.id,
      jobId: usageEvents.jobId,
      meter: usageEvents.meter,
      quantity: usageEvents.quantity,
      engine: usageEvents.engine,
      provider: usageEvents.provider,
      createdAt: usageEvents.createdAt,
      jobPrompt: jobs.prompt,
      jobStatus: jobs.status,
      jobEngine: jobs.engine,
    })
    .from(usageEvents)
    .leftJoin(jobs, eq(usageEvents.jobId, jobs.id))
    .where(params.organizationId ? eq(usageEvents.organizationId, params.organizationId) : undefined)
    .orderBy(desc(usageEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    meter: row.meter,
    quantity: Number(row.quantity ?? 0),
    engine: row.engine,
    provider: row.provider,
    createdAt: row.createdAt,
    job:
      row.jobId && row.jobPrompt
        ? {
            prompt: row.jobPrompt,
            status: row.jobStatus ?? "unknown",
            engine: row.jobEngine ?? row.engine,
          }
        : null,
  }));
}
