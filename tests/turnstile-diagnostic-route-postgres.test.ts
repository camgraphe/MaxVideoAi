import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTurnstileMigrationFixture } from './helpers/turnstile-migration-fixture';

test('admin diagnostic validates the real guard without any payment dependency', { timeout: 60_000 }, async t => {
  const entry = 'frontend/app/api/admin/turnstile-diagnostic/route.ts';
  assert.ok(existsSync(entry), 'the payment-free diagnostic route must exist');
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const { NextRequest } = createRequire(resolve('frontend/package.json'))('next/server');
  const { POST } = await f.load(entry);
  const url = 'https://maxvideoai.example/api/admin/turnstile-diagnostic';
  function request(body: unknown = { captchaToken: 'A:diagnostic' }, headers: Record<string, string> = {}) {
    return new NextRequest(url, { method: 'POST', headers: { 'x-test-role': 'admin', origin: 'https://maxvideoai.example', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  }
  async function reject(req: InstanceType<typeof NextRequest>, status: number) {
    const before = (await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts')).rows[0].n;
    const calls = f.providerCalls.length;
    const response = await POST(req);
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts')).rows[0].n, before);
    assert.equal(f.providerCalls.length, calls);
  }
  await t.test('authentication, role, feature gate and origin are enforced before validation', async () => {
    await reject(request(undefined, { 'x-test-role': '' }), 401);
    await reject(request(undefined, { 'x-test-role': 'member' }), 403);
    delete process.env.TURNSTILE_DIAGNOSTICS_ENABLED;
    await reject(request(), 404);
    process.env.TURNSTILE_DIAGNOSTICS_ENABLED = '1';
    await reject(request(undefined, { origin: '' }), 403);
    await reject(request(undefined, { origin: 'null' }), 403);
    await reject(request(undefined, { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' }), 403);
    await reject(request(undefined, { 'sec-fetch-site': 'cross-site' }), 403);
  });
  await t.test('only bounded diagnostic payloads are accepted', async () => {
    await reject(request('{broken'), 400);
    await reject(request({ captchaToken: '' }), 400);
    await reject(request({ captchaToken: 'a'.repeat(2049) }), 400);
    await reject(request('x'.repeat(5000)), 413);
    await reject(request({ captchaToken: 'A:test', userId: 'victim' }), 400);
    await reject(request({ captchaToken: 'A:test', mode: 'pay' }), 400);
    await reject(request(undefined, { 'content-type': 'text/plain' }), 415);
    process.env.TURNSTILE_SECONDARY_SECRET_KEY = '';
    await reject(request(), 503);
    process.env.TURNSTILE_SECONDARY_SECRET_KEY = 'secret-B';
  });
  await t.test('a real claim is made once; replay is rejected and no customer/session/credit operation is reachable', async () => {
    const payload = { captchaToken: 'B:probe', captchaSiteKey: 'public-B', mode: 'express_checkout' };
    const first = await POST(request(payload));
    assert.equal(first.status, 200);
    const accepted = await first.json();
    assert.equal(accepted.result.captchaPassed, true);
    assert.equal(accepted.result.action, 'allow');
    const second = await POST(request(payload));
    assert.equal(second.status, 403);
    assert.equal((await second.json()).result.reason, 'captcha_token_replayed');
    const old = await POST(request({ captchaToken: 'A:old' }));
    assert.equal((await old.json()).result.captchaPassed, true);
    const rows = (await f.pg.pool.query('SELECT user_id, amount_cents, mode, stripe_checkout_session_id, metadata FROM checkout_attempts')).rows;
    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => row.user_id === 'diagnostic-admin' && row.stripe_checkout_session_id === null));
    assert.ok(rows.every(row => row.metadata.diagnostic === 'turnstile'));
    assert.ok(!JSON.stringify(accepted).includes('secret-B'));
    assert.ok(!JSON.stringify(rows).includes('B:probe'));
  });
});
