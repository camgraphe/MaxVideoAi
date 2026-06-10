import 'dotenv/config';
import { claimNextQueuedTimelineExport } from '../src/server/timeline-exports/repository';
import { renderTimelineExportJob } from '../src/server/timeline-exports/renderer';
import { assertTimelineExportWorkerEnvironment } from '../src/server/timeline-exports/worker-preflight';

async function main() {
  const once = process.argv.includes('--once');
  assertTimelineExportWorkerEnvironment({ once });
  do {
    const job = await claimNextQueuedTimelineExport();
    if (job) {
      console.log(`[timeline-export-worker] rendering ${job.id}`);
      await renderTimelineExportJob(job);
      console.log(`[timeline-export-worker] finished ${job.id}`);
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
