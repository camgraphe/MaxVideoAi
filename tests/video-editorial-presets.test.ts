import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { getVideoEditorialPreset } from '../frontend/lib/video/editorial-presets';
import { cinematicVideoPromptLinks } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-workflow-proofs';
import { useVideoEditorialPreset } from '../frontend/app/(core)/(workspace)/app/_hooks/useVideoEditorialPreset';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';

const engine = 'seedance-2-5-flash';
test('video directions resolve to the right workflow without pretending to restore a rendered recipe', () => {
  const engines = getBaseEnginesByCategory('video');
  const options = { engines, engineMap: new Map(engines.map(e => [e.id, e])), createLocalId: () => 'fixture',
    createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [], video: null }) };
  for (const id of ['create', 'modify', 'extend', 'motion-control', 'the-blue-hour', 'where-gravity-ends']) {
    const preset = getVideoEditorialPreset(engine, id)!;
    assert.ok(preset.prompt);
    assert.equal(preset.mode, id === 'modify' ? 'v2v' : id === 'extend' ? 'extend' : 't2v');
    const resolved = resolveVideoSettingsSnapshot(preset.snapshot, options);
    assert.equal(resolved.prompt, preset.prompt);
    assert.equal(resolved.mode, preset.mode);
    assert.deepEqual(resolved.inputAssets, {});
    assert.equal('price' in preset.snapshot, false);
    const links = cinematicVideoPromptLinks(`/app?engine=${engine}&lang=fr&assistant=milo`, id, id === 'modify' || id === 'extend' ? id : 'create');
    const href = new URL(links.href, 'https://maxvideoai.com');
    assert.equal(href.searchParams.get('lang'), 'fr');
    assert.equal(href.searchParams.get('mode'), preset.mode);
    assert.equal(href.searchParams.has('prompt'), false);
    assert.equal(href.searchParams.has('assistant'), false);
    assert.equal(new URL(links.refineHref, href).searchParams.get('assistant'), 'milo');
  }
  assert.equal(getVideoEditorialPreset('unknown', 'modify'), null);
  assert.equal(getVideoEditorialPreset(engine, 'https://private.example/video.mp4'), null);
});

test('video prompt handoff waits for hydration and mode, applies once, and never overrides a job or login draft', async () => {
  const search = `engine=${engine}&mode=v2v&videoPrompt=modify&assistant=milo&refine=example`;
  const dom = new JSDOM('<div id="root"></div>', { url: `https://example.test/app?${search}` });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const applied: unknown[] = [], errors: string[] = [];
  const applySnapshot = (snapshot: unknown) => { applied.push(snapshot); return true; };
  const onError = (message: string) => { errors.push(message); };
  function Fixture({ ready, query = search, mode = 'v2v' }: { ready: boolean; query?: string; mode?: string }) {
    const pending = useVideoEditorialPreset({ searchString: query, ready, accountScope: 'public', engineId: engine, mode, applySnapshot, onError, locale: 'en' });
    return React.createElement('output', null, String(pending));
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (ready: boolean, query = search, mode = 'v2v') => {
    await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture, { ready, query, mode }))));
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
  };
  try {
    await render(false); assert.equal(applied.length, 0);
    for (const key of ['job', 'from', 'continueDraft', 'tool']) {
      await render(true, `${search}&${key}=existing`); assert.equal(applied.length, 0);
    }
    await render(true, search, 't2v'); assert.equal(applied.length, 0);
    await render(true); assert.equal(applied.length, 1);
    assert.deepEqual(applied[0], getVideoEditorialPreset(engine, 'modify')!.snapshot);
    assert.equal(new URL(dom.window.location.href).searchParams.has('videoPrompt'), false);
    assert.equal(new URL(dom.window.location.href).searchParams.get('assistant'), 'milo');
    assert.equal(dom.window.document.querySelector('output')!.textContent, 'false');
    await render(true); assert.equal(applied.length, 1);
    await render(true, search.replace('videoPrompt=modify', 'videoPrompt=unknown'));
    assert.equal(applied.length, 1);
    assert.equal(dom.window.document.querySelector('output')!.textContent, 'false');
    assert.deepEqual(errors, []);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('reviewed gallery recipes restore exact framing and keep private supplier data out of Create', async () => {
  const { default: recipes } = await import('../frontend/config/model-cinematic-gallery-presets.json');
  const { buildCinematicGalleryItems } = await import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-gallery');
  assert.deepEqual(buildCinematicGalleryItems([], engine), [], 'An empty curated gallery cannot inject reviewed presets');
  const engines = getBaseEnginesByCategory('video');
  const options = { engines, engineMap: new Map(engines.map(e => [e.id, e])), createLocalId: () => 'fixture',
    createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [], video: null }) };
  for (const recipe of recipes) {
    const preset = getVideoEditorialPreset(engine, recipe.id)!;
    const resolved = resolveVideoSettingsSnapshot(preset.snapshot, options);
    assert.equal(resolved.prompt, recipe.prompt);
    assert.equal(resolved.mode, 't2v');
    assert.equal(preset.snapshot.core?.aspectRatio, recipe.aspectRatio);
    assert.equal(preset.snapshot.core?.durationSec, 8);
    assert.equal(preset.snapshot.core?.resolution, '720p');
    assert.deepEqual(resolved.inputAssets, {});
    assert.doesNotMatch(JSON.stringify(preset), /accountId|providerTaskId|assetId|supplierListCost|reservedList/);
    assert.equal(getVideoEditorialPreset('seedance-2-0', recipe.id), null);
    const item = { id: 'a-published-or-local-id', href: '/video/example', posterUrl: '/poster.webp', alt: 'Cinema', title: 'Derived title',
      category: 'portrait', prompt: recipe.prompt, audioBadgeLabel: null, durationLabel: '8s', aspectRatio: recipe.aspectRatio,
      recreateHref: `/app?engine=${engine}&from=existing&lang=fr`, recreateLabel: 'Use', tags: [] };
    const [projected] = buildCinematicGalleryItems([item], engine);
    assert.equal(projected.title, recipe.title);
    assert.equal(projected.id, item.id);
    assert.equal(projected.href, item.href);
    const reuse = new URL(projected.creation!.href, 'https://example.test');
    assert.equal(reuse.searchParams.get('videoPrompt'), recipe.id);
    assert.equal(reuse.searchParams.has('from'), false, 'Explicit T2V prompt handoff must not conflict with a job hydration');
    assert.equal(reuse.searchParams.get('lang'), 'fr');
    for (const locale of ['en', 'fr', 'es'] as const) {
      const [localized] = buildCinematicGalleryItems([{ ...item, recreateHref: `/app?engine=${engine}&from=existing` }], engine, locale);
      for (const href of [localized.creation!.href, localized.creation!.refineHref]) {
        assert.equal(new URL(href, 'https://example.test').searchParams.get('lang'), locale);
      }
    }
  }
});
