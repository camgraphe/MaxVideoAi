import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
let registeredTsconfigPaths = false;

async function loadAngleAtomicModule() {
  process.env.TS_NODE_PROJECT = 'frontend/tsconfig.json';
  if (!registeredTsconfigPaths) {
    await import('../frontend/node_modules/tsconfig-paths/register.js');
    registeredTsconfigPaths = true;
  }

  return import('../frontend/src/server/tools/angle.ts');
}

function withDatabaseUrl() {
  process.env.DATABASE_URL = 'postgres://angle-atomic-test';
}

function restoreDatabaseUrl() {
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
}

test('createAngleInitialJobInExecutor reserves wallet charge and inserts provisional job', async () => {
  withDatabaseUrl();
  const { createAngleInitialJobInExecutor } = await loadAngleAtomicModule();
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>) {
      calls.push({ text, params });
      if (text.includes('INSERT INTO app_receipts')) {
        return [
          {
            balance_cents: 100,
            remaining_cents: 84,
            receipt_id: 'angle-charge-1',
            has_mismatch: 0,
          } as TRecord,
        ];
      }

      return [] as TRecord[];
    },
  };

  await createAngleInitialJobInExecutor(executor, {
    userId: 'user-1',
    jobId: 'tool_angle_atomic_ok',
    description: 'Flux Multiple Angles angle run',
    amountCents: 16,
    currency: 'USD',
    billingProductKey: 'angle-flux-single',
    pricingSnapshotJson: '{"totalCents":16,"currency":"USD"}',
    applicationFeeCents: null,
    vendorAccountId: null,
    engineId: 'flux-multiple-angles',
    engineLabel: 'Flux Multiple Angles',
    requestedOutputCount: 1,
    promptSummary: 'Angle tool test',
    settingsSnapshotJson: '{"surface":"angle"}',
    preferredCurrency: null,
  });

  restoreDatabaseUrl();

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /INSERT INTO app_receipts/);
  assert.match(calls[1]?.text ?? '', /INSERT INTO app_jobs/);
});

test('createAngleInitialJobInExecutor surfaces insufficient wallet funds', async () => {
  withDatabaseUrl();
  const { AngleToolError, createAngleInitialJobInExecutor } = await loadAngleAtomicModule();
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

  await assert.rejects(
    createAngleInitialJobInExecutor(executor, {
      userId: 'user-1',
      jobId: 'tool_angle_atomic_shortfall',
      description: 'Flux Multiple Angles angle run',
      amountCents: 16,
      currency: 'USD',
      billingProductKey: 'angle-flux-single',
      pricingSnapshotJson: '{"totalCents":16,"currency":"USD"}',
      applicationFeeCents: null,
      vendorAccountId: null,
      engineId: 'flux-multiple-angles',
      engineLabel: 'Flux Multiple Angles',
      requestedOutputCount: 1,
      promptSummary: 'Angle tool test',
      settingsSnapshotJson: '{"surface":"angle"}',
      preferredCurrency: null,
    }),
    (error) =>
      error instanceof AngleToolError &&
      error.code === 'insufficient_wallet_funds' &&
      error.status === 402
  );

  restoreDatabaseUrl();
});
