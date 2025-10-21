import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

import { query } from '../src/lib/db';
import { ensureBillingSchema } from '../src/lib/schema';
import { normalizeMediaUrl } from '../lib/media';

type MissingThumbRow = {
  job_id: string;
  video_url: string | null;
  thumb_url: string | null;
  created_at: string;
  visibility: string | null;
  indexable: boolean | null;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set; aborting.');
    process.exit(1);
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.error('[thumb-audit] unable to ensure billing schema', error);
    process.exit(1);
  }

  const rows = await query<MissingThumbRow>(
    `
      SELECT job_id, video_url, thumb_url, created_at, visibility, indexable
      FROM app_jobs
      WHERE visibility = 'public'
        AND COALESCE(indexable, TRUE)
        AND (
          thumb_url IS NULL
          OR trim(thumb_url) = ''
          OR thumb_url LIKE '/assets/frames/%'
        )
      ORDER BY created_at DESC
      LIMIT 20
    `
  );

  if (!rows.length) {
    console.log('✅ No public/indexable jobs with placeholder thumbnails remaining.');
    return;
  }

  console.log(`⚠️ Found ${rows.length} public/indexable job(s) without real thumbnails:`);
  rows.forEach((row, index) => {
    const videoUrl = row.video_url ? normalizeMediaUrl(row.video_url) : null;
    const thumbUrl = row.thumb_url ? normalizeMediaUrl(row.thumb_url) : null;
    console.log(
      `  ${index + 1}. ${row.job_id}\n` +
        `     created_at: ${row.created_at}\n` +
        `     video_url: ${videoUrl ?? '∅'}\n` +
        `     thumb_url: ${thumbUrl ?? '∅'}`
    );
  });
}

void main().catch((error) => {
  console.error('[thumb-audit] unexpected error', error);
  process.exit(1);
});
