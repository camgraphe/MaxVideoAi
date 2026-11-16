import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { copyTextToClipboard } from '../frontend/lib/clipboard';

test('clipboard fallback selects inside the active dialog and restores the trigger focus', async () => {
  const dom = new JSDOM('<dialog open><button>Copy prompt</button></dialog>');
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    navigator: { clipboard: { writeText: async () => { throw new Error('Clipboard API blocked'); } } } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const button = dom.window.document.querySelector('button')!;
  let copied = '';
  Object.defineProperty(dom.window.document, 'execCommand', { value: (command: string) => {
    const selected = dom.window.document.activeElement as HTMLTextAreaElement;
    assert.equal(command, 'copy');
    assert.equal(selected.closest('dialog')?.open, true);
    copied = selected.value.slice(selected.selectionStart, selected.selectionEnd);
    return true;
  } });
  try {
    button.focus();
    assert.equal(await copyTextToClipboard('A cinematic scene.'), true);
    assert.equal(copied, 'A cinematic scene.');
    assert.equal(dom.window.document.activeElement, button);
    assert.equal(dom.window.document.querySelector('textarea'), null);
  } finally {
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
