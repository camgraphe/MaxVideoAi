import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { makeModelPagePricingHarness, findModelLayoutElements } from './helpers/model-page-pricing-harness';

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
    buildModelPagePriceProjection: `async(engine,locale)=>{details.push(['second-label',locale,engine.pricingDetails]);return {pricePerSecondLabel:locale+' 0.10/s',pricePerImageLabel:null,priceRows:[{id:'pricePerSecond',key:'pricePerSecond',label:locale+' price',value:'0.10/s'}]};}`,
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

const modelLocales = ['en', 'fr', 'es'] as const;
async function pricingFixture(modelId: string, locale: typeof modelLocales[number]) {
  const engine = getFalEngineById(modelId)!;
  assert.ok(engine, modelId);
  const base = JSON.parse(await readFile(`content/models/en/${engine.modelSlug}.json`, 'utf8'));
  const overlay = JSON.parse(await readFile(`content/models/${locale}/${engine.modelSlug}.json`, 'utf8'));
  const localizedContent = mergeEngineLocalizedContent(base,overlay);
  return {engine, localizedContent, locale, detailCopy:{backLabel:'Back',pricingLinkLabel:'Pricing',breadcrumb:{home:'Home',models:'Models'}}};
}

async function visiblePricing(h: any, result: any) {
  const elements = findModelLayoutElements(await h.layout(result.props));
  return JSON.parse(JSON.stringify(elements.flatMap(({name,props}) => {
    if (name === 'script') return [{name,content:props.dangerouslySetInnerHTML.__html}];
    if (name === 'ModelHeroSection') return [{name,heroMetaLines:props.heroMetaLines,heroSpecChips:props.heroSpecChips}];
    if (name === 'ModelDecisionPricingCard') return [{name,pricing:props.pricing,offer:props.offer}];
    if (name === 'ModelPublicOfferLine') return [{name,offer:props.offer}];
    if (name === 'ModelPageContentSections') return [{name,specs:props.specsProps}];
    return [];
  })));
}

// Break caught: requesting the unused unit repeats real quote loops, even though
// the hero/spec/schema consumers have no visible use for that projection.
test('adding an unused unit quote repeats work without changing localized consumers', async () => {
  const withUnused = await makeModelPagePricingHarness({includeUnusedUnitQuote:true});
  const retained = await makeModelPagePricingHarness();
  const evidence = [];
  try {
    for (const [modelId, controlCount, currentCount, unit] of [
      ['minimax-h3-max',7,4,'second'], ['veo-3-1',10,7,'second'], ['gpt-image-2',19,18,'image'],
    ] as const) {
      for (const locale of modelLocales) {
        const input = await pricingFixture(modelId,locale);
        withUnused.harness.configure(input);retained.harness.configure(input);
        const control = await withUnused.harness.render(input);
        const result = await retained.harness.render(input);
        const controlCalls = withUnused.harness.calls.length;
        const currentCalls = retained.harness.calls.length;
        assert.equal(controlCalls,controlCount,`${modelId}/${locale} synthetic extra-unit control`);
        assert.equal(currentCalls,currentCount,`${modelId}/${locale} retained segment`);
        assert.equal(result.props[unit==='image'?'pricePerSecondLabel':'pricePerImageLabel'],null);
        assert.equal(result.props[unit==='image'?'pricePerImageLabel':'pricePerSecondLabel'],
          {'en':'$0.10','fr':'0,10\u00a0$US','es':'USD\u00a00.10'}[locale]+(unit==='image'?'/image':'/s'));
        assert.deepEqual(result.props.keySpecRows,control.props.keySpecRows);
        assert.deepEqual(await visiblePricing(retained.harness,result),await visiblePricing(withUnused.harness,control));
        const metadata = await retained.harness.generateMetadata({params:Promise.resolve({slug:input.engine.modelSlug,locale})});
        assert.deepEqual(metadata,await withUnused.harness.generateMetadata({params:Promise.resolve({slug:input.engine.modelSlug,locale})}));
        const prefix = locale==='en'?'':`/${locale}`;
        const base = {en:'models',fr:'modeles',es:'modelos'}[locale];
        assert.equal(result.props.canonicalUrl,`https://maxvideoai.com${prefix}/${base}/${input.engine.modelSlug}`);
        assert.equal(metadata.alternates.canonical,result.props.canonicalUrl);
        assert.ok(Object.keys(metadata.alternates.languages).length>=3);
        retained.harness.configure(input);
        await retained.harness.page({params:Promise.resolve({slug:input.engine.modelSlug,locale})});
        assert.equal(retained.harness.calls.length,currentCount,'fresh active page response owns the same pricing segment');
        evidence.push({modelId,locale,controlCalls,currentCalls,scope:'unit labels + spec price rows; deterministic quote fixture; raw catalog'});
      }
    }
    if (process.env.CWV_MODEL_PRICING_EVIDENCE_PATH) await writeFile(process.env.CWV_MODEL_PRICING_EVIDENCE_PATH,JSON.stringify(evidence,null,2)+'\n');
  } finally {await withUnused.dispose();await retained.dispose();}
});

test('model pricing preserves overrides, partial unavailable quotes and mode-based else branches', async () => {
  const withUnused = await makeModelPagePricingHarness({includeUnusedUnitQuote:true});
  const retained = await makeModelPagePricingHarness();
  try {
    const input = await pricingFixture('veo-3-1','en');
    const noAudio = {currency:'USD',perSecondCents:{default:10},addons:{}};
    const scenarios = [
      {...input,override:noAudio,wantCalls:4},
      {...input,reject:(_context:unknown,count:number)=>count===1,wantCalls:7},
      {...input,reject:(_context:unknown,count:number)=>count>1,wantCalls:7},
      {...input,reject:(context:any)=>context.resolution==='1080p',wantCalls:7},
      {...input,reject:()=>true,unavailableOffer:true,wantCalls:7},
      {...input,engine:{...input.engine,category:'image',engine:{...input.engine.engine,modes:['t2v','t2i']}},wantCalls:7},
      {...input,engine:{...input.engine,category:'image',engine:{...input.engine.engine,modes:[]}},wantCalls:7},
      {...input,engine:{...input.engine,surfaces:{...input.engine.surfaces,pricing:{...input.engine.surfaces.pricing,includeInEstimator:false}}},wantCalls:1},
    ];
    for (const scenario of scenarios) {
      withUnused.harness.configure(scenario);retained.harness.configure(scenario);
      const control = await withUnused.harness.render(scenario);
      const result = await retained.harness.render(scenario);
      assert.equal(retained.harness.calls.length,scenario.wantCalls);
      assert.equal(result.props.isImageEngine,false,'mixed/no modes preserve the video else branch regardless of category');
      assert.equal(result.props.pricePerImageLabel,null);
      assert.deepEqual(result.props.keySpecRows,control.props.keySpecRows);
      assert.deepEqual(await visiblePricing(retained.harness,result),await visiblePricing(withUnused.harness,control));
      if (scenario.override) {
        assert.deepEqual(result.props.pricingEngine.pricingDetails.addons,{});
        assert.ok(retained.harness.calls.every((context:any)=>context.engine.pricingDetails.addons.audio_off===undefined));
      }
      if (scenario.unavailableOffer) {
        assert.equal(result.props.pricePerSecondLabel,null);
        assert.equal(result.props.keySpecValues.pricePerSecond,'Data pending');
        assert.ok(result.props.keySpecRows.every((row:any)=>!row.value.includes('$')));
      }
      if (scenario.wantCalls===1) assert.ok(result.props.keySpecRows.every((row:any)=>!row.key.startsWith('pricePer')));
    }
    const image = await pricingFixture('gpt-image-2','fr');
    const partialImage = {...image,engine:{...image.engine,category:'video'},reject:(context:any)=>context.quality==='high'};
    withUnused.harness.configure(partialImage);retained.harness.configure(partialImage);
    const controlImage=await withUnused.harness.render(partialImage);
    const resultImage=await retained.harness.render(partialImage);
    assert.equal(resultImage.props.isImageEngine,true);
    assert.equal(resultImage.props.pricePerSecondLabel,null);
    assert.equal(retained.harness.calls.length,18);
    assert.deepEqual(resultImage.props.keySpecRows,controlImage.props.keySpecRows);
    for (const {reject,wantLines} of [
      {reject:()=>true,wantLines:undefined},
    ]) {
      retained.harness.configure({...image,reject});
      const unavailable=await retained.harness.render(image);
      assert.equal(unavailable.props.pricePerImageLabel,null);
      assert.equal(unavailable.props.keySpecValues.pricePerImage,'Data pending');
      assert.equal(retained.harness.calls.length,18);
      const price=unavailable.props.keySpecRows.find((row:any)=>row.key==='pricePerImage');
      assert.equal(price.valueLines?.length,wantLines);
      if(wantLines===undefined) assert.equal(price.value,'Data pending');
    }
    for (const branch of ['archive','prelaunch']) {
      retained.harness.configure({...input,[branch]:true,localizedContent:{...input.localizedContent,archive:branch==='archive'?{}:undefined}});
      await retained.harness.page({params:Promise.resolve({slug:input.engine.modelSlug,locale:'en'})});
      assert.equal(retained.harness.calls.length,0,`${branch} must not start active quotes`);
    }
  } finally {await withUnused.dispose();await retained.dispose();}
});

// A shared response omits unavailable points consistently; the next response
// owns a fresh grid rather than caching either failures or successful amounts.
test('model image label and rows share failures and retry on the next render', async () => {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    const input=await pricingFixture('gpt-image-2','en');
    h.configure({...input,reject:(_context:unknown,count:number)=>count<=18});
    const unavailable=await h.render(input);
    assert.equal(unavailable.props.pricePerImageLabel,null);
    assert.equal(unavailable.props.keySpecRows.find((row:any)=>row.key==='pricePerImage').value,'Data pending');
    assert.equal(h.calls.length,18);
    h.configure(input);
    const recovered=await h.render(input);
    assert.equal(recovered.props.pricePerImageLabel,'$0.10/image');
    assert.equal(recovered.props.keySpecRows.find((row:any)=>row.key==='pricePerImage').valueLines.length,18);
    assert.equal(h.calls.length,18);
  } finally {await dispose();}
});
