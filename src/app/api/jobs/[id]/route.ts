import { NextResponse } from "next/server";
import {
  getJobById,
  insertJobEvent,
  serializeJob,
  updateJobRecord,
} from "@/db/repositories/jobs-repo";
import { getProviderAdapter } from "@/providers";
import { requireCurrentSession } from "@/lib/auth/current-user";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = (context.params instanceof Promise ? await context.params : context.params) as {
    id: string;
  };
  let job = await getJobById(resolved.id);
  if (!job) {
    return NextResponse.json(
      { error: `Job ${resolved.id} not found` },
      { status: 404 },
    );
  }

  const session = await requireCurrentSession();
  if (job.organizationId !== session.organization.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  const olderThanThreshold =
    Date.now() - job.updatedAt.getTime() > Number(process.env.PROVIDER_RECHECK_THRESHOLD_MS ?? 60_000);

  const needsRefetch =
    Boolean(job.externalJobId) && (force || ((job.status === "pending" || job.status === "running") && olderThanThreshold));

  if (needsRefetch) {
    try {
      const adapter = getProviderAdapter(job.provider);
      const result = await adapter.pollJob(job.externalJobId, { engine: job.engine });

      await updateJobRecord(job.id, {
        status: result.status,
        progress: result.progress,
        outputUrl: result.outputUrl ?? null,
        thumbnailUrl: result.thumbnailUrl ?? null,
        costActualCents: result.costActualCents ?? null,
        durationActualSeconds: result.durationSeconds ?? null,
        error: result.error ?? null,
      });

      await insertJobEvent({
        jobId: job.id,
        status: result.status,
        progress: result.progress,
        message: result.error ?? "Background poll refresh",
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });

      job = (await getJobById(job.id)) ?? job;
    } catch (error) {
      console.error(`Failed to refetch job ${job.id}`, error);
    }
  }

  return NextResponse.json({ job: serializeJob(job) });
}
