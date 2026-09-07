import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('wallet reservation acquires the shared user lock before reading or charging balance', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://wallet-lock-test';
  try {
    const wallet = await import('../frontend/src/lib/wallet');
    const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = [];
    const result = await wallet.reserveWalletChargeInExecutor({
      query: async (sql: string, params: ReadonlyArray<unknown> = []) => {
        calls.push({ sql, params });
        if (sql.includes('pg_advisory_xact_lock')) return [];
        return [{ balance_cents: 500, remaining_cents: 400, receipt_id: 'receipt-1', has_mismatch: 0 }];
      },
    }, {
      userId: 'user-wallet',
      amountCents: 100,
      currency: 'USD',
      description: 'Test charge',
      jobId: 'job-wallet',
      surface: 'image',
      billingProductKey: 'image_generation',
      pricingSnapshotJson: '{}',
      applicationFeeCents: null,
      vendorAccountId: null,
    }, { preferredCurrency: 'usd' });

    assert.equal(result.ok, true);
    assert.match(calls[0]?.sql ?? '', /pg_advisory_xact_lock/);
    assert.deepEqual(calls[0]?.params, ['wallet:user-wallet']);
    assert.match(calls[1]?.sql ?? '', /WITH receipts AS/);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('concurrent debit transactions for one user cannot both spend the same balance', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://wallet-concurrency-test';
  try {
    const wallet = await import('../frontend/src/lib/wallet');
    let balanceCents = 100;
    let locked = false;
    const waiters: Array<() => void> = [];
    const release = () => {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    };
    const executor = {
      query: async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          await new Promise<void>((resolve) => {
            if (!locked) {
              locked = true;
              resolve();
            } else {
              waiters.push(resolve);
            }
          });
          return [];
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        const before = balanceCents;
        const receiptId = before >= 80 ? `receipt-${before}` : null;
        if (receiptId) balanceCents -= 80;
        return [{
          balance_cents: before,
          remaining_cents: balanceCents,
          receipt_id: receiptId,
          has_mismatch: 0,
        }];
      },
    };
    const reserve = async (jobId: string) => {
      try {
        return await wallet.reserveWalletChargeInExecutor(executor, {
          userId: 'user-concurrent',
          amountCents: 80,
          currency: 'USD',
          description: 'Concurrent charge',
          jobId,
          surface: 'image',
          billingProductKey: null,
          pricingSnapshotJson: '{}',
          applicationFeeCents: null,
          vendorAccountId: null,
        }, { preferredCurrency: 'usd' });
      } finally {
        release();
      }
    };

    const results = await Promise.all([reserve('job-a'), reserve('job-b')]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    assert.equal(balanceCents, 20);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('every paid reservation path uses the shared wallet lock contract while retaining job locks', () => {
  const wallet = readFileSync('frontend/src/lib/wallet.ts', 'utf8');
  const timeline = readFileSync('frontend/src/server/timeline-exports/billing.ts', 'utf8');
  const debitOwners = [
    'frontend/src/server/images/image-initial-job.ts',
    'frontend/app/api/generate/_lib/initial-video-job.ts',
    'frontend/src/server/audio/audio-generate-jobs.ts',
    'frontend/src/server/tools/angle-initial-job.ts',
    'frontend/src/server/tools/upscale-job-persistence.ts',
    'frontend/src/server/tools/background-removal-job-persistence.ts',
  ];

  assert.match(wallet, /export async function lockUserWalletInExecutor/);
  assert.match(wallet, /await lockUserWalletInExecutor\(executor, params\.userId\)/);
  assert.match(timeline, /lockUserWalletInExecutor/);
  assert.doesNotMatch(timeline, /timeline-export:\$\{params\.userId\}/);
  for (const path of debitOwners) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /reserveWalletChargeInExecutor/);
  }
  assert.match(readFileSync(debitOwners[0], 'utf8'), /pg_advisory_xact_lock\(hashtext\(\$1\)\).*params\.jobId/s);
  assert.match(readFileSync(debitOwners[1], 'utf8'), /pg_advisory_xact_lock\(hashtext\(\$1\)\).*params\.jobId/s);
});

test('render growth monitor cancels before an oversized artifact completes', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const runWithLimits = Reflect.get(renderer, 'runTimelineExportRenderWithLimits');
  assert.equal(typeof runWithLimits, 'function', 'renderer must expose its monitored render boundary');
  let cancelCalls = 0;
  let sizeReads = 0;
  await assert.rejects(() => runWithLimits({
    render: () => new Promise(() => undefined),
    cancel: () => { cancelCalls += 1; },
    timeoutMs: 1_000,
    maxOutputBytes: 100,
    monitorIntervalMs: 10,
    readOutputSize: () => {
      sizeReads += 1;
      return sizeReads >= 2 ? 101 : 80;
    },
  }), /TIMELINE_EXPORT_OUTPUT_TOO_LARGE/);
  assert.equal(cancelCalls, 1);
  assert.ok(sizeReads >= 2);
});

test('renderer streams a lower-capped artifact instead of buffering the full file', () => {
  const renderer = readFileSync('frontend/src/server/timeline-exports/renderer.ts', 'utf8');
  const storage = readFileSync('frontend/server/storage.ts', 'utf8');
  const capMatch = renderer.match(/MAX_TIMELINE_EXPORT_OUTPUT_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  assert.ok(capMatch, 'output cap should be a documented MiB product limit');
  assert.ok(Number(capMatch[1]) <= 512, `expected at most 512 MiB, got ${capMatch[1]} MiB`);
  assert.doesNotMatch(renderer, /readFile(?:Sync)?\(/);
  assert.match(renderer, /uploadPath\(\{/);
  assert.match(storage, /export async function uploadFilePath/);
  assert.match(storage, /createReadStream\(params\.path\)/);
});
