import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
let registeredTsconfigPaths = false;

async function loadImageAtomicModules() {
  process.env.TS_NODE_PROJECT = 'frontend/tsconfig.json';
  if (!registeredTsconfigPaths) {
    await import('../frontend/node_modules/tsconfig-paths/register.js');
    registeredTsconfigPaths = true;
  }

  const walletModule = await import('../frontend/src/lib/wallet.ts');
  const imageModule = await import('../frontend/src/server/images/execute-image-generation.ts');
  const dbModule = await import('../frontend/src/lib/db.ts');

  return {
    reserveWalletChargeInExecutor: walletModule.reserveWalletChargeInExecutor,
    buildResponseFromExistingJob: imageModule.buildResponseFromExistingJob,
    dbModule,
  };
}

function withDatabaseUrl() {
  process.env.DATABASE_URL = 'postgres://atomic-test';
}

function restoreDatabaseUrl() {
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
}

test('reserveWalletChargeInExecutor returns a committed charge result from the shared executor', async () => {
  withDatabaseUrl();
  const { reserveWalletChargeInExecutor } = await loadImageAtomicModules();
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>) {
      calls.push({ text, params });
      return [
        {
          balance_cents: 100,
          remaining_cents: 84,
          receipt_id: '123',
          has_mismatch: 0,
        } as TRecord,
      ];
    },
  };

  const result = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: 'user-1',
      amountCents: 16,
      currency: 'USD',
      description: 'Nano Banana 2 - 1 image',
      jobId: 'img_atomic_ok',
      surface: 'image',
      billingProductKey: null,
      pricingSnapshotJson: '{"totalCents":16,"currency":"USD"}',
      applicationFeeCents: null,
      vendorAccountId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
    { preferredCurrency: null }
  );

  restoreDatabaseUrl();

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.receiptId, '123');
  assert.equal(result.ok && result.balanceCents, 100);
  assert.equal(result.ok && result.remainingCents, 84);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /INSERT INTO app_receipts/);
});

test('reserveWalletChargeInExecutor returns insufficient funds when the executor cannot insert a charge', async () => {
  withDatabaseUrl();
  const { reserveWalletChargeInExecutor } = await loadImageAtomicModules();
  const executor = {
    async query<TRecord = unknown>() {
      return [
        {
          balance_cents: 8,
          remaining_cents: -8,
          receipt_id: null,
          has_mismatch: 0,
        } as TRecord,
      ];
    },
  };

  const result = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: 'user-1',
      amountCents: 16,
      currency: 'USD',
      description: 'Nano Banana 2 - 1 image',
      jobId: 'img_atomic_shortfall',
      surface: 'image',
      billingProductKey: null,
      pricingSnapshotJson: '{"totalCents":16,"currency":"USD"}',
      applicationFeeCents: null,
      vendorAccountId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
    { preferredCurrency: null }
  );

  restoreDatabaseUrl();

  assert.equal(result.ok, false);
  assert.equal(result.balanceCents, 8);
});

test('buildResponseFromExistingJob rebuilds structured image outputs from stored renders', async () => {
  const job = {
    job_id: 'img_existing_structured',
    user_id: 'user-1',
    status: 'completed',
    progress: 100,
    provider_job_id: 'fal-123',
    thumb_url: 'https://cdn.example.com/thumb.webp',
    aspect_ratio: '1:1',
    pricing_snapshot: null,
    currency: 'USD',
    payment_status: 'paid_wallet',
    engine_id: 'nano-banana-2',
    engine_label: 'Nano Banana 2',
    render_ids: [
      {
        url: 'https://cdn.example.com/image.png',
        thumb_url: 'https://cdn.example.com/image-thumb.webp',
        width: 1024,
        height: 1024,
        mime_type: 'image/png',
      },
    ],
    hero_render_id: 'https://cdn.example.com/image.png',
    message: 'Prompt description',
    settings_snapshot: {
      core: {
        resolution: '2k',
      },
    },
  } as const;

  const { buildResponseFromExistingJob } = await loadImageAtomicModules();
  const response = buildResponseFromExistingJob({
    job,
    mode: 't2i',
    engineId: 'nano-banana-2',
    engineLabel: 'Nano Banana 2',
    pricing: {
      totalCents: 16,
      currency: 'USD',
    },
    resolvedAspectRatio: '1:1',
    resolution: '1k',
  });

  assert.equal(response.ok, true);
  assert.equal(response.jobId, job.job_id);
  assert.equal(response.images.length, 1);
  assert.equal(response.images[0]?.url, 'https://cdn.example.com/image.png');
  assert.equal(response.images[0]?.thumbUrl, 'https://cdn.example.com/image-thumb.webp');
  assert.equal(response.resolution, '2k');
  assert.equal(response.description, 'Prompt description');
});

test('buildResponseFromExistingJob falls back to hero render when render_ids are absent', async () => {
  const job = {
    job_id: 'img_existing_hero',
    user_id: 'user-1',
    status: 'pending',
    progress: 0,
    provider_job_id: null,
    thumb_url: 'https://cdn.example.com/thumb.webp',
    aspect_ratio: null,
    pricing_snapshot: null,
    currency: 'USD',
    payment_status: 'paid_wallet',
    engine_id: 'nano-banana-2',
    engine_label: 'Nano Banana 2',
    render_ids: null,
    hero_render_id: 'https://cdn.example.com/hero.jpg',
    message: null,
    settings_snapshot: null,
  } as const;

  const { buildResponseFromExistingJob } = await loadImageAtomicModules();
  const response = buildResponseFromExistingJob({
    job,
    mode: 'i2i',
    engineId: 'nano-banana-2',
    engineLabel: 'Nano Banana 2',
    pricing: {
      totalCents: 10,
      currency: 'USD',
    },
    resolvedAspectRatio: '4:5',
    resolution: '1k',
  });

  assert.equal(response.images.length, 1);
  assert.equal(response.images[0]?.url, 'https://cdn.example.com/hero.jpg');
  assert.equal(response.images[0]?.thumbUrl, 'https://cdn.example.com/thumb.webp');
  assert.equal(response.aspectRatio, '4:5');
  assert.equal(response.resolution, '1k');
});
