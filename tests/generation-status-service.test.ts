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
      'https://maxvideoai.com/api/jobs/private-output.png',
      'https://cdn.maxvideoai.com/app/private-output.png',
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
    '/api/jobs/private-output.png',
    '/app/private-output.png',
    'relative-output.png',
    '/api/media/private.png',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('agent status rejects absolute private MaxVideoAI result paths', () => {
  for (const videoUrl of [
    'https://maxvideoai.com/api/media/job.mp4',
    'https://maxvideoai.com/jobs/job_1.mp4',
    'https://cdn.maxvideoai.com/admin/export.mp4',
    'https://cdn.maxvideoai.com/dashboard/render.mp4',
  ]) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ status: 'completed', progress: 100, video_url: videoUrl })
    );
    assert.equal(result?.result, null, videoUrl);
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

test('agent status exposes only the safe Seedance task-type code and actionable retry guidance', () => {
  const result = mapGenerationStatusRecordToAgent(
    generationRecord({
      status: 'failed',
      progress: 0,
      payment_status: 'refunded_wallet',
      message: 'opaque provider failure request_id=secret-value',
      settings_snapshot: {
        providerFailure: {
          provider: 'byteplus_modelark',
          providerErrorCode: 'InvalidParameter.TaskTypeConstraint',
          failureCode: null,
        },
        privateReferenceUrl: 'https://provider.example/private.mp4',
      },
    })
  );

  assert.equal(result?.failureCode, 'seedance_task_type_constraint');
  assert.equal(
    result?.message,
    'Seedance could not identify the intended video edit or extension. Refer to the source directly as Video 1, then prepare a new quote before retrying.'
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /InvalidParameter|request_id|secret-value|privateReferenceUrl|provider\.example/i
  );
});

test('agent failure messages never echo arbitrary secrets, identities, or opaque bodies', () => {
  const expected =
    'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.';
  for (const message of [
    'Stripe key sk_live_supersecret belongs to alice@example.com',
    'api_token=tok_123456789 short_secret=abc123',
    'alice@example.com failed: opaque internal state ZXCV-9988',
    '{"error":{"body":"opaque-provider-body","authorization":"Bearer abc123"}}',
    'short secret abc123',
  ]) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ status: 'failed', message })
    );
    assert.equal(result?.message, expected, message);
    assert.doesNotMatch(JSON.stringify(result), /sk_live|alice@|tok_|ZXCV|opaque-provider|abc123/i);
  }
});

test('agent failure messages map recognized categories to fixed public copy', () => {
  const cases = [
    {
      raw: 'content policy safety moderation rejected',
      expected: 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.',
    },
    {
      raw: 'processing timeout exceeded expected window',
      expected: 'This render exceeded the expected processing window. Please retry in a few moments.',
    },
    {
      raw: 'provider returned no video output',
      expected:
        'The render finished without a usable output. Please retry or contact support with your request ID if it happens again.',
    },
  ];
  for (const fixture of cases) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ status: 'failed', message: fixture.raw })
    );
    assert.equal(result?.message, fixture.expected);
    assert.notEqual(result?.message, fixture.raw);
  }
});

test('agent payment status exposes only evidenced persisted app_jobs states', () => {
  for (const paymentStatus of [
    'platform',
    'paid_wallet',
    'paid_direct',
    'paid_stripe',
    'included',
    'refunded_wallet',
    'refunded',
  ]) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ payment_status: paymentStatus })
    );
    assert.equal(result?.paymentStatus, paymentStatus);
  }
  for (const paymentStatus of ['paid', 'pending', 'unpaid', 'curated', 'trial_reserved', 'trial_restored']) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ payment_status: paymentStatus })
    );
    assert.equal(result?.paymentStatus, null, paymentStatus);
  }
});

test('background removal normalizes to a controlled completed video result', () => {
  const result = mapGenerationStatusRecordToAgent(
    generationRecord({
      job_id: 'tool_background_removal_1',
      surface: 'background-removal',
      status: 'completed',
      progress: 100,
      video_url: 'https://cdn.maxvideoai.com/background-removal/output.mov',
      payment_status: 'paid_wallet',
    })
  );
  assert.deepEqual(result?.result, {
    surface: 'video',
    videoUrl: 'https://cdn.maxvideoai.com/background-removal/output.mov',
    previewUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
  });
  assert.equal(result?.surface, 'video');
});

test('agent surface normalization respects direct surface before conflicting snapshots', () => {
  const backgroundRemoval = mapGenerationStatusRecordToAgent(
    generationRecord({
      surface: 'background-removal',
      settings_snapshot: { surface: 'image' },
      render_ids: ['https://cdn.maxvideoai.com/conflicting.png'],
      status: 'completed',
      video_url: 'https://cdn.maxvideoai.com/background-removal/controlled.mov',
    })
  );
  const image = mapGenerationStatusRecordToAgent(
    generationRecord({
      surface: 'image',
      settings_snapshot: { surface: 'background-removal' },
      render_ids: ['https://cdn.maxvideoai.com/controlled.png'],
      status: 'completed',
      video_url: 'https://cdn.maxvideoai.com/conflicting.mov',
    })
  );
  assert.equal(backgroundRemoval?.surface, 'video');
  assert.equal(image?.surface, 'image');
});

test('agent surface uses only non-empty JSON-array render entries as image evidence', () => {
  const ecmaWhitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
  const fixtures: Array<{ renderIds: unknown; expected: 'video' | 'image' }> = [
    { renderIds: null, expected: 'video' },
    { renderIds: [], expected: 'video' },
    { renderIds: {}, expected: 'video' },
    { renderIds: 7, expected: 'video' },
    { renderIds: 'scalar', expected: 'video' },
    { renderIds: '["https://cdn.maxvideoai.com/encoded.png"]', expected: 'video' },
    { renderIds: [''], expected: 'video' },
    { renderIds: [{ url: '   ' }], expected: 'video' },
    { renderIds: [{ url: 7 }], expected: 'video' },
    { renderIds: ['\t'], expected: 'video' },
    { renderIds: ['\n'], expected: 'video' },
    { renderIds: ['\u00a0'], expected: 'video' },
    { renderIds: [ecmaWhitespace], expected: 'video' },
    { renderIds: [{ url: '\t' }], expected: 'video' },
    { renderIds: [{ url: '\n' }], expected: 'video' },
    { renderIds: [{ url: '\u00a0' }], expected: 'video' },
    { renderIds: [{ url: ecmaWhitespace }], expected: 'video' },
    { renderIds: ['https://cdn.maxvideoai.com/valid.png'], expected: 'image' },
    { renderIds: [{ url: 'https://cdn.maxvideoai.com/valid-object.png' }], expected: 'image' },
    { renderIds: [`${ecmaWhitespace}https://cdn.maxvideoai.com/wrapped.png${ecmaWhitespace}`], expected: 'image' },
    { renderIds: [{ url: `${ecmaWhitespace}https://cdn.maxvideoai.com/wrapped-object.png${ecmaWhitespace}` }], expected: 'image' },
  ];
  for (const fixture of fixtures) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ surface: 'video', render_ids: fixture.renderIds })
    );
    assert.equal(result?.surface, fixture.expected, JSON.stringify(fixture.renderIds));
  }
});

test('provider polling stalled is a terminal safe public failure without retry', () => {
  const result = mapGenerationStatusRecordToAgent(
    generationRecord({
      status: 'provider_polling_stalled',
      progress: 90,
      message: 'manual review secret api_token=tok_private alice@example.com',
    })
  );
  assert.deepEqual(result, {
    jobId: 'job_video_1',
    surface: 'video',
    status: 'failed',
    progress: 90,
    message: 'This render needs manual review. Contact MaxVideoAI support with your request ID before retrying.',
    priceCents: 42,
    currency: 'USD',
    paymentStatus: 'paid_wallet',
    result: null,
    retryAfterSeconds: null,
  });
  assert.doesNotMatch(JSON.stringify(result), /tok_private|alice@/i);
});

test('controlled result URLs reject credentials, fragments, nonstandard ports, and signed queries', () => {
  for (const videoUrl of [
    'https://user:password@cdn.maxvideoai.com/output.mp4',
    'https://cdn.maxvideoai.com/output.mp4#private-fragment',
    'https://cdn.maxvideoai.com:444/output.mp4',
    'https://cdn.maxvideoai.com/output.mp4?X-Amz-Signature=private',
  ]) {
    const result = mapGenerationStatusRecordToAgent(
      generationRecord({ status: 'completed', progress: 100, video_url: videoUrl })
    );
    assert.equal(result?.result, null, videoUrl);
  }
});

test('configured asset, storage, and video bases use exact HTTPS origins and base paths', () => {
  const previous = {
    assetHosts: process.env.ASSET_HOST_ALLOWLIST,
    storage: process.env.S3_PUBLIC_BASE_URL,
    testVideo: process.env.TEST_VIDEO_BASE_URL,
  };
  process.env.ASSET_HOST_ALLOWLIST = 'images.example.com,https://media.example.com/assets';
  process.env.S3_PUBLIC_BASE_URL = 'https://assets.example.com/public';
  process.env.TEST_VIDEO_BASE_URL = 'https://video.example.com/vod';
  try {
    for (const videoUrl of [
      'https://assets.example.com/public/render.mp4?version=1',
      'https://video.example.com/vod/render.mp4?version=1',
      'https://images.example.com/render.mp4?version=1',
      'https://media.example.com/assets/render.mp4?version=1',
    ]) {
      const valid = mapGenerationStatusRecordToAgent(
        generationRecord({ status: 'completed', video_url: videoUrl })
      );
      assert.equal(valid?.result?.surface, 'video', videoUrl);
    }
    for (const videoUrl of [
      'https://assets.example.com.evil/public/render.mp4',
      'https://assets.example.com:444/public/render.mp4',
      'http://assets.example.com/public/render.mp4',
      'https://assets.example.com/outside/render.mp4',
      'https://video.example.com/outside/render.mp4',
      'https://media.example.com/outside/render.mp4',
    ]) {
      const rejected = mapGenerationStatusRecordToAgent(
        generationRecord({ status: 'completed', video_url: videoUrl })
      );
      assert.equal(rejected?.result, null, videoUrl);
    }
  } finally {
    for (const [name, value] of [
      ['ASSET_HOST_ALLOWLIST', previous.assetHosts],
      ['S3_PUBLIC_BASE_URL', previous.storage],
      ['TEST_VIDEO_BASE_URL', previous.testVideo],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
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
