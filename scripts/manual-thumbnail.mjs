import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createRequire } from 'node:module';

const requireModule = createRequire(import.meta.url);
const { config: loadEnv } = requireModule('../frontend/node_modules/dotenv');
const { Client } = requireModule('../frontend/node_modules/pg');
const { S3Client, PutObjectCommand } = requireModule('../frontend/node_modules/@aws-sdk/client-s3');
const ffmpeg = requireModule('../frontend/node_modules/@ffmpeg-installer/ffmpeg');

const __dirname = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const frontendRoot = path.resolve(__dirname, '../frontend');

loadEnv({ path: path.join(frontendRoot, '.env.local') });
loadEnv({ path: path.join(frontendRoot, '.env') });

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/manual-thumbnail.mjs <job_id>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const s3Bucket = process.env.S3_BUCKET;
const s3Region = process.env.S3_REGION;
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
if (!s3Bucket || !s3Region || !s3AccessKeyId || !s3SecretAccessKey) {
  console.error('S3 credentials missing');
  process.exit(1);
}

const JOB_QUERY = `SELECT job_id, user_id, video_url, aspect_ratio FROM app_jobs WHERE job_id = $1 LIMIT 1`;

async function downloadVideo(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await writeFile(destPath, Buffer.from(arrayBuffer));
}

function buildPublicUrl(key) {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base && base.trim().length > 0) {
    return `${base.replace(/\/+$/, '')}/${key}`;
  }
  return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(JOB_QUERY, [jobId]);
    if (!rows.length) {
      throw new Error(`Job ${jobId} not found`);
    }
    const job = rows[0];
    if (!job.video_url) {
      throw new Error(`Job ${jobId} has no video_url`);
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), 'thumb-'));
    const inputPath = path.join(tempDir, 'source.mp4');
    const outputPath = path.join(tempDir, 'thumb.jpg');

    try {
      await downloadVideo(job.video_url, inputPath);

      const scaleFilter = job.aspect_ratio === '9:16' ? 'scale=720:-2' : job.aspect_ratio === '1:1' ? 'scale=720:720' : 'scale=1280:-2';
      await new Promise((resolve, reject) => {
        execFile(
          ffmpeg.path,
          ['-y', '-ss', '1.5', '-i', inputPath, '-frames:v', '1', '-vf', `${scaleFilter},fps=1`, '-q:v', '3', outputPath],
          (error) => (error ? reject(error) : resolve())
        );
      });

      const imageBuffer = await readFile(outputPath);
      const key = `renders/${jobId}-${randomUUID()}.jpg`;
      const s3 = new S3Client({
        region: s3Region,
        credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
      });
      const cacheControl = process.env.S3_CACHE_CONTROL || 'public, max-age=3600';
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          Body: imageBuffer,
          ContentType: 'image/jpeg',
          CacheControl: cacheControl,
        })
      );
      const publicUrl = buildPublicUrl(key);

      await client.query(
        `UPDATE app_jobs SET thumb_url = $2, preview_frame = $2, updated_at = NOW() WHERE job_id = $1`,
        [jobId, publicUrl]
      );

      console.log(`Thumbnail updated for ${jobId}: ${publicUrl}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
