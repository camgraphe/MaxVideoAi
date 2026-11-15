import { setTimeout } from 'node:timers/promises';
import { getDb } from '../src/lib/db';
import { runAudioGenerationWorkerOnce } from '../src/server/audio/dispatch-worker';

async function main() {
  const once = process.argv.includes('--once');
  let stopping = false;
  process.once('SIGTERM', () => { stopping = true; });
  process.once('SIGINT', () => { stopping = true; });
  try {
    do {
      const handled = await runAudioGenerationWorkerOnce();
      if (once) break;
      if (!handled && !stopping) await setTimeout(2_000);
    } while (!stopping);
  } finally { await getDb().end(); }
}

main().catch(() => {
  console.error('Audio worker stopped. Inspect the owned dispatch and provider evidence before resuming.');
  process.exitCode = 1;
});
