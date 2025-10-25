import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv(); // fall back to default .env if present
const JOB_IDS = [
  'job_c564bf56-d35f-487a-8898-a5f4aeb1e855',
  'job_2fa90056-1007-41fc-8c4f-58030a890840',
  'job_7a0f64e5-73e7-4009-93d9-459de0508832',
] as const;

async function main() {
  const [
    { getDb },
    { linkFalJob },
  ] = await Promise.all([
    import('@/lib/db'),
    import('@/server/admin-job-tools'),
  ]);

  const pool = getDb();
  let updates = 0;

  for (const jobId of JOB_IDS) {
    try {
      const outcome = await linkFalJob({ jobId });
      updates += 1;
      console.info(`[link-fal-jobs] job updated`, outcome);
    } catch (error) {
      console.error(`[link-fal-jobs] failed to sync job`, { jobId, error });
    }
  }

  console.info(`[link-fal-jobs] completed`, { targeted: JOB_IDS.length, updates });

  try {
    await pool.end();
  } catch {
    // ignore pool shutdown errors
  }
}

main()
  .catch((error) => {
    console.error('[link-fal-jobs] fatal error', error);
    process.exitCode = 1;
  });
