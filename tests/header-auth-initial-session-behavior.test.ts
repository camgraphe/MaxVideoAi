import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { installAuthLegalFixture, loadAuthLegalClients, sessionFor } from './helpers/auth-legal-client-fixture';

async function withHeader(check: (fixture: ReturnType<typeof installAuthLegalFixture>, state: () => ReturnType<typeof import('../frontend/components/header/useHeaderAccountState').useHeaderAccountState>) => Promise<void>) {
  const bundle = await loadAuthLegalClients();
  const fixture = installAuthLegalFixture();
  const { useHeaderAccountState } = bundle.load();
  let state!: ReturnType<typeof useHeaderAccountState>;
  function Probe() { state = useHeaderAccountState(); return null; }
  try {
    await fixture.render(React.createElement(Probe));
    await check(fixture, () => state);
  } finally { await fixture.dispose(); await bundle.dispose(); }
}

test('INITIAL_SESSION for the same account and token preserves the first pending wallet/access reads', async () => {
  await withHeader(async (fixture, state) => {
    assert.equal(fixture.requests.length, 0, 'no account request before session resolution');
    await fixture.session(0, sessionFor());
    assert.deepEqual(fixture.requests.map(({ url }) => url), ['/api/wallet', '/api/admin/access']);
    await fixture.emit('INITIAL_SESSION', sessionFor());
    assert.equal(fixture.requests.length, 2, 'identical initial-session replay must not supersede two useful in-flight reads');
    await fixture.respond(0, { balance: 12.34, currency: 'USD' });
    assert.deepEqual(state().wallet, { balance: 12.34 }, 'the first response remains useful after INITIAL_SESSION');
    assert.equal(state().walletLoading, false);
    await fixture.respond(1, { ok: true });
    assert.equal(state().isAdmin, true);
  });
});

test('INITIAL_SESSION with a changed token starts fresh account reads and rejects the old responses', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.emit('INITIAL_SESSION', sessionFor('account-a', 'synthetic-token-renewed'));
    assert.equal(fixture.requests.length, 4);
    assert.equal(new Headers(fixture.requests[2].init?.headers).get('Authorization'), 'Bearer synthetic-token-renewed');
    await fixture.respond(0, { balance: 99 });
    await fixture.respond(1, { ok: true });
    assert.equal(state().wallet, null);
    assert.equal(state().isAdmin, false);
    await fixture.respond(2, { balance: 5 });
    assert.deepEqual(state().wallet, { balance: 5 });
  });
});

test('a late INITIAL_SESSION initializes an account after getSession returned no session', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, null);
    assert.equal(fixture.requests.length, 0);
    await fixture.emit('INITIAL_SESSION', sessionFor());
    assert.equal(fixture.requests.length, 2);
    assert.equal(state().email, 'account-a@example.test');
    await fixture.respond(0, { balance: 6 });
    assert.deepEqual(state().wallet, { balance: 6 });
  });
});

test('account changes on INITIAL_SESSION preserve account isolation', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.respond(0, { balance: 10 });
    await fixture.respond(1, { ok: true });
    await fixture.emit('INITIAL_SESSION', sessionFor('account-b', 'synthetic-token-b'));
    assert.equal(fixture.requests.length, 4);
    assert.equal(state().wallet, null);
    assert.equal(state().isAdmin, false);
    assert.equal(state().email, 'account-b@example.test');
  });
});

test('SIGNED_IN, TOKEN_REFRESHED and wallet invalidation still refresh and retry failed reads', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.respond(0, { error: 'unavailable' }, 503);
    await fixture.respond(1, { error: 'unavailable' }, 503);
    assert.equal(state().walletLoading, false);
    await fixture.emit('SIGNED_IN', sessionFor());
    assert.equal(fixture.requests.length, 4);
    await fixture.respond(2, { balance: 7 });
    await fixture.emit('TOKEN_REFRESHED', sessionFor('account-a', 'renewed'));
    assert.equal(fixture.requests.length, 6);
    await fixture.invalidateWallet();
    await fixture.session(1, sessionFor('account-a', 'renewed'));
    assert.equal(fixture.requests.length, 8);
    await fixture.emit('SIGNED_OUT', null);
    await fixture.respond(6, { balance: 99 });
    await fixture.respond(7, { ok: true });
    assert.equal(state().wallet, null);
    assert.equal(state().isAdmin, false);
    assert.equal(state().email, null);
  });
});

test('settled initial failures can be retried by INITIAL_SESSION', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.respond(0, { error: 'unavailable' }, 503);
    await fixture.respond(1, { error: 'unavailable' }, 503);
    await fixture.emit('INITIAL_SESSION', sessionFor());
    assert.equal(fixture.requests.length, 4, 'the guard only reuses still-pending reads');
    await fixture.respond(2, { balance: 8 });
    assert.deepEqual(state().wallet, { balance: 8 });
  });
});

test('an invalidation superseding initialization cannot be mistaken for its pending replay', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.invalidateWallet();
    await fixture.session(1, sessionFor());
    await fixture.emit('INITIAL_SESSION', sessionFor());
    assert.equal(fixture.requests.length, 6, 'a superseded initial request is not reused');
    await fixture.respond(0, { balance: 99 });
    await fixture.respond(2, { balance: 98 });
    assert.equal(state().wallet, null);
    await fixture.respond(4, { balance: 9 });
    assert.deepEqual(state().wallet, { balance: 9 });
  });
});

test('INITIAL_SESSION does not hide a usable wallet while the initial admin request is pending', async () => {
  await withHeader(async (fixture, state) => {
    await fixture.session(0, sessionFor());
    await fixture.respond(0, { balance: 13 });
    assert.equal(state().walletLoading, false);
    await fixture.emit('INITIAL_SESSION', sessionFor());
    assert.equal(fixture.requests.length, 2);
    assert.equal(state().walletLoading, false);
    assert.deepEqual(state().wallet, { balance: 13 });
    await fixture.respond(1, { ok: false });
    assert.equal(state().isAdmin, false);
  });
});

for (const failedIndex of [0, 1]) {
  test(`INITIAL_SESSION retries a failed ${failedIndex === 0 ? 'wallet' : 'access'} read while its sibling remains pending`, async () => {
    await withHeader(async (fixture, state) => {
      await fixture.session(0, sessionFor());
      await fixture.respond(failedIndex, { error: 'temporary failure' }, 503);
      await fixture.emit('INITIAL_SESSION', sessionFor());
      assert.equal(fixture.requests.length, 4, 'a failed branch cannot be reused just because its sibling is pending');
      await fixture.respond(2, { balance: 14 });
      await fixture.respond(3, { ok: true });
      assert.deepEqual(state().wallet, { balance: 14 });
      assert.equal(state().isAdmin, true);
    });
  });
}

for (const failedIndex of [0, 1]) {
  for (const failure of ['network', 'malformed'] as const) {
    test(`INITIAL_SESSION retries a ${failure} failure on ${failedIndex === 0 ? 'wallet' : 'access'} before its sibling settles`, async () => {
      await withHeader(async (fixture) => {
        await fixture.session(0, sessionFor());
        if (failure === 'network') {
          await React.act(async () => fixture.requests[failedIndex].reject(new Error('synthetic network failure')));
        } else {
          await fixture.respond(failedIndex, null);
        }
        await fixture.emit('INITIAL_SESSION', sessionFor());
        assert.equal(fixture.requests.length, 4);
      });
    });
  }
}
