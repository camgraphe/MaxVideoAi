import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const routePath = resolve('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx');

// Exercise the real route orchestration with external readers held open. Price/media
// formatters have deterministic fixtures: their commercial/media policies are not changed here.
async function makeRouteHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'model-page-loading-'));
  const source = await readFile(routePath, 'utf8');
  const imports = [...source.matchAll(/import\s*{([\s\S]*?)}\s*from\s*['"]([^'"]+)['"]/g)];
  const names = new Set(imports.flatMap(match => match[1].split(',').map(name => name.trim())
    .filter(name => name && !name.startsWith('type ')).map(name => name.split(/\s+as\s+/)[0])));
  const definitions: Record<string, string> = {
    loadBenchmarkScoreSlugs: `()=>read('scores',new Set(['veo-3-1']))`,
    listEnginePricingOverrides: `()=>read('engine-settings',{'veo-3-1':{fixture:'override'}})`,
    loadEngineKeySpecs: `()=>read('key-specs',new Map([['veo-3-1',{keySpecs:{fixture:'specs'}}]]))`,
    listPlaylistVideos: `async(key,limit)=>{const rows=await read('gallery',playlistRows);details.push(['playlist',key,limit]);if(failAt==='playlist')throw failure;return rows;}`,
    hasPlaylistCuration: `async(key)=>{details.push(['curation',key]);return managed;}`,
    getPublicVideosByIds: `async(ids)=>{details.push(['public-validation',...ids]);if(failAt==='validation')throw failure;return new Map(videos.filter(v=>ids.includes(v.id)).map(v=>[v.id,v]));}`,
    quoteCurrentExamplePrices: `async(rows)=>new Map(rows.map(v=>[v.id,{kind:'unavailable',reason:'fixture'}]))`,
    finalizeModelGallery: `async(input)=>{details.push(['finalize',input.managed]);return input.cards;}`,
    buildMetadataUrls: `(locale)=>({canonical:'https://maxvideoai.com/'+locale+'/models/veo-3-1'})`,
    resolveLocalesForEnglishPath: `()=>new Set(['en','fr','es'])`,
    buildDetailSlugMap: `()=>({en:'models/veo-3-1'})`,
    buildSoraCopy: `()=>({faqs:[]})`,
    normalizeEngineId: `(id)=>id`,
    applyEnginePricingOverride: `(engine,override)=>({...engine,pricingDetails:override})`,
    toGalleryCard: `(video)=>({...video,fixture:'card'})`,
    pickHeroMedia: `(cards,_preferred,fallback)=>cards[0]??fallback`,
    pickDemoMedia: `()=>null`,
    normalizeMediaUrl: `(url)=>url??null`,
    resolvePublicMarketingVideoUrl: `(url)=>url??null`,
    listFalEngines: `()=>[]`,
    pickCompareEngines: `()=>[]`,
    buildPricePerSecondLabel: `async(engine,locale)=>{details.push(['second-label',locale,engine.pricingDetails]);return locale+' 0.10/s';}`,
    buildPricePerImageLabel: `async(_engine,locale)=>locale+' 0.20/image'`,
    buildPricePerSecondRows: `async(_engine,locale)=>[{id:'pricePerSecond',key:'pricePerSecond',label:locale+' price',value:'0.10/s'}]`,
    buildPricePerImageRows: `async()=>[]`,
    buildSpecValues: `(_engine,specs,prices)=>({...specs,...prices})`,
    resolveSpecRowDefs: `()=>[]`,
    resolveSpecRowLabel: `(locale,key)=>locale+' '+key`,
    resolveAudioPricingLabels: `()=>({on:'on',off:'off'})`,
    PREFERRED_MEDIA: `{'veo-3-1':{hero:'public-one',demo:null}}`,
    FEATURED_EXAMPLE_MEDIA: `{'veo-3-1':[]}`,
    MarketingModelPageLayout: `()=>null`,
    resolveRuntimePublicSlug: `()=>model`,
    isRuntimeModelPagePublished: `()=>true`,
    isRuntimePresentationOnlyModel: `()=>prelaunch`,
    isPrelaunchModelPageTemplateSlug: `()=>false`,
    resolveDictionary: `async()=>({dictionary:{models:{detail:{}}}})`,
    getEngineLocalized: `async()=>localized`,
    getFalEngineBySlug: `()=>engine`,
    isPublishedModelPage: `()=>true`,
    renderMarketingModelPrelaunchPage: `async()=>({prelaunch:true})`,
    DEFAULT_DETAIL_COPY: `{backLabel:'back',pricingLinkLabel:'pricing',breadcrumb:{}}`,
    MODELS_BASE_PATH_MAP: `{en:'models',fr:'modeles',es:'modelos'}`,
  };
  // The extracted orchestration owns these imports after the change.
  for (const name of ['loadBenchmarkScoreSlugs','listEnginePricingOverrides','loadEngineKeySpecs','finalizeModelGallery']) names.add(name);
  const fixture = `
    export const calls=[];export const details=[];export const failure=new Error('fixture read failure');
    let releaseGate;let gate;let failAt='';let managed=false;let prelaunch=false;let playlistRows;
    export const videos=[{id:'public-one',engineId:'veo-3-1',videoUrl:'https://media.maxvideoai.com/original.mp4',posterUrl:'https://media.maxvideoai.com/poster.webp'}];
    export const engine={id:'veo-3-1',modelSlug:'veo-3-1',brandId:'google',marketingName:'Veo',type:'video',engine:{id:'veo-3-1',modes:['t2v']},surfaces:{app:{enabled:true},pricing:{includeInEstimator:true}}};
    export const localized={faqs:[],marketingName:'Veo'};
    export const model={slug:'veo-3-1',lifecycle:'active'};
    export function reset(options={}){calls.length=0;details.length=0;failAt=options.failAt??'';managed=options.managed??false;prelaunch=options.prelaunch??false;playlistRows=options.empty?[]:videos;model.lifecycle=options.archive?'deep_legacy':'active';localized.archive=options.archive?{}:undefined;gate=new Promise(resolve=>releaseGate=resolve);}
    export function release(){releaseGate();}
    async function read(name,value){calls.push(name);await gate;if(failAt===name||(Array.isArray(failAt)&&failAt.includes(name)))throw failure;return value;}
    ${[...names].map(name => `export const ${name}=${definitions[name] ?? '()=>undefined'};`).join('\n')}
  `;
  try {
    await build({
      stdin: { contents: `export {default as page, renderMarketingModelPage as render} from ${JSON.stringify(routePath)}; export * from 'model-fixture';`, resolveDir: process.cwd() },
      outfile: join(directory, 'route.cjs'), bundle: true, platform: 'node', format: 'cjs',
      tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"test"' },
      plugins: [{ name: 'model-read-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'model-fixture') return { path: 'fixture', namespace: 'controlled' };
          if (args.importer === routePath && !args.path.endsWith('/model-page-inputs') && args.path !== '@/server/model-gallery-projection' && !args.path.startsWith('react')) {
            return { path: args.path.endsWith('.css') ? 'empty' : 'fixture', namespace: 'controlled' };
          }
          if (args.importer.endsWith('/model-gallery-projection.ts') && args.path.endsWith('/model-gallery-curation')) return {path:'fixture',namespace:'controlled'};
          if (args.importer.endsWith('/model-page-inputs.ts') && args.path !== '@/server/public-page-timing') {
            return { path: 'fixture', namespace: 'controlled' };
          }
        });
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: args.path === 'empty' ? '' : fixture, loader: 'js' }));
        builder.onLoad({ filter: /models\/\[slug\]\/page\.tsx$/ }, async () => ({ contents: source+'\nexport {renderMarketingModelPage};', loader: 'tsx', resolveDir: routePath.slice(0, routePath.lastIndexOf('/')) }));
      } }],
    });
    return { harness: createRequire(import.meta.url)(join(directory, 'route.cjs')), dispose: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('model route starts independent inputs together and preserves localized output', async () => {
  const { harness: h, dispose } = await makeRouteHarness();
  try {
    const evidence=[];
    for (const locale of ['en','fr','es']) {
      h.reset();
      const pending=h.render({engine:h.engine,localizedContent:h.localized,detailCopy:{backLabel:'back',pricingLinkLabel:'pricing',breadcrumb:{}},locale});
      await tick();
      const started=[...h.calls].sort();
      h.release();
      const result=await pending;
      const props=JSON.parse(JSON.stringify(result.props));
      evidence.push({locale,started,calls:[...h.calls],details:[...h.details],props});
      assert.equal(props.locale,locale);
      assert.equal(props.canonicalUrl,`https://maxvideoai.com/${locale}/models/veo-3-1`);
      assert.equal(props.heroMedia.id,'public-one');
      assert.equal(props.showBenchmarkLink,true);
      assert.deepEqual(props.pricingEngine.pricingDetails,{fixture:'override'});
      assert.equal(props.pricePerSecondLabel,locale+' 0.10/s');
      assert.equal(props.galleryVideos.length,1);
      assert.deepEqual(h.details.filter((row: unknown[])=>row[0]==='public-validation'),[['public-validation','public-one']]);
      assert.equal(h.calls.length,4,'concurrency must not add reads');
    }
    if(process.env.CWV_MODEL_EVIDENCE_PATH) await writeFile(process.env.CWV_MODEL_EVIDENCE_PATH,JSON.stringify(evidence,null,2)+'\n');
    for(const row of evidence) assert.deepEqual(row.started,['engine-settings','gallery','key-specs','scores'],row.locale);
  } finally {await dispose();}
});

test('model route preserves rejected readers, optional playlist fallback and excluded route branches', async () => {
  const { harness: h, dispose } = await makeRouteHarness();
  try {
    for (const failAt of ['scores','engine-settings','key-specs','validation',['scores','engine-settings','key-specs']]) {
      h.reset({failAt});
      const pending=h.render({engine:h.engine,localizedContent:h.localized,detailCopy:{breadcrumb:{}},locale:'fr'});
      const rejected=assert.rejects(pending,(error:unknown)=>error===h.failure);
      await tick();h.release();await rejected;await tick();
    }
    h.reset({failAt:'playlist'});
    const fallback=h.render({engine:h.engine,localizedContent:h.localized,detailCopy:{breadcrumb:{}},locale:'es'});
    await tick();h.release();
    assert.deepEqual((await fallback).props.galleryVideos,[]);
    // Managed empty is authoritative; only legacy empty advances to the alias.
    const priorSlug = h.engine.modelSlug;
    h.engine.modelSlug = 'ltx-2-3-pro';
    for (const managed of [false, true]) {
      h.reset({empty:true,managed});
      const empty = h.render({engine:h.engine,localizedContent:h.localized,detailCopy:{breadcrumb:{}},locale:'en'});
      await tick();h.release();
      assert.deepEqual((await empty).props.galleryVideos,[]);
      const playlistKeys = h.details.filter((row:unknown[])=>row[0]==='playlist').map((row:unknown[])=>row[1]);
      assert.deepEqual(playlistKeys,managed?['examples-ltx-2-3-pro']:['examples-ltx-2-3-pro','examples-ltx-2-3']);
    }
    h.engine.modelSlug = priorSlug;
    for (const options of [{prelaunch:true},{archive:true}]) {
      h.reset(options);
      await h.page({params:Promise.resolve({slug:'veo-3-1',locale:'fr'})});
      assert.deepEqual(h.calls,[],'prelaunch/archive must not start active-model reads');
    }
  } finally {await dispose();}
});
