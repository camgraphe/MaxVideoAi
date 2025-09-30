import "dotenv/config";

import { getJobById, updateJobRecord, insertJobEvent } from "@/db/repositories/jobs-repo";
import { getProviderAdapter } from "@/providers";

async function main() {
  const [jobId, requestId] = process.argv.slice(2);
  if (!jobId || !requestId) {
    console.error("Usage: npx tsx scripts/set-external-id.ts <job_id> <fal_request_id>");
    process.exit(1);
  }

  const job = await getJobById(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found`);
    process.exit(2);
  }

  if (job.provider !== "fal") {
    console.error(`Job ${jobId} is not a FAL job (provider=${job.provider}).`);
    process.exit(3);
  }

  await updateJobRecord(job.id, { externalJobId: requestId });
  console.log(`Set externalJobId=${requestId} on job ${job.id}`);

  const adapter = getProviderAdapter(job.provider);
  try {
    const result = await adapter.pollJob(requestId, { engine: job.engine, withLogs: true });
    await updateJobRecord(job.id, {
      status: result.status,
      progress: result.progress,
      outputUrl: result.outputUrl ?? null,
      thumbnailUrl: result.thumbnailUrl ?? null,
      durationActualSeconds: result.durationSeconds ?? null,
      costActualCents: result.costActualCents ?? null,
      error: result.error ?? null,
    });
    await insertJobEvent({
      jobId: job.id,
      status: result.status,
      progress: result.progress,
      message: result.error ?? "Manual repoll after setting external id",
      payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
    });
    console.log("Repoll completed.");
    if (result.outputUrl) console.log("outputUrl:", result.outputUrl);
    if (result.thumbnailUrl) console.log("thumbnailUrl:", result.thumbnailUrl);
  } catch (error) {
    console.error("Repoll failed", error);
  }
}

main();

