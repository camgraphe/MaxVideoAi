import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useGalleryPreviewBudget } from '../frontend/components/examples/useGalleryPreviewBudget';

type PreviewBudget = ReturnType<typeof useGalleryPreviewBudget>;

async function previewFixture(desktop: boolean) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  dom.window.matchMedia = ((query: string) => ({
    matches: query === '(min-width: 768px)' && desktop,
    addEventListener() {}, removeEventListener() {},
  })) as typeof window.matchMedia;
  const replacements = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let budget: PreviewBudget;
  function Probe() {
    budget = useGalleryPreviewBudget(['lead', 'portrait', 'side']);
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Probe)));
  await act(async () => {
    for (const id of ['lead', 'portrait', 'side']) budget.onVisibility(id, true);
  });
  return {
    dom, get: () => budget,
    async cleanup() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('mobile gallery keeps videos idle until a scroll gesture, then animates one visible card', async () => {
  const fixture = await previewFixture(false);
  try {
    assert.deepEqual([...fixture.get().active], []);
    assert.equal(fixture.get().paused, true);
    await act(async () => fixture.dom.window.dispatchEvent(new fixture.dom.window.Event('touchmove')));
    assert.deepEqual([...fixture.get().active], ['lead']);
    assert.equal(fixture.get().paused, false);
    await act(async () => fixture.get().togglePaused());
    assert.deepEqual([...fixture.get().active], []);
    await act(async () => fixture.get().togglePaused());
    assert.deepEqual([...fixture.get().active], ['lead']);
  } finally { await fixture.cleanup(); }
});

test('mobile animate control starts one preview without scrolling; desktop keeps three previews', async () => {
  const mobile = await previewFixture(false);
  try {
    await act(async () => mobile.get().togglePaused());
    assert.deepEqual([...mobile.get().active], ['lead']);
  } finally { await mobile.cleanup(); }
  const desktop = await previewFixture(true);
  try {
    assert.deepEqual([...desktop.get().active], ['lead', 'portrait', 'side']);
    assert.equal(desktop.get().paused, false);
  } finally { await desktop.cleanup(); }
});
