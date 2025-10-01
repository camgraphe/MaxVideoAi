import "dotenv/config";

import { listJobs, updateJobRecord, insertJobEvent } from "@/db/repositories/jobs-repo";
import type { UpdateJobInput } from "@/db/repositories/jobs-repo";
import { getProviderAdapter } from "@/providers";

async function backfillFalJobs() {
  const allJobs = await listJobs();
  const targets = allJobs.filter((job) => {
    if (job.provider !== "fal") return false;
    if (!job.externalJobId) return false;
    if (job.outputUrl && job.thumbnailUrl && job.status === "completed") {
      return false;
    }
    return true;
  });

  if (!targets.length) {
    console.log("No Fal jobs require backfill.");
    return;
  }

  console.log(`Found ${targets.length} Fal job(s) to backfill.`);

  const adapter = getProviderAdapter("fal");

  for (const job of targets) {
    console.log(`\n→ Backfilling job ${job.id} (external ${job.externalJobId})`);
    console.log(`   engine: ${job.engine}`);

    try {
      const externalId = job.externalJobId!;
      const result = await adapter.pollJob(externalId, {
        withLogs: true,
        engine: job.engine,
      });

      const updates: UpdateJobInput = {
        status: result.status,
        progress: result.progress,
        outputUrl: result.outputUrl ?? null,
        thumbnailUrl: result.thumbnailUrl ?? null,
        durationActualSeconds: result.durationSeconds ?? null,
        costActualCents: result.costActualCents ?? null,
        error: result.error ?? null,
      };

      if (result.asset?.url && !updates.outputUrl) {
        updates.outputUrl = result.asset.url;
      }
      if (result.asset?.thumbnail && !updates.thumbnailUrl) {
        updates.thumbnailUrl = result.asset.thumbnail;
      }
      if (typeof result.asset?.durationSeconds === "number" && !updates.durationActualSeconds) {
        updates.durationActualSeconds = result.asset.durationSeconds;
      }

      await updateJobRecord(job.id, updates);

      await insertJobEvent({
        jobId: job.id,
        status: result.status,
        progress: result.progress,
        message: result.error ?? "Backfill poll",
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });

      console.log("   Updated job with latest Fal data.");
      if (updates.outputUrl) {
        console.log(`   outputUrl: ${updates.outputUrl}`);
      }
      if (updates.thumbnailUrl) {
        console.log(`   thumbnailUrl: ${updates.thumbnailUrl}`);
      }
      if (updates.durationActualSeconds) {
        console.log(`   duration: ${updates.durationActualSeconds}s`);
      }
      if (result.error) {
        console.log(`   provider error: ${result.error}`);
      }
    } catch (error) {
      console.error(`   Failed to backfill job ${job.id}`, error);
    }
  }
}

backfillFalJobs()
  .then(() => {
    console.log("\nBackfill complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backfill failed", error);
    process.exit(1);
  });
