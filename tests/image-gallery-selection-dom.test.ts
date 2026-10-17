import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useImageGallerySelection } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageGallerySelection';
import type { HistoryEntry } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-types';
import type { GroupSummary } from '../frontend/types/groups';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const entries = ['A', 'B'].map(id => ({ id, jobId: id, engineId: id, engineLabel: id, mode: 't2i',
  prompt: `${id} defaults`, createdAt: 0, images: [{ url: `https://media.example/${id}.png` }] })) as HistoryEntry[];
const group = (id: string) => ({ id, hero: { jobId: id }, previews: [] }) as unknown as GroupSummary;
const snapshot = (id: string) => ({ prompt: `${id} snapshot`, engineId: id, resolution: `${id} resolution`, references: [id] });
const response = (id: string) => ({ ok: true, json: async () => ({ ok: true, settingsSnapshot: snapshot(id) }) }) as Response;

async function fixture() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/image' });
  const requests: Array<ReturnType<typeof deferred<Response>> & { signal?: AbortSignal | null }> = [];
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (_url: unknown, init?: RequestInit) => {
      // Deliberately ignore abort: correctness must also survive a response already being parsed.
      const request = { ...deferred<Response>(), signal: init?.signal };
      requests.push(request);
      return request.promise;
    } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const initial = { prompt: '', engineId: '', mode: 't2i', aspectRatio: null, resolution: '', references: [] as string[], preview: null as string | null };
  let observed = initial;
  const applied: unknown[] = [];
  let select!: (value: GroupSummary) => void;
  let edit!: (key: keyof typeof initial, value: unknown) => string;
  function Fixture({ accountId }: { accountId: string | null }) {
    const [state, setState] = useState(initial);
    const setters = useMemo(() => Object.fromEntries(Object.keys(initial).map(key => [key,
      (value: unknown) => setState(current => ({ ...current, [key]: value })),
    ])), []);
    const selection = useImageGallerySelection({ accountId, engines: [], historyEntries: entries,
      applyImageSettingsSnapshot: value => { applied.push(value); setState(current => ({ ...current, ...value as object })); },
      setPrompt: setters.prompt, setEngineId: setters.engineId, setMode: setters.mode,
      setAspectRatio: setters.aspectRatio, setSelectedPreviewEntryId: setters.preview,
      setSelectedPreviewImageIndex: () => {}, setLocalHistory: () => {},
    });
    select = selection.handleSelectGalleryGroup;
    assert.equal(selection.guardComposerActions({ disabledNavigation: undefined }).disabledNavigation, undefined);
    edit = selection.guardComposerActions({ edit: (key: keyof typeof initial, value: unknown) => {
      setters[key](value);
      return 'edited';
    } }).edit;
    observed = state;
    return React.createElement('output', null, state.prompt);
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mounted = true;
  const render = async (accountId: string | null = 'account-A') => { await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture, { accountId })))); };
  const unmount = async () => { if (mounted) { await act(async () => root.unmount()); mounted = false; } };
  await render();
  return { requests, applied, render, unmount, state: () => observed,
    select: async (id: string) => { await act(async () => select(group(id))); },
    edit: async (key: keyof typeof initial, value: unknown) => { await act(async () => assert.equal(edit(key, value), 'edited')); },
    reply: async (index: number, value: Response) => { await act(async () => requests[index].resolve(value)); },
    close: async () => { await unmount(); dom.window.close(); for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    } },
  };
}

test('gallery snapshot hydration respects the latest selection, account and composer intent', async t => {
  await t.test('B keeps its complete settings when A finishes parsing after B', async () => {
    const f = await fixture();
    try {
      await f.select('A');
      const body = deferred<unknown>();
      await f.reply(0, { ok: true, json: () => body.promise } as Response);
      await f.select('B');
      await f.reply(1, response('B'));
      await act(async () => body.resolve({ ok: true, settingsSnapshot: snapshot('A') }));
      assert.equal(f.state().preview, 'B');
      assert.equal(f.state().prompt, 'B snapshot');
      assert.equal(f.state().resolution, 'B resolution');
      assert.deepEqual(f.state().references, ['B']);
      assert.equal(f.requests[0].signal?.aborted, true);
      assert.equal(f.applied.length, 1);
    } finally { await f.close(); }
  });
  await t.test('reselecting the same job gives the latest request its own identity', async () => {
    const f = await fixture();
    try {
      await f.select('A'); await f.select('A');
      await f.reply(1, response('new')); await f.reply(0, response('old'));
      assert.equal(f.state().prompt, 'new snapshot');
      assert.equal(f.applied.length, 1);
    } finally { await f.close(); }
  });
  for (const [key, value] of Object.entries({ prompt: 'manual prompt', engineId: 'manual engine', mode: 'i2i', resolution: '4k', references: ['manual reference'] })) {
    await t.test(`manual ${key} changes cancel pending hydration without blocking future selections`, async () => {
      const f = await fixture();
      try {
        await f.select('A'); await f.edit(key as Parameters<typeof f.edit>[0], value);
        await f.reply(0, response('A'));
        assert.deepEqual(f.state()[key as keyof ReturnType<typeof f.state>], value);
        assert.equal(f.applied.length, 0);
        assert.equal(f.requests[0].signal?.aborted, true);
        await f.select('B'); await f.reply(1, response('B'));
        assert.equal(f.state().prompt, 'B snapshot', 'selection defaults must not cancel their own hydration');
      } finally { await f.close(); }
    });
  }
  await t.test('account replacement and returning to the same account cannot resurrect an old response', async () => {
    const f = await fixture();
    try {
      await f.select('A'); await f.render('account-B'); await f.render('account-A');
      await f.reply(0, response('old account'));
      assert.equal(f.applied.length, 0);
      assert.equal(f.requests[0].signal?.aborted, true);
      await f.select('B'); await f.reply(1, response('B'));
      assert.equal(f.state().prompt, 'B snapshot');
    } finally { await f.close(); }
  });
  await t.test('unmount cancels the request and never applies its late response', async () => {
    const f = await fixture();
    try {
      await f.select('A'); await f.unmount(); await f.reply(0, response('A'));
      assert.equal(f.applied.length, 0);
      assert.equal(f.requests[0].signal?.aborted, true);
    } finally { await f.close(); }
  });
  await t.test('failed and missing snapshots preserve selection defaults; a later valid snapshot still applies', async () => {
    const f = await fixture();
    try {
      await f.select('A');
      await act(async () => f.requests[0].reject(new Error('offline')));
      assert.equal(f.state().prompt, 'A defaults');
      await f.select('B'); await f.reply(1, { ok: true, json: async () => ({ ok: true }) } as Response);
      assert.equal(f.state().preview, 'B'); assert.equal(f.state().prompt, 'B defaults');
      await f.select('A'); await f.reply(2, response('A'));
      assert.equal(f.state().prompt, 'A snapshot');
    } finally { await f.close(); }
  });
});
