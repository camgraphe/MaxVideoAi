import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

test('curation stages drag order, previews before save, locks requests and preserves confirmed state', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/admin/playlists',
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{
    init?: RequestInit;
    resolve: (response: Response) => void;
  }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (_url: string, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ init, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent === name)!;
  const candidates = ['a', 'b', 'c'].map((id) => ({
    id,
    engineId: 'wan-3',
    engineLabel: 'Wan 3',
    prompt: id,
    videoUrl: '/v.mp4',
    thumbUrl: null,
    createdAt: '2026-09-22T00:00:00Z',
  }));
  const snapshot = {
    available: true,
    supported: true,
    slug: 'examples-wan-3',
    isPublic: true,
    revision: 'r1',
    config: null,
    legacyIds: ['a', 'b'],
  };
  try {
    const { PlacementEditor } = await import('../frontend/components/admin/playlists/PlacementEditor');
    await act(async () => root.render(React.createElement(PlacementEditor, { playlistId: 'p' })));
    await act(async () =>
      requests[0].resolve(
        Response.json({
          ok: true,
          snapshot,
          candidates,
          initialIds: ['a', 'b'],
        }),
      ),
    );
    assert.equal(
      button('Preview changes').disabled,
      false,
      'initial adoption can preview the existing order without edits',
    );
    const rows = dom.window.document.querySelectorAll('[data-curation-item]');
    for (const [type, target] of [
      ['dragstart', rows[1]],
      ['dragover', rows[0]],
      ['drop', rows[0]],
    ] as const) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'dataTransfer', {
        value: { setData() {}, effectAllowed: '' },
      });
      await act(async () => target.dispatchEvent(event));
    }
    const order = () =>
      [...dom.window.document.querySelectorAll('[data-curation-item]')].map((el) =>
        el.getAttribute('data-curation-item'),
      );
    assert.deepEqual(order(), ['b', 'a']);
    assert.equal(button('Save changes').disabled, true, 'saving requires an explicit preview');
    await act(async () => button('Cancel').click());
    assert.deepEqual(order(), ['a', 'b']);
    await act(async () =>
      (dom.window.document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click(),
    );
    await act(async () => button('Preview changes').click());
    assert.equal(button('Cancel').disabled, true);
    await act(async () =>
      requests[1].resolve(
        Response.json({
          ok: true,
          preview: {
            items: [candidates[1], candidates[0]],
            token: 't1',
            revision: 'r1',
          },
        }),
      ),
    );
    const preview = dom.window.document.querySelector('[aria-label="Page preview"]')!;
    const selected = dom.window.document.querySelector('[aria-label="Selected media"]')!;
    assert.ok(preview.compareDocumentPosition(selected) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.match(preview.textContent!, /Page preview · 2 videos/);
    assert.equal(dom.window.document.activeElement?.textContent, 'Page preview · 2 videos');
    assert.equal(button('Save changes').disabled, false, 'save is available beside the preview action');
    assert.equal(button('Preview changes').parentElement?.contains(button('Save changes')), true);
    await act(async () => button('Save changes').click());
    assert.equal(JSON.parse(String(requests[2].init?.body)).token, 't1');
    await act(async () =>
      requests[2].resolve(Response.json({ ok: false, error: 'This destination changed. Reload it.' }, { status: 409 })),
    );
    assert.match(dom.window.document.body.textContent!, /destination changed/);
    assert.deepEqual(order(), ['b', 'a'], 'failed save retains draft');
    assert.equal(button('Save changes').disabled, true, 'failed save invalidates preview');
    await act(async () => button('Preview changes').click());
    await act(async () =>
      requests[3].resolve(
        Response.json({
          ok: true,
          preview: {
            items: [candidates[1], candidates[0]],
            token: 't2',
            revision: 'r1',
          },
        }),
      ),
    );
    await act(async () => button('Save changes').click());
    await act(async () =>
      requests[4].resolve(
        Response.json({
          ok: true,
          snapshot: {
            ...snapshot,
            revision: 'r2',
            config: { mode: 'manual', orderedIds: ['b', 'a'], excludedIds: [] },
          },
        }),
      ),
    );
    assert.equal(button('Cancel').disabled, true);
    assert.equal(button('Save changes').disabled, true);
    assert.deepEqual(order(), ['b', 'a']);
    await act(async () =>
      root.render(
        React.createElement(PlacementEditor, {
          key: 'legacy',
          playlistId: 'legacy',
          fallback: React.createElement('button', null, 'Legacy ordering'),
        }),
      ),
    );
    await act(async () =>
      requests[5].resolve(
        Response.json({ ok: true, snapshot: { ...snapshot, supported: false }, candidates: [], initialIds: [] }),
      ),
    );
    assert.ok(button('Legacy ordering'), 'unsupported unconfigured destinations preserve their manual editor');
    await act(async () =>
      root.render(
        React.createElement(PlacementEditor, {
          key: 'retired',
          playlistId: 'retired',
          fallback: React.createElement('button', null, 'Legacy ordering'),
        }),
      ),
    );
    await act(async () =>
      requests[6].resolve(
        Response.json({
          ok: true,
          snapshot: { ...snapshot, supported: false, config: { mode: 'manual', orderedIds: [], excludedIds: [] } },
          candidates: [],
          initialIds: [],
        }),
      ),
    );
    assert.equal(
      button('Legacy ordering'),
      undefined,
      'managed retired destinations cannot use ineffective legacy mutations',
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
