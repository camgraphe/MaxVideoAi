import 'dotenv/config';
import {
  claimNextQueuedTimelineExport,
  claimQueuedTimelineExportById,
} from '../src/server/timeline-exports/repository';
import { renderTimelineExportJob } from '../src/server/timeline-exports/renderer';
import { assertTimelineExportWorkerEnvironment } from '../src/server/timeline-exports/worker-preflight';

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1]?.trim();
  return value || null;
}

async function claimTimelineExportJob(targetExportId: string | null) {
  if (targetExportId) return claimQueuedTimelineExportById(targetExportId);
  return claimNextQueuedTimelineExport();
}

async function main() {
  const once = process.argv.includes('--once');
  const targetExportId = argValue('--export-id') ?? process.env.TIMELINE_EXPORT_TARGET_ID?.trim() ?? null;
  assertTimelineExportWorkerEnvironment({ once });
  do {
    const job = await claimTimelineExportJob(targetExportId);
    if (job) {
      console.log(`[timeline-export-worker] rendering ${job.id}`);
      await renderTimelineExportJob(job);
      console.log(`[timeline-export-worker] finished ${job.id}`);
    } else if (targetExportId) {
      console.log(`[timeline-export-worker] target export ${targetExportId} is not queued`);
      break;
    } else if (once) {
      console.log('[timeline-export-worker] no queued export');
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } while (!once);
}

main().catch((error) => {
  console.error('[timeline-export-worker] fatal', error);
  process.exit(1);
});
