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

test('actual Modify selector preserves Reference settings and changes the quote identity', async () => {
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
  const select = dom.window.document.querySelector('select')!;
  assert.equal(select.value, 'kling-reference');
  assert.equal(select.getAttribute('aria-label'), 'Traitement vidéo');
  assert.equal(select.options[0].textContent, 'Référence');
  assert.equal(engine.operationCaps?.['kling-reference']?.defaultForMode, true);
  await act(async () => { select.value = 'kling-edit'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(form.operation, 'kling-edit'); assert.equal(form.durationSec, 9); assert.equal(form.aspectRatio, '9:16');
  assert.equal(form.extraInputValues.rememberedOtherSetting, 'preserved');
  assert.equal(parseStoredForm(JSON.stringify(form))?.operation, 'kling-edit');
  const effective = resolveVideoOperationEngine(engine, 'v2v', form.operation);
  const quote = buildWorkspacePreflightRequest({ form, selectedEngine: effective, submissionMode: 'v2v', effectiveDurationSec: 9,
   supportsAudioToggle: false, voiceControlEnabled: false, inputAssets: {}, memberTier: 'Member' });
  assert.equal(quote.operation, 'kling-edit'); assert.equal(quote.aspectRatio, undefined);
  assert.deepEqual(quote.extraInputValues, { keep_audio: false });
  await act(async () => { select.value = 'kling-reference'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(form.operation, 'kling-reference'); assert.equal(form.durationSec, 9); assert.equal(form.aspectRatio, '9:16');
 } finally {
  await act(async () => root.unmount()); dom.window.close();
  for (const [key,descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
 }
});
