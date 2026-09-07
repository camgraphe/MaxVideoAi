import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from '@supabase/supabase-js';
import type { AccountNameClient } from '../frontend/app/(core)/settings/_lib/account-preferences';
import { useAccountNameForm } from '../frontend/app/(core)/settings/_hooks/useAccountNameForm';

const messages = { required: 'Required', tooLong: 'Too long', generic: 'Failed', success: 'Saved' };
const makeUser = (id: string, name: string) => ({ id, email: `${id}@test.invalid`, user_metadata: { name, full_name: name } }) as unknown as User;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function mountForm(user: User, loadClient: () => Promise<AccountNameClient>) {
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
    state = useAccountNameForm(currentUser, loadClient);
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
  const gate = deferred<ReturnType<AccountNameClient['auth']['updateUser']> extends Promise<infer T> ? T : never>();
  let updates = 0;
  const user = makeUser('user-a', 'Old');
  const client: AccountNameClient = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async () => { updates += 1; return gate.promise; },
  } };
  const form = await mountForm(user, async () => client);
  try {
    await form.changeName('New');
    let first!: Promise<void>;
    await act(async () => { first = form.state.save(messages); void form.state.save(messages); });
    assert.equal(updates, 1);
    assert.equal(form.state.busy, true);
    assert.equal(form.state.status, null);
    gate.resolve({ data: { user: makeUser('user-a', 'New') }, error: null });
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
  const client: AccountNameClient = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async () => { updates += 1; return { data: { user }, error: null }; },
  } };
  const form = await mountForm(user, () => loader.promise);
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
  const client: AccountNameClient = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async () => ({ data: { user: null }, error: { message: 'Provider denied update' } }),
  } };
  const form = await mountForm(user, async () => client);
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
  const client: AccountNameClient = { auth: {
    getUser: async () => ({ data: { user: userB }, error: null }),
    updateUser: async () => { updates += 1; return { data: { user: userB }, error: null }; },
  } };
  const form = await mountForm(userA, () => loader.promise);
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
