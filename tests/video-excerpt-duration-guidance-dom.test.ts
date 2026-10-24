import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {VideoExcerptSelector} from './components/media/VideoExcerptSelector.client';
import {VideoExcerptControl} from './components/media/VideoExcerptControl.client';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {resolveVideoOperationEngine} from './lib/video-operation';
import {getMediaExcerptLimits} from './lib/video-excerpt';
import {useComposerVideoSourceWorkflow} from './components/composer/useComposerVideoSourceWorkflow';
function Probe({engine,asset}){window.guidance=useComposerVideoSourceWorkflow({engine,assets:{video_url:[asset]},activeManualMode:'v2v',workspaceDensity:true,locale:window.locale,onPrepareVideoExcerpt:async()=>{}});return null;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>{
 const engine=resolveVideoOperationEngine(getBaseEngineIncludingHidden('minimax-h3-max'),'v2v',window.operation);
 const field=engine.inputSchema.required.find(field=>field.id==='video_url');
 const asset={id:'source',assetId:'owned',kind:'video',name:'source.mp4',type:'video/mp4',size:1,status:'ready',url:'https://example.invalid/source',previewUrl:'https://example.invalid/source',durationSec:window.duration,...window.asset};
 root.render(<><Probe engine={engine} asset={asset}/>{window.control?<VideoExcerptControl engine={engine} field={field} index={0} asset={asset} mode='v2v' locale={window.locale} onPrepareVideoExcerpt={async()=>window.applied++}/>:<VideoExcerptSelector operation={window.operation} previewUrl={asset.previewUrl} durationSec={window.duration} limits={getMediaExcerptLimits(engine,'v2v','video_url')} locale={window.locale} onApply={async()=>window.applied++} onCancel={()=>window.cancelled++}/>}</>);
},unmount:()=>root.unmount()};`, {});

async function mount(locale = 'en', control = false) {
  const dom = createClientFlowDom('/app'); const w = dom.window as any;
  Object.assign(w, { locale, control, duration: 4, operation: 'h3-recast', applied: 0, cancelled: 0 });
  w.HTMLMediaElement.prototype.pause = function () {}; w.HTMLMediaElement.prototype.load = function () {};
  w.eval(await bundle); await w.fx.act(async () => w.fx.render());
  return { w, async dispose() { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

for (const [locale, guidance] of [['en', /at least 5 s|5 s minimum/], ['fr', /au moins 5 s|minimum de 5 s/], ['es', /al menos 5 s|mínimo de 5 s/]] as const) {
  test(`${locale}: a source below Recast minimum explains replacement rather than an impossible selection`, async () => {
    const f = await mount(locale);
    try {
      const alert = f.w.document.querySelector('[role=alert]');
      assert.match(alert.textContent, guidance);
      assert.match(f.w.guidance.extensionNotice, guidance, 'price guidance must explain the same unmet source minimum');
      const apply = f.w.document.querySelector('.video-excerpt-actions button:last-child');
      assert.equal(apply.disabled, true);
      await f.w.fx.act(async () => apply.click());
      assert.equal(f.w.applied, 0);
    } finally { await f.dispose(); }
  });
}

test('too-short source has no dead-end section control; another operation or a longer original can still prepare', async () => {
  const f = await mount('en', true);
  try {
    assert.equal(Boolean(f.w.document.querySelector('.video-excerpt-trigger')), false);
    await f.w.fx.act(async () => { f.w.operation = 'h3-relight'; f.w.fx.render(); });
    assert.ok(f.w.document.querySelector('.video-excerpt-trigger'), '4s can prepare a valid Relight copy');
    await f.w.fx.act(async () => {
      f.w.operation = 'h3-recast';
      f.w.asset = { excerptSource: { durationSec: 10, previewUrl: 'https://example.invalid/original' } };
      f.w.fx.render();
    });
    assert.ok(f.w.document.querySelector('.video-excerpt-trigger'), 'a short previous cut can be extended within its longer original');
  } finally { await f.dispose(); }
});

test('valid source with an invalid short selection explains how to expand the selection', async () => {
  const f = await mount();
  try {
    // Remount the selector to initialize from the new source.
    await f.w.fx.act(async () => { f.w.control = true; f.w.fx.render(); });
    await f.w.fx.act(async () => { f.w.duration = 10; f.w.control = false; f.w.fx.render(); });
    const input = f.w.document.querySelector('[aria-label="End (seconds)"]');
    await f.w.fx.act(async () => {
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(input, '4');
      input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    });
    assert.match(f.w.document.querySelector('[role=alert]').textContent, /section.*at least 5 s|at least 5 s.*section/);
    assert.equal(f.w.document.querySelector('.video-excerpt-actions button:last-child').disabled, true);
  } finally { await f.dispose(); }
});
