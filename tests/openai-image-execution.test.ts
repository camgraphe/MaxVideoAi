import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { executeOpenAIImageGeneration, type OpenAIImageExecutionParams } from '../frontend/src/server/images/openai-image-execution';
import { OpenAIImageError } from '../frontend/src/server/images/openai-image-error';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { mapGenerationStatusRecordToAgent, mapGenerationStatusRecordToWeb, type GenerationStatusRecord } from '../frontend/src/server/generations/generation-status';
import { normalizeJobStatus } from '../frontend/lib/job-status';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWKsAAAAASUVORK5CYII=';
const params = { userId: 'owner', jobId: 'offline-job', engine: { id: 'gpt-image-2-6-flare', label: 'GPT Image 2.6 Flare', providerMeta: { provider: 'openai_images', modelSlug: 'gpt-image-2.6-flare' } },
  engineEntry: { id: 'gpt-image-2-6-flare', marketingName: 'GPT Image 2.6 Flare' }, mode: 't2i', effectivePrompt: 'A picture', combinedImageUrls: [], numImages: 10,
  outputFormat: 'png', quality: 'high', complexity: 'high', resolution: '1024x1024', background: 'auto', resolvedAspectRatio: null, pricing: { totalCents: 50 } } as OpenAIImageExecutionParams;

test('OpenAI output, ambiguous transport and storage failure retain the paid identity and never cause another POST', async () => {
  const db = await startDisposablePostgres('openai-image-output');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY, user_id TEXT, provider TEXT, provider_job_id TEXT, render_ids JSONB, status TEXT, payment_status TEXT, progress INT, message TEXT, updated_at TIMESTAMPTZ);
      INSERT INTO app_jobs(job_id,user_id,status,payment_status,progress) VALUES ('offline-job','owner','pending','paid_wallet',0);`);
    await db.pool.query(readFileSync('neon/migrations/95_openai_image_results.sql', 'utf8'));
    for (const scenario of ['complete', 'partial', 'storage-failure', 'transport', 'rejection'] as const) {
      let posts = 0, refunds = 0, completions = 0, ambiguous = 0;
      await db.pool.query("DELETE FROM app_openai_image_results; UPDATE app_jobs SET render_ids=NULL,status='pending',provider_job_id=NULL");
      const run = executeOpenAIImageGeneration(params, {
        assertAvailableFn: () => undefined,
        queryFn: async <T>(sql: string, args?: readonly unknown[]) => (await db.pool.query(sql, args as unknown[])).rows as T[],
        prepareReferencesFn: async () => [],
        generateFn: async () => {
          posts++;
          if (scenario === 'transport' || scenario === 'rejection') throw new OpenAIImageError('Offline', { submissionState: scenario === 'transport' ? 'uncertain' : 'definitive', status: scenario === 'transport' ? 503 : 400 });
          return { requestId: 'req_offline', body: { output_format: 'png', data: Array.from({length:10},(_,index)=>({b64_json: scenario === 'partial' && index === 9 ? 'invalid' : png})) } };
        },
        uploadFn: async () => { if (scenario === 'storage-failure') throw new Error('Storage unavailable'); return { url: 'https://media.maxvideoai.com/renders/owned.png', width: 1024, height: 1024, mime: 'image/png' }; },
        thumbnailsFn: async () => ['https://media.maxvideoai.com/thumbs/owned.webp'],
        completeFn: async ({ images }) => { completions++; await db.pool.query("UPDATE app_jobs SET status='completed',render_ids=$1::jsonb", [JSON.stringify(images)]); return { heroThumb: 'thumb' }; },
        failFn: async () => { refunds++; return { message: 'Rejected', providerBody: null, providerStatus: 400 }; },
        ambiguousFn: async (jobId) => { assert.equal(jobId, params.jobId); ambiguous++; },
      });
      if (scenario === 'complete') {
        const output = await run; assert.equal(output.images.length, 10); assert.equal(output.providerJobId, 'req_offline');
        assert.equal(completions, 1); assert.equal(ambiguous, 0); assert.equal(refunds, 0);
      } else {
        await assert.rejects(run, { code: scenario === 'rejection' ? 'OPENAI_IMAGE_ERROR' : 'provider_outcome_ambiguous' });
        assert.equal(completions, 0); assert.equal(ambiguous, scenario === 'rejection' ? 0 : 1); assert.equal(refunds, scenario === 'rejection' ? 1 : 0);
      }
      const saved = (await db.pool.query('SELECT * FROM app_jobs')).rows[0];
      if (scenario === 'complete') { assert.equal(saved.render_ids.length,10); assert.equal(saved.render_ids[0].url, 'https://media.maxvideoai.com/renders/owned.png'); }
      else assert.equal(saved.render_ids, null);
      if (scenario === 'partial') {
        const [receipt] = (await db.pool.query('SELECT * FROM app_openai_image_results')).rows;
        assert.equal(receipt.state, 'needs_review');
        assert.equal(receipt.stored_images[0].image.url, 'https://media.maxvideoai.com/renders/owned.png');
        assert.equal(saved.status, 'provider_polling_stalled');
        const row = { ...saved, surface: 'image', engine_id: params.engine.id } as GenerationStatusRecord;
        const web = mapGenerationStatusRecordToWeb(row);
        assert.equal(web.outputPreparationState, 'manual_review');
        assert.equal(normalizeJobStatus(web.status, false, web.outputPreparationState), 'pending');
        assert.match(web.message ?? '', /manual review/);
        const mcp = mapGenerationStatusRecordToAgent(row);
        assert.equal(mcp.status, 'failed'); assert.equal(mcp.retryAfterSeconds, null);
        assert.match(mcp.message ?? '', /manual review/); assert.equal(mcp.paymentStatus, 'paid_wallet');
      }
      assert.equal(JSON.stringify(saved).includes(png), false);
      assert.equal(posts, 1);
    }
  } finally { await db.cleanup(); }
});
