import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { buildMarketingModelMenu } from '../frontend/config/navigation';
import { listRuntimeModels } from '../frontend/config/model-runtime';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const directoryPath = 'frontend/app/(localized)/[locale]/(marketing)/models';
const tick = () => new Promise<void>(done => setImmediate(done));

// Exercise the real catalogue, cards, localized components, filters and JSON-LD.
// Only the request dictionary and external current-price reads are controlled.
async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-streaming-'));
  const output = join(directory, 'catalog.cjs');
  const fixture = `
    let locale='en',held,releaseGate,outcome;
    export const calls=[];
    export const priceError=new Error('held catalogue pricing failure');
    export function configure(value,result='exact') {locale=value;outcome=result;calls.length=0;held=new Promise(done=>releaseGate=done);}
    export function release(){releaseGate();}
    export async function resolveDictionary(){return {locale,dictionary:require(${JSON.stringify(resolve('frontend/messages'))}+'/'+locale+'.json')};}
    export async function computeMarketingPriceRange(engine,options){
      calls.push({id:engine.id,options});await held;
      if(outcome==='rejected')throw priceError;
      if(outcome==='unavailable')return null;
      return {currency:'USD',min:{cents:731},max:{cents:977}};
    }
  `;
  await build({
    stdin: { contents: `export {default as Page,generateModelsMetadata} from ${JSON.stringify(resolve(directoryPath,'ModelsCatalogPage.tsx'))};
      export {buildModelsCatalogCards} from ${JSON.stringify(resolve(directoryPath,'_lib/models-catalog-cards.ts'))};
      export {I18nProvider} from ${JSON.stringify(resolve('frontend/lib/i18n/I18nProvider.tsx'))};export * from 'catalog-fixture';`, resolveDir: process.cwd() },
    outfile:output,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',jsx:'automatic',
    plugins:[{name:'catalog-io',setup(builder){
      builder.onResolve({filter:/.*/},args=>{
        if(args.path==='catalog-fixture'||args.path==='@/lib/i18n/server'||args.path==='@/lib/pricing-marketing')return {path:'fixture',namespace:'controlled'};
        if(args.path==='next-intl/server')return {path:'translations',namespace:'controlled'};
        if(args.path==='server-only'||args.path.endsWith('.css'))return {path:'empty',namespace:'controlled'};
        if(!args.path.startsWith('.')&&!args.path.startsWith('/')&&!args.path.startsWith('@/')&&!args.path.startsWith('node:'))return {path:requireFrontend.resolve(args.path),external:true};
      });
      builder.onLoad({filter:/.*/,namespace:'controlled'},args=>({loader:'js',contents:args.path==='fixture'?fixture:args.path==='translations'?`export async function getTranslations(){return key=>key;}`:''}));
    }}],
  });
  return {directory,h:requireFrontend(output)};
}

function projection(document: Document) {
  return {
    hero:document.querySelector('.catalog-editorial-hero')?.innerHTML,
    useCases:document.querySelector('.catalog-use-cases')?.innerHTML,
    recommended:document.querySelector('#recommended')?.innerHTML,
    gallery:document.querySelector('#models-grid')?.innerHTML,
    schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent!)),
  };
}

test('catalogue streams the complete stable hero before prices and reveals exact recommendations and filters together', async t => {
  const Module=requireFrontend('node:module'),priorResolve=Module._resolveFilename;
  const aliases=Object.fromEntries(['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/server','react-dom/client'].map(name=>[name,requireFrontend.resolve(`next/dist/compiled/${name}`)]));
  Module._resolveFilename=function(request:string,...args:unknown[]){return priorResolve.call(this,aliases[request]??request,...args);};
  const previousReact=Object.getOwnPropertyDescriptor(globalThis,'React');
  let directory:string|undefined;
  try {
    const React=requireFrontend('next/dist/compiled/react');
    Object.defineProperty(globalThis,'React',{configurable:true,value:React});
    const {renderToReadableStream}=requireFrontend('next/dist/compiled/react-dom/server');
    const {AppRouterContext}=requireFrontend('next/dist/shared/lib/app-router-context.shared-runtime');
    const {ImageConfigContext}=requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
    const {imageConfigDefault}=requireFrontend('next/dist/shared/lib/image-config');
    const built=await bundle();directory=built.directory;const h=built.h;
    const en=JSON.parse(await readFile('frontend/messages/en.json','utf8'));
    for(const scope of ['all','video','image'])for(const locale of ['en','fr','es'])await t.test(`${scope}/${locale}`,async()=>{
      h.configure(locale);
      const dictionary=JSON.parse(await readFile(`frontend/messages/${locale}.json`,'utf8'));
      const wrap=(page:any)=>React.createElement('html',null,React.createElement('body',null,
        React.createElement(ImageConfigContext.Provider,{value:{...imageConfigDefault,...requireFrontend('./next.config.js').images}},
          React.createElement(AppRouterContext.Provider,{value:{back(){},push(){},prefetch(){}}},
            React.createElement(h.I18nProvider,{locale,dictionary,fallback:en},page))),React.createElement('span',{'data-shell-complete':'true'})));
      let ready=false;
      const pending=h.Page({scope}).then((page:any)=>{ready=true;return page;});
      try {
        // Wait for real filesystem/localization reads to reach the held price seam.
        for(let attempt=0;attempt<200&&h.calls.length===0;attempt++)await new Promise(done=>setTimeout(done,5));
        await tick();await tick();
        assert.ok(h.calls.length>0);
        assert.equal(ready,true,'The catalogue must return its complete hero while current prices are held');
        const errors:unknown[]=[];
        const stream=await renderToReadableStream(wrap(await pending),{onError:(error:unknown)=>{errors.push(error);}});
        const reader=stream.getReader(),decoder=new TextDecoder();let shell='';
        while(!shell.includes('data-shell-complete')){const next=await reader.read();assert.equal(next.done,false);shell+=decoder.decode(next.value,{stream:true});}
        const initial=new JSDOM(shell);
        const discovery=initial.window.document.querySelector('[data-model-directory]');
        assert.ok(discovery, 'All catalogue routes expose a server-rendered directory before price reads resolve');
        const catalogBase={en:'/models',fr:'/fr/modeles',es:'/es/modelos'}[locale as 'en'|'fr'|'es'];
        const targets=new Set([...initial.window.document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')));
        for (const suffix of ['/video','/image']) assert.ok(targets.has(catalogBase+suffix), `Missing hub ${catalogBase}${suffix}`);
        if(scope!=='video')for(const slug of ['nano-banana-2','gpt-image-2-5-sunburst']) {
          assert.ok(targets.has(`${catalogBase}/${slug}`), `Missing initial image model ${slug}`);
        }
        assert.equal(discovery.querySelectorAll('img,video').length,0,'Discovery must not load another media gallery');
        assert.ok(!targets.has(`${catalogBase}/seedance-1-5-pro`), 'Closed generation is not promoted as a current catalogue choice');
        const hero=initial.window.document.querySelector('.catalog-editorial-hero');
        assert.ok(hero?.querySelector('h1'));
        assert.equal(hero.querySelectorAll('.catalog-creative-stack img').length,3);
        assert.equal(Boolean(hero.querySelector('.catalog-top-picks')),scope!=='image','Keep the existing scoped hero recommendations');
        assert.equal(initial.window.document.querySelector('#models-grid'),null,'Price filters cannot hydrate with provisional amounts');
        assert.equal(initial.window.document.querySelector('#recommended'),null,'Price-bearing recommendations wait with the gallery');
        assert.ok(initial.window.document.querySelector('[aria-hidden="true"].min-h-screen'));
        assert.doesNotMatch(initial.window.document.body.textContent??'',/7[.,]31/);
        h.release();let tail='';for(;;){const next=await reader.read();if(next.done)break;tail+=decoder.decode(next.value,{stream:true});}
        assert.deepEqual(errors,[]);
        assert.doesNotMatch(tail,/<h1\b|catalog-creative-stack|catalog-top-picks/,'The quote reveal cannot replace already painted hero nodes');
        const final=new JSDOM(shell+tail,{runScripts:'dangerously',pretendToBeVisual:true});await new Promise(done=>setTimeout(done,60));
        assert.equal(final.window.document.querySelector('.catalog-editorial-hero')?.innerHTML,hero.innerHTML);
        assert.match(final.window.document.querySelector('#models-grid')?.textContent??'',/7[.,]31/);
        if(scope==='all')assert.match(final.window.document.querySelector('#recommended')?.textContent??'',/7[.,]31/);
        assert.equal(final.window.document.querySelectorAll('script[type="application/ld+json"]').length,3);
        const control=await renderToReadableStream(wrap(await h.Page({scope})));await control.allReady;
        const controlDoc=new JSDOM(await new Response(control).text());
        assert.deepEqual(projection(final.window.document),projection(controlDoc.window.document),'Streaming preserves localized final cards, filters, hero and native schemas');
        const cards=await h.buildModelsCatalogCards({activeLocale:locale,engineMetaCopy:dictionary.models.meta??{},engineTypeLabelOverrides:dictionary.models.engineTypeLabels,galleryCopy:dictionary.models.gallery,scope});
        const expectedNewModels=new Set(buildMarketingModelMenu(listRuntimeModels()).filter(item=>item.badge==='new').map(item=>item.slug));
        for(const card of cards)assert.equal(card.badge,expectedNewModels.has(card.id)?'new':null,`${card.id}: badge must follow published editorial discovery`);
        const noveltyBadges=[...final.window.document.querySelectorAll('#models-grid [data-model-novelty="new"]')];
        for(const badge of noveltyBadges)assert.equal(badge.textContent,dictionary.nav.badges.new,`${locale}: localized novelty badge`);
        if(scope!=='image') {
          const maxCard=[...final.window.document.querySelectorAll('#models-grid article')].find(card=>card.querySelector('h3')?.textContent==='FLUX 3 Max');
          assert.ok(maxCard,'The new current model must be visible in the initial catalogue cards');
          assert.equal(maxCard.querySelector('[data-model-novelty="new"]')?.textContent,dictionary.nav.badges.new);
          const reviewLabel={en:'Editorial estimate',fr:'Estimation éditoriale',es:'Estimación editorial'}[locale as 'en'|'fr'|'es'];
          assert.equal(maxCard.querySelector('[data-score-review="editorial-estimated"]')?.textContent,reviewLabel);
          assert.ok(maxCard.textContent?.includes('≈8.7'));
          assert.ok(maxCard.querySelector('[data-score-review]')?.getAttribute('href')?.endsWith('/benchmarks#review-flux-3-max'));
          for(const section of scope==='all'?['.catalog-top-picks','#recommended']:['.catalog-top-picks']) {
            const review=final.window.document.querySelector(`${section} [data-score-review="editorial-estimated"]`);
            assert.equal(review?.textContent,reviewLabel,`${section}: estimated score must be qualified in ${locale}`);
          }
        }
        for(const card of cards)assert.ok(targets.has(`${catalogBase}/${card.id}`), `Missing SSR directory destination ${card.id}`);
        assert.ok(cards.every((card:any)=>card.filterMeta.priceFrom===7.31||card.filterMeta.priceFrom===null));
        assert.ok(h.calls.every((call:any)=>call.options.requireCurrentPolicy===true&&call.options.durationSec===5&&call.options.memberTier==='member'));
        const metadata=await h.generateModelsMetadata({params:{locale},scope});
        const base={en:'/models',fr:'/fr/modeles',es:'/es/modelos'}[locale as 'en'|'fr'|'es'];
        assert.equal(metadata.alternates.canonical,`https://maxvideoai.com${base}${scope==='all'?'':`/${scope}`}`);
        initial.window.close();final.window.close();controlDoc.window.close();
      } finally {h.release();await pending.catch(()=>undefined);}
    });
    for(const outcome of ['unavailable','rejected'])await t.test(outcome,async()=>{
      h.configure('fr',outcome);
      const dictionary=JSON.parse(await readFile('frontend/messages/fr.json','utf8'));
      const errors:unknown[]=[];
      const page=await h.Page({scope:'all'});
      const wrap=React.createElement('html',null,React.createElement('body',null,
        React.createElement(ImageConfigContext.Provider,{value:{...imageConfigDefault,...requireFrontend('./next.config.js').images}},
          React.createElement(AppRouterContext.Provider,{value:{back(){},push(){},prefetch(){}}},
            React.createElement(h.I18nProvider,{locale:'fr',dictionary,fallback:en},page))),React.createElement('span',{'data-shell-complete':'true'})));
      const stream=await renderToReadableStream(wrap,{onError:(error:unknown)=>{errors.push(error);}});
      const reader=stream.getReader(),decoder=new TextDecoder();let shell='';
      try {
        while(!shell.includes('data-shell-complete')){const next=await reader.read();assert.equal(next.done,false);shell+=decoder.decode(next.value,{stream:true});}
        assert.match(shell,/<h1\b/);
        assert.doesNotMatch(shell,/id="models-grid"|id="recommended"/);
        h.release();let tail='';for(;;){const next=await reader.read();if(next.done)break;tail+=decoder.decode(next.value,{stream:true});}
        const doc=new JSDOM(shell+tail,{runScripts:'dangerously',pretendToBeVisual:true});await new Promise(done=>setTimeout(done,60));
        assert.ok(doc.window.document.querySelector('h1'));
        assert.doesNotMatch(doc.window.document.body.textContent??'',/7[.,]31/);
        if(outcome==='rejected'){
          assert.ok(errors.length>0);
          assert.ok(errors.every(error=>error===h.priceError),'Late pricing preserves its original error');
          assert.equal(doc.window.document.querySelector('#models-grid'),null);
          assert.equal(doc.window.document.querySelector('#recommended'),null);
          await assert.rejects(h.buildModelsCatalogCards({activeLocale:'fr',engineMetaCopy:{},galleryCopy:{},scope:'all'}),(error:unknown)=>error===h.priceError);
        }else{
          assert.deepEqual(errors,[]);
          assert.ok(doc.window.document.querySelector('#models-grid'));
          assert.ok(doc.window.document.querySelector('#recommended'));
          const cards=await h.buildModelsCatalogCards({activeLocale:'fr',engineMetaCopy:{},galleryCopy:{},scope:'all'});
          assert.ok(cards.every((card:any)=>card.filterMeta.priceFrom===null));
          assert.ok(cards.every((card:any)=>card.stats.priceFrom==='—'||card.priceNote));
          assert.equal(doc.window.document.querySelectorAll('script[type="application/ld+json"]').length,3);
        }
        doc.window.close();
      }finally{h.release();}
    });
  } finally {
    Module._resolveFilename=priorResolve;
    previousReact?Object.defineProperty(globalThis,'React',previousReact):Reflect.deleteProperty(globalThis,'React');
    if(directory)await rm(directory,{recursive:true,force:true});
  }
});
