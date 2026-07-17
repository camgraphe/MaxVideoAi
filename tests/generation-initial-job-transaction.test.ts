import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';

const root = process.cwd();
const sharedPath = join(root, 'frontend/src/server/generations/initial-job-reservation.ts');
const videoPath = join(root, 'frontend/app/api/generate/_lib/initial-video-job.ts');
const imagePath = join(root, 'frontend/src/server/images/image-initial-job.ts');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextExport = source.indexOf('\nexport ', start + 1);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandFailure(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function videoParams(jobId = 'job-video-1') {
  return {
    jobId,
    userId: 'user-1',
    paymentMode: 'wallet' as const,
    walletReservation: 'reserve' as const,
    funding: { kind: 'wallet' as const, reservation: 'reserve' as const },
    pendingReceipt: {
      userId: 'user-1',
      amountCents: 100,
      currency: 'USD',
      description: 'Video generation',
      jobId,
      snapshot: {},
      applicationFeeCents: null,
      vendorAccountId: null,
    },
    preferredCurrency: 'usd' as const,
    resolvedCurrencyLower: 'usd',
    jobInsert: {
      jobId,
      userId: 'user-1',
      engineId: 'test-video',
      engineLabel: 'Test video',
      durationSec: 5,
      prompt: 'private prompt',
      thumbUrl: '/thumb.svg',
      aspectRatio: '16:9',
      hasAudio: true,
      canUpscale: false,
      previewFrame: '/thumb.svg',
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIdsJson: null,
      heroRenderId: null,
      localKey: null,
      message: null,
      etaSeconds: null,
      etaLabel: null,
      provider: 'test',
      finalPriceCents: 100,
      pricingSnapshotJson: '{}',
      costBreakdownJson: null,
      settingsSnapshotJson: '{}',
      currency: 'USD',
      vendorAccountId: null,
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
      visibility: 'private' as const,
      indexable: false,
    },
  };
}

function imageParams(jobId = 'job-image-1') {
  return {
    userId: 'user-1',
    mode: 't2i' as const,
    jobId,
    surface: 'image' as const,
    billingProductKey: null,
    description: 'Image generation',
    amountCents: 100,
    currency: 'USD',
    pricingSnapshotJson: '{}',
    applicationFeeCents: null,
    vendorAccountId: null,
    engineId: 'test-image',
    engineLabel: 'Test image',
    durationSec: 0,
    prompt: 'private prompt',
    aspectRatio: '1:1',
    canUpscale: false,
    finalPriceCents: 100,
    costBreakdownJson: null,
    settingsSnapshotJson: '{}',
    visibility: 'private' as const,
    indexable: false,
    preferredCurrency: 'usd' as const,
    walletChargeMode: 'charge' as const,
    walletReservation: 'reserve' as const,
  };
}

test('executor-aware initial job variants are transaction-branded and cannot start nested transactions', () => {
  assert.equal(existsSync(sharedPath), true, 'shared initial-job transaction owner should exist');
  const shared = readFileSync(sharedPath, 'utf8');
  const video = readFileSync(videoPath, 'utf8');
  const image = readFileSync(imagePath, 'utf8');

  assert.match(shared, /export type WalletReservation = 'reserve' \| 'already_reserved'/);
  assert.match(shared, /TransactionQueryExecutor/);
  assert.match(shared, /withDbTransaction/);
  assert.match(shared, /pg_advisory_xact_lock/);

  assert.match(video, /export async function createInitialVideoJobInExecutor\(\s*executor: TransactionQueryExecutor/);
  assert.match(image, /export async function createInitialImageJobInExecutor\(\s*executor: TransactionQueryExecutor/);
  assert.doesNotMatch(functionBody(video, 'createInitialVideoJobInExecutor'), /withDbTransaction|BEGIN|COMMIT|ROLLBACK/);
  assert.doesNotMatch(functionBody(image, 'createInitialImageJobInExecutor'), /withDbTransaction|BEGIN|COMMIT|ROLLBACK/);
  assert.match(video, /createAtomicInitialVideoJob[\s\S]*runInitialJobTransaction/);
  assert.match(image, /createAtomicInitialImageJob[\s\S]*runInitialJobTransaction/);
});

test('one caller-owned video executor locks, reserves the wallet, and inserts without transaction control SQL', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://unit.invalid/maxvideoai';
  try {
    const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
    const calls: string[] = [];
    const executor = {
      async query<TRecord>(sql: string) {
        calls.push(sql);
        if (/WITH receipts AS/i.test(sql)) {
          return [
            {
              balance_cents: '1000',
              remaining_cents: '900',
              receipt_id: '1',
              has_mismatch: 0,
            },
          ] as TRecord[];
        }
        return [] as TRecord[];
      },
    } as TransactionQueryExecutor;

    const result = await createInitialVideoJobInExecutor(executor, videoParams());
    assert.deepEqual(result, { kind: 'created', walletChargeReserved: true });
    assert.match(calls[0], /pg_advisory_xact_lock/);
    assert.equal(calls.filter((sql) => /WITH receipts AS/i.test(sql)).length, 1);
    assert.equal(calls.filter((sql) => /INSERT INTO app_jobs/i.test(sql)).length, 1);
    assert.equal(
      calls.some((sql) => /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)),
      false
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('already_reserved skips only image wallet reservation and still creates the initial job', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://unit.invalid/maxvideoai';
  try {
    const { createInitialImageJobInExecutor } = await import('../frontend/src/server/images/image-initial-job');
    const calls: string[] = [];
    const executor = {
      async query<TRecord>(sql: string) {
        calls.push(sql);
        if (/FROM app_receipts[\s\S]*type = 'charge'/i.test(sql)) {
          return [
            {
              id: 1,
              user_id: 'user-1',
              amount_cents: 100,
              currency: 'USD',
              surface: 'image',
              billing_product_key: null,
            },
          ] as TRecord[];
        }
        return [] as TRecord[];
      },
    } as TransactionQueryExecutor;

    const result = await createInitialImageJobInExecutor(executor, {
      ...imageParams(),
      walletReservation: 'already_reserved',
    });
    assert.deepEqual(result, { kind: 'created', recoveredCharge: true });
    assert.equal(
      calls.some((sql) => /WITH receipts AS/i.test(sql)),
      false
    );
    assert.equal(calls.filter((sql) => /INSERT INTO app_jobs/i.test(sql)).length, 1);
    assert.equal(
      calls.some((sql) => /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)),
      false
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('already_reserved video requires the existing receipt, skips reservation, and still inserts the job', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://unit.invalid/maxvideoai';
  try {
    const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
    const calls: string[] = [];
    const executor = {
      async query<TRecord>(sql: string) {
        calls.push(sql);
        if (/FROM app_receipts[\s\S]*type = 'charge'/i.test(sql)) {
          return [
            {
              id: 1,
              user_id: 'user-1',
              amount_cents: 100,
              currency: 'USD',
              surface: 'video',
              billing_product_key: null,
            },
          ] as TRecord[];
        }
        return [] as TRecord[];
      },
    } as TransactionQueryExecutor;

    const result = await createInitialVideoJobInExecutor(executor, {
      ...videoParams('job-video-reserved'),
      walletReservation: 'already_reserved',
      funding: { kind: 'wallet', reservation: 'already_reserved' },
    });
    assert.deepEqual(result, { kind: 'created', walletChargeReserved: true });
    assert.equal(
      calls.some((sql) => /WITH receipts AS/i.test(sql)),
      false
    );
    assert.equal(calls.filter((sql) => /INSERT INTO app_jobs/i.test(sql)).length, 1);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('shared reservation phase resolves before an injected image provider can run', async () => {
  const { executeAfterInitialJobReservation } = await import('../frontend/src/server/generations/initial-job-reservation');
  const order: string[] = [];
  let transactionOpen = false;
  const result = await executeAfterInitialJobReservation({
    reserveInitialState: async () => {
      transactionOpen = true;
      order.push('transaction-open');
      await Promise.resolve();
      transactionOpen = false;
      order.push('transaction-resolved');
      return { kind: 'created' as const };
    },
    mapExisting: () => 'existing',
    submitProvider: async () => {
      assert.equal(transactionOpen, false);
      order.push('provider');
      return 'submitted';
    },
  });
  assert.equal(result, 'submitted');
  assert.deepEqual(order, ['transaction-open', 'transaction-resolved', 'provider']);
});

test('a trusted pre-reserved image state bypasses a second transaction and submits only after caller commit', async () => {
  const { executeAfterInitialJobReservation } = await import('../frontend/src/server/generations/initial-job-reservation');
  let transactionOpen = true;
  let providerCalls = 0;
  const trustedInitialState = {
    kind: 'created' as const,
    recoveredCharge: true,
  };

  transactionOpen = false;
  const result = await executeAfterInitialJobReservation({
    trustedInitialState,
    reserveInitialState: async () => {
      assert.fail('pre-reserved phase must not open a second transaction');
    },
    mapExisting: () => 'existing',
    submitProvider: async (created) => {
      assert.equal(transactionOpen, false);
      assert.equal(created, trustedInitialState);
      providerCalls += 1;
      return 'submitted';
    },
  });
  assert.equal(result, 'submitted');
  assert.equal(providerCalls, 1);
});

test('concurrent video reservations serialize on one job id in disposable PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'initial-job-pg-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', ['-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8'], {
    encoding: 'utf8',
  });
  assert.equal(init.status, 0, commandFailure(init));
  const start = spawnSync('pg_ctl', ['-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start'], {
    encoding: 'utf8',
    stdio: 'ignore',
  });
  assert.equal(start.status, 0, commandFailure(start));
  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8',
      stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const admin = new Client({
    host: socketDirectory,
    user: 'postgres',
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(`
    CREATE TABLE app_receipts (
      id bigserial PRIMARY KEY, user_id text NOT NULL, type text NOT NULL, amount_cents integer NOT NULL,
      currency text, description text, job_id text, surface text, billing_product_key text,
      pricing_snapshot jsonb, application_fee_cents integer, vendor_account_id text,
      stripe_payment_intent_id text, stripe_charge_id text, platform_revenue_cents integer,
      destination_acct text, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, user_id text, surface text, billing_product_key text, engine_id text,
      engine_label text, duration_sec integer, prompt text, thumb_url text, aspect_ratio text,
      has_audio boolean, can_upscale boolean, preview_frame text, batch_id text, group_id text,
      iteration_index integer, iteration_count integer, render_ids jsonb, hero_render_id text,
      local_key text, message text, eta_seconds integer, eta_label text, provider text, video_url text,
      status text, progress integer, provider_job_id text, final_price_cents integer,
      pricing_snapshot jsonb, cost_breakdown_usd jsonb, settings_snapshot jsonb, currency text,
      vendor_account_id text, payment_status text, stripe_payment_intent_id text, stripe_charge_id text,
      visibility text, indexable boolean, provisional boolean
    );
    INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
    VALUES ('user-1', 'topup', 1000, 'USD', 'test topup');
  `);

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(socketDirectory)}`;
  const first = new Client({
    host: socketDirectory,
    user: 'postgres',
    database: 'postgres',
  });
  const second = new Client({
    host: socketDirectory,
    user: 'postgres',
    database: 'postgres',
  });
  await first.connect();
  await second.connect();
  t.after(async () => {
    await Promise.allSettled([first.end(), second.end(), admin.end()]);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
  const asExecutor = (client: Client, calls: string[]) =>
    ({
      async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
        calls.push(sql);
        return (await client.query<TRecord>(sql, params as unknown[] | undefined)).rows;
      },
    }) as TransactionQueryExecutor;
  const callsA: string[] = [];
  const callsB: string[] = [];

  await first.query('BEGIN');
  const resultA = await createInitialVideoJobInExecutor(asExecutor(first, callsA), videoParams('job-race'));
  assert.equal(resultA.kind, 'created');

  await second.query('BEGIN');
  let secondSettled = false;
  const resultBPromise = createInitialVideoJobInExecutor(asExecutor(second, callsB), videoParams('job-race')).then((result) => {
    secondSettled = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(secondSettled, false, 'second transaction should wait on the advisory lock');
  await first.query('COMMIT');
  const resultB = await resultBPromise;
  await second.query('COMMIT');

  assert.equal(resultB.kind, 'existing_job');
  const counts = await admin.query<{ jobs: string; charges: string }>(`
    SELECT
      (SELECT count(*) FROM app_jobs WHERE job_id = 'job-race') AS jobs,
      (SELECT count(*) FROM app_receipts WHERE job_id = 'job-race' AND type = 'charge') AS charges
  `);
  assert.deepEqual(counts.rows[0], { jobs: '1', charges: '1' });
  assert.equal(
    [...callsA, ...callsB].some((sql) => /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)),
    false
  );
});
