import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useImageReferenceSlots } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlots';
import { DEFAULT_COPY } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy';

test('image handoff uses actual library insertion, validates formats and exact replacement without changing other slots', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  let slots!: ReturnType<typeof useImageReferenceSlots>;
  function Fixture() {
    slots = useImageReferenceSlots({ autoModeFromReferences: true, mode: 'i2i', resolvedCopy: DEFAULT_COPY, setError: () => {}, supportedReferenceFormats: ['png'], supportedReferenceFormatsLabel: 'PNG', toolsEnabled: false });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const first = { id: 'first', url: 'https://media.example/original.png?signature=first', mime: 'image/png', width: 1024, height: 768 };
  const second = { ...first, id: 'second', url: 'https://media.example/second.png?signature=second' };
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.deepEqual(slots.readyReferenceUrls, []);
    await act(async () => { assert.equal(slots.handleLibrarySelect(first, 0), true); });
    await act(async () => { assert.equal(slots.handleLibrarySelect(second, 2), true); });
    assert.equal(slots.displayedReferenceSlots[0]?.url, first.url);
    assert.equal(slots.displayedReferenceSlots[1], null);
    assert.equal(slots.displayedReferenceSlots[2]?.url, second.url);
    await act(async () => { assert.equal(slots.handleLibrarySelect({ ...first, id: 'replacement', url: 'https://media.example/replacement.png' }, 2), true); });
    assert.equal(slots.displayedReferenceSlots[0]?.url, first.url);
    assert.equal(slots.displayedReferenceSlots[2]?.url, 'https://media.example/replacement.png');
    await act(async () => { assert.equal(slots.handleLibrarySelect(first, 99), false); slots.handleLibrarySelect({ ...second, mime: 'image/jpeg', url: 'https://media.example/unsupported.jpg' }, 0); });
    assert.equal(slots.displayedReferenceSlots[0]?.url, first.url);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
