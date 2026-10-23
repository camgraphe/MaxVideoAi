import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(
  `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {VideoExcerptSelector} from './components/media/VideoExcerptSelector.client';import {requestVideoExcerpt} from './lib/client-video-excerpt';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<VideoExcerptSelector previewUrl="https://example.invalid/signed" durationSec={window.duration} limits={{sourceFieldId:'video_url',minDurationSec:null,maxDurationSec:18,maxSizeMB:100,durationPolicy:'source_video'}} locale={window.locale} onCancel={()=>window.cancelled++} onApply={async range=>{window.applied.push(range);if(window.failure)throw new Error('Failed to prepare');if(window.request)await requestVideoExcerpt({source:{type:'asset',assetId:'owned',kind:'video'},engineId:'luma-ray-3-2',mode:'v2v',range},window.request);}}/>),unmount:()=>root.unmount()};`,
  {}
);
async function mount(duration = 5.558333, locale = 'en') {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  Object.assign(w, { duration, locale, cancelled: 0, applied: [] });
  w.HTMLMediaElement.prototype.pause = function () {};
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
test('selector retains exact fractional full range, uses lazy manual playback and exposes touch sliders', async () => {
  const f = await mount();
  try {
    const d = f.w.document;
    assert.equal(d.querySelector('[aria-label="End (seconds)"]').value, '5.558333');
    assert.equal(d.querySelector('video').preload, 'none');
    assert.equal(d.querySelector('video').autoplay, false);
    assert.equal(d.querySelectorAll('input[type=range]').length, 2);
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
  `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {Composer} from './components/Composer';import {getBaseEngineIncludingHidden} from './src/lib/engines';import {I18nProvider} from './lib/i18n/I18nProvider';const root=createRoot(document.getElementById('root'));const engine=getBaseEngineIncludingHidden('luma-ray-3-2');window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><Composer density={window.density} engine={engine} activeManualMode="v2v" prompt="Edit" onPromptChange={()=>{}} promptRequired price={1.25} currency="USD" isLoading={false} assetFields={[{field:{id:'video_url',type:'video',maxCount:1},required:true}]} assets={{video_url:Array.from({length:window.sourceCount??1},(_,index)=>({id:'original'+index,assetId:'owned'+index,kind:'video',name:'source'+index+'.mp4',size:1,type:'video/mp4',status:'ready',url:'https://example.invalid/original'+index,previewUrl:'https://example.invalid/signed'+index,durationSec:5.558333}))}} onGenerate={()=>window.generated++} onPrepareVideoExcerpt={async()=>{window.applied++;}} /></I18nProvider>),unmount:()=>root.unmount()};`,
  {}
);
for (const density of ['workspace', 'default'])
  test(`${density}: real Composer masks price and Generate throughout selector and restores on cancel`, async () => {
    const dom = createClientFlowDom('/app');
    const w = dom.window as any;
    Object.assign(w, { density, generated: 0, applied: 0 });
    w.HTMLMediaElement.prototype.pause = function () {};
    w.eval(await composerBundle);
    const buttons = () => [...w.document.querySelectorAll('button')] as any[];
    try {
      await w.fx.act(async () => w.fx.render());
      const generate = () => buttons().find((button) => button.textContent.includes('Modify video'));
      assert.equal(generate().disabled, false);
      assert.match(generate().textContent, /1\.25/);
      await w.fx.act(async () =>
        buttons()
          .find((button) => button.textContent === 'Choose excerpt')
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
        (button: any) => button.textContent === 'Choose excerpt'
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
