import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { ensureEngineRegistryMeta } from '../frontend/src/components/ui/engine-select/engine-select-helpers';

async function mount() {
  const dom = new JSDOM('<div class="app-experience"><div id="scroll-owner"><div id="root"></div></div></div>', {
    url: 'http://localhost/app', pretendToBeVisual: true,
  });
  const win = dom.window;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    React, window: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, Element: win.Element, Node: win.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  win.HTMLElement.prototype.scrollIntoView = () => {};
  let triggerRect = { bottom: 200, left: 40, width: 320 };
  let geometryReads = 0;
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.getAttribute('aria-haspopup') === 'dialog') geometryReads++;
    return { ...triggerRect, top: triggerRect.bottom - 44, right: triggerRect.left + triggerRect.width,
      height: 44, x: triggerRect.left, y: triggerRect.bottom - 44, toJSON() {} };
  };
  // Registry loading, family/filter logic, portal, keyboard and rendering all remain real.
  // Preload the local registry so a timer/import cannot confound the scroll counts.
  await ensureEngineRegistryMeta();
  const { createRoot } = createRequire(new URL('../frontend/package.json', import.meta.url))('react-dom/client') as typeof import('react-dom/client');
  const { EngineSettingsBar } = await import('../frontend/components/EngineSettingsBar');
  const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider');
  const engines = listFalEngines().filter(entry => entry.engine.modes.some(mode => mode.endsWith('2v') || mode === 'extend' || mode === 'retake')).map(entry => entry.engine);
  const dictionary = {};
  const selections: string[] = [];
  let commits = 0;
  function Fixture() {
    const [engineId, setEngineId] = React.useState('veo-3-1');
    return React.createElement(I18nProvider, { locale: 'en', dictionary, fallback: dictionary },
      React.createElement(React.Profiler, { id: 'engine-settings', onRender() { commits++; } },
        React.createElement(EngineSettingsBar, {
          engines, engineId, mode: 't2v', onModeChange() {}, showModeBadge: false,
          controlPresentation: 'workspace', density: 'compact',
          disabledEngineReasons: { 'veo-3-1-fast': 'Fixture reference incompatibility' },
          onEngineChange(id) { selections.push(id); setEngineId(id); },
        })));
  }
  const root = createRoot(win.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  const trigger = win.document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  const run = async (action: () => void) => { await act(async () => action()); };
  const open = () => run(() => trigger.click());
  const dialog = () => win.document.querySelector<HTMLElement>('[data-engine-select-portal] [role="dialog"]')!;
  return {
    win, trigger, open, dialog, run, selections,
    get geometryReads() { return geometryReads; }, get commits() { return commits; },
    clear() { geometryReads = 0; commits = 0; },
    rect(patch: Partial<typeof triggerRect>) { triggerRect = { ...triggerRect, ...patch }; },
    async close() {
      await act(async () => root.unmount()); win.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('scrolling the fixed model browser panes does not reposition or rerender the engine selector', async t => {
  const h = await mount();
  try {
    await h.open();
    const dialog = h.dialog();
    const originalStyle = dialog.getAttribute('style');
    const panes = [...dialog.querySelectorAll<HTMLElement>('.app-scroll-surface')];
    assert.equal(panes.length, 2, 'exercise both the family and model scroll containers');
    h.clear();
    for (const pane of panes) {
      for (let index = 0; index < 3; index++) {
        pane.scrollTop = (index + 1) * 40;
        await h.run(() => pane.dispatchEvent(new h.win.Event('scroll')));
      }
    }
    t.diagnostic(JSON.stringify({ paneScrolls: 6, geometryReads: h.geometryReads, commits: h.commits }));
    assert.equal(h.geometryReads, 0, 'fixed portal contents cannot move the trigger');
    assert.equal(h.commits, 0, 'internal scrolling must not invalidate the model browser');
    assert.equal(dialog.getAttribute('style'), originalStyle);
    assert.equal(h.trigger.getAttribute('aria-expanded'), 'true');
  } finally { await h.close(); }
});

test('ancestor scroll and viewport-only resize still recompute the model browser geometry', async () => {
  const h = await mount();
  try {
    await h.open();
    h.clear();
    h.rect({ bottom: 120, left: 72 });
    await h.run(() => h.win.document.getElementById('scroll-owner')!.dispatchEvent(new h.win.Event('scroll')));
    assert.equal(h.geometryReads, 1);
    assert.equal(h.dialog().style.top, '128px');
    assert.equal(h.dialog().style.left, '72px');
    for (const [width, height, expectedWidth, expectedHeight, expectedTop] of [
      [390, 844, '366px', '560px', '128px'],
      [390, 500, '366px', '476px', '12px'],
      [1024, 768, '620px', '560px', '128px'],
    ] as const) {
      Object.defineProperties(h.win, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } });
      await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
      assert.equal(h.dialog().style.width, expectedWidth);
      assert.equal(h.dialog().style.top, expectedTop);
      assert.equal(h.dialog().querySelector<HTMLElement>('.app-engine-browser')!.style.height, expectedHeight);
    }
    await h.run(() => h.win.document.activeElement!.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.ok(!h.dialog());
    assert.ok(h.win.document.activeElement === h.trigger);
    h.clear();
    await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
    await h.run(() => h.win.document.getElementById('scroll-owner')!.dispatchEvent(new h.win.Event('scroll')));
    assert.equal(h.geometryReads, 0, 'dismissal removes the positioning listeners');
  } finally { await h.close(); }
});

test('model families, disabled choices, keyboard selection and dismissal remain usable after pane scrolling', async () => {
  const h = await mount();
  try {
    await h.open();
    const families = h.dialog().querySelector<HTMLElement>('.app-engine-families')!;
    await h.run(() => families.dispatchEvent(new h.win.Event('scroll')));
    const kling = [...families.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Kling'))!;
    assert.ok(kling);
    await h.run(() => kling.click());
    assert.equal(kling.getAttribute('aria-pressed'), 'true');
    assert.ok(h.dialog().querySelector('[id^="kling"][data-engine-option]'));
    const veo = [...families.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Veo'))!;
    await h.run(() => veo.click());
    const disabled = h.win.document.getElementById('veo-3-1-fast-option') as HTMLButtonElement;
    assert.equal(disabled.disabled, true);
    await h.run(() => disabled.click());
    assert.deepEqual(h.selections, []);
    const option = h.win.document.getElementById('veo-3-1-option') as HTMLButtonElement;
    await h.run(() => option.focus());
    await h.run(() => option.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    const focused = h.win.document.activeElement as HTMLButtonElement;
    assert.equal(focused.dataset.engineOption, 'true');
    assert.equal(focused.disabled, false);
    assert.notEqual(focused.id, disabled.id);
    const selectedId = focused.id.replace(/-option$/, '');
    await h.run(() => focused.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.deepEqual(h.selections, [selectedId]);
    assert.ok(!h.dialog());
    assert.ok(h.win.document.activeElement === h.trigger);
    await h.open();
    await h.run(() => h.win.document.body.dispatchEvent(new h.win.MouseEvent('mousedown', { bubbles: true })));
    assert.ok(!h.dialog());
  } finally { await h.close(); }
});

test('search and pointer selection remain current after scrolling and mobile resizing', async () => {
  const h = await mount();
  try {
    await h.open();
    const search = h.dialog().querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!;
    assert.ok(search);
    await h.run(() => search.focus());
    const setValue = Object.getOwnPropertyDescriptor(h.win.HTMLInputElement.prototype, 'value')!.set!;
    await h.run(() => {
      setValue.call(search, 'ltx');
      search.dispatchEvent(new h.win.Event('input', { bubbles: true }));
    });
    const options = [...h.dialog().querySelectorAll<HTMLButtonElement>('[data-engine-option]')];
    assert.ok(options.length > 0);
    assert.ok(options.every(option => option.id.startsWith('ltx')));
    assert.ok(h.win.document.activeElement === search, 'filtering keeps search focus');
    Object.defineProperties(h.win, { innerWidth: { value: 390, configurable: true }, innerHeight: { value: 500, configurable: true } });
    await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
    assert.equal(search.value, 'ltx');
    const pane = h.dialog().querySelectorAll<HTMLElement>('.app-scroll-surface')[1];
    h.clear();
    await h.run(() => pane.dispatchEvent(new h.win.Event('scroll')));
    assert.equal(h.geometryReads, 0);
    assert.equal(h.commits, 0);
    const selectedId = options[0].id.replace(/-option$/, '');
    await h.run(() => options[0].click());
    assert.deepEqual(h.selections, [selectedId]);
    assert.ok(!h.dialog());
    await h.open();
    assert.equal(h.win.document.getElementById(`${selectedId}-option`)?.getAttribute('aria-pressed'), 'true');
  } finally { await h.close(); }
});
