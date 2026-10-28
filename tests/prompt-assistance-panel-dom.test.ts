import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';

test('proposal action stays outside its disclosure; chat keyboard does not submit the containing generation form', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prompt-panel-'));
  const output = join(dir, 'panel.cjs');
  const compiled = await build({ entryPoints: ['frontend/components/composer/PromptAssistancePanel.client.tsx'], bundle: true, write: false, outfile: output, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json' });
  await writeFile(output, compiled.outputFiles.find(file => file.path.endsWith('.cjs'))!.contents);
  const require = createRequire(resolve('frontend/package.json'));
  // Resolve external React from this checkout, not the disposable directory.
  const Module = require('node:module');
  const mod = new Module(output); mod.filename = output; mod.paths = require.resolve.paths('react'); mod._compile(await import('node:fs/promises').then(fs => fs.readFile(output, 'utf8')), output);
  const Panel = mod.exports.PromptAssistancePanel;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  let sent = 0, applied = 0, generated = 0;
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client');
  const props = { locale: 'en', modelLabel: 'Selected model', messages: [], proposal: { text: 'Long prompt. '.repeat(400), target: 'prompt', stale: false }, message: 'Refine', pending: false, onMessageChange() {}, onSend() {sent++}, onProposalTextChange() {}, onApply() {applied++}, onCopy() {} };
  const root = createRoot(document.getElementById('root')!);
  const render = (extra = {}) => act(async () => root.render(React.createElement('form', { onSubmit: (event: Event) => {event.preventDefault(); generated++;} }, React.createElement(Panel, {...props,...extra}))));
  const click = (selector: string) => act(async () => (document.querySelector(selector) as HTMLButtonElement).click());
  try {
    await render();
    const apply = document.querySelector('[data-assistance-apply]') as HTMLButtonElement;
    assert.ok(apply); assert.equal(apply.disabled, false);
    assert.equal(document.querySelector('[data-assistance-editor]'), null);
    assert.equal(document.querySelector('[data-assistance-transcript]')!.contains(apply), false);
    await click('[data-assistance-apply]'); assert.equal(applied, 1);
    await click('[data-assistance-expand]');
    assert.equal((document.querySelector('[data-assistance-editor]') as HTMLTextAreaElement).value, props.proposal.text);
    assert.equal(document.querySelector('[data-assistance-body]')!.contains(apply), false);
    const message = document.querySelector('[data-assistance-message]') as HTMLTextAreaElement;
    for (const options of [{shiftKey:true}, {isComposing:true}, {keyCode:229}]) await act(async () => { message.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true,...options})); });
    assert.equal(sent, 0);
    await act(async () => {message.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});
    assert.equal(sent, 1); assert.equal(generated, 0);
    await render({ proposal: {...props.proposal, stale:true} });
    assert.equal((document.querySelector('[data-assistance-apply]') as HTMLButtonElement).disabled,true);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key,descriptor] of saved) if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key);
    await rm(dir,{recursive:true,force:true});
  }
});
