import "dotenv/config";

import { updateJobRecord, insertJobEvent, getJobById } from "@/db/repositories/jobs-repo";
import { getProviderAdapter } from "@/providers";
import * as fs from "node:fs";
import * as path from "node:path";

function parseCsv(content: string): Array<{ jobId: string; requestId: string }> {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Array<{ jobId: string; requestId: string }> = [];
  for (const line of lines) {
    const [jobId, requestId] = line.split(",").map((s) => s.trim());
    if (jobId && requestId) {
      out.push({ jobId, requestId });
    }
  }
  return out;
}

async function main() {
  const [csvPath] = process.argv.slice(2);
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-external-ids.ts <path/to/mapping.csv>");
    console.error("CSV format: job_id,request_id (one pair per line)");
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  const content = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(content);
  if (!rows.length) {
    console.error("No mapping rows found in CSV.");
    process.exit(2);
  }
  console.log(`Processing ${rows.length} mapping(s)...`);

  for (const row of rows) {
    try {
      const job = await getJobById(row.jobId);
      if (!job) {
        console.warn(`Skip ${row.jobId}: job not found`);
        continue;
      }
      if (job.provider !== "fal") {
        console.warn(`Skip ${row.jobId}: not a FAL job`);
        continue;
      }
      await updateJobRecord(job.id, { externalJobId: row.requestId });
      const adapter = getProviderAdapter(job.provider);
      const result = await adapter.pollJob(row.requestId, { engine: job.engine, withLogs: true });
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
        message: result.error ?? "Bulk repoll after external id import",
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });
      console.log(`Updated ${row.jobId} with outputUrl=${result.outputUrl ?? "<none>"}`);
    } catch (error) {
      console.error(`Failed ${row.jobId}`, error);
    }
  }
}

main();

