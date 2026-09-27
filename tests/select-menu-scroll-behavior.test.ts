import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';

async function mount({ placement = 'top', portal = true, core = false }: {
  placement?: 'top' | 'auto'; portal?: boolean; core?: boolean;
} = {}) {
  const dom = new JSDOM('<div id="scroll-owner"><div id="root"></div></div><button id="outside">Outside</button>', {
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
  let rect = { top: 500, left: 40, width: 140, height: 44 };
  const reads = { rect: 0, width: 0, height: 0 };
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    reads.rect++;
    return { ...rect, bottom: rect.top + rect.height, right: rect.left + rect.width,
      x: rect.left, y: rect.top, toJSON() {} };
  };
  Object.defineProperties(win.HTMLElement.prototype, {
    offsetWidth: { configurable: true, get() { reads.width++; return 180; } },
    offsetHeight: { configurable: true, get() { reads.height++; return 248; } },
  });
  const { createRoot } = createRequire(new URL('../frontend/package.json', import.meta.url))('react-dom/client') as typeof import('react-dom/client');
  const { SelectMenu } = await import('../frontend/components/ui/SelectMenu');
  const coreModule = core ? await import('../frontend/components/CoreSettingsBar') : null;
  const i18n = core ? await import('../frontend/lib/i18n/I18nProvider') : null;
  const catalogue = core ? await import('../frontend/src/config/falEngines') : null;
  const engine = catalogue?.listFalEngines().find(entry => entry.engine.id === 'kling-o3-standard')?.engine;
  const selections: (string | number | boolean)[] = [];
  const options = Array.from({ length: 20 }, (_, index) => ({ value: index + 1, label: `${index + 1}s`, disabled: index === 1 }));
  let commits = 0;
  function Fixture() {
    const [value, setValue] = React.useState<string | number | boolean>(core ? 5 : 1);
    if (coreModule && i18n && engine) {
      return React.createElement(i18n.I18nProvider, { locale: 'en', dictionary: {}, fallback: {} },
        React.createElement(coreModule.CoreSettingsBar, {
          engine, mode: 't2v', caps: engine.modeCaps?.t2v, density: 'workspace',
          durationSec: Number(value), onDurationChange(next) { selections.push(next); setValue(next); },
          resolution: '720p', onResolutionChange() {}, aspectRatio: '16:9', onAspectRatioChange() {},
          fps: 24, onFpsChange() {},
        }));
    }
    return React.createElement(React.Profiler, { id: 'settings-menu', onRender() { commits++; } },
      React.createElement(SelectMenu, {
        options, value, portal, menuPlacement: placement, searchable: true,
        onChange(next) { selections.push(next); setValue(next); },
      }));
  }
  const root = createRoot(win.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  const trigger = win.document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
  const run = async (action: () => void) => { await act(async () => action()); };
  const list = () => win.document.querySelector<HTMLElement>('[role="listbox"]')!;
  const menu = () => list()?.parentElement!;
  return {
    win, trigger, run, list, menu, selections, reads,
    open: () => run(() => trigger.click()),
    get commits() { return commits; },
    clear() { reads.rect = 0; reads.width = 0; reads.height = 0; commits = 0; },
    rect(patch: Partial<typeof rect>) { rect = { ...rect, ...patch }; },
    viewport(width: number, height: number) {
      Object.defineProperties(win, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } });
    },
    async close() {
      await act(async () => root.unmount()); win.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

for (const placement of ['top', 'auto'] as const) {
  test(`scrolling a fixed ${placement} settings menu does not request trigger or menu geometry`, async t => {
    const h = await mount({ placement });
    try {
      await h.open();
      const style = h.menu().getAttribute('style');
      h.clear();
      for (let i = 0; i < 6; i++) {
        h.list().scrollTop = (i + 1) * 30;
        await h.run(() => h.list().dispatchEvent(new h.win.Event('scroll')));
      }
      t.diagnostic(JSON.stringify({ placement, scrolls: 6, reads: h.reads, commits: h.commits }));
      assert.deepEqual(h.reads, { rect: 0, width: 0, height: 0 }, 'fixed options scrolling cannot move the trigger or resize the menu');
      assert.equal(h.menu().getAttribute('style'), style);
      assert.equal(h.trigger.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(h.selections, []);
    } finally { await h.close(); }
  });
}

test('fixed settings menu follows ancestor scroll and viewport resize, then removes listeners on dismissal', async () => {
  const h = await mount();
  try {
    await h.open();
    assert.equal(h.menu().style.bottom, '276px');
    h.rect({ top: 400, left: 80 });
    await h.run(() => h.win.document.getElementById('scroll-owner')!.dispatchEvent(new h.win.Event('scroll')));
    assert.equal(h.menu().style.bottom, '376px');
    assert.equal(h.menu().style.left, '80px');
    h.viewport(180, 650);
    await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
    assert.equal(h.menu().style.bottom, '258px');
    assert.equal(h.menu().style.width, '156px');
    assert.equal(h.menu().style.left, '12px');
    await h.run(() => h.trigger.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.ok(!h.list());
    h.clear();
    await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
    await h.run(() => h.win.document.getElementById('scroll-owner')!.dispatchEvent(new h.win.Event('scroll')));
    assert.deepEqual(h.reads, { rect: 0, width: 0, height: 0 });
  } finally { await h.close(); }
});

test('automatic placement still flips after viewport resize for fixed and inline menus', async () => {
  for (const portal of [true, false]) {
    const h = await mount({ placement: 'auto', portal });
    try {
      await h.open();
      assert.ok(portal ? h.menu().style.bottom : h.menu().classList.contains('bottom-full'));
      h.rect({ top: 40 });
      h.viewport(390, 844);
      await h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
      assert.ok(portal ? h.menu().style.top === '92px' : h.menu().classList.contains('mt-2'));
      h.rect({ top: 560 });
      await h.run(() => h.win.document.getElementById('scroll-owner')!.dispatchEvent(new h.win.Event('scroll')));
      assert.ok(portal ? h.menu().style.bottom === '292px' : h.menu().classList.contains('bottom-full'));
    } finally { await h.close(); }
  }
});

test('settings selection, search, disabled choices and focus dismissal survive internal scrolling', async () => {
  const h = await mount();
  try {
    await h.open();
    assert.equal(h.trigger.getAttribute('aria-controls'), h.list().id);
    assert.equal(h.list().getAttribute('aria-labelledby'), h.trigger.id);
    await h.run(() => h.list().dispatchEvent(new h.win.Event('scroll')));
    const disabled = h.list().querySelector<HTMLButtonElement>('button[disabled]')!;
    await h.run(() => disabled.click());
    assert.deepEqual(h.selections, []);
    await h.run(() => h.trigger.focus());
    await h.run(() => h.trigger.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await h.run(() => h.trigger.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.deepEqual(h.selections, [3], 'keyboard skips the disabled second option');
    assert.ok(!h.list());
    assert.equal(h.win.document.activeElement, h.trigger);
    await h.open();
    const search = h.menu().querySelector<HTMLInputElement>('input')!;
    await h.run(() => search.focus());
    const setValue = Object.getOwnPropertyDescriptor(h.win.HTMLInputElement.prototype, 'value')!.set!;
    await h.run(() => {
      setValue.call(search, '20');
      search.dispatchEvent(new h.win.Event('input', { bubbles: true }));
    });
    assert.equal(h.list().querySelectorAll('[role="option"]').length, 1);
    assert.equal(h.win.document.activeElement, search);
    h.clear();
    await h.run(() => h.list().dispatchEvent(new h.win.Event('scroll')));
    assert.deepEqual(h.reads, { rect: 0, width: 0, height: 0 });
    assert.equal(search.value, '20');
    await h.run(() => h.list().querySelector<HTMLButtonElement>('[role="option"]')!.click());
    assert.deepEqual(h.selections, [3, 20]);
    assert.equal(h.trigger.textContent, '20s');
    await h.open();
    assert.equal(h.menu().querySelector<HTMLInputElement>('input')!.value, '');
    assert.equal(h.list().querySelector('[aria-selected="true"]')?.textContent, '20s');
    await h.run(() => h.win.document.getElementById('outside')!.focus());
    assert.ok(!h.list());
    assert.equal(h.win.document.activeElement?.id, 'outside', 'focus departure retains the user target');
    await h.open();
    await h.run(() => h.win.document.getElementById('outside')!.dispatchEvent(new h.win.MouseEvent('mousedown', { bubbles: true })));
    assert.ok(!h.list());
  } finally { await h.close(); }
});

test('the real workspace duration control keeps its model options and selection after scrolling', async () => {
  const h = await mount({ core: true });
  try {
    assert.match(h.trigger.textContent ?? '', /Duration:.*5s/);
    await h.open();
    assert.ok(h.menu().classList.contains('app-settings-menu'));
    assert.equal(h.list().querySelectorAll('[role="option"]').length, 13);
    const style = h.menu().getAttribute('style');
    h.clear();
    for (let index = 0; index < 6; index++) {
      h.list().scrollTop = (index + 1) * 40;
      await h.run(() => h.list().dispatchEvent(new h.win.Event('scroll')));
    }
    assert.deepEqual(h.reads, { rect: 0, width: 0, height: 0 });
    assert.equal(h.menu().getAttribute('style'), style);
    const last = [...h.list().querySelectorAll<HTMLButtonElement>('[role="option"]')].at(-1)!;
    assert.match(last.textContent ?? '', /15s/);
    await h.run(() => last.click());
    assert.deepEqual(h.selections, [15]);
    assert.match(h.trigger.textContent ?? '', /Duration:.*15s/);
    assert.ok(!h.list());
  } finally { await h.close(); }
});
