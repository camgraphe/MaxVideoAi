import "dotenv/config";

import { listJobs, updateJobRecord } from "@/db/repositories/jobs-repo";
import { getModelSpec } from "@/data/models";

async function backfillJobMetadata() {
  const jobs = await listJobs();
  let updated = 0;

  for (const job of jobs) {
    if (job.provider !== "fal") continue;

    const updates: Record<string, unknown> = {};
    const metadata = { ...(job.metadata ?? {}) } as Record<string, unknown>;

    if (!job.version) {
      const spec = getModelSpec("fal", job.engine);
      updates.version = spec?.id ?? job.engine;
    }

    if (metadata.usageRecorded === undefined) {
      metadata.usageRecorded = Boolean(job.costActualCents);
      updates.metadata = metadata;
    }

    if (Object.keys(updates).length === 0) continue;

    await updateJobRecord(job.id, updates);
    updated += 1;
  }

  console.log(`Backfill complete. Updated ${updated} job(s).`);
}

backfillJobMetadata()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
