import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { getDropdownGeometry } from '../frontend/src/components/ui/engine-select/EngineSelectDropdown';
import { EngineSelectDropdown } from '../frontend/src/components/ui/engine-select/EngineSelectDropdown';
import { DEFAULT_ENGINE_SELECT_COPY } from '../frontend/src/components/ui/engine-select/engine-select-copy';
import { useEngineSelectDropdownState } from '../frontend/src/components/ui/engine-select/useEngineSelectDropdownState';
import type { EngineRegistryMeta } from '../frontend/src/components/ui/engine-select/engine-select-types';
import type { EngineCaps } from '../frontend/types/engines';

const selectorEngine = (id: string, label: string): EngineCaps => ({
  id,
  label,
  provider: 'Fixture provider',
  status: 'live',
  latencyTier: 'standard',
  modes: ['t2v'],
  maxDurationSec: 5,
  resolutions: ['720p'],
  aspectRatios: ['16:9'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
  availability: 'available',
  updatedAt: '2026-09-07',
  ttlSec: 60,
});

test('model dropdown fits narrow and short viewports, including triggers near the bottom edge', () => {
  for (const viewport of [{ width: 320, height: 680 }, { width: 390, height: 260 }, { width: 1440, height: 900 }]) {
    const geometry = getDropdownGeometry({ left: viewport.width - 180, top: viewport.height - 20, width: 320 }, viewport);
    assert.ok(geometry.left >= 12);
    assert.ok(geometry.left + geometry.width <= viewport.width - 12);
    assert.ok(geometry.top >= 12);
    assert.ok(geometry.top + geometry.maxHeight <= viewport.height - 12);
  }
});

test('model keyboard navigation skips unmounted families and disabled choices without hijacking search or Close', async () => {
  const dom = new JSDOM('<input id="search"><div id="root"></div>', { pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const engines = ['first', 'disabled', 'other-family', 'last'].map((id) => ({ id })) as EngineCaps[];
  const changes: string[] = [];
  let closeCount = 0;
  const onChange = (id: string) => changes.push(id);
  function Fixture() {
    const [open, setOpen] = React.useState(true);
    const state = useEngineSelectDropdownState({ open, setOpen, onEngineChange: onChange, selectedEngineId: 'first', visibleEngines: engines });
    return React.createElement('div', { ref: state.containerRef },
      React.createElement('button', { ref: state.triggerRef, id: 'trigger' }, 'Models'),
      React.createElement('div', { ref: state.contentRef },
        React.createElement('button', { id: 'close', onClick: () => { closeCount++; setOpen(false); } }, 'Close'),
        ...[0, 1, 3].map((index) => React.createElement('button', {
          key: index, id: engines[index].id, 'data-engine-option': true, disabled: index === 1,
          ref: (node: HTMLButtonElement | null) => { state.itemRefs.current[index] = node; },
        }, engines[index].id))));
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const key = async (value: string) => {
    const event = new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    await act(async () => { dom.window.document.activeElement?.dispatchEvent(event); });
    return event;
  };
  try {
    await act(async () => { root.render(React.createElement(Fixture)); });
    assert.equal(dom.window.document.activeElement?.id, 'first');
    await key('ArrowDown');
    assert.equal(dom.window.document.activeElement?.id, 'last');
    await key('ArrowDown');
    assert.equal(dom.window.document.activeElement?.id, 'first');
    await key('ArrowUp');
    assert.equal(dom.window.document.activeElement?.id, 'last');
    dom.window.document.getElementById('search')!.focus();
    assert.equal((await key(' ')).defaultPrevented, false);
    assert.equal((await key('Enter')).defaultPrevented, false);
    assert.deepEqual(changes, []);
    dom.window.document.getElementById('close')!.focus();
    assert.equal((await key('Enter')).defaultPrevented, false);
    assert.deepEqual(changes, []);
    dom.window.document.getElementById('last')!.focus();
    await key('Enter');
    assert.deepEqual(changes, ['last']);
    assert.equal(dom.window.document.activeElement?.id, 'trigger');
    assert.equal(closeCount, 0);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('rendered dropdown reports catalogue coverage and explains legacy-only empty search results', async () => {
  const dom = new JSDOM('<div id="root"></div><div id="portal"></div>', { pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const current = { ...selectorEngine('current-model', 'Current Model'), avgDurationMs: 42000, durationSource: 'completion_event' as const, durationSampleCount: 12 };
  const otherCurrent = selectorEngine('other-current', 'Other Current');
  const legacy = selectorEngine('legacy-secret', 'Legacy Secret');
  const engines = [current, otherCurrent, legacy];
  const meta = new Map(engines.map((engine, index) => [engine.id, {
    id: engine.id,
    modelSlug: engine.id,
    provider: engine.provider,
    marketingName: engine.label,
    brandId: engine.id === otherCurrent.id ? 'second-family' : 'first-family',
    family: engine.id === otherCurrent.id ? 'second-family' : 'first-family',
    category: 'video',
    availability: 'available',
    surfaces: { app: { discoveryRank: index + 1 } },
    isLegacy: engine.id === legacy.id,
  }]));
  const registryMeta = {
    order: new Map(engines.map((engine, index) => [engine.id, index])),
    meta,
  } as unknown as EngineRegistryMeta;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const portalElement = dom.window.document.getElementById('portal') as HTMLDivElement;
  const props = {
    activeOptionId: undefined,
    contentRef: React.createRef<HTMLDivElement>(),
    copy: DEFAULT_ENGINE_SELECT_COPY,
    engines,
    engineScores: { 'current-model': 9.1 },
    disabledEngineReasons: { 'current-model': 'Requires a compatible reference' },
    formatEngineShort: (engine: EngineCaps | null | undefined) => engine?.label ?? '',
    hasLegacyEngines: true,
    highlightedIndex: 0,
    legacyToggleId: 'legacy-toggle',
    legacyToggleLabel: DEFAULT_ENGINE_SELECT_COPY.modal.legacyToggleLabel,
    onBrowse() {},
    onClose() {},
    onHighlight() {},
    onItemRef() {},
    onSelectEngine() {},
    onToggleLegacy() {},
    portalElement,
    position: { left: 0, top: 0, width: 640 },
    registryMeta,
    selectedEngine: current,
    showLegacy: false,
    triggerId: 'engine-trigger',
    visibleEngines: [current, otherCurrent],
  };

  try {
    await act(async () => { root.render(React.createElement(EngineSelectDropdown, props)); });
    assert.match(portalElement.textContent ?? '', /Models: 2\/3 · Families: 2/);
    assert.match(portalElement.textContent ?? '', /1 legacy model hidden/);
    const selection = portalElement.querySelector<HTMLButtonElement>('[data-engine-option]')!;
    assert.equal(selection.disabled, true);
    assert.equal(selection.getAttribute('aria-pressed'), 'true');
    assert.match(selection.textContent ?? '', /Requires a compatible reference/);
    assert.doesNotMatch(selection.textContent ?? '', /9\.1|Observed completions|Fixture provider/);
    const details = portalElement.querySelector<HTMLDetailsElement>('details.app-engine-details')!;
    assert.equal(details.open, false);
    assert.match(details.querySelector('summary')?.textContent ?? '', /Details.*Current Model/);
    assert.match(details.textContent ?? '', /Score: 9\.1\/10/);
    assert.match(details.textContent ?? '', /Observed completions \(12\)/);
    await act(async () => { details.querySelector('summary')!.click(); });
    assert.equal(details.open, true, 'native disclosure opens independently of disabled model selection');


    const input = portalElement.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!;
    // React was imported before JSDOM and enables its legacy input polyfill.
    Object.assign(input, { attachEvent() {}, detachEvent() {} });
    await act(async () => {
      const setInputValue = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setInputValue?.call(input, 'legacy secret');
      Simulate.change(input);
    });

    assert.match(portalElement.textContent ?? '', /No models match “legacy secret”\./);
    assert.match(
      portalElement.textContent ?? '',
      /1 matching legacy model is hidden\. Turn on Legacy models to include it\./,
    );
    await act(async () => { portalElement.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click(); });
    assert.equal(input.value, '');
    assert.equal(dom.window.document.activeElement, input, 'clearing search returns focus to the input');
    assert.ok(portalElement.querySelector('[data-engine-option]'));

  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('rendered dropdown keeps a one-model catalogue summary count-neutral in every locale', async () => {
  const dom = new JSDOM('<div id="root"></div><div id="portal"></div>', { pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const onlyEngine = selectorEngine('only-model', 'Only Model');
  const registryMeta = {
    order: new Map([[onlyEngine.id, 0]]),
    meta: new Map([[onlyEngine.id, {
      id: onlyEngine.id,
      modelSlug: onlyEngine.id,
      provider: onlyEngine.provider,
      marketingName: onlyEngine.label,
      brandId: 'only-family',
      family: 'only-family',
      category: 'video',
      availability: 'available',
      surfaces: { app: { discoveryRank: 1 } },
    }]]),
  } as unknown as EngineRegistryMeta;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const portalElement = dom.window.document.getElementById('portal') as HTMLDivElement;

  try {
    for (const [locale, expected] of [
      ['en', 'Models: 1/1 · Families: 1'],
      ['fr', 'Modèles : 1/1 · Familles : 1'],
      ['es', 'Modelos: 1/1 · Familias: 1'],
    ] as const) {
      const dictionary = JSON.parse(
        (await import('node:fs')).readFileSync(`frontend/messages/${locale}.json`, 'utf8'),
      );
      const localizedCopy = {
        ...DEFAULT_ENGINE_SELECT_COPY,
        ...dictionary.workspace.generate.engineSelect,
      };
      await act(async () => {
        root.render(React.createElement(EngineSelectDropdown, {
          activeOptionId: undefined,
          contentRef: React.createRef<HTMLDivElement>(),
          copy: localizedCopy,
          engines: [onlyEngine],
          formatEngineShort: (engine: EngineCaps | null | undefined) => engine?.label ?? '',
          hasLegacyEngines: false,
          highlightedIndex: 0,
          legacyToggleId: 'legacy-toggle',
          legacyToggleLabel: localizedCopy.modal.legacyToggleLabel,
          onBrowse() {},
          onClose() {},
          onHighlight() {},
          onItemRef() {},
          onSelectEngine() {},
          onToggleLegacy() {},
          portalElement,
          position: { left: 0, top: 0, width: 640 },
          registryMeta,
          selectedEngine: onlyEngine,
          showLegacy: false,
          triggerId: 'engine-trigger',
          visibleEngines: [onlyEngine],
        }));
      });
      assert.match(portalElement.textContent ?? '', new RegExp(expected));
    }
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
