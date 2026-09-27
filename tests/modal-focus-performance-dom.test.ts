import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useAccessibleModal } from '../frontend/components/ui/useAccessibleModal';
import { WorkspaceReferencePopup } from '../frontend/components/composer/WorkspaceReferencePopup.client';

function harness() {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', { pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const reads: HTMLElement[] = [];
  // Native DOM enumeration/filtering/focus stay real. JSDOM has no geometry:
  // supply visibility rectangles and observe every geometry request separately.
  dom.window.HTMLElement.prototype.getClientRects = function () {
    reads.push(this);
    return (this.closest('[hidden]') ? [] : [{ width: 44, height: 44 }]) as unknown as DOMRectList;
  };
  const doc = dom.window.document;
  const root = createRoot(doc.getElementById('root')!);
  const opener = doc.getElementById('opener')!;
  opener.focus();
  return { dom, doc, reads, opener,
    render: async (element: React.ReactNode) => act(async () => root.render(element)),
    focus: async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }),
    key: async (key: string, shiftKey = false) => act(async () => {
      doc.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    }),
    close: async () => {
      await act(async () => root.unmount());
      assert.equal(doc.activeElement, opener);
      assert.equal(doc.body.style.overflow, '');
      dom.window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('default reference popup performs only the required initial visibility scan', async () => {
  const h = harness();
  let closed = 0;
  try {
    await h.render(React.createElement(WorkspaceReferencePopup, {
      title: 'Reference', closeLabel: 'Close', onClose: () => closed++, children: React.createElement(React.Fragment, {},
        React.createElement('button', { id: 'media' }, 'Media'),
        React.createElement('button', { id: 'last' }, 'Upload'),
        React.createElement('button', { id: 'disabled', disabled: true }, 'Disabled'),
        React.createElement('div', { hidden: true }, React.createElement('button', { id: 'hidden' }, 'Hidden'))),
    }));
    await h.focus();
    const close = h.doc.querySelector<HTMLElement>('[data-modal-initial-focus]')!;
    assert.equal(h.doc.activeElement, close);
    assert.equal(h.doc.body.style.overflow, 'hidden');
    assert.deepEqual(h.reads.map(node => node.id || node.textContent), ['Close', 'media', 'last', 'hidden'],
      'one complete initial scan, including hidden visibility validation; no redundant recovery scan');
    await h.key('Tab', true);
    assert.equal(h.doc.activeElement?.id, 'last');
    await h.key('Tab');
    assert.equal(h.doc.activeElement, close);
    await h.key('Escape');
    assert.equal(closed, 1);
  } finally { await h.close(); }
});

test('closeDisabled false to true to false preserves recovery, tab containment and Escape rules', async () => {
  const h = harness();
  let closed = 0;
  function Fixture({ busy, empty = false }: { busy: boolean; empty?: boolean }) {
    const { dialogRef, onDialogKeyDown } = useAccessibleModal({ closeDisabled: busy, onClose: () => closed++ });
    return React.createElement('div', { id: 'dialog', ref: dialogRef, role: 'dialog', tabIndex: -1, onKeyDown: onDialogKeyDown },
      React.createElement('button', { id: 'close', disabled: busy, 'data-modal-initial-focus': 'true' }, 'Close'),
      React.createElement('button', { id: 'submit', disabled: busy }, 'Submit'),
      React.createElement('button', { id: 'recovery', disabled: empty }, 'Details'),
      React.createElement('button', { id: 'last', disabled: empty }, 'Help'),
      React.createElement('div', { hidden: true }, React.createElement('button', { id: 'hidden' }, 'Hidden')));
  }
  try {
    await h.render(React.createElement(Fixture, { busy: false }));
    await h.focus();
    assert.equal(h.doc.activeElement?.id, 'close');
    h.doc.getElementById('submit')!.focus();
    h.reads.length = 0;
    await h.render(React.createElement(Fixture, { busy: true }));
    assert.deepEqual(h.reads.map(node => node.id), ['recovery', 'last', 'hidden']);
    assert.equal(h.doc.activeElement?.id, 'recovery', 'focus recovers from the now-disabled Submit control');
    await h.key('Escape');
    assert.equal(closed, 0);
    await h.key('Tab', true);
    assert.equal(h.doc.activeElement?.id, 'last');
    await h.key('Tab');
    assert.equal(h.doc.activeElement?.id, 'recovery');
    h.reads.length = 0;
    await h.render(React.createElement(Fixture, { busy: false }));
    assert.equal(h.reads.length, 0, 're-enabling Close does not need a recovery geometry scan');
    assert.equal(h.doc.activeElement?.id, 'recovery', 'enabling Close must not steal focus');
    await h.key('Escape');
    assert.equal(closed, 1);
    await h.render(React.createElement(Fixture, { busy: true, empty: true }));
    assert.equal(h.doc.activeElement?.id, 'dialog', 'no visible enabled control falls back to the dialog');
    await h.key('Tab');
    assert.equal(h.doc.activeElement?.id, 'dialog');
  } finally { await h.close(); }
});
