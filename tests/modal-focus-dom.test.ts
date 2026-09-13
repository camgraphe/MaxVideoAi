import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useAccessibleModal } from '../frontend/components/ui/useAccessibleModal';

test('modal enters, cycles past hidden controls, closes and restores the opener', async () => {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', { pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // jsdom has no layout; model the browser visibility check, including a hidden ancestor.
  dom.window.HTMLElement.prototype.getClientRects = function () {
    const closedDetails = this.closest('details:not([open])');
    const hidden = this.closest('[hidden]') || (closedDetails && this.tagName !== 'SUMMARY');
    return (hidden ? [] : [{ width: 44, height: 44 }]) as unknown as DOMRectList;
  };
  const opener = dom.window.document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  let closed = false;
  function Fixture() {
    const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: () => { closed = true; } });
    return React.createElement('div', { ref: dialogRef, tabIndex: -1, onKeyDown: onDialogKeyDown },
      React.createElement('button', { id: 'close', 'data-modal-initial-focus': 'true' }, 'Close'),
      React.createElement('video', { controls: true, tabIndex: 0 }),
      React.createElement('button', {}, 'Download'),
      React.createElement('details', {},
        React.createElement('summary', { id: 'last', tabIndex: 0 }, 'Show more'),
        React.createElement('button', { id: 'collapsed' }, 'Hidden in details')),
      React.createElement('div', { hidden: true }, React.createElement('button', { id: 'hidden' }, 'Hidden')));
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => { root.render(React.createElement(Fixture)); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    assert.equal(dom.window.document.activeElement?.id, 'close');
    assert.equal(dom.window.document.body.style.overflow, 'hidden');
    const key = async (value: string, shiftKey = false) => act(async () => {
      dom.window.document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }));
    });
    await key('Tab', true);
    assert.equal(dom.window.document.activeElement?.id, 'last');
    await key('Tab');
    assert.equal(dom.window.document.activeElement?.id, 'close');
    await key('Escape');
    assert.equal(closed, true);
    await act(async () => { root.unmount(); });
    assert.equal(dom.window.document.activeElement, opener);
    assert.equal(dom.window.document.body.style.overflow, '');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
