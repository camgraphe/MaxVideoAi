import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useMediaHandoff } from '../frontend/components/library/useMediaHandoff';
import { stageMediaHandoff, type MediaDestination } from '../frontend/lib/media-handoff';

test('pending handoff follows exact navigation scope, survives StrictMode and cannot reopen after close or navigation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const asset = { id: 'selected-original', url: 'https://media.example/original.png', kind: 'image' as const };
  const renders: Array<{ scope: string; asset: string | null }> = [];
  let close!: () => void;
  function Fixture({ account, destination, token }: { account: string | null; destination: MediaDestination; token: string | null }) {
    const handoff = useMediaHandoff(account, destination);
    close = handoff.close;
    // Record render-time exposure too: an effect-only cleanup must not leak one stale frame.
    renders.push({ scope: JSON.stringify([account, destination, token]), asset: handoff.asset?.id ?? null });
    return React.createElement('output', {}, handoff.asset?.id ?? 'none');
  }
  const render = (account: string | null, destination: MediaDestination, token: string | null) => act(async () => {
    root.render(React.createElement(StrictMode, {}, React.createElement(SearchParamsContext.Provider, {
      value: new URLSearchParams(token ? { media: token } : {}),
    }, React.createElement(Fixture, { account, destination, token }))));
  });
  const selected = () => dom.window.document.querySelector('output')?.textContent;
  const stage = (token: string, destination: MediaDestination = 'video') => stageMediaHandoff(dom.window.sessionStorage, 'account-a', asset, destination, token);
  try {
    stage('first');
    await render('account-a', 'video', 'first');
    assert.equal(selected(), asset.id, 'StrictMode effect replay must keep the first successful consumption');
    await render('account-a', 'video', 'first');
    assert.equal(selected(), asset.id);
    const afterFirst = renders.length;
    await render('account-a', 'video', null);
    assert.ok(renders.slice(afterFirst).every(entry => entry.asset === null), 'token removal hides the original before effects');
    await render('account-a', 'video', 'first');
    assert.equal(selected(), 'none', 'returning to a consumed token cannot resurrect it');

    stage('second'); await render('account-a', 'video', 'second');
    assert.equal(selected(), asset.id);
    await render('account-a', 'video', 'invalid');
    assert.equal(selected(), 'none');
    await render('account-a', 'video', 'second');
    assert.equal(selected(), 'none');

    stage('third'); await render('account-a', 'video', 'third');
    await render('account-a', 'image', 'third');
    assert.equal(selected(), 'none');
    await render('account-a', 'video', 'third');
    assert.equal(selected(), 'none', 'destination round trip invalidates prior pending data');

    stage('fourth'); await render('account-a', 'video', 'fourth');
    await render('account-b', 'video', 'fourth');
    assert.equal(selected(), 'none');
    await render('account-a', 'video', 'fourth');
    assert.equal(selected(), 'none', 'account round trip cannot restore the prior confirmation');

    stage('fifth'); await render('account-a', 'video', 'fifth');
    await render(null, 'video', 'fifth');
    assert.equal(selected(), 'none');
    await render('account-a', 'video', 'fifth');
    assert.equal(selected(), 'none');

    stage('sixth'); await render('account-a', 'video', 'sixth');
    const previousClose = close;
    await act(async () => close());
    await render('account-a', 'video', 'sixth');
    assert.equal(selected(), 'none', 'closed request stays closed under an unchanged navigation');
    stage('seventh', 'image'); await render('account-a', 'image', 'seventh');
    assert.equal(selected(), asset.id);
    await act(async () => previousClose());
    assert.equal(selected(), asset.id, 'a late close from a previous request cannot close the new confirmation');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
