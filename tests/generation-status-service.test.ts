import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGenerationStatus,
  mapGenerationStatusRecordToAgent,
  mapGenerationStatusRecordToWeb,
  readOwnedGenerationRecord,
  type GenerationStatusRecord,
} from '../frontend/src/server/generations/generation-status.ts';

function generationRecord(overrides: Partial<GenerationStatusRecord> = {}): GenerationStatusRecord {
  return {
    id: 7,
    job_id: 'job_video_1',
    user_id: 'user_1',
    status: 'queued',
    progress: 3,
    provider_job_id: 'provider-secret-1',
    provider: 'fal',
    surface: 'video',
    billing_product_key: 'video_generation',
    video_url: null,
    preview_video_url: null,
    audio_url: null,
    thumb_url: null,
    preview_frame: null,
    engine_id: 'seedance-2-0-mini',
    engine_label: 'Seedance 2 Mini',
    duration_sec: 5,
    prompt: 'private prompt',
    created_at: '2026-07-16T10:00:00.000Z',
    final_price_cents: 42,
    pricing_snapshot: { currency: 'USD', totalCents: 42 } as GenerationStatusRecord['pricing_snapshot'],
    settings_snapshot: { privateReferenceUrl: 'https://provider.example/private.png' },
    currency: 'USD',
    payment_status: 'paid_wallet',
    vendor_account_id: 'acct_private',
    stripe_payment_intent_id: 'pi_private',
    stripe_charge_id: 'ch_private',
    batch_id: 'batch_1',
    group_id: 'group_1',
    iteration_index: 0,
    iteration_count: 1,
    render_ids: null,
    hero_render_id: null,
    local_key: 'private-local-key',
    message: 'Provider request_id=https://provider.example/private',
    eta_seconds: 20,
    eta_label: 'Soon',
    aspect_ratio: '16:9',
    ...overrides,
  };
}

test('owned status lookup scopes the SQL by job and user before returning a record', async () => {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const record = generationRecord();

  const result = await readOwnedGenerationRecord({
    userId: 'user_1',
    jobId: 'job_video_1',
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return [record];
    },
  });

  assert.equal(result, record);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.sql ?? '', /WHERE job_id = \$1[\s\S]*AND user_id = \$2/);
  assert.deepEqual(calls[0]?.params, ['job_video_1', 'user_1']);
});

test('owned status lookup rejects a mismatched row before mapping private fields', async () => {
  let privateFieldRead = false;
  const mismatched = generationRecord({ user_id: 'user_2' });
  Object.defineProperty(mismatched, 'prompt', {
    enumerable: true,
    get() {
      privateFieldRead = true;
      throw new Error('private field must not be mapped');
    },
  });

  const result = await readOwnedGenerationRecord({
    userId: 'user_1',
    jobId: 'job_video_1',
    queryFn: async () => [mismatched],
  });

  assert.equal(result, null);
  assert.equal(privateFieldRead, false);
});

test('agent status normalizes accepted and running states with a five-second minimum retry', () => {
  const accepted = mapGenerationStatusRecordToAgent(generationRecord());
  const running = mapGenerationStatusRecordToAgent(
    generationRecord({ status: 'processing', progress: 140, message: 'fal.ai provider payload' })
  );

  assert.deepEqual(accepted, {
    jobId: 'job_video_1',
    surface: 'video',
    status: 'accepted',
    progress: 3,
    message: 'Generation accepted.',
    priceCents: 42,
    currency: 'USD',
    paymentStatus: 'paid_wallet',
    result: null,
    retryAfterSeconds: 5,
  });
  assert.equal(running?.status, 'running');
  assert.equal(running?.progress, 100);
  assert.equal(running?.message, 'Generation in progress.');
  assert.ok((running?.retryAfterSeconds ?? 0) >= 5);
});

test('agent status returns only stable completed image media and omits private generation data', () => {
  const record = generationRecord({
    job_id: 'job_image_1',
    surface: 'image',
    status: 'completed',
    progress: 0,
    video_url: null,
    render_ids: [
      'https://cdn.maxvideoai.com/image-1.png',
      'https://cdn.maxvideoai.com/image-2.png?X-Amz-Signature=private',
      'https://v3b.fal.media/provider-output.png',
      '/public/relative-output.png',
      '/api/media/private.png',
    ],
    thumb_url: 'https://cdn.maxvideoai.com/image-1-thumb.webp',
    payment_status: 'refunded_wallet',
    message: 'provider completed request_id secret',
  });

  const result = mapGenerationStatusRecordToAgent(record);
  assert.deepEqual(result, {
    jobId: 'job_image_1',
    surface: 'image',
    status: 'completed',
    progress: 100,
    message: null,
    priceCents: 42,
    currency: 'USD',
    paymentStatus: 'refunded_wallet',
    result: {
      surface: 'image',
      imageUrls: ['https://cdn.maxvideoai.com/image-1.png'],
      thumbnailUrls: ['https://cdn.maxvideoai.com/image-1-thumb.webp'],
    },
    retryAfterSeconds: null,
  });

  const serialized = JSON.stringify(result);
  for (const secret of [
    'private prompt',
    'provider-secret-1',
    'acct_private',
    'pi_private',
    'ch_private',
    'private-local-key',
    'privateReferenceUrl',
    'X-Amz-Signature',
    'v3b.fal.media',
    'relative-output.png',
    '/api/media/private.png',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('web status mapper honors explicit null repair overrides instead of restoring stale row media', () => {
  const payload = mapGenerationStatusRecordToWeb(
    generationRecord({
      status: 'completed',
      progress: 100,
      video_url: 'https://cdn.maxvideoai.com/stale.mp4',
      render_ids: ['https://cdn.maxvideoai.com/stale.png'],
      message: 'stale message',
    }),
    { videoUrl: null, renderIds: null, renderThumbUrls: null, message: null }
  );

  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  assert.equal(Object.hasOwn(serialized, 'videoUrl'), false);
  assert.equal(serialized.renderIds, null);
  assert.equal(serialized.renderThumbUrls, null);
  assert.equal(Object.hasOwn(serialized, 'message'), false);
});

test('agent status sanitizes terminal failures and preserves refunded state', async () => {
  const result = await getGenerationStatus({
    userId: 'user_1',
    jobId: 'job_video_1',
    queryFn: async () => [
      generationRecord({
        status: 'failed',
        progress: -20,
        payment_status: 'refunded_wallet',
        message: 'fal.ai request_id https://provider.example/private returned no video',
      }),
    ],
  });

  assert.equal(result?.status, 'failed');
  assert.equal(result?.progress, 0);
  assert.equal(result?.paymentStatus, 'refunded_wallet');
  assert.equal(
    result?.message,
    'The render finished without a usable output. Please retry or contact support with your request ID if it happens again.'
  );
  assert.equal(result?.result, null);
  assert.equal(result?.retryAfterSeconds, null);
});

test('web status mapper preserves the authenticated video response fixture', () => {
  const payload = mapGenerationStatusRecordToWeb(
    generationRecord({
      status: 'completed',
      progress: 100,
      video_url: 'https://cdn.maxvideoai.com/video.mp4',
      preview_video_url: 'https://cdn.maxvideoai.com/video-preview.mp4',
      audio_url: 'https://cdn.maxvideoai.com/audio.mp3',
      thumb_url: 'https://cdn.maxvideoai.com/thumb.webp',
      settings_snapshot: { schemaVersion: 1, surface: 'video' },
      message: null,
    })
  );

  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    ok: true,
    jobId: 'job_video_1',
    surface: 'video',
    billingProductKey: 'video_generation',
    createdAt: '2026-07-16T10:00:00.000Z',
    status: 'completed',
    progress: 100,
    videoUrl: 'https://cdn.maxvideoai.com/video.mp4',
    previewVideoUrl: 'https://cdn.maxvideoai.com/video-preview.mp4',
    audioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    thumbUrl: 'https://cdn.maxvideoai.com/thumb.webp',
    aspectRatio: '16:9',
    pricing: { currency: 'USD', totalCents: 42 },
    settingsSnapshot: { schemaVersion: 1, surface: 'video' },
    finalPriceCents: 42,
    currency: 'USD',
    paymentStatus: 'paid_wallet',
    vendorAccountId: 'acct_private',
    stripePaymentIntentId: 'pi_private',
    stripeChargeId: 'ch_private',
    batchId: 'batch_1',
    groupId: 'group_1',
    iterationIndex: 0,
    iterationCount: 1,
    localKey: 'private-local-key',
    etaSeconds: 20,
    etaLabel: 'Soon',
  });
});
