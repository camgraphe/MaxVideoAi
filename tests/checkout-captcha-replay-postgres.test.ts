import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('a successful CAPTCHA token authorizes at most one checkout even when Siteverify accepts its replay', { timeout: 60_000 }, async (t) => {
  const pg = await startDisposablePostgres('checkout-captcha-replay');
  const folder = mkdtempSync(join(tmpdir(), 'checkout-captcha-replay-bundle-'));
  const shared = globalThis as typeof globalThis & { __captchaReplayPool?: typeof pg.pool };
  shared.__captchaReplayPool = pg.pool;
  const savedFetch = globalThis.fetch;
  const keys = ['CHECKOUT_CAPTCHA_MODE', 'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'] as const;
  const savedEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.CHECKOUT_CAPTCHA_MODE = 'progressive';
  process.env.TURNSTILE_SECRET_KEY = 'synthetic-secret';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'synthetic-sitekey';
  let validations = 0;
  let beforeValidationResponse: (() => Promise<void>) | undefined;
  globalThis.fetch = async () => {
    validations++;
    await beforeValidationResponse?.();
    return new Response(JSON.stringify({ success: true, hostname: 'localhost', challenge_ts: new Date().toISOString(), 'error-codes': [] }), { status: 200 });
  };
  t.after(async () => {
    globalThis.fetch = savedFetch;
    for (const key of keys) {
      if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
    }
    delete shared.__captchaReplayPool;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  });
  await pg.pool.query(readFileSync('neon/migrations/18_checkout_abuse_guard.sql', 'utf8'));
  await pg.pool.query(`CREATE TABLE checkout_interaction_events
    (user_id text, event_name text, metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now())`);
  const replayMigration = 'neon/migrations/68_checkout_captcha_token_once.sql';
  // The pre-fix run uses the existing schema; the missing migration must never make this invariant pass.
  if (existsSync(replayMigration)) await pg.pool.query(readFileSync(replayMigration, 'utf8'));
  const output = join(folder, 'guard.cjs');
  await build({ entryPoints: ['frontend/server/checkout-guard.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'disposable-postgres', setup(b) {
      b.onResolve({ filter: /^@\/lib\/db$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'ts', contents:
        `export async function query(sql, params) { return (await globalThis.__captchaReplayPool.query(sql, params)).rows; }` }));
    } }],
  });
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const { evaluateWalletCheckoutGuard: evaluate, markCheckoutAttemptSessionCreated, markCheckoutAttemptSessionFailed } = requireFrontend(output);
  const input = { userId: 'synthetic-user', clientIp: null, amountCents: 1700, mode: 'hosted', hasCompletedTopUp: false, isPresetTopupTier: false };

  await t.test('a delayed provider success cannot reuse the token, including whitespace aliases', async () => {
    const first = await evaluate({ ...input, captchaToken: 'opaque-token-a' });
    assert.equal(first.action, 'allow');
    assert.equal(first.captchaPassed, true);
    const beforeReplay = validations;
    const second = await evaluate({ ...input, captchaToken: ' \nopaque-token-a\t' });
    assert.equal(second.action, 'captcha_required', 'replayed token must not authorize a second checkout');
    assert.equal(second.captchaPassed, false);
    assert.equal(validations, beforeReplay, 'a known spent token is rejected before any external validation');
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM checkout_attempts WHERE captcha_passed")).rows[0].n, 1);
    assert.equal((await evaluate({ ...input, captchaToken: 'fresh-token-b' })).action, 'allow', 'a fresh challenge must still authorize checkout');
  });
  await t.test('the token is consumed globally across user, IP, mode and session failures', async () => {
    const first = await evaluate({ ...input, captchaToken: 'cross-user-token' });
    await markCheckoutAttemptSessionFailed(first.attemptId, 'synthetic-stripe-failure');
    const replay = await evaluate({ ...input, userId: 'another-user', clientIp: '192.0.2.8', mode: 'express_checkout', captchaToken: 'cross-user-token' });
    assert.equal(replay.action, 'captcha_required');
    assert.equal(replay.captchaPassed, false);
    const token = 'session-created-token';
    const created = await evaluate({ ...input, captchaToken: token });
    await markCheckoutAttemptSessionCreated(created.attemptId, 'isolated-no-stripe-session');
    assert.equal((await evaluate({ ...input, captchaToken: token })).action, 'captcha_required');
  });
  await t.test('a fresh server process still rejects a token consumed by another process', () => {
    const source = `
      const {createRequire}=require('node:module');
      const req=createRequire(${JSON.stringify(resolve('frontend/package.json'))});
      const pool=new (req('pg').Pool)({connectionString:process.env.CAPTCHA_TEST_DATABASE_URL});
      globalThis.__captchaReplayPool=pool;
      let validations=0;
      globalThis.fetch=async()=>{validations++;return new Response(JSON.stringify({success:true}),{status:200})};
      const mod=req(${JSON.stringify(output)});
      mod.evaluateWalletCheckoutGuard(${JSON.stringify({ ...input, userId: 'fresh-process-user', captchaToken: 'opaque-token-a' })})
        .then(result=>console.log(JSON.stringify({action:result.action,captchaPassed:result.captchaPassed,validations})))
        .catch(error=>{console.error(error.name);process.exitCode=1})
        .finally(()=>pool.end());
    `;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', source], { encoding: 'utf8', env: {
      PATH: process.env.PATH,
      CHECKOUT_CAPTCHA_MODE: 'progressive', TURNSTILE_SECRET_KEY: 'synthetic-secret',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'synthetic-sitekey', CAPTCHA_TEST_DATABASE_URL: pg.databaseUrl,
    } }));
    assert.deepEqual(result, { action: 'captcha_required', captchaPassed: false, validations: 0 });
  });
  await t.test('concurrent requests from different clients have exactly one successful authorization', async () => {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const timeout = setTimeout(release, 4000);
    beforeValidationResponse = async () => {
      if (++arrivals === 12) release();
      await barrier;
    };
    try {
      const results = await Promise.all(Array.from({ length: 12 }, (_, n) => evaluate({
        ...input, userId: `concurrent-user-${n}`, clientIp: `192.0.2.${n + 20}`, captchaToken: 'concurrent-token',
      })));
      assert.equal(arrivals, 12, 'every request must pass the precheck and receive provider success before competing for the claim');
      assert.equal(results.filter((x) => x.action === 'allow').length, 1);
      assert.equal(results.filter((x) => x.action === 'captcha_required' && !x.captchaPassed).length, 11);
      assert.equal(new Set(results.map((x) => x.attemptId)).size, 12, 'rejected attempts remain auditable');
      const claims = (await pg.pool.query(`SELECT captcha_passed, count(*)::int AS n
        FROM checkout_attempts WHERE user_id LIKE 'concurrent-user-%' GROUP BY captcha_passed`)).rows;
      assert.equal(claims.find((row) => row.captcha_passed)?.n, 1);
      assert.equal(claims.find((row) => !row.captcha_passed)?.n, 11);
    } finally {
      clearTimeout(timeout);
      release();
      beforeValidationResponse = undefined;
    }
  });
  await t.test('a consumed token is rejected even when the later request falls below progressive thresholds', async () => {
    assert.equal((await evaluate({ ...input, captchaToken: 'threshold-token' })).action, 'allow');
    const replay = await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true, captchaToken: 'threshold-token' });
    assert.equal(replay.action, 'captcha_required');
    assert.equal((await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true })).action, 'allow', 'ordinary checkout without a challenge remains compatible');
  });
  await t.test('metadata cannot substitute a different token identity and raw tokens are never persisted', async () => {
    const token = 'identity-token';
    const first = await evaluate({ ...input, captchaToken: token, metadata: { turnstileTokenHash: 'forged-hash' } });
    assert.equal(first.action, 'allow');
    assert.equal((await evaluate({ ...input, captchaToken: token, metadata: { turnstileTokenHash: 'another-forged-hash' } })).action, 'captcha_required');
    const rows = (await pg.pool.query('SELECT metadata FROM checkout_attempts')).rows;
    assert.ok(rows.filter((x) => x.metadata.turnstileTokenHash).every((x) => /^[a-f0-9]{64}$/.test(x.metadata.turnstileTokenHash)));
    assert.ok(!JSON.stringify(rows).includes(token));
  });
  await t.test('a replay does not replace the existing failed-card cooldown with a softer challenge', async () => {
    const scoped = { ...input, userId: 'cooldown-user', captchaToken: 'cooldown-token' };
    assert.equal((await evaluate(scoped)).action, 'allow');
    await pg.pool.query("INSERT INTO checkout_interaction_events (user_id,event_name) VALUES ('cooldown-user','stripe_checkout_session_expired_for_failed_cards')");
    const replay = await evaluate(scoped);
    assert.equal(replay.action, 'rate_limited');
    assert.equal(replay.reason, 'failed_card_attempt_cooldown');
    assert.equal(replay.captchaPassed, false);
  });
  await t.test('distinct-card cooldown blocks fresh and replayed tokens in both checkout modes without extending on late expiry', async () => {
    for (const mode of ['hosted', 'express_checkout']) {
      for (const hasCompletedTopUp of [false, true]) {
        const userId = `distinct-${mode}-${hasCompletedTopUp}`;
        const scoped = { ...input, userId, mode, hasCompletedTopUp };
        const spent = `${userId}-spent`;
        const duringCooldown = `${userId}-during-cooldown`;
        assert.equal((await evaluate({ ...scoped, captchaToken: spent })).action, 'allow');
        await pg.pool.query(`INSERT INTO checkout_interaction_events (user_id,event_name,metadata) VALUES
          ($1,'stripe_failed_card_cooldown_started','{}'),
          ($1,'stripe_checkout_session_expired_for_failed_cards','{"cooldown_started_separately":true}')`, [userId]);
        const beforeReplay = validations;
        const replay = await evaluate({ ...scoped, captchaToken: spent });
        assert.equal(replay.action, 'rate_limited');
        assert.equal(replay.reason, 'failed_card_attempt_cooldown');
        assert.equal(replay.retryAfterSeconds, 1800);
        assert.equal(replay.captchaPassed, false);
        assert.equal(validations, beforeReplay);
        const fresh = await evaluate({ ...scoped, captchaToken: duringCooldown });
        assert.equal(fresh.captchaPassed, true, 'provider success must not override the cooldown');
        assert.equal(fresh.action, 'rate_limited');
        assert.equal(fresh.reason, 'failed_card_attempt_cooldown');
        const audit = (await pg.pool.query('SELECT metadata FROM checkout_attempts WHERE id=$1', [fresh.attemptId])).rows[0];
        assert.equal(audit.metadata.counts.userFailedCardLimits30m, 1, 'expiry must not double-count the anchored cooldown');
        await pg.pool.query(`UPDATE checkout_interaction_events SET created_at=now()-interval '31 minutes'
          WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'`, [userId]);
        assert.equal((await evaluate({ ...scoped, captchaToken: spent })).action, 'captcha_required');
        assert.equal((await evaluate({ ...scoped, captchaToken: duringCooldown })).action, 'captcha_required');
        assert.equal((await evaluate({ ...scoped, captchaToken: `${userId}-after-cooldown` })).action, 'allow',
          'a fresh token works after the original cooldown even if the later expiry event is still recent');
      }
    }
  });
  await t.test('missing uniqueness enforcement fails the successful claim before authorization', async () => {
    await pg.pool.query('DROP INDEX checkout_attempts_turnstile_token_once_idx');
    await assert.rejects(evaluate({ ...input, userId: 'missing-index-user', captchaToken: 'missing-index-token' }), /no unique or exclusion constraint/);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM checkout_attempts WHERE user_id='missing-index-user' AND captcha_passed")).rows[0].n, 0);
  });
});
