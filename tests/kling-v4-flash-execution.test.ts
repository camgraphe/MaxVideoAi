import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { KLING_V4_FLASH_ENGINE } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { executeVideoGeneration } from '../frontend/src/server/video-generation/execute-video-generation';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { buildKlingV4FlashFalRequest } from '../frontend/src/lib/kling-v4-flash';
import { getDb } from '../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

test('Flash Modify executes inherited fractional source timing and explicit output through the real web pipeline with a fake provider', async () => {
  const db = await startDisposablePostgres('flash-modify-execute');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    const engine = KLING_V4_FLASH_ENGINE;
    const inputs = ['video_url', 'video_urls'].map((slotId, index) => ({ name: slotId, slotId, kind: 'video' as const, assetId: `owned-${index}`,
      type: 'video/mp4', size: 1024, url: `https://media.maxvideoai.com/user-assets/owned-${index}.mp4`, width: 1280, height: 720, durationSec: 1 }));
    const trustedResolvedReferences = inputs.map((input, index) => ({ assetId: input.assetId, storageUrl: input.url, mediaKind: 'video' as const,
      role: index ? 'reference' as const : 'source' as const, ...(index ? { slot: 0 } : {}), mimeType: 'video/mp4', width: 1280, height: 720, durationSec: index ? 3.5 : 6.25, fps: 24, sizeBytes: 1024 }));
    let submissions = 0;
    for (const [durationSec, reverse] of [[undefined, false], [3, false], [undefined, true]] as const) {
      const jobId = reverse ? 'reordered' : durationSec === undefined ? 'inherited' : 'explicit';
      await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,settings_snapshot,payment_status,final_price_cents)
        VALUES($1,'owner','kling-v4-flash','fal','pending','{}','paid_wallet',100)`, [jobId]);
      const body = { engineId: engine.id, mode: 'v2v', prompt: 'Edit @Video1 using @Video2', resolution: '720p', inputs: reverse ? [...inputs].reverse() : inputs, ...(durationSec === undefined ? {} : { durationSec }) };
      const options = buildGenerateRequestOptions({ body, engine, mode: 'v2v', isBytePlusV1a: false });
      assert.equal(options.ok, true); if (!options.ok) return;
      let captured: Record<string, unknown> | undefined;
      const result = await executeVideoGeneration({ req: new NextRequest('http://localhost/api/generate'), body,
        userId: 'owner', localKey: null, requestStartedAt: Date.now(), logMetric: () => {}, metricState: {},
        routeContext: { engine, isBytePlusV1a: false, jobId, mode: 'v2v', payment: { mode: 'wallet' }, providerKey: 'fal', providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false } },
        requestOptions: options.options, walletReservation: 'already_reserved', preReservedInitialState: { kind: 'created', jobId, walletChargeReserved: true },
        trustedQuotedBilling: { pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' }, membershipTier: 'member' }, trustedResolvedReferences,
        adapters: { submitGenerateProviderTask: async (value: { falPayload: GeneratePayload }) => {
          submissions++; captured = buildKlingV4FlashFalRequest(value.falPayload).requestBody;
          return { kind: 'accepted_response', body: { ok: true, jobId } };
        } },
      } as never);
      assert.equal(result.body.ok, true, JSON.stringify(result));
      assert.ok(captured);
      assert.equal(captured.duration, durationSec);
      assert.equal(captured.video_url, inputs[0].url);
      assert.deepEqual(captured.video_urls, [inputs[1].url]);
    }
    assert.equal(submissions, 3);
  } finally {
    await getDb().end().catch(() => {});
    await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});
