import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { getImageEditorialPreset, imageEditorialPresetHref } from '../frontend/lib/image/editorial-presets';
import { listSeedreamEditorialImages } from '../frontend/lib/seedream-editorial-images';
import {isMiloRefineEntry,miloRefineWelcome} from '../frontend/src/lib/prompt-assistance/marketing-entry';
import frames from '../frontend/config/model-cinematic-start-frames.json';
import { useImageEditorialPreset } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageEditorialPreset';

test('approved examples retain exact prompts, native settings and successive original references', () => {
  const images = listSeedreamEditorialImages('seedream-5-5');
  for (const image of images) {
    const preset = getImageEditorialPreset(image.engineId, image.id)!;
    assert.equal(preset.snapshot.prompt, image.prompt);
    assert.equal(preset.snapshot.inputMode, image.settings.mode);
    assert.deepEqual(preset.snapshot.core, image.settings);
    const source = images.find(item => item.id === image.sourceImageId);
    assert.deepEqual(preset.snapshot.refs.imageUrls, source ? [`https://maxvideoai.com${source.original.url}`] : []);
    assert.equal(preset.quoteInput.referenceImageCount, source ? 1 : 0);
    assert.equal(preset.quoteInput.durationSec, 1);
    const href = new URL(imageEditorialPresetHref(image.engineId, image.id, 'fr'), 'https://maxvideoai.com');
    assert.equal(href.searchParams.get('example'), image.id);
    assert.equal(href.searchParams.get('lang'), 'fr');
    assert.equal(href.searchParams.has('prompt'), false);
  }
  for (const frame of frames) {
    const preset = getImageEditorialPreset(frame.sourceEngineId, frame.id)!;
    assert.equal(preset.snapshot.engineId, 'gpt-image-2-6-sunburst');
    assert.equal(preset.quoteInput.quality, 'max');
    assert.deepEqual(preset.quoteInput.customImageSize, {width: frame.original.width, height: frame.original.height});
    assert.equal(getImageEditorialPreset('seedance-2-5-flash', frame.id), null);
  }
  assert.equal(getImageEditorialPreset('seedream-5-5', 'https://attacker.example/image.jpg'), null);
  assert.equal(getImageEditorialPreset('unknown', images[0].id), null);
});

test('example handoff waits for the draft, applies once, clears consumed intent and respects restoration priority', async () => {
  const image = listSeedreamEditorialImages('seedream-5-5')[0];
  const href = imageEditorialPresetHref(image.engineId, image.id, 'en');
  const dom = new JSDOM('<div id="root"></div>', {url: `http://localhost:3116${href}`});
  const globals = {window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const previous = new Map(Object.keys(globals).map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const applied: unknown[] = [];
  const errors: string[] = [];
  const applySnapshot = (snapshot: unknown) => {applied.push(snapshot);};
  const onError = (message: string) => {errors.push(message);};
  function Fixture({hydrated,search = href.split('?')[1]}:{hydrated:boolean;search?:string}) {
    useImageEditorialPreset({storageHydrated:hydrated,searchParams:new URLSearchParams(search),availableEngineIds:[image.engineId],applySnapshot,onError,errorMessage:'Failed'});
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (hydrated:boolean,search?:string) => {
    await React.act(async () => root.render(React.createElement(Fixture,{hydrated,search})));
    await React.act(async () => { await new Promise(resolve=>setTimeout(resolve,80)); });
  };
  try {
    await render(false); assert.equal(applied.length,0);
    for(const key of ['job','tool','continueDraft']) {
      await render(true,href.split('?')[1]+`&${key}=existing`); assert.equal(applied.length,0);
    }
    await render(true);
    assert.equal(applied.length,1);
    assert.equal(new URL(dom.window.location.href).searchParams.has('example'),false);
    assert.equal(new URL(dom.window.location.href).searchParams.get('engine'),image.engineId);
    await render(true); assert.equal(applied.length,1);
    assert.deepEqual(errors,[]);
  } finally {
    await React.act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor] of previous) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});


test('Milo refinement is an explicit local welcome in the requested language',()=>{
  assert.equal(isMiloRefineEntry('?assistant=milo&refine=example'),true);
  assert.equal(isMiloRefineEntry('?assistant=milo'),false);
  assert.equal(isMiloRefineEntry('?assistant=other&refine=example'),false);
  assert.equal(miloRefineWelcome('en').question,'What would you like to change?');
  assert.equal(miloRefineWelcome('fr').question,'Que souhaites-tu modifier ?');
  assert.equal(miloRefineWelcome('es').question,'¿Qué quieres cambiar?');
});
