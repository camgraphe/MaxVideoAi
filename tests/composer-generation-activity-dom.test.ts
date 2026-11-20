import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { buildCompletedGroup, buildPendingGroup } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-history';
import type { ComposerProps } from '../frontend/components/composer/composer-types';
import { getWorkspaceReferenceUploadStatus } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields';
import type { GroupSummary } from '../frontend/types/groups';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };
const pending = [
  { id: 'one', engineLabel: 'Seedance 2.0', prompt: 'Laverie de nuit', durationSec: 15 },
  { id: 'two', engineLabel: 'Kling', prompt: 'Autre cadrage', durationSec: 5 },
];

async function mount(image = false, density: 'workspace' | 'default' = 'workspace') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { Composer } = await import('../frontend/components/Composer');
  const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider');
  const { useImageWorkspaceDisplayState } = await import('../frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceDisplayState');
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const root = createRoot(dom.window.document.getElementById('root')!);
  let state = { isLoading: false, isPricing: false, price: 14.04 as number | null, error: undefined as string | undefined, pendingGenerations: pending, groups: [] as GroupSummary[], assets: {} as ComposerProps['assets'], assetFields: [] as ComposerProps['assetFields'], referenceUploadStatus: undefined as ComposerProps['referenceUploadStatus'] };
  let submissions = 0;
  function Fixture() {
    const display = useImageWorkspaceDisplayState({ error: null, historyEntries: [], numImages: 4, pendingGroups: state.groups, pricingErrorMessage: null, pricingSnapshot: null, selectedEngine: undefined, selectedPreviewEntryId: null });
    return React.createElement(I18nProvider, { locale: 'fr', dictionary: {}, fallback: {}, children: React.createElement(Composer, {
      density, engine, prompt: 'A night scene', onPromptChange() {}, price: state.price, error: state.error, currency: 'USD', promptRequired: true, assetFields: state.assetFields, assets: state.assets,
      isLoading: state.isLoading, isPricing: state.isPricing, pendingGenerations: image ? display.pendingGenerations : state.pendingGenerations,
      generateLabel: 'Générer', referenceUploadStatus: state.referenceUploadStatus, onGenerate() { submissions += 1; },
    }) });
  }
  async function render(patch: Partial<typeof state> = {}) {
    state = { ...state, ...patch };
    await act(async () => root.render(React.createElement(Fixture)));
  }
  await render();
  const button = (label: string) => [...dom.window.document.querySelectorAll('button')].find(el => el.getAttribute('aria-label') === label || el.textContent?.includes(label)) as HTMLButtonElement | undefined;
  return {
    dom, render, button,
    get submissions() { return submissions; },
    async click(label: string) { const el = button(label); assert.ok(el, `Missing button: ${label}`); await act(async () => el.click()); },
    async dispose() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('an unavailable quote preserves the Generate action used to open guest sign-in', async () => {
  const fixture = await mount();
  try {
    await fixture.render({ price: null, error: 'Connectez-vous pour vérifier la vidéo.' });
    assert.equal(fixture.button('Générer')?.disabled, false);
    await fixture.click('Générer'); assert.equal(fixture.submissions, 1);
    await fixture.render({ price: 1.25, error: undefined });
    assert.equal(fixture.button('Générer')?.disabled, false);
  } finally { await fixture.dispose(); }
});

test('activity list opens independently of Generate and permits another submission after acceptance', async () => {
  const fixture = await mount();
  try {
    await fixture.click('Afficher les 2 générations en cours');
    assert.equal(fixture.submissions, 0);
    assert.match(fixture.dom.window.document.querySelector('[role="dialog"]')?.textContent ?? '', /Laverie de nuit/);
    assert.equal(fixture.button('Générer')?.disabled, false);
    await fixture.click('Générer');
    assert.equal(fixture.submissions, 1);
    await fixture.render({ isLoading: true });
    assert.equal(fixture.button('Envoi')?.disabled, true);
    assert.equal(fixture.button('Envoi')?.getAttribute('aria-busy'), 'true');
    await fixture.click('Envoi');
    assert.equal(fixture.submissions, 1);
    await fixture.render({ isLoading: false });
    await fixture.click('Générer');
    assert.equal(fixture.submissions, 2);
    assert.ok(fixture.button('Afficher les 2 générations en cours'));
  } finally { await fixture.dispose(); }
});

test('open activity updates as jobs finish and disappears when none remain', async () => {
  const fixture = await mount();
  try {
    await fixture.click('Afficher les 2 générations en cours');
    await fixture.render({ pendingGenerations: [pending[1]] });
    assert.ok(fixture.button('Afficher la génération en cours'));
    const dialog = fixture.dom.window.document.querySelector('[role="dialog"]')!;
    assert.doesNotMatch(dialog.textContent ?? '', /Laverie de nuit/);
    assert.match(dialog.textContent ?? '', /Autre cadrage/);
    await fixture.render({ pendingGenerations: [] });
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(fixture.dom.window.document.querySelector('.app-generation-count'), null);
    assert.equal(fixture.button('Générer')?.disabled, false);
  } finally { await fixture.dispose(); }
});

test('existing generations remain inspectable while a new request is being submitted', async () => {
  const fixture = await mount();
  try {
    await fixture.render({ isLoading: true });
    await fixture.click('Afficher les 2 générations en cours');
    assert.ok(fixture.dom.window.document.querySelector('[role="dialog"]'));
    assert.equal(fixture.button('Envoi')?.disabled, true);
    assert.equal(fixture.submissions, 0);
  } finally { await fixture.dispose(); }
});

test('Escape closes the activity list and restores focus to its trigger', async () => {
  const fixture = await mount();
  try {
    await fixture.click('Afficher les 2 générations en cours');
    await act(async () => fixture.dom.window.document.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(fixture.dom.window.document.activeElement, fixture.button('Afficher les 2 générations en cours'));
  } finally { await fixture.dispose(); }
});

test('pricing refresh does not masquerade as sending and keeps the quote unavailable', async () => {
  const fixture = await mount();
  try {
    await fixture.render({ isPricing: true });
    assert.equal(fixture.button('Générer')?.disabled, true);
    assert.equal(fixture.button('Envoi'), undefined);
    assert.doesNotMatch(fixture.button('Générer')?.textContent ?? '', /14.04/);
    assert.ok(fixture.button('Afficher les 2 générations en cours'));
  } finally { await fixture.dispose(); }
});

test('image completion clears the counter even while the same group remains in the gallery', async () => {
  const fixture = await mount(true);
  try {
    await fixture.render({ groups: [buildPendingGroup({ id: 'image-job', engineId: 'seedream', engineLabel: 'Seedream', prompt: 'Night scene', count: 4, createdAt: 1000 })] });
    await fixture.click('Afficher la génération en cours');
    assert.equal(fixture.dom.window.document.querySelectorAll('.app-generation-row').length, 1);
    await fixture.render({ groups: [buildCompletedGroup({ id: 'image-job', engineId: 'seedream', engineLabel: 'Seedream', prompt: 'Night scene', aspectRatio: '1:1', images: [{ url: '/one.webp' }, { url: '/two.webp' }], createdAt: 1000 })] });
    assert.equal(fixture.dom.window.document.querySelector('.app-generation-count'), null);
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(fixture.button('Générer')?.disabled, false);
  } finally { await fixture.dispose(); }
});

test('default composer retains its existing price and refresh presentation', async () => {
  const fixture = await mount(false, 'default');
  try {
    assert.match(fixture.button('Générer')?.textContent ?? '', /\$14.04/);
    assert.equal(fixture.dom.window.document.querySelector('.app-generation-quote'), null);
    await fixture.render({ isPricing: true });
    assert.equal(fixture.button('Générer')?.disabled, true);
    assert.doesNotMatch(fixture.button('Générer')?.textContent ?? '', /14.04/);
    assert.equal(fixture.dom.window.document.querySelector('.app-quote-status'), null);
    assert.equal(fixture.button('Envoi'), undefined);
  } finally { await fixture.dispose(); }
});

test('a pending or failed optional reference blocks Generate until corrected', async () => {
  const fixture = await mount();
  try {
    const field = { id: 'image_urls', type: 'image' as const, label: 'Images', maxCount: 4 };
    const imported = { id: 'reference', name: 'portrait.jpg', kind: 'image' as const, size: 2048, type: 'image/jpeg', previewUrl: 'blob:preview' };
    const action = () => fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-generation-action')!;
    await fixture.render({ assetFields: [{ field, required: false }], assets: { image_urls: [{ ...imported, status: 'uploading' }] } });
    assert.equal(action().disabled, true);
    assert.match(action().textContent!, /Import en cours/);
    action().click();
    assert.equal(fixture.submissions, 0);

    await fixture.render({ assets: { image_urls: [{ ...imported, status: 'error', error: 'Failed to upload' }] } });
    assert.equal(action().disabled, true);
    assert.match(action().textContent!, /Référence à corriger/);

    await fixture.render({ assets: { image_urls: [{ ...imported, status: 'ready', url: 'https://owned.test/portrait.jpg' }] } });
    assert.equal(action().disabled, false);
    assert.doesNotMatch(action().textContent!, /Import en cours|Référence à corriger/);

    await fixture.render({ assets: {} });
    await fixture.click('Générer');
    assert.equal(fixture.submissions, 1);
  } finally { await fixture.dispose(); }
});

test('advanced editor references report their upload state at Generate only while active', async () => {
  const fixture = await mount();
  try {
    const fieldId = 'reference_image_urls';
    const image = { id: 'keyframe', fieldId, name: 'frame.jpg', kind: 'image' as const, size: 4096, type: 'image/jpeg', previewUrl: 'blob:frame' };
    const fx = listFalEngines().find(config => config.id === 'flux-3-max')!.engine;
    const kling = listFalEngines().find(config => config.id === 'kling-v4')!.engine;
    const action = () => fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-generation-action')!;
    for (const status of ['uploading', 'error'] as const) {
      const expected = status === 'uploading' ? /Import en cours/ : /Référence à corriger/;
      await fixture.render({ referenceUploadStatus: getWorkspaceReferenceUploadStatus({
        engine: fx, mode: 'ref2v', inputAssets: { [fieldId]: [{ ...image, status }] }, klingElements: [], supportsKlingV3Controls: false,
      }) });
      assert.equal(action().disabled, true);
      assert.match(action().textContent!, expected);
    }
    const failedSubject = { id: 'subject', frontal: null, references: [], video: { ...image, kind: 'video' as const, status: 'error' as const } };
    await fixture.render({ referenceUploadStatus: getWorkspaceReferenceUploadStatus({
      engine: kling, mode: 'ref2v', inputAssets: {}, klingElements: [failedSubject], supportsKlingV3Controls: false,
    }) });
    assert.match(action().textContent!, /Référence à corriger/);
    await fixture.render({ referenceUploadStatus: getWorkspaceReferenceUploadStatus({
      engine: kling, mode: 'i2v', inputAssets: { video_urls: [{ ...image, fieldId: 'video_urls', kind: 'video', status: 'uploading' }] },
      klingElements: [failedSubject], supportsKlingV3Controls: false,
    }) });
    assert.equal(action().disabled, false);
    await fixture.click('Générer');
    assert.equal(fixture.submissions, 1);
  } finally {
    await fixture.dispose();
  }
});

test('opening frames promoted from two-frame slots keep their upload feedback', () => {
  for (const [engineId, fieldId] of [['veo-3-1', 'first_frame_url'], ['flux-3', 'start_image_url']]) {
    const engine = listFalEngines().find(config => config.id === engineId)!.engine;
    for (const status of ['uploading', 'error'] as const) {
      const image = { id: 'opening', fieldId, name: 'shot.jpg', kind: 'image' as const, size: 4096, type: 'image/jpeg', previewUrl: 'blob:frame', status };
      assert.equal(getWorkspaceReferenceUploadStatus({
        engine, mode: 'i2v', inputAssets: { [fieldId]: [image] }, klingElements: [], supportsKlingV3Controls: false,
      }), status);
    }
  }
});
