import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import { AudioWorkspacePreview, type AudioWorkspacePreviewProps } from '../frontend/app/(core)/(workspace)/app/audio/_components/audio-workspace-preview';
import { DEFAULT_AUDIO_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/audio/copy';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useAccessibleModal } from '../frontend/components/ui/useAccessibleModal';
import type { ComposerProps } from '../frontend/components/composer/composer-types';

async function loadReferenceSection() {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try { return await import('../frontend/components/composer/WorkspaceReferenceSection.client'); } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
}

async function mount(element: React.ReactNode) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 10, height: 10 }] as unknown as DOMRectList; };
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
    assert.match(fixture.container.textContent!, /Referencias/);
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
    const manage = fixture.container.querySelector<HTMLButtonElement>('.app-reference-commands button')!;
    await act(async () => manage.click());
    assert.equal(manage.getAttribute('aria-expanded'), 'true');
    const upload = fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-reference-add-target')!;
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
    const command = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    await act(async () => command.click());
    const doc = fixture.dom.window.document;
    let fileSelections = 0;
    doc.querySelectorAll('input[type="file"]').forEach(input => input.addEventListener('click', (event) => { event.preventDefault(); fileSelections += 1; }));
    const filled = doc.querySelector<HTMLElement>('[data-asset-index="49"]')!;
    await act(async () => filled.querySelector('video')!.click());
    assert.equal(fileSelections, 0);
    const remove = filled.querySelector<HTMLButtonElement>('button[aria-label^="Quitar"]')!;
    await act(async () => remove.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(fileSelections, 0, 'keyboard event cannot bubble into an upload container');
    await act(async () => remove.click());
    assert.deepEqual(removed, [['refs', 49]]);
    await act(async () => doc.querySelector<HTMLButtonElement>('[data-asset-index="0"] .app-reference-add-target')!.click());
    assert.equal(fileSelections, 1);
    await act(async () => filled.querySelector<HTMLButtonElement>('button[aria-label^="Elegir en Medios"]')!.click());
    assert.deepEqual(library, [['refs', 49]]);
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.activeElement, command);
  } finally { await fixture.cleanup(); }
});


test('direct frame commands order Start before End, preserve exact uploads and safely hand off to Media', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const baseEngine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const engine = { ...baseEngine, inputSchema: { constraints: { supportedFormats: ['png'] } } };
  const start = { id: 'image_url', label: 'Start image', type: 'image' as const, maxCount: 1 };
  const end = { id: 'end_image_url', label: 'End image', type: 'image' as const, maxCount: 1 };
  const asset = { kind: 'image' as const, name: 'Existing start', type: 'image/png', size: 1, previewUrl: '/existing.png' };
  const uploads: unknown[][] = [];
  const removals: unknown[][] = [];
  const handoffs: unknown[][] = [];
  let libraryOpener: Element | null = null;
  function Library({ close }: { close: () => void }) {
    const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: close });
    return React.createElement('div', { ref: dialogRef, role: 'dialog', 'aria-modal': 'true', onKeyDown: onDialogKeyDown }, React.createElement('button', { onClick: close }, 'Cancel library'));
  }
  function Fixture() {
    const [library, setLibrary] = React.useState(false);
    return React.createElement(React.Fragment, null, React.createElement(WorkspaceReferenceSection, {
      engine, assetFields: [{ field: end, role: 'frame', required: false }, { field: start, role: 'primary', required: false }],
      assets: { image_url: [asset] }, referenceWarning: '',
      onAssetAdd: (...args) => uploads.push(args), onAssetRemove: (...args) => removals.push(args),
      onOpenLibrary: (...args) => {
        assert.equal(document.querySelector('[role="dialog"]'), null, 'reference dialog is gone before the Media callback');
        assert.equal(document.body.style.overflow, '', 'the popup body lock is released before Media mounts');
        libraryOpener = document.activeElement;
        handoffs.push(args); setLibrary(true);
      },
    }), library ? React.createElement(Library, { close: () => setLibrary(false) }) : null);
  }
  const fixture = await mount(React.createElement(Fixture));
  const doc = fixture.dom.window.document;
  const click = async (node: HTMLElement) => act(async () => node.click());
  try {
    const commands = [...fixture.container.querySelectorAll<HTMLButtonElement>('[data-reference-command]')];
    assert.deepEqual(commands.map(node => node.dataset.referenceCommand), ['image_url', 'end_image_url']);
    assert.equal(doc.querySelector('input[type="file"]'), null, 'no empty dropzone appears in the toolbar');
    await click(commands[1]);
    assert.equal(doc.querySelector('[role="dialog"] h2')?.textContent, 'Imagen final');
    assert.equal(doc.querySelectorAll('[data-reference-field]').length, 1);
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
    const popup = doc.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = [...popup.querySelectorAll<HTMLButtonElement>('button:not([disabled]), summary')];
    assert.equal(doc.activeElement, buttons[0], 'popup gives initial focus to Close');
    buttons[0].focus();
    await act(async () => buttons[0].dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    assert.equal(doc.activeElement, buttons.at(-1), 'Shift+Tab wraps inside the focused popup');
    await act(async () => buttons.at(-1)!.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    assert.equal(doc.activeElement, buttons[0], 'Tab wraps back to Close');
    const input = doc.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new fixture.dom.window.File(['png'], 'end.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => input.dispatchEvent(new fixture.dom.window.Event('change', { bubbles: true })));
    assert.equal(uploads.length, 1); assert.equal(uploads[0][0], end); assert.equal(uploads[0][1], file); assert.equal(uploads[0][2], 0);
    const dialog = doc.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => dialog.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(doc.activeElement, commands[1]); assert.equal(doc.body.style.overflow, '');
    await click(commands[0]);
    const replaceInput = doc.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(replaceInput, 'files', { value: [], configurable: true });
    await act(async () => replaceInput.dispatchEvent(new fixture.dom.window.Event('change', { bubbles: true })));
    assert.equal(uploads.length, 1, 'cancelled replacement does not mutate the existing asset');
    assert.equal(doc.querySelector('.app-reference-media img')?.getAttribute('src'), '/existing.png');
    await click(doc.querySelector<HTMLButtonElement>('button[aria-label^="Elegir en Medios"]')!);
    assert.deepEqual(handoffs, [[start, 0]]); assert.equal(libraryOpener, commands[0]);
    assert.equal(doc.querySelectorAll('[role="dialog"]').length, 1); assert.equal(doc.body.style.overflow, 'hidden');
    await click([...doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Cancel library')!);
    assert.equal(doc.activeElement, commands[0]); assert.equal(doc.body.style.overflow, '');
    await click(commands[0]);
    assert.equal(doc.querySelector('.app-reference-media img')?.getAttribute('src'), '/existing.png');
    await click(doc.querySelector<HTMLButtonElement>('button[aria-label^="Quitar"]')!);
    assert.deepEqual(removals, [[start, 0]]);
  } finally { await fixture.cleanup(); }
});

test('required audio and disabled explanations remain visible, while fifty references have a bounded summary and complete inventory', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const assets = Array.from({ length: 50 }, (_, index) => ({ kind: 'image' as const, name: `Ref ${index}`, type: 'image/png', size: 1, previewUrl: `/ref-${index}.png` }));
  const props = { engine, assetFields: [
    { field: { id: 'references', type: 'image' as const, label: 'Images', maxCount: 50 }, required: false },
    { field: { id: 'audio_url', type: 'audio' as const, label: 'Source audio', minCount: 1, maxCount: 1 }, required: true, disabled: true, disabledReason: 'Sign in to upload audio' },
  ], assets: { references: assets }, referenceWarning: '' };
  const removals: Array<[string, number]> = [];
  const fixture = await mount(React.createElement(WorkspaceReferenceSection, { ...props, onAssetRemove: (field, slotIndex) => removals.push([field.id, slotIndex]) }));
  const doc = fixture.dom.window.document;
  try {
    assert.match(fixture.container.textContent!, /Obligatorio · Source audio/);
    assert.equal(fixture.container.querySelectorAll('.app-reference-selected-manage').length, 3);
    assert.equal(fixture.container.querySelectorAll('.app-reference-selected-remove').length, 3);
    assert.equal(fixture.container.querySelectorAll('img').length, 3);
    assert.equal(doc.querySelector('audio'), null);
    const command = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    await act(async () => fixture.container.querySelectorAll<HTMLButtonElement>('.app-reference-selected-remove')[1]!.click());
    assert.deepEqual(removals, [['references', 1]]);
    assert.equal(doc.querySelector('[role="dialog"]'), null, 'direct removal does not open the reference manager');
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('.app-reference-selected-manage')!.click());
    assert.equal(doc.querySelectorAll('[data-reference-field="references"] [data-asset-index]').length, 50);
    assert.ok(doc.querySelector('[data-reference-field="references"] [data-asset-index="49"]'));
    await act(async () => doc.querySelector<HTMLButtonElement>('[data-reference-role="audio_url"]')!.click());
    const audio = doc.querySelector('[data-reference-field="audio_url"]')!;
    assert.match(audio.textContent!, /Sign in to upload audio/);
    assert.equal(audio.querySelector<HTMLInputElement>('input')?.accept, '.mp3,.wav');
    assert.equal(audio.querySelector<HTMLButtonElement>('button')?.disabled, true);
    const dialog = doc.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => dialog.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(doc.activeElement, command, 'summary opens with the stable toolbar command as focus return');
  } finally { await fixture.cleanup(); }
});

test('image source, mask and custom roles retain distinct names and original upload/library field indices', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const base = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const engine = { ...base, modes: ['t2i' as const, 'i2i' as const], inputSchema: { ...base.inputSchema!, constraints: { ...base.inputSchema?.constraints, minImageSidePx: undefined } } };
  const fields: ComposerProps['assetFields'] = [
    { field: { id: 'image_url', type: 'image', label: 'Source image', maxCount: 1 }, role: 'primary', required: true },
    { field: { id: 'mask', type: 'image', label: 'Mask', maxCount: 1 }, required: true },
    { field: { id: 'style_reference', type: 'image', label: 'Style reference', maxCount: 3 }, required: false },
  ];
  const uploads: unknown[][] = []; const library: unknown[][] = [];
  const existing = { kind: 'image' as const, name: 'Style', type: 'image/png', size: 1, previewUrl: '/style.png' };
  const fixture = await mount(React.createElement(WorkspaceReferenceSection, { engine, referenceWarning: '', assets: { style_reference: [null, existing] }, assetFields: fields,
    onAssetAdd: (field, file, index) => uploads.push([field, file, index]), onOpenLibrary: (field, index) => library.push([field, index]) }));
  const doc = fixture.dom.window.document;
  try {
    assert.equal(fixture.container.querySelector('[data-reference-command="image_url"]'), null);
    assert.match(fixture.container.textContent!, /Source image, Mask/);
    const command = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    for (const [position, entry] of fields.entries()) {
      await act(async () => command.click());
      const roles = [...doc.querySelectorAll<HTMLButtonElement>('[data-reference-role]')];
      assert.equal(new Set(roles.map(role => role.textContent)).size, 3);
      assert.match(roles[0].textContent!, /Source image/); assert.match(roles[1].textContent!, /Mask/); assert.match(roles[2].textContent!, /Style reference/);
      await act(async () => roles[position].click());
      const inventory = doc.querySelector(`[data-reference-field="${entry.field.id}"]`)!;
      assert.equal(doc.querySelectorAll('[data-reference-field]').length, 1);
      const index = position === 2 ? 1 : 0;
      const slot = inventory.querySelector(`[data-asset-index="${index}"]`)!;
      const input = slot.querySelector<HTMLInputElement>('input[type="file"]')!;
      const file = new fixture.dom.window.File(['fixture'], 'reference.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      await act(async () => input.dispatchEvent(new fixture.dom.window.Event('change', { bubbles: true })));
      assert.deepEqual(uploads[position], [entry.field, file, index]);
      await act(async () => slot.querySelector<HTMLButtonElement>('button[aria-label^="Elegir en Medios"]')!.click());
      assert.deepEqual(library[position], [entry.field, index]);
      assert.equal(doc.querySelector('[role="dialog"]'), null); assert.equal(doc.activeElement, command);
    }
  } finally { await fixture.cleanup(); }
});


test('actual image Media picker owns focus, Escape and body lock and restores its connected command', async () => {
  const { ImageLibraryModal } = await import('../frontend/app/(core)/(workspace)/app/image/_components/ImageLibraryModal');
  const { DEFAULT_COPY } = await import('../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy');
  function Fixture() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(React.Fragment, null,
      React.createElement('button', { onClick: (event: React.MouseEvent<HTMLButtonElement>) => { event.currentTarget.focus(); setOpen(true); } }, 'Reference command'),
      React.createElement(SWRConfig, { value: { provider: () => new Map(), isPaused: () => true } },
        React.createElement(ImageLibraryModal, { open, onClose: () => setOpen(false), onSelect() {}, onToggleCharacter() {}, selectedCharacterReferences: [], characterSelectionLimit: 1, copy: DEFAULT_COPY.library, characterCopy: DEFAULT_COPY.characterPicker, selectionMode: 'reference', initialSource: 'all', supportedFormats: ['png'], supportedFormatsLabel: 'PNG', toolsEnabled: false })));
  }
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {} };
  const fixture = await mount(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(PathnameContext.Provider, { value: '/app/image' },
      React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, React.createElement(Fixture)))));
  const doc = fixture.dom.window.document;
  try {
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.body.style.overflow, '');
    const command = fixture.container.querySelector<HTMLButtonElement>('button')!;
    await act(async () => { command.click(); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
    const dialog = doc.querySelector<HTMLElement>('[role="dialog"]')!;
    assert.equal(dialog.getAttribute('aria-label'), DEFAULT_COPY.library.modal.title);
    assert.equal(doc.body.style.overflow, 'hidden');
    assert.ok(dialog.contains(doc.activeElement));
    assert.equal(dialog.querySelector('input[type="file"]')?.getAttribute('tabindex'), '-1');
    await act(async () => dialog.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.activeElement, command); assert.equal(doc.body.style.overflow, '');
  } finally { await fixture.cleanup(); }
});

test('removing controlled frame and sparse collection assets keeps focus in the popup and Escape returns to the stable command', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const asset = { kind: 'image' as const, name: 'Selected image', previewUrl: '/selected.png', size: 1, type: 'image/png' };
  const sparse: ComposerProps['assets'][string] = Array(50).fill(null); sparse[49] = asset;
  const removed: Array<[string, number]> = [];
  function Fixture() {
    const [assets, setAssets] = React.useState<ComposerProps['assets']>({ image_url: [asset], end_image_url: [asset], references: sparse });
    return React.createElement(WorkspaceReferenceSection, {
      engine, assets, referenceWarning: '', assetFields: [
        { field: { id: 'image_url', type: 'image', label: 'Start image', maxCount: 1 }, required: false },
        { field: { id: 'end_image_url', type: 'image', label: 'End image', maxCount: 1 }, required: false },
        { field: { id: 'references', type: 'image', label: 'References', maxCount: 50 }, required: false },
      ], onAssetRemove: (field, index) => {
        removed.push([field.id, index]);
        setAssets(current => ({ ...current, [field.id]: current[field.id].map((entry, slotIndex) => slotIndex === index ? null : entry) }));
      },
    });
  }
  const fixture = await mount(React.createElement(Fixture));
  const doc = fixture.dom.window.document;
  try {
    for (const [commandId, fieldId, slotIndex] of [['end_image_url', 'end_image_url', 0], ['collections', 'references', 49]] as const) {
      const command = fixture.container.querySelector<HTMLButtonElement>(`[data-reference-command="${commandId}"]`)!;
      await act(async () => command.click());
      const dialog = doc.querySelector<HTMLElement>('[role="dialog"]')!;
      const remove = dialog.querySelector<HTMLButtonElement>(`[data-reference-field="${fieldId}"] [data-asset-index="${slotIndex}"] button[aria-label^="Quitar"]`)!;
      remove.focus();
      await act(async () => remove.click());
      assert.equal(remove.isConnected, false, 'the actual state update unmounts the focused remove control');
      assert.ok(dialog.contains(doc.activeElement), 'focus remains inside the still-open popup after removal');
      assert.equal(doc.body.style.overflow, 'hidden');
      assert.equal(command.isConnected, true);
      await act(async () => doc.activeElement!.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
      assert.ok(dialog.contains(doc.activeElement), 'Tab containment still works after the focused control disappears');
      await act(async () => doc.activeElement!.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      assert.equal(doc.querySelector('[role="dialog"]'), null, 'Escape from the recovered active element closes the popup');
      assert.equal(doc.activeElement, command);
      assert.equal(doc.body.style.overflow, '');
    }
    assert.deepEqual(removed, [['end_image_url', 0], ['references', 49]]);
  } finally { await fixture.cleanup(); }
});

test('populated frame commands show their original previews and states without duplicating frames in the bounded collection summary', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const image = { kind: 'image' as const, name: 'Reference', previewUrl: '/ref.png', size: 1, type: 'image/png' };
  const fixture = await mount(React.createElement(WorkspaceReferenceSection, {
    engine, referenceWarning: '', assets: {
      image_url: [{ ...image, name: 'Full start name', previewUrl: '/original-start.png', status: 'uploading' }],
      end_image_url: [{ ...image, name: 'Full end name', previewUrl: '/original-end.png', status: 'error', error: 'Upload failed' }],
      references: Array(50).fill(image),
    }, assetFields: [
      { field: { id: 'image_url', type: 'image', label: 'Start image', maxCount: 1 }, required: false },
      { field: { id: 'end_image_url', type: 'image', label: 'End image', maxCount: 1 }, required: false },
      { field: { id: 'references', type: 'image', label: 'References', maxCount: 50 }, required: false },
    ],
  }));
  try {
    const start = fixture.container.querySelector('[data-reference-command="image_url"]')!;
    const end = fixture.container.querySelector('[data-reference-command="end_image_url"]')!;
    assert.equal(start.querySelector('img')?.getAttribute('src'), '/original-start.png');
    assert.equal(end.querySelector('img')?.getAttribute('src'), '/original-end.png');
    assert.equal(start.getAttribute('aria-label'), 'Imagen inicial · Full start name');
    assert.equal(end.getAttribute('aria-label'), 'Imagen final · Full end name');
    assert.ok(start.querySelector('[role="status"]')); assert.match(end.querySelector('[role="alert"]')!.textContent!, /Upload failed/);
    assert.equal(start.querySelector('svg'), null); assert.equal(end.querySelector('svg'), null);
    assert.doesNotMatch(start.textContent!, /✓/);
    const summary = fixture.container.querySelector('.app-reference-selected-summary')!;
    assert.equal(summary.querySelectorAll('button').length, 3);
    assert.equal(summary.querySelectorAll('img[src="/ref.png"]').length, 3);
    assert.doesNotMatch(summary.textContent!, /Full start name|Full end name/);
    assert.match(summary.textContent!, /\+47/);
  } finally { await fixture.cleanup(); }
});
