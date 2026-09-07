import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useHeaderAccountState } from '../frontend/components/header/useHeaderAccountState';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(ok: boolean, body: unknown) {
  return { ok, json: async () => body } as Response;
}

test('header wallet keeps request readiness separate across settlement, remount, account switch, and unmount', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'https://maxvideoai.test/app' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const savedEnv = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Blob: dom.window.Blob,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const walletResponses: Deferred<Response>[] = [];
  const adminResponses: Deferred<Response>[] = [];
  const fetchCalls: string[] = [];
  const fetchStub = ((input: string | URL | Request) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url === '/api/admin/access') {
      const pending = deferred<Response>();
      adminResponses.push(pending);
      return pending.promise;
    }
    if (url === '/api/wallet') {
      const pending = deferred<Response>();
      walletResponses.push(pending);
      return pending.promise;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  saved.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchStub });
  dom.window.sessionStorage.setItem('last-known:user-id', 'user-a');

  type Session = { access_token: string; user: { id: string; email: string } } | null;
  let currentSession: Session = {
    access_token: 'token-a',
    user: { id: 'user-a', email: 'a@example.com' },
  };
  let authListener: ((event: string, session: Session) => void | Promise<void>) | null = null;
  let unsubscribeCount = 0;
  let getSessionCount = 0;
  let nextSessionResponse: Deferred<{ data: { session: Session } }> | null = null;
  const observed: Array<{ authResolved: boolean; walletLoading: boolean; balance: number | null; email: string | null; isAdmin: boolean }> = [];
  const supabaseModule = await import('../frontend/src/lib/supabaseClient');
  await supabaseModule.supabase.auth.initialize();
  supabaseModule.supabase.auth.stopAutoRefresh();
  const auth = supabaseModule.supabase.auth as unknown as {
    getSession: () => Promise<{ data: { session: Session } }>;
    onAuthStateChange: (listener: (event: string, session: Session) => void | Promise<void>) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
  const originalGetSession = auth.getSession;
  const originalOnAuthStateChange = auth.onAuthStateChange;
  auth.getSession = async () => {
    getSessionCount += 1;
    if (nextSessionResponse) {
      const pending = nextSessionResponse;
      nextSessionResponse = null;
      return pending.promise;
    }
    return { data: { session: currentSession } };
  };
  auth.onAuthStateChange = (listener) => {
    authListener = listener;
    return { data: { subscription: { unsubscribe: () => { unsubscribeCount += 1; } } } };
  };

  function Probe() {
    const state = useHeaderAccountState();
    observed.push({
      authResolved: state.authResolved,
      walletLoading: state.walletLoading,
      balance: state.wallet?.balance ?? null,
      email: state.email,
      isAdmin: state.isAdmin,
    });
    return React.createElement('output', null, JSON.stringify(observed.at(-1)));
  }

  const container = dom.window.document.getElementById('root')!;
  let root = createRoot(container);
  let rootMounted = true;
  const latest = () => observed.at(-1)!;
  const flush = async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  };
  const waitFor = async (predicate: () => boolean) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (predicate()) return;
      await flush();
    }
    assert.fail('condition was not reached');
  };

  try {
    await act(async () => { root.render(React.createElement(Probe)); });
    await waitFor(() => latest().authResolved && walletResponses.length === 1 && adminResponses.length === 1);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: true,
      balance: null,
      email: 'a@example.com',
      isAdmin: false,
    });
    assert.equal(walletResponses.length, 1);

    await act(async () => { walletResponses[0].resolve(response(true, { balance: 12.34, currency: 'USD' })); });
    await waitFor(() => latest().balance === 12.34 && !latest().walletLoading);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: false,
      balance: 12.34,
      email: 'a@example.com',
      isAdmin: false,
    });
    assert.equal(adminResponses.length, 1, 'wallet settlement must not wait for the admin response');
    await act(async () => { adminResponses[0].resolve(response(true, { ok: true })); });
    await waitFor(() => latest().isAdmin);

    await act(async () => { root.unmount(); });
    rootMounted = false;
    root = createRoot(container);
    rootMounted = true;
    await act(async () => { root.render(React.createElement(Probe)); });
    await waitFor(() => walletResponses.length === 2 && adminResponses.length === 2 && latest().authResolved);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: true,
      balance: null,
      email: 'a@example.com',
      isAdmin: false,
    });
    assert.equal(walletResponses.length, 2);
    await act(async () => { walletResponses[1].resolve(response(false, { error: 'unavailable' })); });
    await waitFor(() => !latest().walletLoading);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: false,
      balance: null,
      email: 'a@example.com',
      isAdmin: false,
    });
    await act(async () => { adminResponses[1].resolve(response(true, { ok: true })); });
    await waitFor(() => latest().isAdmin);

    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('wallet:invalidate')); });
    await waitFor(() => walletResponses.length === 3 && adminResponses.length === 3);
    assert.equal(walletResponses.length, 3);
    assert.equal(latest().walletLoading, true);

    currentSession = {
      access_token: 'token-b',
      user: { id: 'user-b', email: 'b@example.com' },
    };
    await act(async () => { await authListener?.('SIGNED_IN', currentSession); });
    await waitFor(() => walletResponses.length === 4 && adminResponses.length === 4);
    assert.equal(walletResponses.length, 4);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: true,
      balance: null,
      email: 'b@example.com',
      isAdmin: false,
    });

    await act(async () => { walletResponses[2].resolve(response(true, { balance: 88, currency: 'USD' })); });
    await flush();
    await act(async () => { adminResponses[2].resolve(response(true, { ok: true })); });
    await flush();
    assert.equal(latest().balance, null, 'a superseded account response must not overwrite the current account');
    assert.equal(latest().walletLoading, true);
    assert.equal(latest().isAdmin, false, 'a superseded access response must not restore the previous account privileges');

    await act(async () => { walletResponses[3].resolve(response(true, { balance: 7, currency: 'USD' })); });
    await waitFor(() => latest().balance === 7 && !latest().walletLoading);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: false,
      balance: 7,
      email: 'b@example.com',
      isAdmin: false,
    });
    await act(async () => { adminResponses[3].resolve(response(true, { ok: false })); });

    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('wallet:invalidate')); });
    await waitFor(() => walletResponses.length === 5 && adminResponses.length === 5);
    assert.equal(walletResponses.length, 5);
    assert.equal(latest().balance, 7, 'a usable balance remains visible while it refreshes');
    await act(async () => { await authListener?.('SIGNED_OUT', null); });
    await waitFor(() => latest().email === null && !latest().walletLoading);
    assert.deepEqual(latest(), {
      authResolved: true,
      walletLoading: false,
      balance: null,
      email: null,
      isAdmin: false,
    });
    await act(async () => {
      walletResponses[4].resolve(response(true, { balance: 99, currency: 'USD' }));
      adminResponses[4].resolve(response(true, { ok: true }));
    });
    await flush();
    assert.equal(latest().balance, null, 'a late response must not restore a signed-out account balance');
    assert.equal(latest().isAdmin, false, 'a late response must not restore signed-out account privileges');
    assert.equal(dom.window.sessionStorage.getItem('last-known:wallet'), null);

    currentSession = {
      access_token: 'token-b',
      user: { id: 'user-b', email: 'b@example.com' },
    };
    const delayedSession = deferred<{ data: { session: Session } }>();
    nextSessionResponse = delayedSession;
    const sessionCallsBeforeInvalidate = getSessionCount;
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('wallet:invalidate')); });
    await waitFor(() => getSessionCount === sessionCallsBeforeInvalidate + 1);
    await act(async () => { root.unmount(); });
    rootMounted = false;
    delayedSession.resolve({ data: { session: currentSession } });
    await flush();
    assert.equal(walletResponses.length, 5, 'an invalidate awaiting session state must not launch requests after unmount');
    assert.ok(unsubscribeCount >= 2, 'every mounted auth subscription must be released');
    assert.equal(fetchCalls.filter((url) => url === '/api/wallet').length, 5);
    assert.equal(fetchCalls.filter((url) => url === '/api/admin/access').length, 5);
  } finally {
    if (rootMounted) {
      await act(async () => { root.unmount(); });
    }
    auth.getSession = originalGetSession;
    auth.onAuthStateChange = originalOnAuthStateChange;
    supabaseModule.supabase.auth.stopAutoRefresh();
    (supabaseModule.supabase.auth as unknown as { broadcastChannel?: { close: () => void } }).broadcastChannel?.close();
    dom.window.close();
    if (savedEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.url;
    if (savedEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedEnv.key;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
