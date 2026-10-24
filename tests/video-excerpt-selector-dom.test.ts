import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(
  `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {VideoExcerptSelector} from './components/media/VideoExcerptSelector.client';import {requestVideoExcerpt} from './lib/client-video-excerpt';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<VideoExcerptSelector operation={window.operation} previewUrl={window.previewUrl||"https://example.invalid/signed"} durationSec={window.duration} limits={{sourceFieldId:'video_url',minDurationSec:window.operation==='h3-relight'?56/24:null,maxDurationSec:['h3-relight','flux-fast-edit'].includes(window.operation)?15:18,maxSizeMB:100,durationPolicy:'source_video'}} locale={window.locale} onCancel={()=>window.cancelled++} onApply={async range=>{window.applied.push(range);if(window.failure)throw new Error('Failed to prepare');if(window.request)await requestVideoExcerpt({source:{type:'asset',assetId:'owned',kind:'video'},engineId:'luma-ray-3-2',mode:'v2v',range},window.request);}}/>),unmount:()=>root.unmount()};`,
  {}
);
async function mount(duration = 5.558333, locale = 'en') {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  Object.assign(w, { duration, locale, cancelled: 0, applied: [] });
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  return {
    w,
    async input(label: string, value: string) {
      const input = w.document.querySelector(`[aria-label="${label}"]`);
      await w.fx.act(async () => {
        Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new w.Event('input', { bubbles: true }));
      });
    },
    async click(text: string) {
      const button = [...w.document.querySelectorAll('button')].find(
        (e: any) => e.textContent === text
      ) as any;
      await w.fx.act(async () => button.click());
    },
    async dispose() {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}
test('selector retains exact fractional full range, uses lazy manual playback and exposes one dual-handle track', async () => {
  const f = await mount();
  try {
    const d = f.w.document;
    assert.equal(d.querySelector('[aria-label="End (seconds)"]').value, '5.558333');
    assert.equal(d.querySelector('video').preload, 'none');
    assert.equal(d.querySelector('video').autoplay, false);
    assert.equal(d.querySelectorAll('input[type=range]').length, 0);
    assert.equal(d.querySelectorAll('.video-excerpt-track').length, 1);
    assert.equal(d.querySelectorAll('.video-excerpt-handle[role=slider]').length, 2);
    await f.click('Use excerpt');
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.applied)), [{ startSec: 0, endSec: 5.558333 }]);
  } finally {
    await f.dispose();
  }
});
test('long source has no silent cut, exact numeric editing applies chosen range and invalid ranges stay blocked', async () => {
  const f = await mount(60);
  try {
    let apply = [...f.w.document.querySelectorAll('button')].find(
      (e: any) => e.textContent === 'Use excerpt'
    ) as any;
    assert.equal(apply.disabled, true);
    await f.input('Start (seconds)', '20.125');
    await f.input('End (seconds)', '38.125');
    assert.equal(apply.disabled, false);
    await f.click('Use excerpt');
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.applied)), [{ startSec: 20.125, endSec: 38.125 }]);
    await f.input('End (seconds)', '60.1');
    assert.equal(apply.disabled, true);
    await f.click('Cancel');
    assert.equal(f.w.cancelled, 1);
  } finally {
    await f.dispose();
  }
});
test('prepare failure is readable and Escape cancels through accessible modal', async () => {
  const f = await mount(5, 'fr');
  try {
    f.w.failure = true;
    await f.click('Utiliser cet extrait');
    assert.match(
      f.w.document.querySelector('[role=alert]').textContent,
      /Impossible de préparer cet extrait/
    );
    await f.w.fx.act(async () =>
      f.w.document
        .querySelector('[role=dialog]')
        .dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    assert.equal(f.w.cancelled, 1);
  } finally {
    await f.dispose();
  }
});

const importBundle = bundleClientFlow(
  `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {AssetDropzone} from './components/AssetDropzone';import {getBaseEngineIncludingHidden} from './src/lib/engines';import {I18nProvider} from './lib/i18n/I18nProvider';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><AssetDropzone engine={getBaseEngineIncludingHidden('luma-ray-3-2')} field={{id:'video_url',type:'video',maxCount:1,maxDurationSec:18}} required assets={[]} allowVideoExcerptImport={window.allowExcerpt} onSelect={(...args)=>window.selected.push(args)} onError={m=>window.errors.push(m)} /></I18nProvider>),unmount:()=>root.unmount()};`,
  {}
);
test('real dropzone accepts long source for excerpt workflow only and keeps preparation and byte bounds', async () => {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  Object.assign(w, { allowExcerpt: false, duration: 60, selected: [], errors: [] });
  w.URL.createObjectURL = () => 'blob:video';
  w.URL.revokeObjectURL = () => {};
  w.HTMLMediaElement.prototype.load = function () {};
  Object.defineProperty(w.HTMLMediaElement.prototype, 'duration', { get: () => w.duration });
  Object.defineProperty(w.HTMLMediaElement.prototype, 'src', {
    set() {
      queueMicrotask(() => this.onloadedmetadata?.());
    },
  });
  w.eval(await importBundle);
  const choose = async (size = 100) => {
    await w.fx.act(async () => {
      const input = w.document.querySelector('input[type=file]');
      const file = new w.File([new Uint8Array(Math.min(size, 100))], 'source.mp4', { type: 'video/mp4' });
      Object.defineProperty(file, 'size', { value: size });
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
    });
  };
  try {
    await w.fx.act(async () => w.fx.render());
    await choose();
    assert.equal(w.selected.length, 0);
    assert.equal(w.errors.length, 1);
    w.allowExcerpt = true;
    await w.fx.act(async () => w.fx.render());
    await choose();
    assert.equal(w.selected.length, 1);
    assert.equal(w.selected[0][3].durationSec, 60);
    w.duration = 181;
    await choose();
    assert.equal(w.selected.length, 1);
    w.duration = 60;
    await choose(1024 * 1024 * 1024);
    assert.equal(w.selected.length, 1);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

const composerBundle = bundleClientFlow(
  `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {Composer} from './components/Composer';import {getBaseEngineIncludingHidden} from './src/lib/engines';import {I18nProvider} from './lib/i18n/I18nProvider';const root=createRoot(document.getElementById('root'));const engine=getBaseEngineIncludingHidden('luma-ray-3-2');window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><Composer density={window.density} engine={engine} activeManualMode="v2v" prompt="Edit" onPromptChange={()=>{}} promptRequired price={1.25} currency="USD" isLoading={false} assetFields={[{field:{id:'video_url',type:'video',maxCount:1},required:true}]} assets={{video_url:Array.from({length:window.sourceCount??1},(_,index)=>({id:'original'+index,assetId:'owned'+index,kind:'video',name:'source'+index+'.mp4',size:1,type:'video/mp4',status:'ready',url:'https://example.invalid/original'+index,previewUrl:'https://example.invalid/signed'+index,durationSec:5.558333}))}} onGenerate={()=>window.generated++} onPrepareVideoExcerpt={async()=>{window.applied++;}} onVideoExcerptEditorChange={(_field,_index,open)=>open?window.sourcePreview:undefined} /></I18nProvider>),unmount:()=>root.unmount()};`,
  {}
);
for (const density of ['workspace', 'default'])
  test(`${density}: real Composer masks price and Generate throughout selector and restores on cancel`, async () => {
    const dom = createClientFlowDom('/app');
    const w = dom.window as any;
    Object.assign(w, { density, generated: 0, applied: 0 });
    w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
    w.eval(await composerBundle);
    const buttons = () => [...w.document.querySelectorAll('button')] as any[];
    try {
      await w.fx.act(async () => w.fx.render());
      const generate = () => buttons().find((button) => button.textContent.includes('Modify video'));
      assert.equal(generate().disabled, false);
      assert.match(generate().textContent, /1\.25/);
      await w.fx.act(async () =>
        buttons()
          .find((button) => button.textContent === 'Choose start and end')
          .click()
      );
      assert.equal(generate().disabled, true);
      assert.doesNotMatch(generate().textContent, /1\.25/);
      assert.equal(w.applied, 0);
      await w.fx.act(async () =>
        buttons()
          .find((button) => button.textContent === 'Cancel')
          .click()
      );
      assert.equal(generate().disabled, false);
      assert.match(generate().textContent, /1\.25/);
      assert.equal(w.generated, 0);
      assert.equal(w.applied, 0);
    } finally {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    }
  });

test('every selected source retains an excerpt action beyond the compact summary limit', async () => {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  Object.assign(w, { density: 'workspace', sourceCount: 4, generated: 0, applied: 0 });
  w.eval(await composerBundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(
      [...w.document.querySelectorAll('button')].filter(
        (button: any) => button.textContent === 'Choose start and end'
      ).length,
      4
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('initial oversized source can play manually and loop finite in-source selection while Apply remains blocked', async () => {
  const f = await mount(60);
  try {
    const video = f.w.document.querySelector('video');
    let pauses = 0;
    video.pause = () => pauses++;
    Object.defineProperty(video, 'paused', { get: () => false });
    await f.w.fx.act(async () => video.dispatchEvent(new f.w.Event('play', { bubbles: true })));
    assert.equal(pauses, 0, 'full source preview must not require a model-valid excerpt first');
    assert.equal(
      [...f.w.document.querySelectorAll('button')].find((b: any) => b.textContent === 'Use excerpt').disabled,
      true
    );
    await f.input('Start (seconds)', '20');
    await f.input('End (seconds)', '50');
    video.currentTime = 50;
    await f.w.fx.act(async () => video.dispatchEvent(new f.w.Event('timeupdate', { bubbles: true })));
    assert.equal(video.currentTime, 20, 'an oversized finite in-source interval may still preview and loop');
    await f.input('End (seconds)', '61');
    video.currentTime = 45;
    const before = pauses;
    await f.w.fx.act(async () => video.dispatchEvent(new f.w.Event('play', { bubbles: true })));
    assert.equal(pauses, before, 'invalid handles must still permit manual full-source preview');
    assert.equal(video.currentTime, 45);
    assert.equal(f.w.applied.length, 0);
  } finally {
    await f.dispose();
  }
});
for (const [locale, apply, expected] of [
  [
    'en',
    'Use excerpt',
    {
      generic: /Unable to prepare/,
      network: /connection/,
      malformed: /verified/,
      budget: /100 MiB.*180.*60/,
      range: /valid start and end/,
    },
  ],
  [
    'fr',
    'Utiliser cet extrait',
    {
      generic: /Impossible de préparer/,
      network: /connexion/,
      malformed: /vérifié/,
      budget: /100 Mio.*180.*60/,
      range: /début et une fin valides/,
    },
  ],
  [
    'es',
    'Usar fragmento',
    {
      generic: /No se pudo preparar/,
      network: /conexión/,
      malformed: /verificar/,
      budget: /100 MiB.*180.*60/,
      range: /inicio y un final válidos/,
    },
  ],
] as const)
  for (const kind of ['generic', 'network', 'malformed', 'budget', 'range'] as const)
    test(`${locale}: actual ${kind} request failure is localized without raw exception text`, async () => {
      const f = await mount(5, locale);
      try {
        f.w.request = async () => {
          if (kind === 'network') throw new TypeError('RAW network details');
          if (kind === 'malformed')
            return {
              ok: true,
              status: 200,
              json: async () => ({ ok: true, asset: { id: 'wrong', url: 'https://example.invalid/wrong' } }),
            };
          return {
            ok: false,
            status: 422,
            json: async () => ({
              ok: false,
              error: {
                code:
                  kind === 'budget'
                    ? 'PREPARATION_LIMIT'
                    : kind === 'range'
                      ? 'PARAMETER_INVALID'
                      : 'FUTURE_ERROR',
                message: 'RAW server details',
              },
            }),
          };
        };
        await f.click(apply);
        const message = f.w.document.querySelector('[role=alert]').textContent;
        assert.match(message, expected[kind]);
        assert.doesNotMatch(message, /RAW|FUTURE_ERROR|Failed to prepare/);
      } finally {
        await f.dispose();
      }
    });


test('shared Composer waits for owned full-timeline access and never plays the gallery preview', async()=>{
 const dom=createClientFlowDom('/app'),w=dom.window as any;
 let resolve!: (url:string)=>void;
 w.sourcePreview=new Promise<string>(done=>{resolve=done;});
 Object.assign(w,{density:'workspace',generated:0,applied:0});
 w.HTMLMediaElement.prototype.pause=function(){};
 w.eval(await composerBundle);
 try{
  await w.fx.act(async()=>w.fx.render());
  const choose=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Choose start and end') as any;
  await w.fx.act(async()=>choose.click());
  assert.equal(w.document.querySelector('[role=dialog] video'),null);
  assert.match(w.document.querySelector('[role=dialog]').textContent,/Opening original/);
  await w.fx.act(async()=>resolve('https://example.invalid/full-original?access=fresh'));
  assert.equal(w.document.querySelector('[role=dialog] video').src,'https://example.invalid/full-original?access=fresh');
  assert.equal(w.document.querySelector('[role=dialog] video').preload,'none');
  assert.equal(w.document.querySelector('[role=dialog] video').autoplay,false);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});


test('timeline keyboard handles cannot cross, moves preserve length, zoom never changes range and reset is exact', async () => {
  const f = await mount(60.558333);
  const d = f.w.document;
  const key = async (selector: string, value: string, shiftKey = false) => f.w.fx.act(async () =>
    d.querySelector(selector).dispatchEvent(new f.w.KeyboardEvent('keydown', {key:value,shiftKey,bubbles:true})));
  const value = (label: string) => Number(d.querySelector(`[aria-label="${label} (seconds)"]`).value);
  try {
    await f.input('Start (seconds)', '20');
    await f.input('End (seconds)', '25');
    await key('.video-excerpt-handle-start', 'ArrowRight');
    assert.equal(value('Start'), 20.1);
    await key('.video-excerpt-handle-start', 'End');
    assert.ok(value('Start') < value('End'));
    assert.equal(Number(d.querySelector('.video-excerpt-handle-end').getAttribute('aria-valuemin')), value('Start') + .01);
    await f.input('Start (seconds)', '20');
    await key('.video-excerpt-selection', 'ArrowRight', true);
    assert.equal(value('Start'), 21);
    assert.equal(value('End'), 26);
    await f.click('Zoom to excerpt');
    assert.equal(d.querySelector('[aria-label="Full view"]').getAttribute('aria-pressed'), 'true');
    assert.equal(value('Start'), 21);
    assert.equal(value('End'), 26);
    await f.click('Whole video');
    assert.equal(value('Start'), 0);
    assert.equal(value('End'), 60.558333);
    assert.equal(d.querySelector('[aria-label="Zoom to excerpt"]').getAttribute('aria-pressed'), 'false');
    assert.equal([...d.querySelectorAll('button')].find((b:any)=>b.textContent==='Use excerpt').disabled,true);
    await key('.video-excerpt-handle-end', 'ArrowLeft', true);
    await key('.video-excerpt-handle-end', 'End');
    assert.equal(value('End'), 60.558333);
  } finally { await f.dispose(); }
});

test('pointer resize, selected-body movement and time-ruler seeking use the same bounded timeline', async () => {
  const f = await mount(60);
  const d = f.w.document;
  const pointer = async (node: any, type: string, x: number, pointerType = 'touch') => f.w.fx.act(async () => {
    const event = new f.w.Event(type, {bubbles:true,cancelable:true});
    Object.assign(event,{clientX:x,pointerId:1,pointerType,button:0});node.dispatchEvent(event);
  });
  try {
    const track = d.querySelector('.video-excerpt-track');
    track.getBoundingClientRect = () => ({left:0,width:600});
    const handle = d.querySelector('.video-excerpt-handle-start');
    await pointer(handle,'pointerdown',0);
    await pointer(handle,'pointermove',100);
    await pointer(handle,'pointerup',100);
    assert.equal(d.querySelector('[aria-label="Start (seconds)"]').value,'10');
    await f.input('End (seconds)', '20');
    const selected=d.querySelector('.video-excerpt-selection');
    await pointer(selected,'pointerdown',150,'mouse');
    await pointer(selected,'pointermove',300,'mouse');
    await pointer(selected,'pointerup',300,'mouse');
    assert.equal(d.querySelector('[aria-label="Start (seconds)"]').value,'25');
    assert.equal(d.querySelector('[aria-label="End (seconds)"]').value,'35');
    await pointer(d.querySelector('.video-excerpt-seek'),'pointerdown',400);
    assert.equal(d.querySelector('video').currentTime,40);
    assert.equal(f.w.applied.length,0);
  } finally { await f.dispose(); }
});

test('filmstrip is optional: one decoder only after preview intent and cancellation releases it', async () => {
  const f=await mount(60), d=f.w.document;
  const original=d.createElement.bind(d), decoders:any[]=[];
  d.createElement=(tag:string,...args:any[])=>{const node=original(tag,...args);if(tag==='video'){decoders.push(node);node.load=()=>{};node.pause=()=>{};}return node;};
  try {
    assert.equal(decoders.length,0);
    await f.w.fx.act(async()=>d.querySelector('video').dispatchEvent(new f.w.Event('play',{bubbles:true})));
    assert.equal(decoders.length,1);
    const decoder=decoders[0];
    assert.equal(decoder.crossOrigin,'anonymous');
    assert.equal(d.querySelector('video').hasAttribute('crossorigin'),false);
    await f.w.fx.act(async()=>decoder.dispatchEvent(new f.w.Event('error')));
    assert.equal(d.querySelectorAll('.video-excerpt-frames img').length,0);
    assert.equal(d.querySelectorAll('.video-excerpt-handle').length,2);
    assert.equal(decoder.hasAttribute('src'),false);
    await f.w.fx.act(async()=>d.querySelector('video').dispatchEvent(new f.w.Event('play',{bubbles:true})));
    assert.equal(decoders.length,1,'failed optional capture is not retried per play');
  } finally { await f.dispose(); }
});


test('pending filmstrip decoder is cancelled on source change and unmount without publishing old frames', async () => {
 const f=await mount(60),d=f.w.document,original=d.createElement.bind(d),decoders:any[]=[];
 d.createElement=(tag:string,...args:any[])=>{const node=original(tag,...args);if(tag==='video'){decoders.push(node);node.load=()=>{};node.pause=()=>{};}return node;};
 try{
  await f.w.fx.act(async()=>d.querySelector('video').dispatchEvent(new f.w.Event('play',{bubbles:true})));
  assert.equal(decoders.length,1);assert.ok(decoders[0].hasAttribute('src'));
  f.w.previewUrl='https://example.invalid/replacement';
  await f.w.fx.act(async()=>f.w.fx.render());
  assert.equal(decoders.length,2);assert.equal(decoders[0].hasAttribute('src'),false);
  assert.equal(d.querySelectorAll('.video-excerpt-frames img').length,0);
  await f.w.fx.act(async()=>f.w.fx.unmount());
  assert.equal(decoders[1].hasAttribute('src'),false);
 }finally{await f.dispose();}
});

test('unavailable canvas leaves functional handles after an explicitly activated capture', async () => {
 const f=await mount(60),d=f.w.document,original=d.createElement.bind(d),decoders:any[]=[];
 d.createElement=(tag:string,...args:any[])=>{const node=original(tag,...args);if(tag==='video'){decoders.push(node);node.load=()=>{};node.pause=()=>{};Object.defineProperty(node,'videoWidth',{value:160});Object.defineProperty(node,'videoHeight',{value:90});}if(tag==='canvas')node.getContext=()=>null;return node;};
 try{
  await f.w.fx.act(async()=>d.querySelector('video').dispatchEvent(new f.w.Event('play',{bubbles:true})));
  await f.w.fx.act(async()=>decoders[0].dispatchEvent(new f.w.Event('loadeddata')));
  assert.equal(decoders[0].hasAttribute('src'),false);
  assert.equal(d.querySelectorAll('.video-excerpt-frames img').length,0);
  await f.input('Start (seconds)','20');await f.input('End (seconds)','25');
  assert.equal([...d.querySelectorAll('button')].find((b:any)=>b.textContent==='Use excerpt').disabled,false);
 }finally{await f.dispose();}
});

test('moving a precise typed interval preserves its true width across an integer duration boundary', async () => {
 const f=await mount(60),d=f.w.document;
 try {
  await f.input('Start (seconds)','1.0000001');await f.input('End (seconds)','7.0000002');
  const width=7.0000002-1.0000001;
  await f.w.fx.act(async()=>d.querySelector('.video-excerpt-selection').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));
  const start=Number(d.querySelector('[aria-label="Start (seconds)"]').value),end=Number(d.querySelector('[aria-label="End (seconds)"]').value);
  assert.ok(end-start>6,'movement must not cross the integer pricing boundary by rounding width');
  assert.ok(Math.abs(end-start-width)<1e-12);
  assert.ok(Math.abs(start-2.0000001)<1e-12,'keyboard movement quantizes the delta, retaining the typed offset');
  await f.w.fx.act(async()=>d.querySelector('.video-excerpt-selection').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Home',bubbles:true})));
  assert.equal(d.querySelector('[aria-label="Start (seconds)"]').value,'0','Home uses the exact bound even with a typed fractional offset');
  await f.w.fx.act(async()=>d.querySelector('.video-excerpt-selection').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'End',bubbles:true})));
  assert.equal(d.querySelector('[aria-label="End (seconds)"]').value,'60');
 } finally {await f.dispose();}
});

test('preview timecode carries rounded centiseconds into the next minute', async () => {
 const f=await mount(60);
 try {await f.input('Start (seconds)','59.999');assert.equal(f.w.document.querySelector('.video-excerpt-time strong').textContent,'01:00.00');}
 finally {await f.dispose();}
});

for (const pointerType of ['mouse', 'touch'])
 test(`${pointerType}: off-center handle grabs resize by pointer delta and retain exact bounds`, async () => {
  const f=await mount(60.558333),d=f.w.document;
  const value=(which:string)=>Number(d.querySelector(`[aria-label="${which} (seconds)"]`).value);
  const drag=async(which:string,from:number,to:number)=>{
   const node=d.querySelector(`.video-excerpt-handle-${which}`);
   for(const [type,x] of [['pointerdown',from],['pointermove',to],['pointerup',to]] as const){
    await f.w.fx.act(async()=>{const event=new f.w.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{clientX:x,pointerId:7,pointerType,button:0});node.dispatchEvent(event);});
   }
  };
  try {
   d.querySelector('.video-excerpt-track').getBoundingClientRect=()=>({left:0,width:600});
   await f.input('Start (seconds)','20');await f.input('End (seconds)','40');
   // Both grabs are15px left of their bounds; a1px movement changes only~0.1s.
   await drag('start',20/60.558333*600-15,20/60.558333*600-14);
   assert.equal(value('Start'),20.1);
   await drag('end',40/60.558333*600-15,40/60.558333*600-14);
   assert.equal(value('End'),40.1);
   await drag('start',20.1/60.558333*600-15,5000);
   assert.equal(value('Start'),40.09,'start cannot cross end');
   await drag('end',40.1/60.558333*600+15,-5000);
   assert.equal(value('End'),40.1,'end cannot cross start');
   await drag('start',40.09/60.558333*600-15,-5000);
   assert.equal(value('Start'),0);
   await drag('end',40.1/60.558333*600+15,5000);
   assert.equal(value('End'),60.558333,'source-end clamp retains the exact fraction');
   await drag('start',-15,-14);
   assert.equal(value('Start'),.1,'an outer source-edge grab still tracks the raw pixel delta');
   await drag('end',615,614);
   assert.equal(value('End'),60.46,'an outer end-edge grab still tracks the raw pixel delta');
   await drag('start',-14,-5000);await drag('end',614,5000);
   assert.equal(value('Start'),0);assert.equal(value('End'),60.558333);
   assert.equal(f.w.applied.length,0);
  } finally {await f.dispose();}
 });


test('Relight discloses chosen/actual timing and ending removal before Apply; FAST rejects a 15 second selection',async()=>{
 const f=await mount(5.56);
 try{
  await f.w.fx.act(async()=>{f.w.operation='h3-relight';f.w.fx.render();});
  const disclosure=f.w.document.querySelector('[data-testid="video-compatible-copy-disclosure"]');
  assert.match(disclosure.textContent,/24 fps.*selected 5.56 s.*actual ≈5.17 s.*124 frames.*≈0.39 s/);
  assert.equal(f.w.applied.length,0);await f.click('Use excerpt');assert.equal(f.w.applied.length,1);
  await f.w.fx.act(async()=>{f.w.operation='flux-fast-edit';f.w.duration=20;f.w.fx.render();});
  await f.input('End (seconds)','15');
  const apply=[...f.w.document.querySelectorAll('button')].find((button:any)=>button.textContent==='Use excerpt') as any;
  assert.equal(apply.disabled,true);await f.input('End (seconds)','14.9');assert.equal(apply.disabled,false);
  assert.match(f.w.document.querySelector('[data-testid="video-compatible-copy-disclosure"]').textContent,/whole video.*Original, framing and audio/);
 }finally{await f.dispose();}
});

for (const [locale, actual, removed, minimum, apply] of [
  ['en', 'actual ≈5.17 s', 'Removes ≈0.39 s', '56 frames at 24 fps', 'Use excerpt'],
  ['fr', 'durée réelle ≈5,17 s', '≈0,39 s retirée', '56 images à 24 images/s', 'Utiliser cet extrait'],
  ['es', 'duración real ≈5,17 s', 'Se eliminan ≈0,39 s', '56 fotogramas a 24 fps', 'Usar fragmento'],
]) test(`${locale}: concise Relight disclosure keeps exact frame minimum and applied range`, async () => {
  const f = await mount(5.558333, locale);
  try {
    await f.w.fx.act(async () => { f.w.operation = 'h3-relight'; f.w.fx.render(); });
    const disclosure = f.w.document.querySelector('[data-testid="video-compatible-copy-disclosure"]').textContent;
    assert.ok(disclosure.includes(actual), disclosure); assert.ok(disclosure.includes(removed), disclosure);
    assert.doesNotMatch(disclosure, /166667|391666|391333/);
    const limits = f.w.document.querySelector('.video-excerpt-limits').textContent;
    assert.ok(limits.includes(minimum), limits); assert.doesNotMatch(limits, /2[.,]33/);
    await f.click(apply);
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.applied)), [{ startSec: 0, endSec: 5.558333 }]);
    const end = f.w.document.querySelectorAll('input[type=number]')[1];
    await f.w.fx.act(async () => {
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(end, '2.33');
      end.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    });
    assert.equal([...f.w.document.querySelectorAll('button')].find((b: any) => b.textContent === apply).disabled, true);
  } finally { await f.dispose(); }
});
