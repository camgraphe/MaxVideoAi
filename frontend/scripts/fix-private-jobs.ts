import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

import { query } from '../src/lib/db';

const TARGET_IDS = [
  'job_45d957eb-e943-4838-b6f0-50a1b006687d',
  'job_c1311458-e35c-4e4d-b791-488c14fc395e',
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing; aborting.');
    process.exit(1);
  }

  if (!TARGET_IDS.length) {
    console.log('No job IDs specified.');
    return;
  }

  await query(
    `UPDATE app_jobs
       SET visibility = 'public',
           indexable = COALESCE(indexable, TRUE)
     WHERE job_id = ANY($1)`,
    [TARGET_IDS]
  );

  const rows = await query<{ job_id: string; visibility: string | null; indexable: boolean | null }>(
    `SELECT job_id, visibility, indexable
       FROM app_jobs
      WHERE job_id = ANY($1)`,
    [TARGET_IDS]
  );

  rows.forEach((row) => {
    console.log(`${row.job_id}: visibility=${row.visibility}, indexable=${row.indexable}`);
  });
}

void main().catch((error) => {
  console.error('[fix-private-jobs] failed', error);
  process.exit(1);
});
