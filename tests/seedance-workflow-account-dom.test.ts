import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSeedanceWorkflowAccount } from '../frontend/hooks/useSeedanceWorkflowAccount';

test('a late session read cannot restore a logged-out workflow account', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const oldMode = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  let onAuth: (event: string, session: any) => void = () => {}, resolveRead: (value: any) => void = () => {};
  let account: ReturnType<typeof useSeedanceWorkflowAccount>, unsubscribed = false;
  const auth = { onAuthStateChange: (callback: typeof onAuth) => { onAuth = callback; return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } }; }, getSession: () => new Promise<any>(resolve => { resolveRead = resolve; }) };
  const load = async () => ({ auth });
  function Fixture() { account = useSeedanceWorkflowAccount(load); return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => onAuth('SIGNED_OUT', null));
    await act(async () => resolveRead({ data: { session: { user: { id: 'old-owner' }, access_token: 'old-token' } } }));
    assert.equal(account!, null);
    await act(async () => onAuth('SIGNED_IN', { user: { id: 'new-owner' }, access_token: 'new-token' }));
    assert.deepEqual(account!, { userId: 'new-owner', token: 'new-token' });
    await act(async () => root.unmount()); assert.equal(unsubscribed, true);
  } finally { if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode; dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
});
