import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { makeModelPagePricingHarness } from './helpers/model-page-pricing-harness';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const tick = () => new Promise<void>(done => setImmediate(done));
function gate() { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); return { promise, release }; }
async function input(modelId: string, locale: 'en' | 'fr' | 'es', legacy = false) {
  const sourceEngine = getFalEngineById(modelId)!;
  const en = JSON.parse(await readFile(`content/models/en/${sourceEngine.modelSlug}.json`, 'utf8'));
  const local = JSON.parse(await readFile(`content/models/${locale}/${sourceEngine.modelSlug}.json`, 'utf8'));
  // Exercise the preserved unconfigured-template branch without changing publication or registry fixtures.
  const engine = legacy ? {...sourceEngine,modelSlug:'stream-legacy-fixture'} : sourceEngine;
  const media = {id:'selected-real-poster',engineId:engine.id,prompt:'Controlled selected render',durationSec:5,aspectRatio:'16:9',
    thumbUrl:'https://media.maxvideoai.com/fixture/selected-real-poster.webp',
    videoUrl:engine.category==='image'?null:'https://media.maxvideoai.com/fixture/selected-real-video.mp4'};
  const localizedContent = mergeEngineLocalizedContent(en,local);
  if (legacy) {
    localizedContent.examples = {...localizedContent.examples as object,modelSlug:engine.modelSlug};
    localizedContent.prompting = {...localizedContent.prompting as object,modelSlug:engine.modelSlug};
  }
  return {engine,locale,localizedContent,
    detailCopy:{backLabel:'Back',pricingLinkLabel:'Pricing',breadcrumb:{home:'Home',models:'Models'}},
    managed:true,examples:[media],publicVideos:[media]};
}
function documentProjection(document: Document) {
  return {
    hero: document.querySelector('h1')?.textContent,
    specs: document.querySelector('#specs')?.textContent,
    pricing: document.querySelector('#decision-pricing')?.textContent,
    offers: [...document.querySelectorAll('p')].filter(node=>node.querySelector('strong')?.textContent?.includes('19')).map(node=>node.textContent),
    schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent!)).sort((a,b)=>a['@type'].localeCompare(b['@type'])),
    heroImages:[...document.querySelectorAll('img[fetchpriority="high"]')].map(node=>({src:node.getAttribute('src'),srcset:node.getAttribute('srcset'),sizes:node.getAttribute('sizes')})),
  };
}

test('decision video SSR streams only the selected hero; image and legacy await exact EN/FR/ES details and native JSON-LD', async t => {
  const Module = requireFrontend('node:module'), priorResolve = Module._resolveFilename;
  const aliases = Object.fromEntries(['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/server','react-dom/client'].map(name=>[name,requireFrontend.resolve(`next/dist/compiled/${name}`)]));
  Module._resolveFilename = function(request: string,...args: unknown[]) {return priorResolve.call(this,aliases[request]??request,...args);};
  const previousReact = Object.getOwnPropertyDescriptor(globalThis,'React');
  let dispose: undefined | (()=>Promise<void>);
  try {
    const React = requireFrontend('next/dist/compiled/react');
    Object.defineProperty(globalThis,'React',{configurable:true,value:React});
    const {renderToReadableStream} = requireFrontend('next/dist/compiled/react-dom/server');
    const {AppRouterContext} = requireFrontend('next/dist/shared/lib/app-router-context.shared-runtime');
    const {ImageConfigContext} = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
    const {imageConfigDefault} = requireFrontend('next/dist/shared/lib/image-config');
    const config = {...imageConfigDefault,...requireFrontend('./next.config.js').images};
    const built = await makeModelPagePricingHarness({executeInputs:true,executeGallery:true,executeSections:true});
    const h = built.harness; dispose = built.dispose;
    const english = JSON.parse(await readFile('frontend/messages/en.json','utf8'));
    for (const legacy of [false,true]) for (const modelId of ['veo-3-1','gpt-image-2']) for (const locale of ['en','fr','es'] as const) {
      await t.test(`${legacy?'legacy':'decision'}/${modelId}/${locale}`,async()=>{
        const fixture = await input(modelId,locale,legacy), held = gate();
        h.configure(fixture);
        h.setQuote(async(context:any)=>{
          await held.promise;
          const imageSizes=['1024x768','1024x1024','1024x1536','1920x1080','2560x1440','3840x2160'];
          const pointIndex=imageSizes.indexOf(context.resolution)*3+['low','medium','high'].indexOf(context.quality);
          const videoRate=731+Math.max(0,['720p','1080p','4k'].indexOf(context.resolution))*137+(context.addons?.audio_off?0:51);
          const totalCents=fixture.engine.category==='image'?731+pointIndex*137:videoRate*context.durationSec;
          return {totalCents,currency:'USD',base:{seconds:context.durationSec}};
        });
        h.setPublicQuote(async()=>{await held.promise;return {status:'exact',amountCents:1937,currency:'USD'};});
        const dictionary = JSON.parse(await readFile(`frontend/messages/${locale}.json`,'utf8'));
        const wrap = (page:any)=>React.createElement('html',null,React.createElement('body',null,React.createElement(ImageConfigContext.Provider,{value:config},
          React.createElement(AppRouterContext.Provider,{value:{back(){},push(){},prefetch(){}}},React.createElement(h.I18nProvider,{locale,dictionary,fallback:english},page,React.createElement('span',{'data-shell-complete':'true'}))))));
        let pageReady = false;
        const pending = h.rawRender(fixture).then((page:any)=>{pageReady=true;return page;});
        try {
          await tick();await tick();
          assert.equal(pageReady,true,'The actual route returns before the held canonical projection');
          const page = await pending, errors:unknown[]=[];
          const streamsHero=!legacy && fixture.engine.category!=='image';
          let shellReady=false;
          const rendering=renderToReadableStream(wrap(page),{onError:(error:unknown)=>{errors.push(error);}}).then((stream:any)=>{shellReady=true;return stream;});
          await tick();await tick();
          assert.equal(shellReady,streamsHero,'Only decision video heroes can render before exact pricing');
          if(!streamsHero) held.release();
          const stream = await Promise.race([rendering,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('renderer timeout '+JSON.stringify(errors))),2000))]);
          const reader = stream.getReader(), decoder = new TextDecoder();
          let shell='';
          while (!shell.includes('data-shell-complete')) {
            const next=await Promise.race([reader.read(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('shell timeout '+JSON.stringify(errors)+' '+shell.slice(-300))),2000))]);assert.equal(next.done,false);shell+=decoder.decode(next.value,{stream:true});
          }
          assert.match(shell,/selected-real-poster/);
          assert.match(shell,/fetchPriority="high"|fetchpriority="high"/);
          assert.equal((shell.match(/<h1\b/g)??[]).length,1);
          const shellDoc = new JSDOM(shell);
          if(streamsHero) {
            assert.doesNotMatch(shellDoc.window.document.body.textContent??'',/19[.,]37|7[.,]31/,'Pending amounts cannot appear');
            assert.doesNotMatch(shell,/\"offers\"\s*:/,'No speculative offer can appear');
            assert.equal(shellDoc.window.document.querySelector('#specs'),null,'Specs are emitted with their complete exact rows');
            assert.equal(shellDoc.window.document.querySelector('#decision-pricing'),null,'No partial scenario card may shift details');
            assert.ok(shellDoc.window.document.querySelector('[aria-hidden="true"].min-h-screen'),'Reserve the below-hero viewport while details wait');
          }
          shellDoc.window.close();
          if(streamsHero) assert.equal(h.timingRecords.length,0);
          held.release();
          let tail='';for (;;) {const next=await reader.read();if(next.done)break;tail+=decoder.decode(next.value,{stream:true});}
          assert.deepEqual(errors,[]);
          assert.doesNotMatch(tail,/<h1\b/,'Price arrival cannot replace the hero');
          assert.equal((tail.match(/fetchPriority="high"|fetchpriority="high"/g)??[]).length,0,'Price arrival cannot serialize the critical poster again');
          const doc = new JSDOM(shell+tail,{runScripts:'dangerously',pretendToBeVisual:true});
          await new Promise(done=>setTimeout(done,60));
          const final=documentProjection(doc.window.document);
          const product=final.schemas.find(value=>value['@type']==='Product');
          assert.equal(product.offers.price,'19.37');
          assert.equal(product.offers.priceCurrency,'USD');
          assert.ok(final.schemas.some(value=>value['@type']==='WebPage'));
          assert.ok(final.schemas.some(value=>value['@type']==='BreadcrumbList'));
          assert.match(final.specs??'',fixture.engine.category==='image'?/7[.,]31/:/7[.,]31|7[.,]82/);
          if(fixture.engine.category==='image') {
            const priceRow=(await page.props.pricing).keySpecRows.find((row:any)=>row.key==='pricePerImage');
            assert.equal(priceRow.valueLines.length,18,'Distinct canonical quality/resolution amounts exercise the full image price grid');
            assert.match(final.specs??'',/30[.,]60/);
          }
          assert.ok(final.offers.length>0,'The exact Product offer remains visible');
          if (!legacy) assert.match(final.pricing??'',/19[.,]37/);
          const controlPage=await h.rawRender(fixture);
          const control=await renderToReadableStream(wrap(controlPage));await control.allReady;
          const controlDoc=new JSDOM(await new Response(control).text(),{runScripts:'dangerously',pretendToBeVisual:true});
          await new Promise(done=>setTimeout(done,60));
          assert.deepEqual(final,documentProjection(controlDoc.window.document),'Streaming retains exact final prices, specs, offers, schemas and selected poster');
          doc.window.close();controlDoc.window.close();
          const metadata=await h.generateMetadata({params:Promise.resolve({slug:fixture.engine.modelSlug,locale})});
          assert.equal(metadata.alternates.canonical,page.props.canonicalUrl);
        } finally {held.release();await pending.catch(()=>undefined);}
      });
    }
    for (const [modelId,legacy] of [['veo-3-1',false],['gpt-image-2',false],['veo-3-1',true],['gpt-image-2',true]] as const) {
      for (const outcome of ['unavailable','rejected'] as const) await t.test(`${legacy?'legacy':'decision'}/${modelId}: commercial ${outcome}`,async()=>{
        const fixture=await input(modelId,'fr',legacy),held=gate(),original=new Error('exact offer failure');
        const streamsHero=!legacy && fixture.engine.category!=='image';
        h.configure(fixture);
        h.setQuote((context:any)=>({totalCents:731*context.durationSec,currency:'USD',base:{seconds:context.durationSec}}));
        h.setPublicQuote(async()=>{await held.promise;if(outcome==='rejected')throw original;return {status:'unavailable'};});
        const errors:unknown[]=[];
        const dictionary=JSON.parse(await readFile('frontend/messages/fr.json','utf8'));
        const page=await h.rawRender(fixture);
        const wrap=React.createElement('html',null,React.createElement('body',null,
          React.createElement(ImageConfigContext.Provider,{value:config},React.createElement(AppRouterContext.Provider,{value:{back(){},push(){},prefetch(){}}},React.createElement(h.I18nProvider,{locale:'fr',dictionary,fallback:english},page))),
          React.createElement('span',{'data-shell-complete':'true'})));
        let shellReady=false;
        const rendering=renderToReadableStream(wrap,{onError:(error:unknown)=>{errors.push(error);}}).then((stream:any)=>{shellReady=true;return stream;});
        void rendering.catch(()=>undefined);
        try {
          await tick();await tick();
          assert.equal(shellReady,streamsHero,'Images and legacy wait for scenario/offer quotes even after the spec projection is ready');
          if(!streamsHero) held.release();
          if(!streamsHero && outcome==='rejected') {
            await assert.rejects(rendering,(error:unknown)=>error===original);
            assert.ok(errors.length>0);
            assert.ok(errors.every(error=>error===original));
            return;
          }
          const stream=await rendering, reader=stream.getReader(),decoder=new TextDecoder();let shell='';
          while(!shell.includes('data-shell-complete')) {const next=await reader.read();assert.equal(next.done,false);shell+=decoder.decode(next.value,{stream:true});}
          assert.match(shell,/selected-real-poster/);
          assert.doesNotMatch(shell,/'offers'\s*:|"offers"\s*:/);
          held.release();let tail='';
          for(;;){const next=await reader.read();if(next.done)break;tail+=decoder.decode(next.value,{stream:true});}
          const doc=new JSDOM(shell+tail,{runScripts:'dangerously',pretendToBeVisual:true});
          await new Promise(done=>setTimeout(done,60));
          const schemas=[...doc.window.document.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent!));
          assert.ok(schemas.every(value=>!value.offers),'Unavailable or rejected quotes never become a speculative Product offer');
          if(outcome==='rejected') {
            assert.ok(errors.length>0);
            assert.ok(errors.every(error=>error===original),'Suspended details preserve the original quote failure');
          } else {
            assert.deepEqual(errors,[]);
            assert.ok(schemas.some(value=>value['@type']==='WebPage'));
            assert.ok(schemas.some(value=>value['@type']==='BreadcrumbList'));
            assert.ok(schemas.every(value=>value['@type']!=='Product'),'The existing contract omits Product when no exact offer is available');
            if(!legacy) assert.match(doc.window.document.querySelector('#decision-pricing')?.textContent??'',/Devis en direct/);
          }
          doc.window.close();
        } finally {held.release();await rendering.catch(()=>undefined);}
      });
    }
  } finally {
    await dispose?.();Module._resolveFilename=priorResolve;
    previousReact?Object.defineProperty(globalThis,'React',previousReact):Reflect.deleteProperty(globalThis,'React');
  }
});
