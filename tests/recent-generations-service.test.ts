import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RecentGenerationInputError,
  listRecentGenerations,
  mapRecentGenerationRecordToWeb,
  parseRecentGenerationCursor,
  readRecentGenerationRecordsForWeb,
  type RecentGenerationRecord,
} from '../frontend/src/server/generations/recent-generations.ts';

function recentRecord(overrides: Partial<RecentGenerationRecord> = {}): RecentGenerationRecord {
  return {
    id: 10,
    job_id: 'job_10',
    user_id: 'user_1',
    updated_at: '2026-07-16T10:01:00.000Z',
    surface: 'video',
    billing_product_key: 'video_generation',
    settings_snapshot: { schemaVersion: 1, surface: 'video' },
    engine_id: 'seedance-2-0-mini',
    engine_label: 'Seedance 2 Mini',
    duration_sec: 5,
    prompt: 'private route prompt',
    thumb_url: 'https://cdn.maxvideoai.com/thumb.webp',
    video_url: null,
    preview_video_url: null,
    audio_url: null,
    created_at: '2026-07-16T10:00:00.000Z',
    aspect_ratio: '16:9',
    has_audio: true,
    can_upscale: true,
    preview_frame: 'https://cdn.maxvideoai.com/thumb.webp',
    final_price_cents: 18,
    pricing_snapshot: { currency: 'USD', totalCents: 18 } as RecentGenerationRecord['pricing_snapshot'],
    currency: 'USD',
    vendor_account_id: 'acct_private',
    payment_status: 'paid_wallet',
    stripe_payment_intent_id: 'pi_private',
    stripe_charge_id: 'ch_private',
    batch_id: null,
    group_id: null,
    iteration_index: null,
    iteration_count: null,
    render_ids: null,
    hero_render_id: null,
    local_key: 'private-key',
    message: 'Provider queued',
    eta_seconds: 30,
    eta_label: 'Soon',
    visibility: 'public',
    indexable: true,
    status: 'queued',
    progress: 1,
    provider: 'fal',
    provider_job_id: 'provider-private-10',
    ...overrides,
  };
}

test('recent agent reads are user-scoped, filtered, and capped to fifty items', async () => {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const result = await listRecentGenerations({
    userId: 'user_1',
    surface: 'video',
    status: 'running',
    limit: 999,
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return [recentRecord({ status: 'processing' })];
    },
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.status, 'running');
  assert.equal(result.items[0]?.retryAfterSeconds, 5);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.sql ?? '', /WHERE user_id = \$1/);
  assert.match(calls[0]?.sql ?? '', /LOWER\(COALESCE\(status, ''\)\)/);
  assert.ok(calls[0]?.params?.includes('user_1'));
  assert.ok(calls[0]?.params?.includes('video'));
  assert.equal(calls[0]?.params?.at(-1), 51);
});

test('recent agent reads retain failed jobs instead of applying the web feed expiration window', async () => {
  let querySql = '';
  await listRecentGenerations({
    userId: 'user_1',
    status: 'failed',
    queryFn: async (sql) => {
      querySql = sql;
      return [recentRecord({ status: 'failed', payment_status: 'refunded_wallet' })];
    },
  });
  assert.doesNotMatch(querySql, /INTERVAL '150 seconds'/);
  assert.match(querySql, /LOWER\(COALESCE\(status, ''\)\)/);
});

test('recent agent reads reject oversized and malformed cursors', async () => {
  const queryFn = async () => [] as RecentGenerationRecord[];
  await assert.rejects(
    listRecentGenerations({ userId: 'user_1', cursor: 'x'.repeat(257), queryFn }),
    (error: unknown) => error instanceof RecentGenerationInputError && error.field === 'cursor'
  );
  await assert.rejects(
    listRecentGenerations({ userId: 'user_1', cursor: 'not-a-cursor', queryFn }),
    (error: unknown) => error instanceof RecentGenerationInputError && error.field === 'cursor'
  );
});

test('recent agent reads replace non-finite limits with the bounded default', async () => {
  let queryParams: ReadonlyArray<unknown> | undefined;
  await listRecentGenerations({
    userId: 'user_1',
    limit: Number.NaN,
    queryFn: async (_sql, params) => {
      queryParams = params;
      return [];
    },
  });
  assert.equal(queryParams?.at(-1), 21);
});

test('web cursor parsing retains legacy partial timestamp and numeric-prefix behavior', () => {
  assert.deepEqual(parseRecentGenerationCursor('2026-07-16T10:00:00.000Z|bad'), {
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    id: null,
  });
  assert.deepEqual(parseRecentGenerationCursor('bad|9'), { createdAt: null, id: 9 });
  assert.deepEqual(parseRecentGenerationCursor('12legacy'), { createdAt: null, id: 12 });
});

test('recent agent reads deduplicate provider jobs without exposing provider identity', async () => {
  const result = await listRecentGenerations({
    userId: 'user_1',
    limit: 2,
    queryFn: async () => [
      recentRecord(),
      recentRecord({ id: 9, job_id: 'job_duplicate', provider_job_id: 'provider-private-10' }),
      recentRecord({
        id: 8,
        job_id: 'job_image_8',
        created_at: '2026-07-16T09:00:00.000Z',
        surface: 'image',
        status: 'completed',
        progress: 100,
        provider_job_id: 'provider-private-8',
        render_ids: ['https://cdn.maxvideoai.com/image.png'],
      }),
    ],
  });

  assert.deepEqual(result.items.map((item) => item.jobId), ['job_10', 'job_image_8']);
  assert.equal(result.nextCursor, '2026-07-16T09:00:00.000Z|8');
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /provider-private|private route prompt|acct_private|pi_private|private-key/);
});

test('web recent lookup preserves lenient cursor behavior and exact list query ownership', async () => {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const result = await readRecentGenerationRecordsForWeb({
    userId: 'user_1',
    feedType: 'all',
    requestedSurface: null,
    cursor: 'invalid-legacy-cursor',
    limit: 24,
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return [recentRecord()];
    },
  });

  assert.equal(result.length, 1);
  assert.match(calls[0]?.sql ?? '', /WHERE user_id = \$1/);
  assert.deepEqual(calls[0]?.params, ['user_1', 25]);
});

test('web recent lookup drops a mismatched injected row before the route can map it', async () => {
  const result = await readRecentGenerationRecordsForWeb({
    userId: 'user_1',
    feedType: 'all',
    requestedSurface: null,
    limit: 24,
    queryFn: async () => [recentRecord({ user_id: 'user_2' })],
  });
  assert.deepEqual(result, []);
});

test('web recent mapper preserves the authenticated route fixture including prompt and billing fields', () => {
  const payload = mapRecentGenerationRecordToWeb(
    recentRecord({
      surface: 'image',
      render_ids: [{ url: 'https://cdn.maxvideoai.com/image.png', thumb_url: 'https://cdn.maxvideoai.com/image-thumb.webp' }],
      status: 'completed',
      progress: 100,
      payment_status: 'refunded_wallet',
    })
  );

  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    jobId: 'job_10',
    surface: 'image',
    billingProductKey: 'video_generation',
    settingsSnapshot: { schemaVersion: 1, surface: 'video' },
    engineLabel: 'Seedance 2 Mini',
    durationSec: 5,
    prompt: 'private route prompt',
    thumbUrl: 'https://cdn.maxvideoai.com/thumb.webp',
    createdAt: '2026-07-16T10:00:00.000Z',
    engineId: 'seedance-2-0-mini',
    aspectRatio: '16:9',
    hasAudio: true,
    canUpscale: true,
    previewFrame: 'https://cdn.maxvideoai.com/thumb.webp',
    finalPriceCents: 18,
    currency: 'USD',
    pricingSnapshot: { currency: 'USD', totalCents: 18 },
    vendorAccountId: 'acct_private',
    paymentStatus: 'refunded_wallet',
    stripePaymentIntentId: 'pi_private',
    stripeChargeId: 'ch_private',
    renderIds: ['https://cdn.maxvideoai.com/image.png'],
    renderThumbUrls: ['https://cdn.maxvideoai.com/image-thumb.webp'],
    localKey: 'private-key',
    status: 'completed',
    progress: 100,
    message: 'Provider queued',
    etaSeconds: 30,
    etaLabel: 'Soon',
    visibility: 'public',
    indexable: true,
  });
});
