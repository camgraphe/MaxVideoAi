import assert from 'node:assert/strict';
import test from 'node:test';
import { createTurnstileMigrationFixture } from './helpers/turnstile-migration-fixture';

test('widget migration preserves stale tabs, rollback and the global replay boundary', { timeout: 60_000 }, async t => {
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const { evaluateWalletCheckoutGuard: evaluate } = await f.load('frontend/server/checkout-guard.ts');
  const input = { userId: 'migration-user', clientIp: null, amountCents: 1700, mode: 'hosted', hasCompletedTopUp: false, isPresetTopupTier: false };

  await t.test('old payload A and tagged B work before, during and after a public-key rollback', async () => {
    for (const [phase, active] of [['bridge', 'public-A'], ['cutover', 'public-B'], ['rollback', 'public-A']]) {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = active;
      for (const mode of ['hosted', 'express_checkout']) {
        const old = await evaluate({ ...input, mode, captchaToken: `A:${phase}-${mode}` });
        const modern = await evaluate({ ...input, mode, captchaSiteKey: 'public-B', captchaToken: `B:${phase}-${mode}` });
        assert.equal(old.captchaPassed, true, `${phase}: an untagged old tab must use A`);
        assert.equal(modern.captchaPassed, true, `${phase}: a B tab must use B even after rollback`);
        assert.equal(modern.action, 'allow');
      }
    }
  });
  await t.test('no secret probing and no unknown identifier can silently fall back to A', async () => {
    for (const hint of ['unknown-widget', '', null, 42, { siteKey: 'public-A' }]) {
      const before = f.providerCalls.length;
      const result = await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true, captchaSiteKey: hint, captchaToken: 'A:untrusted-id' });
      assert.equal(result.action, 'captcha_required');
      assert.equal(result.reason, 'captcha_widget_mismatch');
      assert.equal(f.providerCalls.length, before);
    }
    const before = f.providerCalls.length;
    const mismatch = await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'A:wrong-key' });
    assert.equal(mismatch.captchaPassed, false);
    assert.equal(mismatch.action, 'captcha_required');
    assert.deepEqual(f.providerCalls.slice(before).map(x => x.secret), ['secret-B']);
  });
  await t.test('a partial or ambiguous transition cannot become the unconfigured bypass', async () => {
    const cases = [
      { TURNSTILE_SECONDARY_SECRET_KEY: '' }, { TURNSTILE_LEGACY_SITE_KEY: '' },
      { TURNSTILE_SECONDARY_SITE_KEY: 'public-A' }, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'unknown' },
      { TURNSTILE_SECRET_KEY: '' },
    ];
    for (const change of cases) {
      const saved = Object.fromEntries(Object.keys(change).map(k => [k, process.env[k]]));
      Object.assign(process.env, change);
      try {
        const result = await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true });
        assert.equal(result.action, 'captcha_required');
        assert.equal(result.reason, 'captcha_configuration_error');
      } finally { Object.assign(process.env, saved); }
    }
  });
  await t.test('a consumed B token remains consumed across widget hints, users and rollback', async () => {
    assert.equal((await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:spent' })).captchaPassed, true);
    const before = f.providerCalls.length;
    for (const hint of ['public-B', 'public-A', undefined]) {
      const result = await evaluate({ ...input, userId: 'another-user', mode: 'express_checkout', captchaSiteKey: hint, captchaToken: ' \nB:spent\t' });
      assert.equal(result.reason, 'captcha_token_replayed');
      assert.equal(result.captchaPassed, false);
    }
    assert.equal(f.providerCalls.length, before);
    const claims = await f.pg.pool.query("SELECT count(*)::int AS n FROM checkout_attempts WHERE captcha_passed AND metadata->>'turnstileTokenHash'=encode(sha256('B:spent'::bytea),'hex')");
    assert.equal(claims.rows[0].n, 1);
  });
  await t.test('expired and network-failed B validations remain challenges and cooldown retains priority', async () => {
    for (const token of ['B:expired', 'B:network-error']) {
      const result = await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: token });
      assert.equal(result.action, 'captcha_required');
      assert.equal(result.captchaPassed, false);
    }
    await f.pg.pool.query("INSERT INTO checkout_interaction_events(user_id,event_name) VALUES ('cooldown-user','stripe_failed_card_cooldown_started')");
    for (const hint of ['public-B', 'unknown']) {
      const result = await evaluate({ ...input, userId: 'cooldown-user', captchaSiteKey: hint, captchaToken: 'B:cooldown' });
      assert.equal(result.action, 'rate_limited');
      assert.equal(result.reason, 'failed_card_attempt_cooldown');
    }
  });
  await t.test('metadata exposes only server-selected public widget identity', async () => {
    const result = await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:audit', metadata: { turnstileWidgetGeneration: 'forged' } });
    const row = (await f.pg.pool.query('SELECT metadata FROM checkout_attempts WHERE id=$1', [result.attemptId])).rows[0];
    assert.equal(row.metadata.turnstileWidgetGeneration, 'secondary');
    assert.equal(row.metadata.turnstileSiteKey, 'public-B');
    const serialized = JSON.stringify((await f.pg.pool.query('SELECT metadata FROM checkout_attempts')).rows);
    for (const forbidden of ['secret-A', 'secret-B', 'B:audit']) assert.ok(!serialized.includes(forbidden));
    assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE stripe_checkout_session_id IS NOT NULL')).rows[0].n, 0);
  });
});
