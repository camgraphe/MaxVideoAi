import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useImageWorkspaceQueryHydration } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceQueryHydration';
import { listBuildOnlyPrivateFalEngines } from '../scripts/lib/private-engine-catalog-projection';

test('image snapshot hydration restores the exact Nano21 token cap and rejects malformed caps before mutating', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/image' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const entry = listBuildOnlyPrivateFalEngines().find(row => row.id === 'nano-banana-2-1')!;
  const engines = [{ id: entry.id, name: 'Nano Banana 2.1', modes: ['t2i', 'i2i'], aliases: [], engineCaps: entry.engine }];
  const initial = { engineId: '', mode: 't2i', prompt: '', numImages: 1, aspectRatio: null, background: null, resolution: null,
    customImageWidth: '', customImageHeight: '', seed: '', outputFormat: null, quality: null, style: null, maskUrl: '',
    enableWebSearch: false, thinkingLevel: null, maxOutputTokens: null, limitGenerations: false, watermark: false, referenceSlots: [],
    selectedPreviewEntryId: null, selectedPreviewImageIndex: 0, error: null, statusMessage: null };
  let observed: Record<string, unknown> = initial;
  let apply: (snapshot: unknown) => void;
  function Fixture({ available = true }: { available?: boolean }) {
    const [state, setState] = React.useState(initial);
    const setters = React.useMemo(() => Object.fromEntries(Object.keys(initial).map(key => [
      `set${key[0].toUpperCase()}${key.slice(1)}`,
      (value: unknown) => setState(current => ({ ...current, [key]: typeof value === 'function' ? value(current[key as keyof typeof initial]) : value })),
    ])), []);
    const hydration = useImageWorkspaceQueryHydration({ ...setters, engines: available ? engines : [], searchParams: null, genericError: 'Failed' } as unknown as Parameters<typeof useImageWorkspaceQueryHydration>[0]);
    observed = state;
    apply = hydration.applyImageSettingsSnapshot;
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const snapshot = { schemaVersion: 1, surface: 'image', engineId: 'nano-banana-2-1', inputMode: 't2i', prompt: 'Exact English fixture prompt',
    core: { numImages: 1, resolution: '1k', aspectRatio: '16:9', thinkingLevel: 'medium', maxOutputTokens: 4096 }, refs: { imageUrls: [] } };
  try {
    await React.act(async () => root.render(React.createElement(Fixture)));
    await React.act(async () => apply!(snapshot));
    assert.deepEqual([observed.engineId, observed.prompt, observed.resolution, observed.aspectRatio, observed.thinkingLevel, observed.maxOutputTokens],
      ['nano-banana-2-1', 'Exact English fixture prompt', '1k', '16:9', 'medium', 4096]);
    const accepted = observed;
    for (const cap of [0, null, -1, 1.5, 32769, '4096']) {
      assert.throws(() => apply!({ ...snapshot, prompt: 'Must never apply', core: { ...snapshot.core, maxOutputTokens: cap } }), /maxOutputTokens/);
    }
    assert.equal(observed, accepted);
    await React.act(async () => apply!({ ...snapshot, core: { ...snapshot.core, maxOutputTokens: undefined } }));
    assert.equal(observed.maxOutputTokens, 32768, 'historical Nano21 snapshots keep the original default');
    await React.act(async () => root.render(React.createElement(Fixture, { available: false })));
    assert.throws(() => apply!(snapshot), /unavailable/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('query snapshots fence stale URL, account and later composer input, and unauthenticated responses never apply', async t => {
  for (const scenario of ['url', 'account', 'edit', 'unauthenticated', 'recipe-conflict']) await t.test(scenario, async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/image' });
    const requests: Array<{ resolve: (value: Response) => void; signal?: AbortSignal | null }> = [];
    const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
      fetch: (_url: unknown, init?: RequestInit) => new Promise<Response>(resolve => requests.push({ resolve, signal: init?.signal })) };
    const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const applied: string[] = [], errors: Array<string | null> = [];
    const noop = () => {};
    const setters = Object.fromEntries(['AspectRatio','Background','CustomImageHeight','CustomImageWidth','EnableWebSearch','EngineId',
      'LimitGenerations','MaskUrl','Mode','NumImages','OutputFormat','Quality','ReferenceSlots','Resolution','Seed','Style',
      'SelectedPreviewEntryId','SelectedPreviewImageIndex','StatusMessage','ThinkingLevel','MaxOutputTokens','Watermark'].map(name => [`set${name}`, noop]));
    const engine = listBuildOnlyPrivateFalEngines().find(row => row.id === 'nano-banana-2-1')!;
    const engines = [{ id: engine.id, modes: ['t2i'], engineCaps: engine.engine }];
    function Fixture({ query, accountId, signature }: { query: URLSearchParams; accountId: string; signature: string }) {
      useImageWorkspaceQueryHydration({ ...setters, setPrompt: value => applied.push(value as string), setError: value => errors.push(value as string | null),
        engines, searchParams: query, accountId, composerSignature: signature, genericError: 'Failed' } as unknown as Parameters<typeof useImageWorkspaceQueryHydration>[0]);
      return null;
    }
    const root = createRoot(dom.window.document.getElementById('root')!);
    const render = async (query = '?job=old', accountId = 'account-A', signature = 'initial') => {
      await React.act(async () => root.render(React.createElement(React.StrictMode, null,
        React.createElement(Fixture, { query: new URLSearchParams(query), accountId, signature }))));
    };
    try {
      if (scenario === 'recipe-conflict') {
        await render('?recipe=nano21-unknown&job=old');
        assert.equal(requests.length, 0); assert.deepEqual(applied, []); assert.match(errors.at(-1)!, /conflicts/);
      } else {
        await render();
        const pending = requests.at(-1)!;
        let resolveBody!: (value: unknown) => void;
        await React.act(async () => pending.resolve({ ok: scenario !== 'unauthenticated', status: scenario === 'unauthenticated' ? 401 : 200,
          json: () => new Promise(resolve => { resolveBody = resolve; }) } as Response));
        if (scenario === 'url') await render('?job=new');
        if (scenario === 'account') await render('?job=old', 'account-B');
        if (scenario === 'edit') await render('?job=old', 'account-A', 'human-edited');
        await React.act(async () => resolveBody(scenario === 'unauthenticated' ? { ok: false, error: 'Authentication required' } : {
          ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'image', engineId: engine.id, inputMode: 't2i', prompt: 'Stale prompt', core: { maxOutputTokens: 4096 } },
        }));
        assert.deepEqual(applied, []);
        if (scenario === 'unauthenticated') assert.match(errors.at(-1)!, /Authentication required/);
        if (scenario === 'url' || scenario === 'account') assert.equal(pending.signal?.aborted, true);
      }
    } finally {
      await React.act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    }
  });
});
