import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useImageComposerPersistence } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
import { useImageSettingsFields } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageSettingsFields';
import { DEFAULT_COPY } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import { listFalEngines } from '../frontend/src/config/falEngines';

test('a saved image model restores its settings after the initial model normalizes unsupported fields', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/image' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const baseCaps = listFalEngines().find(entry => entry.category === 'image')!.engine;
  const fields = [
    { id: 'quality', type: 'select', values: ['low', 'high'], default: 'low' },
    { id: 'seed', type: 'number' }, { id: 'enable_web_search', type: 'boolean', default: false },
    { id: 'watermark', type: 'boolean', default: false }, { id: 'resolution', type: 'select', values: ['custom'], default: 'custom' },
    { id: 'image_width', type: 'number', default: 1024 }, { id: 'image_height', type: 'number', default: 1024 },
  ];
  const engines = ['first', 'saved'].map((id, index) => ({ id, name: id, modes: ['t2i'], aliases: [], prompts: [], pricePerImage: 0.1, currency: 'USD',
    engineCaps: { ...baseCaps, id, modes: ['t2i'], inputSchema: { required: [], optional: index ? fields : [] } } }));
  dom.window.localStorage.setItem('maxvideoai.image.composer.v1:guest', JSON.stringify({ version: 5, engineId: 'saved', mode: 't2i',
    prompt: 'My saved prompt', numImages: 1, quality: 'high', seed: 42, enableWebSearch: true, watermark: true,
    resolution: 'custom', customImageSize: { width: 1536, height: 512 }, referenceSlots: [] }));
  const initial = { engineId: 'first', mode: 't2i', prompt: '', numImages: 1, aspectRatio: null, background: null, resolution: null,
    customImageWidth: '', customImageHeight: '', seed: '', outputFormat: null, quality: null, style: null, maskUrl: '',
    enableWebSearch: false, thinkingLevel: null, limitGenerations: false, watermark: false, referenceSlots: [] };
  let observed: typeof initial;
  function Fixture() {
    const [state, setState] = React.useState(initial);
    const setters = React.useMemo(() => Object.fromEntries(Object.keys(initial).map(key => [
      `set${key[0].toUpperCase()}${key.slice(1)}`,
      (value: unknown) => setState(current => ({ ...current, [key]: typeof value === 'function' ? value(current[key as keyof typeof initial]) : value })),
    ])), []);
    const args = { ...state, ...setters, accountId: null, engines, persistableReferenceSlots: [] };
    useImageSettingsFields({ ...args, selectedEngineCaps: engines.find(engine => engine.id === state.engineId)!.engineCaps,
      resolvedCopy: DEFAULT_COPY } as Parameters<typeof useImageSettingsFields>[0]);
    useImageComposerPersistence(args as unknown as Parameters<typeof useImageComposerPersistence>[0]);
    observed = state;
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await React.act(async () => root.render(React.createElement(Fixture)));
    assert.deepEqual({ engineId: observed!.engineId, prompt: observed!.prompt, quality: observed!.quality, seed: observed!.seed,
      webSearch: observed!.enableWebSearch, watermark: observed!.watermark, width: observed!.customImageWidth, height: observed!.customImageHeight },
    { engineId: 'saved', prompt: 'My saved prompt', quality: 'high', seed: '42', webSearch: true, watermark: true, width: '1536', height: '512' });
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
