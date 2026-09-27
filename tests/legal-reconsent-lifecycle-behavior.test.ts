import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { installAuthLegalFixture, loadAuthLegalClients, sessionFor } from './helpers/auth-legal-client-fixture';

const required = (version = 'current-a') => ({
  ok: true, needsReconsent: true, shouldBlock: true, mode: 'hard', graceEndsAt: null,
  documents: [{ key: 'terms', currentVersion: version, publishedAt: null, acceptedVersion: 'old' }],
});
const accepted = { ok: true, needsReconsent: false, shouldBlock: false, mode: 'hard', graceEndsAt: null, documents: [] };
type Fixture = ReturnType<typeof installAuthLegalFixture>;

async function withPrompt(check: (fixture: Fixture, Prompt: typeof import('../frontend/components/legal/ReconsentPrompt').ReconsentPrompt) => Promise<void>, hint = 'account-a') {
  const bundle = await loadAuthLegalClients();
  const fixture = installAuthLegalFixture(hint);
  try { await check(fixture, bundle.load().ReconsentPrompt); }
  finally { await fixture.dispose(); await bundle.dispose(); }
}

async function ready(fixture: Fixture) {
  await fixture.session(0, sessionFor());
  await fixture.respond(0, required());
  assert.ok(fixture.container.querySelector('.fixed.inset-0'));
}

async function clickAccept(fixture: Fixture) {
  const button = fixture.container.querySelector('button');
  assert.ok(button);
  await act(async () => button.click());
}

test('overlapping focus checks share pending session lookup and GET while the required prompt stays visible', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await fixture.focus();
    await fixture.focus();
    assert.ok(fixture.container.querySelector('.fixed.inset-0'), 'known required consent remains blocking during refresh');
    assert.equal(fixture.sessions.length, 2, 'focus checks coalesce the session lookup');
    await fixture.session(1, sessionFor());
    await fixture.focus();
    assert.equal(fixture.requests.length, 2, 'only one refresh GET may be pending');
    assert.equal(fixture.sessions.length, 2);
    await fixture.respond(1, required('current-b'));
    assert.match(fixture.container.textContent ?? '', /current-b/);
    await fixture.focus();
    assert.equal(fixture.sessions.length, 3, 'a completed check must not become a result cache');
  });
});

test('disabled reconsent ignores late GET responses and re-enabling starts a fresh check', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, sessionFor());
    await fixture.render(React.createElement(Prompt, { enabled: false }));
    await fixture.respond(0, required());
    assert.equal(fixture.container.textContent, '');
    await fixture.render(React.createElement(Prompt, { enabled: true }));
    assert.equal(fixture.container.textContent, '', 'old lifecycle status must not reappear');
    await fixture.session(1, sessionFor());
    await fixture.respond(1, required('new-lifecycle'));
    assert.match(fixture.container.textContent ?? '', /new-lifecycle/);
  });
});

test('acceptance supersedes an older GET and focus cannot race the pending POST', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.session(1, sessionFor());
    assert.equal(fixture.requests[1].init?.method, 'POST');
    await fixture.focus();
    assert.equal(fixture.sessions.length, 2, 'focus waits for the user acceptance to finish');
    await fixture.respond(1, accepted);
    assert.equal(fixture.container.textContent, '');
  });
});

test('a GET started before acceptance cannot restore the old required prompt after POST succeeds', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await fixture.focus();
    await fixture.session(1, sessionFor());
    await clickAccept(fixture);
    await fixture.session(2, sessionFor());
    assert.equal(fixture.requests[2].init?.method, 'POST');
    await fixture.respond(2, accepted);
    await fixture.respond(1, required('stale-response'));
    assert.equal(fixture.container.textContent, '');
  });
});

test('logout retires a pending GET without allowing its response to restore another session status', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, sessionFor());
    await fixture.emit('SIGNED_OUT', null);
    await fixture.respond(0, required('signed-out'));
    assert.equal(fixture.container.textContent, '');
  });
});

test('account switch retires old GETs and renders only the new account response', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, sessionFor());
    await fixture.emit('SIGNED_IN', sessionFor('account-b', 'synthetic-token-b'));
    assert.equal(fixture.requests.length, 2);
    assert.equal(new Headers(fixture.requests[1].init?.headers).get('Authorization'), 'Bearer synthetic-token-b');
    await fixture.respond(1, required('account-b-current'));
    await fixture.respond(0, required('account-a-stale'));
    assert.match(fixture.container.textContent ?? '', /account-b-current/);
    assert.doesNotMatch(fixture.container.textContent ?? '', /account-a-stale/);
  });
});

test('token refresh supersedes a pending GET and rejects a stale unauthorized response', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await fixture.focus();
    await fixture.session(1, sessionFor());
    await fixture.emit('TOKEN_REFRESHED', sessionFor('account-a', 'synthetic-token-new'));
    assert.equal(fixture.requests.length, 3);
    assert.equal(new Headers(fixture.requests[2].init?.headers).get('Authorization'), 'Bearer synthetic-token-new');
    await fixture.respond(2, required('refreshed-token'));
    await fixture.respond(1, { ok: false }, 401);
    assert.match(fixture.container.textContent ?? '', /refreshed-token/);
  });
});

test('auth changes during the initial session lookup retire its late result', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.emit('SIGNED_IN', sessionFor('account-b', 'synthetic-token-b'));
    assert.equal(fixture.requests.length, 1);
    await fixture.respond(0, required('only-b'));
    await fixture.session(0, sessionFor());
    assert.equal(fixture.requests.length, 1, 'superseded lookup must not issue an account-a GET');
    assert.match(fixture.container.textContent ?? '', /only-b/);
  });
});

test('matching initial auth replay shares the pending GET without hiding its result', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, sessionFor());
    await fixture.emit('INITIAL_SESSION', sessionFor());
    await fixture.emit('SIGNED_IN', sessionFor());
    assert.equal(fixture.requests.length, 1);
    await fixture.respond(0, required());
    assert.ok(fixture.container.querySelector('.fixed.inset-0'));
  });
});

test('a confirmed account switch clears the displayed previous account before the new GET resolves', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await fixture.emit('SIGNED_IN', sessionFor('account-b', 'synthetic-token-b'));
    assert.equal(fixture.container.textContent, '');
    await fixture.respond(1, required('only-b'));
    assert.match(fixture.container.textContent ?? '', /only-b/);
  });
});

test('logout while acceptance session lookup is pending prevents the POST', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.emit('SIGNED_OUT', null);
    await fixture.session(1, sessionFor());
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.container.textContent, '');
  });
});

test('acceptance never posts documents shown for one account with another account session', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.session(1, sessionFor('account-b', 'synthetic-token-b'));
    assert.equal(fixture.requests.length, 2);
    assert.notEqual(fixture.requests[1].init?.method, 'POST');
    assert.equal(fixture.container.textContent, '');
    await fixture.respond(1, required('only-b'));
    assert.match(fixture.container.textContent ?? '', /only-b/);
  });
});

test('an old account POST response cannot change the new account status', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.session(1, sessionFor());
    await fixture.emit('SIGNED_IN', sessionFor('account-b', 'synthetic-token-b'));
    await fixture.respond(2, required('b-required'));
    await fixture.respond(1, accepted);
    assert.match(fixture.container.textContent ?? '', /b-required/);
    assert.equal((fixture.container.querySelector('button') as HTMLButtonElement).disabled, false);
  });
});

for (const failure of ['http', 'network', 'malformed'] as const) {
  test(`a ${failure} GET failure keeps required consent visible and a later focus retries`, async () => {
    await withPrompt(async (fixture, Prompt) => {
      await fixture.render(React.createElement(Prompt));
      await ready(fixture);
      await fixture.focus();
      await fixture.session(1, sessionFor());
      const warnings: unknown[][] = [];
      const warn = console.warn;
      console.warn = (...args) => { warnings.push(args); };
      try {
        if (failure === 'http') await fixture.respond(1, { ok: false, error: 'Synthetic read failure' }, 503);
        else if (failure === 'network') await act(async () => fixture.requests[1].reject(new Error('Synthetic read failure')));
        else await act(async () => fixture.requests[1].resolve(new Response('{bad JSON')));
      } finally { console.warn = warn; }
      assert.equal(warnings.length, 1, 'the existing failure diagnostic remains');
      assert.ok(fixture.container.querySelector('.fixed.inset-0'));
      await fixture.focus();
      await fixture.session(2, sessionFor());
      await fixture.respond(2, required('after-retry'));
      assert.match(fixture.container.textContent ?? '', /after-retry/);
    });
  });
}

test('401 clears the current legal status and permits a later authorized retry', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await fixture.focus();
    await fixture.session(1, sessionFor());
    await fixture.respond(1, { ok: false }, 401);
    assert.equal(fixture.container.textContent, '');
    await fixture.focus();
    await fixture.session(2, sessionFor());
    await fixture.respond(2, required('authorized-again'));
    assert.match(fixture.container.textContent ?? '', /authorized-again/);
  });
});

test('failed acceptance remains blocking, accepts a fresh retry, and sends the original document-key contract', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.session(1, sessionFor());
    assert.deepEqual(JSON.parse(String(fixture.requests[1].init?.body)), {
      documents: ['terms'], locale: 'en-US', source: 'reconsent',
    });
    await fixture.respond(1, { ok: false, error: 'Synthetic write failure' }, 503);
    assert.ok(fixture.container.querySelector('.fixed.inset-0'));
    assert.match(fixture.container.textContent ?? '', /Synthetic write failure/);
    await clickAccept(fixture);
    await fixture.session(2, sessionFor());
    await fixture.respond(2, accepted);
    assert.equal(fixture.container.textContent, '');
    await fixture.focus();
    assert.equal(fixture.sessions.length, 4, 'successful acceptance does not permanently suppress fresh legal checks');
  });
});

test('unmount removes auth/focus listeners and a later mount owns its own status', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, sessionFor());
    await fixture.render(null);
    assert.equal(fixture.listeners.size, 0);
    await fixture.focus();
    assert.equal(fixture.sessions.length, 1);
    await fixture.render(React.createElement(Prompt));
    await fixture.session(1, sessionFor('account-b', 'synthetic-token-b'));
    await fixture.respond(1, required('new-mount'));
    await fixture.respond(0, required('retired-mount'));
    assert.match(fixture.container.textContent ?? '', /new-mount/);
    assert.doesNotMatch(fixture.container.textContent ?? '', /retired-mount/);
  });
});

test('fresh first-load status and the server soft-consent policy remain authoritative', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    assert.equal(fixture.container.textContent, '');
    await fixture.session(0, sessionFor());
    assert.equal(fixture.container.textContent, '');
    await fixture.respond(0, { ...required(), mode: 'soft', shouldBlock: false });
    assert.equal(fixture.container.querySelector('.fixed.inset-0'), null);
    assert.match(fixture.container.textContent ?? '', /Grace period active/);
  });
});

test('stale hints and anonymous visitors never issue an unauthorized legal request', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.session(0, null);
    await fixture.focus();
    await fixture.session(1, null);
    assert.equal(fixture.requests.length, 0);
  });
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await fixture.focus();
    assert.equal(fixture.sessions.length, 0);
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.requests.length, 0);
  }, '');
});

test('token refresh during an acceptance preserves the one pending write for the same account', async () => {
  await withPrompt(async (fixture, Prompt) => {
    await fixture.render(React.createElement(Prompt));
    await ready(fixture);
    await clickAccept(fixture);
    await fixture.session(1, sessionFor());
    await fixture.emit('TOKEN_REFRESHED', sessionFor('account-a', 'synthetic-token-new'));
    await fixture.focus();
    assert.equal(fixture.requests.length, 2, 'a read must not race the pending acceptance on token rotation');
    assert.equal((fixture.container.querySelector('button') as HTMLButtonElement).disabled, true);
    await fixture.respond(1, accepted);
    assert.equal(fixture.container.textContent, '');
    await fixture.focus();
    await fixture.session(2, sessionFor('account-a', 'synthetic-token-new'));
    assert.equal(new Headers(fixture.requests[2].init?.headers).get('Authorization'), 'Bearer synthetic-token-new');
  });
});

for (const failure of ['missing-session', 'rejected-lookup'] as const) {
  test(`a ${failure} during acceptance preserves mandatory consent and permits an authorized retry`, async () => {
    await withPrompt(async (fixture, Prompt) => {
      await fixture.render(React.createElement(Prompt));
      await ready(fixture);
      await clickAccept(fixture);
      if (failure === 'missing-session') await fixture.session(1, null);
      else await act(async () => fixture.sessions[1].reject(new Error('Synthetic transient session failure')));
      assert.equal(fixture.requests.length, 1, 'an unresolved identity must never issue POST');
      assert.ok(fixture.container.querySelector('.fixed.inset-0'), 'absence during a lookup is not an explicit logout');
      assert.match(fixture.container.textContent ?? '', /current-a/);
      assert.match(fixture.container.textContent ?? '', /try again/i);
      assert.equal((fixture.container.querySelector('button') as HTMLButtonElement).disabled, false);
      await clickAccept(fixture);
      await fixture.session(2, sessionFor());
      assert.equal(fixture.requests[1].init?.method, 'POST');
      assert.equal(new Headers(fixture.requests[1].init?.headers).get('Authorization'), 'Bearer synthetic-token-a');
      await fixture.respond(1, accepted);
      assert.equal(fixture.container.textContent, '');
    });
  });
}
