import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { installAuthLegalFixture, loadAuthLegalClients, sessionFor } from './helpers/auth-legal-client-fixture';

async function withClients(hint: string, check: (fixture: ReturnType<typeof installAuthLegalFixture>, clients: ReturnType<Awaited<ReturnType<typeof loadAuthLegalClients>>['load']>) => Promise<void>) {
  const bundle = await loadAuthLegalClients();
  const fixture = installAuthLegalFixture(hint);
  try { await check(fixture, bundle.load()); }
  finally { await fixture.dispose(); await bundle.dispose(); }
}

test('billing auth resolves usable sessions before remote user validation and legal reads wait for confirmed header auth', async (t) => {
  await withClients('account-a', async (fixture, { useRequireAuth, useHeaderAccountState, ReconsentPrompt }) => {
    function Header() {
      const { email, authResolved } = useHeaderAccountState();
      return React.createElement(ReconsentPrompt, { enabled: authResolved && Boolean(email) });
    }
    // The existing BillingClient conditional mount, without any checkout adapter.
    function BillingBoundary() {
      const { loading } = useRequireAuth({ redirectIfLoggedOut: false });
      return loading ? null : React.createElement(React.Fragment, null,
        React.createElement('main', null, 'Billing content'), React.createElement(Header));
    }
    await fixture.render(React.createElement(BillingBoundary));
    assert.equal(fixture.container.textContent, '');
    assert.equal(fixture.sessions.length, 1);
    assert.equal(fixture.requests.length, 0);
    await fixture.session(0, sessionFor());
    assert.match(fixture.container.textContent ?? '', /Billing content/);
    assert.equal(fixture.users.length, 1, 'verification still runs');
    assert.equal(fixture.sessions.length, 2, 'Header mounts after billing auth releases the gate');
    assert.equal(fixture.requests.length, 0);
    await fixture.session(1, sessionFor());
    assert.deepEqual(fixture.requests.map(({ url }) => url), ['/api/wallet', '/api/admin/access']);
    assert.equal(fixture.sessions.length, 3, 'reconsent resolves current session headers after header auth');
    await fixture.session(2, sessionFor());
    assert.deepEqual(fixture.requests.map(({ url }) => url), ['/api/wallet', '/api/admin/access', '/api/legal/reconsent']);
    assert.equal(fixture.container.querySelector('button'), null, 'unresolved legal status must not fabricate an acceptance');
    await fixture.respond(2, { ok: true, needsReconsent: true, shouldBlock: true, mode: 'hard', documents: [
      { key: 'terms', currentVersion: 'synthetic-current', publishedAt: null, acceptedVersion: 'synthetic-old' },
    ] });
    assert.equal(fixture.container.querySelector('button')?.textContent, 'Accept and continue');
    assert.ok(fixture.container.querySelector('.fixed.inset-0'), 'required hard reconsent stays blocking');
    await fixture.user(0, sessionFor());
    t.diagnostic('Controlled gates: billing getSession → content + pending getUser → header getSession → legal getSession → GET → required prompt. No elapsed-time claim.');
  });
});

test('anonymous auth and legal prompt do not import session work or call protected APIs', async () => {
  await withClients('', async (fixture, { useRequireAuth, ReconsentPrompt }) => {
    let state!: ReturnType<typeof useRequireAuth>;
    function Probe() { state = useRequireAuth({ redirectIfLoggedOut: false }); return React.createElement(ReconsentPrompt); }
    await fixture.render(React.createElement(Probe));
    assert.equal(state.loading, false);
    assert.equal(state.authStatus, 'loggedOut');
    assert.equal(state.session, null);
    assert.equal(fixture.sessions.length, 0);
    assert.equal(fixture.requests.length, 0);
  });
});

test('a stale hint retains refresh handling and releases initial loading when refresh expires', async () => {
  await withClients('account-a', async (fixture, { useRequireAuth }) => {
    let state!: ReturnType<typeof useRequireAuth>;
    function Probe() { state = useRequireAuth({ redirectIfLoggedOut: false }); return null; }
    await fixture.render(React.createElement(Probe));
    await fixture.session(0, null);
    assert.equal(fixture.refreshes.length, 1);
    assert.equal(state.loading, true);
    assert.equal(state.authStatus, 'refreshing');
    await fixture.expireLookups();
    assert.equal(state.loading, false);
    assert.equal(state.session, null);
    assert.equal(state.authStatus, 'refreshing');
    await act(async () => fixture.refreshes[0].resolve({ data: { session: null }, error: null }));
    await fixture.emit('SIGNED_IN', sessionFor());
    assert.equal(state.authStatus, 'authed');
    assert.equal(state.session?.user.id, 'account-a');
  });
});

test('delayed initial session lookup releases loading at its existing bound and accepts later auth events', async () => {
  await withClients('account-a', async (fixture, { useRequireAuth }) => {
    let state!: ReturnType<typeof useRequireAuth>;
    function Probe() { state = useRequireAuth({ redirectIfLoggedOut: false }); return null; }
    await fixture.render(React.createElement(Probe));
    assert.equal(state.loading, true);
    await fixture.expireLookups();
    assert.equal(state.loading, false);
    assert.equal(state.authStatus, 'refreshing');
    await fixture.emit('SIGNED_IN', sessionFor());
    assert.equal(state.session?.user.id, 'account-a');
    await fixture.session(0, null);
    assert.equal(state.authStatus, 'authed');
  });
});

test('cookie choice UI waits for the fresh version response independently of auth', async () => {
  await withClients('', async (fixture, { CookieBanner }) => {
    await fixture.render(React.createElement(CookieBanner));
    assert.equal(fixture.sessions.length, 0);
    assert.equal(fixture.container.querySelector('button'), null);
    assert.deepEqual(fixture.requests.map(({ url }) => url), ['/api/legal/cookies/version']);
    assert.equal(fixture.requests[0].init?.cache, 'no-store');
    await fixture.respond(0, { ok: true, version: 'synthetic-current', publishedAt: null });
    assert.equal(fixture.container.querySelectorAll('button').length, 3, 'required choice controls are offered once the version is known');
    await fixture.render(React.createElement(CookieBanner));
    assert.equal(fixture.requests.length, 1, 'same-route rerender must not refetch the cookie version');
  });
});
