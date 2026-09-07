import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from '@supabase/supabase-js';
import { type AccountNameClient, updateAccountNameWithToken } from '../frontend/app/(core)/settings/_lib/account-preferences';
import { useAccountNameForm } from '../frontend/app/(core)/settings/_hooks/useAccountNameForm';

const messages = { required: 'Required', tooLong: 'Too long', generic: 'Failed', success: 'Saved' };
const makeUser = (id: string, name: string) => ({ id, email: `${id}@test.invalid`, user_metadata: { name, full_name: name } }) as unknown as User;
const makeClient = (user: User, accessToken = `token-${user.id}`): AccountNameClient => ({ auth: {
  getSession: async () => ({ data: { session: { access_token: accessToken, user } }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
} });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function mountForm(user: User, loadClient: () => Promise<AccountNameClient>, updateName: typeof updateAccountNameWithToken) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/settings' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let currentUser = user;
  let state!: ReturnType<typeof useAccountNameForm>;
  function Fixture() {
    state = useAccountNameForm(currentUser, { loadClient, updateName });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  return {
    get state() { return state; },
    async changeName(name: string) { await act(async () => state.setName(name)); },
    async changeUser(next: User) { currentUser = next; await act(async () => root.render(React.createElement(Fixture))); },
    async dispose() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('pending save blocks a double submission and reports success only after completion', async () => {
  const gate = deferred<User>();
  let updates = 0;
  const user = makeUser('user-a', 'Old');
  const client = makeClient(user);
  const updateName: typeof updateAccountNameWithToken = async () => { updates += 1; return gate.promise; };
  const form = await mountForm(user, async () => client, updateName);
  try {
    await form.changeName('New');
    let first!: Promise<void>;
    await act(async () => { first = form.state.save(messages); void form.state.save(messages); });
    assert.equal(updates, 1);
    assert.equal(form.state.busy, true);
    assert.equal(form.state.status, null);
    gate.resolve(makeUser('user-a', 'New'));
    await act(async () => first);
    assert.equal(form.state.busy, false);
    assert.deepEqual(form.state.status, { kind: 'success', message: 'Saved' });
    assert.equal(form.state.dirty, false);
  } finally { await form.dispose(); }
});

test('cancel invalidates a pending save and restores the saved name', async () => {
  const loader = deferred<AccountNameClient>();
  let updates = 0;
  const user = makeUser('user-a', 'Old');
  const client = makeClient(user);
  const updateName: typeof updateAccountNameWithToken = async () => { updates += 1; return user; };
  const form = await mountForm(user, () => loader.promise, updateName);
  try {
    await form.changeName('New');
    let save!: Promise<void>;
    await act(async () => { save = form.state.save(messages); });
    await act(async () => form.state.cancel());
    loader.resolve(client);
    await act(async () => save);
    assert.equal(updates, 0);
    assert.equal(form.state.name, 'Old');
    assert.equal(form.state.busy, false);
    assert.equal(form.state.status, null);
  } finally { await form.dispose(); }
});

test('provider failure clears pending state and exposes the real error', async () => {
  const user = makeUser('user-a', 'Old');
  const client = makeClient(user);
  const updateName: typeof updateAccountNameWithToken = async () => { throw new Error('Provider denied update'); };
  const form = await mountForm(user, async () => client, updateName);
  try {
    await form.changeName('New');
    await act(async () => form.state.save(messages));
    assert.equal(form.state.busy, false);
    assert.deepEqual(form.state.status, { kind: 'error', message: 'Provider denied update' });
    assert.equal(form.state.dirty, true);
  } finally { await form.dispose(); }
});

test('account switch before client readiness prevents the stale write', async () => {
  const loader = deferred<AccountNameClient>();
  const userA = makeUser('user-a', 'Alice');
  const userB = makeUser('user-b', 'Bob');
  let updates = 0;
  const client = makeClient(userB);
  const updateName: typeof updateAccountNameWithToken = async () => { updates += 1; return userB; };
  const form = await mountForm(userA, () => loader.promise, updateName);
  try {
    await form.changeName('Alice edited');
    let save!: Promise<void>;
    await act(async () => { save = form.state.save(messages); });
    await form.changeUser(userB);
    loader.resolve(client);
    await act(async () => save);
    assert.equal(updates, 0);
    assert.equal(form.state.name, 'Bob');
    assert.equal(form.state.busy, false);
    assert.equal(form.state.status, null);
  } finally { await form.dispose(); }
});

test('session switch after token verification cannot retarget the bound mutation', async () => {
  const userA = makeUser('user-a', 'Alice');
  const userB = makeUser('user-b', 'Bob');
  let ambientUser = userA;
  const client: AccountNameClient = { auth: {
    getSession: async () => ({ data: { session: { access_token: 'token-a', user: userA } }, error: null }),
    getUser: async (token) => {
      assert.equal(token, 'token-a');
      ambientUser = userB;
      return { data: { user: userA }, error: null };
    },
  } };
  let boundRequest: { accessToken: string; expectedUserId: string } | null = null;
  const updateName: typeof updateAccountNameWithToken = async ({ accessToken, expectedUserId }) => {
    boundRequest = { accessToken, expectedUserId };
    return userA;
  };
  const form = await mountForm(userA, async () => client, updateName);
  try {
    await form.changeName('Alice edited');
    await act(async () => form.state.save(messages));
    assert.equal(ambientUser.id, 'user-b');
    assert.deepEqual(boundRequest, { accessToken: 'token-a', expectedUserId: 'user-a' });
    assert.deepEqual(form.state.status, { kind: 'success', message: 'Saved' });
  } finally { await form.dispose(); }
});
