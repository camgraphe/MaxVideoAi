import { query, isDatabaseConfigured } from '../frontend/src/lib/db';

type JobRow = {
  job_id: string;
  engine_id: string;
  engine_label: string;
  prompt: string;
  duration_sec: number | null;
  aspect_ratio: string | null;
  settings_snapshot: Record<string, unknown> | null;
  created_at: string;
};

function parseLimit(): number {
  const raw = process.argv[2];
  if (!raw) return 50;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.min(Math.floor(value), 500);
}

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('[export-latest-jobs] DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }

  const limit = parseLimit();
  const rows = await query<JobRow>(
    `
      SELECT job_id, engine_id, engine_label, prompt, duration_sec, aspect_ratio, settings_snapshot, created_at
      FROM app_jobs
      WHERE status = 'completed'
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  const payload = rows.map((row) => ({
    jobId: row.job_id,
    engineSlug: row.engine_id,
    engineLabel: row.engine_label,
    prompt: row.prompt,
    settings: {
      durationSec: row.duration_sec ?? null,
      aspectRatio: row.aspect_ratio ?? null,
      snapshot: row.settings_snapshot ?? null,
    },
    createdAt: row.created_at,
  }));

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  console.error('[export-latest-jobs] Failed:', error);
  process.exitCode = 1;
});
