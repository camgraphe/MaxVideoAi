import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import { AudioWorkspacePreview, type AudioWorkspacePreviewProps } from '../frontend/app/(core)/(workspace)/app/audio/_components/audio-workspace-preview';
import { DEFAULT_AUDIO_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/audio/copy';
import { listFalEngines } from '../frontend/src/config/falEngines';
import type { ComposerProps } from '../frontend/components/composer/composer-types';

async function mount(element: React.ReactNode) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  const render = async (child: React.ReactNode) => {
    await act(async () => root.render(React.createElement(I18nProvider, { locale: 'es', dictionary: {} as Dictionary, fallback: {} as Dictionary, children: child })));
  };
  await render(element);
  return { container, dom, render, async cleanup() {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  } };
}

test('audio keeps its actual preview node through empty, pending, running, result and failed states', async () => {
  const copy = DEFAULT_AUDIO_WORKSPACE_COPY;
  const props: AudioWorkspacePreviewProps = { copy };
  const fixture = await mount(React.createElement(AudioWorkspacePreview, props));
  const section = fixture.container.querySelector('section')!;
  const show = async (patch: Partial<AudioWorkspacePreviewProps>) => {
    await fixture.render(React.createElement(AudioWorkspacePreview, { ...props, ...patch }));
    assert.equal(fixture.container.querySelector('section'), section);
  };
  const job = { jobId: 'local-audio', status: 'pending' as const, progress: 50, message: 'IN_PROGRESS', audioUrl: null, videoUrl: null, thumbUrl: null, outputKind: 'audio' as const };
  try {
    assert.equal(section.dataset.audioPreviewState, 'empty');
    assert.match(section.textContent!, /Tu audio aparecerá aquí/);
    await show({ awaitingJob: true });
    assert.equal(section.dataset.audioPreviewState, 'pending');
    await show({ activeJob: job });
    assert.equal(section.dataset.audioPreviewState, 'pending');
    assert.doesNotMatch(section.textContent!, /50|IN_PROGRESS/);
    assert.equal(section.querySelector('audio,video'), null);
    await show({ activeJob: { ...job, status: 'running' } });
    assert.equal(section.dataset.audioPreviewState, 'running');
    await show({ activeJob: { ...job, status: 'completed', audioUrl: '/local-output.wav' } });
    assert.equal(section.dataset.audioPreviewState, 'completed');
    assert.equal(section.querySelector('audio')?.getAttribute('src'), '/local-output.wav');
    assert.equal(section.querySelector('audio')?.getAttribute('preload'), 'none');
    assert.equal(section.querySelector('audio')?.hasAttribute('autoplay'), false);
    await show({ activeJob: { ...job, status: 'failed' } });
    assert.equal(section.dataset.audioPreviewState, 'failed');
    assert.ok(section.querySelector('[role="alert"]'));
    await show({ activeJob: { ...job, status: 'failed' }, awaitingJob: true });
    assert.equal(section.dataset.audioPreviewState, 'pending');
  } finally { await fixture.cleanup(); }
});

test('real Composer renders Spanish statuses and associates both single and multi-prompt labels', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  let Composer;
  try { ({ Composer } = await import('../frontend/components/Composer')); } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const props: ComposerProps = { engine, density: 'workspace', prompt: '', onPromptChange() {}, price: null, currency: 'USD', isLoading: false, isPricing: true, promptRequired: true, assetFields: [{ field: { id: 'references', type: 'image', label: 'Refs', maxCount: 50 }, required: false }], assets: {}, onGenerate() {} };
  const fixture = await mount(React.createElement(Composer, props));
  try {
    assert.match(fixture.container.textContent!, /Calculando…/);
    assert.match(fixture.container.textContent!, /Imágenes/);
    const label = fixture.container.querySelector('label')!;
    assert.equal(label.control?.tagName, 'TEXTAREA');
    await fixture.render(React.createElement(Composer, { ...props, isPricing: false, multiPrompt: { enabled: true, scenes: [{ id: 'scene-1', prompt: '', duration: 5 }], totalDurationSec: 5, minDurationSec: 1, maxDurationSec: 15, onToggle() {}, onAddScene() {}, onRemoveScene() {}, onUpdateScene() {} } }));
    assert.match(fixture.container.textContent!, /Precio no disponible/);
    const group = fixture.container.querySelector('[role="group"][aria-labelledby]')!;
    const heading = fixture.dom.window.document.getElementById(group.getAttribute('aria-labelledby')!);
    assert.equal(heading?.tagName, 'H2');
    assert.equal(heading?.textContent, 'Prompt');
    assert.equal(fixture.container.querySelector('label[for]'), null);
    assert.equal(group.querySelector('textarea')?.getAttribute('aria-label'), 'Scene 1 prompt');
    const manage = fixture.container.querySelector<HTMLButtonElement>('.app-reference-heading button')!;
    await act(async () => manage.click());
    assert.equal(manage.getAttribute('aria-expanded'), 'true');
    const upload = fixture.container.querySelector<HTMLButtonElement>('.app-reference-add-target')!;
    upload.focus();
    await act(async () => upload.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(manage.getAttribute('aria-expanded'), 'false');
    assert.equal(fixture.dom.window.document.activeElement, manage);
  } finally { await fixture.cleanup(); }
});

test('rendered sparse references retain upload/library/remove indices and native media does not select a file', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  let Composer;
  try { ({ Composer } = await import('../frontend/components/Composer')); } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const slots: ComposerProps['assets'][string] = Array(50).fill(null);
  slots[49] = { kind: 'video', name: 'Local reference', type: 'video/mp4', size: 1, previewUrl: '/local-reference.mp4' };
  const removed: Array<[string, number]> = [];
  const library: Array<[string, number]> = [];
  const props: ComposerProps = { engine, density: 'workspace', prompt: '', onPromptChange() {}, price: null, currency: 'USD', isLoading: false, promptRequired: true, assetFields: [{ field: { id: 'refs', type: 'video', label: 'Refs', maxCount: 50 }, required: false }], assets: { refs: slots }, onAssetRemove: (field, index) => removed.push([field.id, index]), onOpenLibrary: (field, index) => library.push([field.id, index]) };
  const fixture = await mount(React.createElement(Composer, props));
  try {
    let fileSelections = 0;
    fixture.container.querySelectorAll('input[type="file"]').forEach(input => input.addEventListener('click', (event) => { event.preventDefault(); fileSelections += 1; }));
    const filled = fixture.container.querySelector<HTMLElement>('[data-asset-index="49"]')!;
    await act(async () => filled.querySelector('video')!.click());
    assert.equal(fileSelections, 0);
    const remove = filled.querySelector<HTMLButtonElement>('button[aria-label^="Quitar"]')!;
    await act(async () => remove.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(fileSelections, 0, 'keyboard event cannot bubble into an upload container');
    await act(async () => remove.click());
    assert.deepEqual(removed, [['refs', 49]]);
    await act(async () => filled.querySelector<HTMLButtonElement>('button[aria-label^="Biblioteca"]')!.click());
    assert.deepEqual(library, [['refs', 49]]);
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('[data-asset-index="0"] .app-reference-add-target')!.click());
    assert.equal(fileSelections, 1);
  } finally { await fixture.cleanup(); }
});
