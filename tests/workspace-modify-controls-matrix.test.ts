import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { CoreSettingsBar } from '../frontend/components/CoreSettingsBar';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { videoDurationPolicy, videoInheritsSourceFraming } from '../frontend/lib/video-workflow-capabilities';
import { getModifySourceDefaults } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-modify-source-defaults';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
const source = { id:'phone',kind:'video',status:'ready',durationSec:4,width:1080,height:1920 } as ReferenceAsset;
const noop = () => {};
for (const engine of getBaseEnginesByCategory('video')) for (const mode of ['v2v','extend'] as const) {
  if (!engine.modes.includes(mode)) continue;
  test(`${engine.id}/${mode}: only real mode choices are interactive`, () => {
    const caps=engine.modeCaps?.[mode];
    const previous = Object.getOwnPropertyDescriptor(globalThis,'React');
    Object.defineProperty(globalThis,'React',{configurable:true,value:React});
    try {
      const dom=new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider,{locale:'en',dictionary:{},fallback:{},children:React.createElement(CoreSettingsBar,{
        engine,mode,caps,density:'workspace',durationSec:8,resolution:engine.resolutions[0],aspectRatio:'16:9',fps:30,
        onDurationChange:noop,onResolutionChange:noop,onAspectRatioChange:noop,onFpsChange:noop,showAudioControl:true,audioEnabled:true,onAudioChange:noop,
      })})));
      try {
        const buttons=[...dom.window.document.querySelectorAll('button')].map(button=>button.textContent??'');
        if(videoDurationPolicy(engine,mode)==='source_video') assert.equal(buttons.some(text=>/duration:/i.test(text)),false);
        if(videoInheritsSourceFraming(engine,mode)||!caps?.aspectRatio?.length) assert.equal(buttons.some(text=>/format:/i.test(text)),false);
        if(caps?.audioToggle!==true) assert.equal(buttons.some(text=>/audio:/i.test(text)),false);
        if(caps?.fps===undefined) assert.equal(buttons.some(text=>/Frame rate:/i.test(text)),false);
        if(caps?.resolutionLocked||caps?.resolution?.length===1) assert.equal(buttons.some(text=>/Resolution:/i.test(text)),false);
        if(caps?.duration&&'options'in caps.duration&&caps.duration.options.length===1) assert.equal(buttons.some(text=>/duration:/i.test(text)),false);
      } finally { dom.window.close(); }
      const defaults=getModifySourceDefaults(engine,mode,source);
      if(mode==='extend') assert.deepEqual(defaults,{},'extension length is independent of source length');
      if(videoDurationPolicy(engine,mode)==='source_video') assert.equal(defaults.durationSec,undefined);
      if(videoInheritsSourceFraming(engine,mode)) assert.equal(defaults.aspectRatio,undefined);
      if(defaults.aspectRatio) assert.ok(caps?.aspectRatio?.includes(defaults.aspectRatio));
      if(defaults.durationSec) assert.equal(defaults.durationSec,4);
      assert.equal(defaults.audio,undefined,'source audio is never fabricated from metadata');
    } finally { if(previous)Object.defineProperty(globalThis,'React',previous);else Reflect.deleteProperty(globalThis,'React'); }
  });
}
for(const id of ['wan-3','wan-3-prime'])test(`${id}: a four-second source defaults to four output seconds, retaining input charges`,()=>{
  const engine=getBaseEnginesByCategory('video').find(engine=>engine.id===id)!;
  const defaults=getModifySourceDefaults(engine,'v2v',source);
  const facts=buildPublicPricingFacts({engine,mode:'v2v',durationSec:defaults.durationSec!,resolution:'720p',inputVideoDurationSec:4,hasVideoInput:true});
  assert.equal(facts.base.seconds,4);
  assert.equal(facts.meta.input_video_duration_sec,4);
  assert.equal(facts.meta.billable_duration_sec,8);
  assert.equal(facts.facts.vendorSubtotalExactCents,id==='wan-3'?80:112);
});
test('unknown/unsupported input timing does not invent an accepted model duration',()=>{
  const engine=getBaseEnginesByCategory('video').find(engine=>engine.id==='wan-3')!;
  for(const durationSec of [0,NaN,Infinity,31])assert.equal(getModifySourceDefaults(engine,'v2v',{...source,durationSec}).durationSec,undefined);
  assert.equal(getModifySourceDefaults(engine,'v2v',{...source,durationSec:4.3}).durationSec,5);
  assert.equal(getModifySourceDefaults(engine,'v2v',{...source,width:700,height:900}).aspectRatio,'auto');
});
