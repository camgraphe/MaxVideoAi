import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { createTurnstileMigrationFixture } from './helpers/turnstile-migration-fixture';

test('explicit B-only mode retires A without weakening verification, replay or cooldown', { timeout: 60_000 }, async t => {
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const { evaluateWalletCheckoutGuard: guard } = await f.load('frontend/server/checkout-guard.ts');
  let requestNumber = 0;
  const evaluate = (params: Record<string, unknown>) => guard({ userId: `retirement-${++requestNumber}`, clientIp: `192.0.2.${requestNumber}`, ...params });
  const input = { amountCents: 1700, mode: 'hosted', hasCompletedTopUp: false, isPresetTopupTier: false };
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-B';
  assert.equal((await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:spent-before-retirement' })).captchaPassed, true);
  process.env.TURNSTILE_WIDGET_MODE = 'secondary_only';
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_LEGACY_SITE_KEY;

  await t.test('new B clients work with only the secondary pair', async () => {
    for (const mode of ['hosted', 'express_checkout']) {
      const result = await evaluate({ ...input, mode, captchaSiteKey: 'public-B', captchaToken: 'B:new-' + mode });
      assert.equal(result.action, 'allow');
      assert.equal(result.captchaPassed, true);
    }
  });

  await t.test('stale A and untagged clients are rejected before any provider call', async () => {
    const before = f.providerCalls.length;
    for (const mode of ['hosted', 'express_checkout']) {
      for (const captchaSiteKey of [undefined, 'public-A', '', null, 42]) {
        const result = await evaluate({ ...input, mode, captchaSiteKey, captchaToken: 'A:retired' });
        assert.equal(result.action, 'captcha_required');
        assert.equal(result.reason, 'captcha_widget_mismatch');
        assert.equal(result.captchaPassed, false);
      }
    }
    assert.equal(f.providerCalls.length, before);
  });

  await t.test('a claimed token remains spent after retiring A and cooldown takes priority', async () => {
    const replay = await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:spent-before-retirement' });
    assert.equal(replay.reason, 'captcha_token_replayed');
    await f.pg.pool.query("INSERT INTO checkout_interaction_events(user_id,event_name) VALUES ('cooldown-retirement','stripe_failed_card_cooldown_started')");
    for (const captchaSiteKey of [undefined, 'public-A', 'public-B']) {
      const result = await evaluate({ ...input, userId: 'cooldown-retirement', captchaSiteKey, captchaToken: 'B:cooldown' });
      assert.equal(result.action, 'rate_limited');
      assert.equal(result.reason, 'failed_card_attempt_cooldown');
    }
  });

  await t.test('missing B, mismatched active key, disabled or unknown modes cannot bypass the guard', async () => {
    for (const change of [
      { TURNSTILE_SECONDARY_SECRET_KEY: '' }, { TURNSTILE_SECONDARY_SITE_KEY: '' },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-A' }, { CHECKOUT_CAPTCHA_MODE: 'off' },
      { TURNSTILE_WIDGET_MODE: 'typo' },
    ]) {
      const saved = Object.fromEntries(Object.keys(change).map(key => [key, process.env[key]]));
      Object.assign(process.env, change);
      try {
        const result = await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true });
        assert.equal(result.action, 'captcha_required');
        assert.equal(result.reason, 'captcha_configuration_error');
      } finally { Object.assign(process.env, saved); }
    }
  });

  await t.test('rollback to compatibility accepts A and B while keeping B replay history', async () => {
    Object.assign(process.env, { TURNSTILE_WIDGET_MODE: 'compatibility', TURNSTILE_SECRET_KEY: 'secret-A', TURNSTILE_LEGACY_SITE_KEY: 'public-A' });
    assert.equal((await evaluate({ ...input, captchaToken: 'A:rollback' })).captchaPassed, true);
    assert.equal((await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:rollback' })).captchaPassed, true);
    assert.equal((await evaluate({ ...input, captchaSiteKey: 'public-B', captchaToken: 'B:spent-before-retirement' })).reason, 'captcha_token_replayed');
    process.env.TURNSTILE_WIDGET_MODE = 'typo';
    assert.equal((await evaluate({ ...input, hasCompletedTopUp: true, isPresetTopupTier: true })).reason, 'captcha_configuration_error');
    assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE stripe_checkout_session_id IS NOT NULL')).rows[0].n, 0);
  });
});

test('explicit reload clears only the deployment pin and requires the same origin', { timeout: 60_000 }, async t => {
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const entry = 'frontend/app/api/turnstile/reload/route.ts';
  assert.ok(existsSync(entry), 'an explicit reload must be able to clear an HttpOnly deployment pin');
  const { POST } = await f.load(entry);
  for (const headers of [{}, { origin: 'https://other.example' }, { origin: 'https://maxvideoai.com', 'sec-fetch-site': 'cross-site' }]) {
    const response = POST(new Request('https://maxvideoai.com/api/turnstile/reload', { method: 'POST', headers }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const response = POST(new Request('https://maxvideoai.com/api/turnstile/reload', {
    method: 'POST', headers: { origin: 'https://maxvideoai.com', 'sec-fetch-site': 'same-origin', cookie: '__vdpl=old; session=unchanged' },
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('set-cookie'), '__vdpl=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(await response.text(), '');
  assert.equal(f.providerCalls.length, 0);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts')).rows[0].n, 0);
});

test('public configuration exposes accepted widget identities without secrets, cache or side effects', { timeout: 60_000 }, async t => {
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const entry = 'frontend/app/api/turnstile/config/route.ts';
  assert.ok(existsSync(entry), 'a read-only runtime configuration route must exist');
  const { GET } = await f.load(entry);
  let response = await GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { activeSiteKey: 'public-A', acceptedSiteKeys: ['public-A', 'public-B'] });
  Object.assign(process.env, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-B', TURNSTILE_WIDGET_MODE: 'secondary_only' });
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_LEGACY_SITE_KEY;
  response = await GET();
  assert.deepEqual(await response.json(), { activeSiteKey: 'public-B', acceptedSiteKeys: ['public-B'] });
  delete process.env.TURNSTILE_SECONDARY_SECRET_KEY;
  response = await GET();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'captcha_configuration_unavailable' });
  assert.equal(f.providerCalls.length, 0);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts')).rows[0].n, 0);
});
