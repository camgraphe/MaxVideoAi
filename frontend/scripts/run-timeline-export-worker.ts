import 'dotenv/config';
import { claimNextQueuedTimelineExport } from '../src/server/timeline-exports/repository';
import { renderTimelineExportJob } from '../src/server/timeline-exports/renderer';

async function main() {
  const once = process.argv.includes('--once');
  do {
    const job = await claimNextQueuedTimelineExport();
    if (job) {
      await renderTimelineExportJob(job);
    } else if (once) {
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
