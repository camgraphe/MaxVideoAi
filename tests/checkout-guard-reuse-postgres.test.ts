import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('first-top-up reuse preserves fraud cooldown and guard/report counts reflect real session creation', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} unavailable`);
  const pg = await startDisposablePostgres('checkout-guard-reuse');
  const folder = mkdtempSync(join(tmpdir(), 'checkout-guard-bundle-'));
  const shared = globalThis as typeof globalThis & { __checkoutGuardPool?: typeof pg.pool };
  shared.__checkoutGuardPool = pg.pool;
  const previousMode = process.env.CHECKOUT_CAPTCHA_MODE;
  process.env.CHECKOUT_CAPTCHA_MODE = 'off';
  t.after(async () => {
    if (previousMode === undefined) delete process.env.CHECKOUT_CAPTCHA_MODE; else process.env.CHECKOUT_CAPTCHA_MODE = previousMode;
    delete shared.__checkoutGuardPool;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  });
  await pg.pool.query(`
    CREATE TABLE checkout_attempts (id bigserial PRIMARY KEY, user_id text, ip_hash text, amount_cents int,
      mode text, outcome text, reason text, metadata jsonb, captcha_required boolean DEFAULT false,
      captcha_passed boolean DEFAULT false, stripe_checkout_session_id text, created_at timestamptz DEFAULT now());
    CREATE TABLE checkout_interaction_events (id bigserial PRIMARY KEY, user_id text, checkout_attempt_id bigint,
      stripe_checkout_session_id text, event_name text, metadata jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE app_receipts (id bigserial PRIMARY KEY, stripe_checkout_session_id text, type text);
    INSERT INTO checkout_attempts (user_id, amount_cents, mode, outcome, reason, stripe_checkout_session_id, metadata)
      VALUES ('first-user',1000,'express_checkout','session_created','under_limits','cs_reuse','{"currency":"EUR","checkoutUiMode":"elements"}');
  `);
  const output = join(folder, 'guard.cjs');
  await build({ stdin: { resolveDir: process.cwd(), contents: `
    export { findReusableExpressCheckoutSession } from './frontend/server/checkout-session-reuse';
    export { withCheckoutSessionPreparationLock } from './frontend/server/checkout-session-coordination';
    export { evaluateWalletCheckoutGuard } from './frontend/server/checkout-guard';
    export { fetchCheckoutReport } from './frontend/server/checkout-report';`, loader: 'ts' },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'local-postgres', setup(b) {
      b.onResolve({ filter: /^@\/lib\/(db|schema)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'ts', contents: args.path.endsWith('/db')
        ? `
          const pool = globalThis.__checkoutGuardPool;
          export async function query(sql, params) { return (await pool.query(sql, params)).rows; }
          export async function withDbTransaction(callback) {
            const client = await pool.connect();
            const executor = { query: async (sql, params) => (await client.query(sql, params)).rows };
            try {
              await client.query('BEGIN');
              const result = await callback(executor, client);
              await client.query('COMMIT');
              return result;
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            } finally {
              client.release();
            }
          }
        `
        : 'export async function ensureBillingSchema() {}' }));
    } }],
  });
  const mod = requireFrontend(output);
  let inspections = 0;
  const session = { id: 'cs_reuse', client_secret: 'test-secret', status: 'open', payment_status: 'unpaid', expires_at: Date.now()/1000 + 1800, metadata: {} };
  const stripe = { checkout: { sessions: { retrieve: async () => { inspections++; return session; } } } };
  const input = { userId: 'first-user', amountCents: 1000, currency: 'EUR', hasCompletedTopUp: false };
  assert.equal((await mod.findReusableExpressCheckoutSession(stripe, input)).id, 'cs_reuse');
  assert.equal((await mod.findReusableExpressCheckoutSession(stripe, input)).checkoutAttemptId, 1);
  session.metadata = { ga_session_id: '1789486466' };
  assert.equal(
    (await mod.findReusableExpressCheckoutSession(stripe, input)).id,
    'cs_reuse',
    'another tab for the same checkout must reuse the payable session even when its analytics session differs',
  );
  session.metadata = {};
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts')).rows[0].n, 1, 'reuse never creates or resets an attempt');
  for (const changed of [{ userId: 'other-user' }, { currency: 'USD' }, { amountCents: 2500 }]) {
    assert.equal(await mod.findReusableExpressCheckoutSession(stripe, { ...input, ...changed }), null);
  }
  session.payment_status = 'paid';
  assert.equal(await mod.findReusableExpressCheckoutSession(stripe, input), null);
  session.payment_status = 'unpaid'; session.status = 'expired';
  assert.equal(await mod.findReusableExpressCheckoutSession(stripe, input), null);
  session.status = 'open';
  await pg.pool.query("INSERT INTO checkout_interaction_events (user_id, event_name) VALUES ('first-user', 'stripe_checkout_session_expired_for_failed_cards')");
  const beforeCooldown = inspections;
  assert.equal(await mod.findReusableExpressCheckoutSession(stripe, input), null, 'no first-payer reuse during a failed-card cooldown');
  assert.equal(inspections, beforeCooldown, 'cooldown is checked before any Stripe retrieval');
  assert.equal((await mod.findReusableExpressCheckoutSession(stripe, { ...input, hasCompletedTopUp: true })).id, 'cs_reuse');
  const guardInput = { userId: 'first-user', clientIp: null, amountCents: 1000, mode: 'express_checkout', hasCompletedTopUp: false, isPresetTopupTier: true };
  assert.equal((await mod.evaluateWalletCheckoutGuard(guardInput)).reason, 'failed_card_attempt_cooldown');
  await pg.pool.query("UPDATE checkout_interaction_events SET created_at = now() - interval '31 minutes'");
  assert.equal((await mod.findReusableExpressCheckoutSession(stripe, input)).id, 'cs_reuse');
  await pg.pool.query(`INSERT INTO checkout_attempts (user_id, amount_cents, mode, outcome, stripe_checkout_session_id)
    SELECT 'first-user',1000,'express_checkout','session_failed','cs_expired_' || n FROM generate_series(1,5) n;
    INSERT INTO checkout_attempts (user_id, amount_cents, mode, outcome, reason)
    SELECT 'first-user',1000,'express_checkout','captcha_required','first_topup_user_window' FROM generate_series(1,20);
  `);
  assert.equal((await mod.evaluateWalletCheckoutGuard(guardInput)).reason, 'first_topup_user_hard_limit', 'expired sessions still consume creation capacity');
  await pg.pool.query("INSERT INTO app_receipts (stripe_checkout_session_id, type) VALUES ('cs_reuse','topup')");
  const report = await mod.fetchCheckoutReport('24h');
  assert.equal(report.summary.sessionsCreated, 6);
  assert.equal(report.summary.passed, 1);
  assert.ok(report.reasons.every((r: { reason: string }) => r.reason !== 'under_limits'));
  assert.equal(report.recent.find((row: { id: number }) => row.id === 1).paymentCurrency, 'EUR');
  await pg.pool.query("DELETE FROM checkout_attempts WHERE stripe_checkout_session_id IS NOT NULL");
  assert.equal((await mod.evaluateWalletCheckoutGuard(guardInput)).action, 'allow', 'CAPTCHA and UI events alone never consume creation capacity');

  await pg.pool.query('CREATE TABLE checkout_coordination_probe (value text NOT NULL)');
  let releaseFirst!: () => void;
  let firstEntered!: () => void;
  const firstCanFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstDidEnter = new Promise<void>((resolve) => { firstEntered = resolve; });
  const lockScope = { userId: 'same-user', ipHash: 'same-ip' };
  const first = mod.withCheckoutSessionPreparationLock(lockScope, async (executor: { query: Function }) => {
    firstEntered();
    await firstCanFinish;
    await executor.query("INSERT INTO checkout_coordination_probe (value) VALUES ('created')");
    return 'created';
  });
  await firstDidEnter;

  assert.equal(
    await mod.withCheckoutSessionPreparationLock(
      { userId: 'unrelated-user', ipHash: 'unrelated-ip' },
      async () => 'unrelated',
    ),
    'unrelated',
    'an unrelated customer must not wait for this checkout',
  );

  let secondEntered = false;
  const second = mod.withCheckoutSessionPreparationLock(lockScope, async (executor: { query: Function }) => {
    secondEntered = true;
    const rows = await executor.query('SELECT value FROM checkout_coordination_probe');
    return rows[0]?.value ?? 'missing';
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(secondEntered, false, 'the second preparation must not race the first callback');
  releaseFirst();
  assert.deepEqual(await Promise.all([first, second]), ['created', 'created']);
  assert.equal(secondEntered, true);
});
