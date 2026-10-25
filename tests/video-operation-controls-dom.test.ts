import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoOperationSelector } from '../frontend/app/(core)/(workspace)/app/_components/VideoOperationSelector';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { parseStoredForm } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';

test('Kling references and Modify use the main workflow navigation, without a second cross-workflow selector', async () => {
 const dom = new JSDOM('<div id="root"></div>');
 const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
 const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
 const engine = getFalEngineById('kling-o3-standard')!.engine;
 let form = { ...coerceFormState(engine, 'v2v', null), durationSec: 9, aspectRatio: '9:16', extraInputValues: { keep_audio: false, rememberedOtherSetting: 'preserved' } };
 function Fixture() {
  const [current, setCurrent] = React.useState(form);
  form = current;
  return React.createElement(VideoOperationSelector, { engine, locale: 'fr', mode: 'v2v', form: current, setForm: setCurrent });
 }
 const root = createRoot(dom.window.document.getElementById('root')!);
 try {
  await act(async () => root.render(React.createElement(Fixture)));
  assert.equal(Boolean(dom.window.document.querySelector('select')), false);
  assert.equal(form.operation, undefined, 'Legacy omitted Reference identity stays unchanged');
  assert.equal(engine.operationCaps?.['kling-reference']?.defaultForMode, true);
  for (const operation of ['kling-edit', 'kling-reference'] as const) {
   form = { ...form, operation };
   await act(async () => root.render(React.createElement(VideoOperationSelector, {
    engine, locale: 'fr', mode: 'v2v', form, setForm: () => { throw new Error('Rendering must not change saved inputs'); },
   })));
   assert.equal(Boolean(dom.window.document.querySelector('select')), false);
   assert.equal(parseStoredForm(JSON.stringify(form))?.operation, operation);
   const effective = resolveVideoOperationEngine(engine, 'v2v', operation);
   const quote = buildWorkspacePreflightRequest({ form, selectedEngine: effective, submissionMode: 'v2v', effectiveDurationSec: 9,
    supportsAudioToggle: false, voiceControlEnabled: false, inputAssets: {}, memberTier: 'Member' });
   assert.equal(quote.operation, operation);
   if (operation === 'kling-edit') {
    assert.equal(quote.aspectRatio, undefined);
    assert.deepEqual(quote.extraInputValues, { keep_audio: false });
   }
   assert.equal(form.durationSec, 9);
   assert.equal(form.aspectRatio, '9:16');
   assert.equal(form.extraInputValues.rememberedOtherSetting, 'preserved');
  }
 } finally {
  await act(async () => root.unmount()); dom.window.close();
  for (const [key,descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
 }
});


test('only meaningful choices inside one workflow expose an operation selector', async () => {
 const dom = new JSDOM('<div id="root"></div>');
 const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
 const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
 const root = createRoot(dom.window.document.getElementById('root')!);
 try {
  for (const [engineId, mode] of [['kling-o3-pro', 'v2v'], ['kling-o3-4k', 'v2v'], ['flux-3','v2v'], ['flux-3-draft','v2v'], ['flux-3','ref2v'], ['luma-ray-3-2','extend'], ['ltx-2-3','reframe']] as const) {
   const engine = getFalEngineById(engineId)!.engine;
   const form = coerceFormState(engine, mode, null);
   await act(async () => root.render(React.createElement(VideoOperationSelector, { engine, mode, form, setForm: () => {} })));
   assert.equal(Boolean(dom.window.document.querySelector('select')), false, engineId + '/' + mode);
  }
  const engine = getFalEngineById('minimax-h3-max')!.engine;
  let form = { ...coerceFormState(engine, 'v2v', null), operation: 'h3-recast' as const };
  function Fixture() {
   const [current, setCurrent] = React.useState(form);
   form = current;
   return React.createElement(VideoOperationSelector, { engine, locale: 'fr', mode: 'v2v', form: current, setForm: setCurrent });
  }
  await act(async () => root.render(React.createElement(Fixture)));
  const select = dom.window.document.querySelector('select')!;
  assert.deepEqual(Array.from(select.options).map(option => option.value), ['h3-recast','h3-relight']);
  assert.equal(select.getAttribute('aria-label'), 'Que souhaitez-vous changer ?');
  await act(async () => { select.value='h3-relight'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(form.operation, 'h3-relight');
  assert.match(dom.window.document.body.textContent!, /sphère d’éclairage/);
 } finally {
  await act(async () => root.unmount()); dom.window.close();
  for (const [key,descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
 }
});
