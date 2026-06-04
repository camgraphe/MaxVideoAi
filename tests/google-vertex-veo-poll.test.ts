import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runGoogleVertexVeoPoll } from '../frontend/server/google-vertex-veo-poll';

const root = process.cwd();
const pollPath = join(root, 'frontend/server/google-vertex-veo-poll.ts');
const routePath = join(root, 'frontend/app/api/cron/google-vertex-veo-poll/route.ts');
const vercelConfigPath = join(root, 'frontend/vercel.json');

const baseJob = {
  job_id: 'job_veo_123',
  user_id: 'user_123',
  engine_id: 'veo-3-1-lite',
  engine_label: 'Google Veo 3.1 Lite',
  provider_job_id: 'projects/demo/locations/us-central1/publishers/google/models/veo-3.1-lite-generate-001/operations/op123',
  status: 'running',
  duration_sec: 8,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 99,
  pricing_snapshot: { totalCents: 99, currency: 'USD' },
  settings_snapshot: { core: { durationSec: 8, aspectRatio: '16:9', resolution: '1080p' } },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: new Date(Date.now() - 20_000).toISOString(),
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

test('Google Vertex Veo poll copies provider output before marking the job completed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const uploads: Array<{ data: Buffer; mime: string; fileName?: string | null }> = [];
  const outputs: unknown[] = [];

  const response = await runGoogleVertexVeoPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 17, attempt_index: 1 }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: 'job_veo_123' }] as never;
        }
        return [] as never;
      },
      getGoogleVertexVeoClientFn: () => ({
        fetchOperation: async () => ({
          name: baseJob.provider_job_id,
          done: true,
          response: {
            videos: [
              {
                bytesBase64Encoded: Buffer.from('mp4-bytes').toString('base64'),
                mimeType: 'video/mp4',
              },
            ],
          },
        }),
        downloadGcsUri: async () => {
          throw new Error('not used');
        },
      }),
      isStorageConfiguredFn: () => true,
      uploadFileBufferFn: async (payload) => {
        uploads.push({ data: payload.data, mime: payload.mime, fileName: payload.fileName });
        return { key: 'renders/user_123/job_veo_123.mp4', url: 'https://cdn.maxvideoai.com/renders/job_veo_123.mp4' };
      },
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_veo_123-thumb.jpg',
      upsertLegacyJobOutputsFn: async (payload) => {
        outputs.push(payload);
      },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(uploads[0]?.data.toString(), 'mp4-bytes');
  assert.equal(uploads[0]?.mime, 'video/mp4');

  const completedUpdate = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate, 'completed app_jobs update should run');
  assert.equal(completedUpdate.params?.[1], 'https://cdn.maxvideoai.com/renders/job_veo_123.mp4');
  assert.match(String(completedUpdate.params?.[3]), /google_vertex_veo_public_pricing_estimate/);
  assert.match(String(completedUpdate.params?.[3]), /0\.64/);
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);

  const attemptUpdate = queries.find((entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_usd/.test(entry.sql));
  assert.ok(attemptUpdate, 'provider_attempts should store estimated Google provider cost');
  assert.equal(attemptUpdate.params?.[1], 'completed');
  assert.doesNotMatch(String(attemptUpdate.params?.[2]), new RegExp(Buffer.from('mp4-bytes').toString('base64')));
  assert.match(String(attemptUpdate.params?.[2]), /omitted binary string/);
  assert.equal(attemptUpdate.params?.[4], 0.64);
});

test('Google Vertex Veo poll defers completion when output cannot be copied to MaxVideoAI storage', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await runGoogleVertexVeoPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 17, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexVeoClientFn: () => ({
        fetchOperation: async () => ({
          name: baseJob.provider_job_id,
          done: true,
          response: {
            videos: [
              {
                gcsUri: 'gs://veo-output/job_veo_123.mp4',
                mimeType: 'video/mp4',
              },
            ],
          },
        }),
        downloadGcsUri: async () => ({ data: Buffer.from('mp4-bytes'), mime: 'video/mp4' }),
      }),
      isStorageConfiguredFn: () => false,
      uploadFileBufferFn: async () => {
        throw new Error('not used');
      },
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  assert.equal(queries.some((entry) => /SET status = 'completed'/.test(entry.sql)), false);
  const retryUpdate = queries.find((entry) => /Generated video is ready\. Preparing it for download\./.test(JSON.stringify(entry.params)));
  assert.ok(retryUpdate, 'copy failure should leave the job in a retry/admin-review state');
});

test('Google Vertex Veo polling is isolated and exposed through a cron route', () => {
  assert.ok(existsSync(pollPath), 'Google Vertex Veo poller should exist');
  assert.ok(existsSync(routePath), 'Google Vertex Veo cron route should exist');
  const source = readFileSync(pollPath, 'utf8');
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  assert.doesNotMatch(source, /generateVideo/);
  assert.match(readFileSync(routePath, 'utf8'), /x-google-vertex-veo-poll-token/);
  assert.match(readFileSync(vercelConfigPath, 'utf8'), /google-vertex-veo-poll/);
});
