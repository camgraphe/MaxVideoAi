import { NextResponse } from "next/server";
import {
  getJobByExternalJobId,
  insertJobEvent,
  updateJobRecord,
} from "@/db/repositories/jobs-repo";
import type { UpdateJobInput } from "@/db/repositories/jobs-repo";
import {
  extractFalVideoResourceFromPayload,
  mapFalPollResponse,
  verifyFalWebhook,
  type FalPollResponse,
} from "@/providers/fal";
import { archiveJobMedia } from "@/services/storage";

export async function POST(request: Request) {
  const bodyBuffer = Buffer.from(await request.arrayBuffer());

  let isValid = false;
  try {
    isValid = await verifyFalWebhook(request.headers, bodyBuffer);
  } catch (error) {
    console.error("Fal webhook verification failed", error);
    return NextResponse.json({ error: "verification_failed" }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: FalPollResponse | null = null;
  try {
    payload = JSON.parse(bodyBuffer.toString("utf8")) as FalPollResponse;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!payload?.request_id) {
    return NextResponse.json({ error: "missing request_id" }, { status: 400 });
  }

  const job = await getJobByExternalJobId(payload.request_id);
  if (!job) {
    return NextResponse.json({ ok: true, skipped: "job_not_found" });
  }

  const includeLogs = Array.isArray(payload.logs) && payload.logs.length > 0;
  const result = mapFalPollResponse(payload.request_id, payload, includeLogs);

  const updates: UpdateJobInput = {
    status: result.status,
    progress: result.progress,
    outputUrl: result.outputUrl ?? null,
    thumbnailUrl: result.thumbnailUrl ?? null,
    durationActualSeconds: result.durationSeconds ?? null,
    costActualCents: result.costActualCents ?? null,
    error: result.error ?? null,
  };

  let archivedUrl: string | null = null;
  const videoResource = extractFalVideoResourceFromPayload(payload);
  const shouldArchive = result.status === "completed" && result.outputUrl && !job.archiveUrl;

  if (shouldArchive) {
    try {
      const archive = await archiveJobMedia({
        jobId: job.id,
        sourceUrl: result.outputUrl!,
        contentType: videoResource?.contentType,
        filename: videoResource?.fileName,
      });
      archivedUrl = archive?.url ?? null;
    } catch (error) {
      console.error("Failed to archive Fal output", error);
    }
  }

  if (archivedUrl) {
    updates.archiveUrl = archivedUrl;
  }

  await updateJobRecord(job.id, updates);

  await insertJobEvent({
    jobId: job.id,
    status: result.status,
    progress: result.progress,
    message: result.error ?? "Fal webhook update",
    payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
  });

  return NextResponse.json({ ok: true, archived: Boolean(archivedUrl) });
}
