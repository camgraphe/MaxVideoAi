import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { getDropdownGeometry } from '../frontend/src/components/ui/engine-select/EngineSelectDropdown';
import { useEngineSelectDropdownState } from '../frontend/src/components/ui/engine-select/useEngineSelectDropdownState';
import type { EngineCaps } from '../frontend/types/engines';

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
          key: index, id: engines[index].id, role: 'option', disabled: index === 1,
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
