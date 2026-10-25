import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import tailwindConfig from '../frontend/tailwind.config';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { listBuildOnlyPrivateFalEngines } from '../scripts/lib/private-engine-catalog-projection';
import { nano21EditorialFixture } from './helpers/nano21-editorial-fixture';
import { buildGoogleVertexImagePayload } from '../frontend/src/server/images/google-vertex-image-payload';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const fixture = `
import {useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import {useImageWorkspaceQueryHydration} from './app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceQueryHydration';
import {useImageWorkspacePricing} from './app/(core)/(workspace)/app/image/_hooks/useImageWorkspacePricing';
import {useImageGenerationRunner} from './app/(core)/(workspace)/app/image/_hooks/useImageGenerationRunner';
import {useImageSettingsFields} from './app/(core)/(workspace)/app/image/_hooks/useImageSettingsFields';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import {I18nProvider} from './lib/i18n/I18nProvider';
const caps=globalThis.fixtureConfig.engine,noop=()=>{},engines=[{id:caps.id,name:caps.label,modes:caps.modes,aliases:[],engineCaps:caps}];
const initial={engineId:caps.id,mode:'t2i',prompt:'',numImages:1,aspectRatio:null,background:null,resolution:null,
 customImageWidth:'',customImageHeight:'',seed:'',outputFormat:null,quality:null,style:null,maskUrl:'',enableWebSearch:false,
 thinkingLevel:null,maxOutputTokens:null,limitGenerations:false,watermark:false,referenceSlots:[],selectedPreviewEntryId:null,
 selectedPreviewImageIndex:0,error:null,statusMessage:null,authModalOpen:false,localHistory:[],pendingGroups:[]};
function Fixture(){
 const [state,setState]=useState(initial),[accountId,setAccountId]=useState(null);
 const setters=useMemo(()=>Object.fromEntries(Object.keys(initial).map(key=>['set'+key[0].toUpperCase()+key.slice(1),value=>
   setState(current=>({...current,[key]:typeof value==='function'?value(current[key]):value}))])),[]);
 const searchParams=useMemo(()=>new URLSearchParams(location.search),[]);
 const hydration=useImageWorkspaceQueryHydration({...setters,engines,accountId,searchParams,storageHydrated:true,
   composerSignature:JSON.stringify([state.prompt,state.resolution,state.maxOutputTokens]),genericError:'Failed'});
 const pricing=useImageWorkspacePricing({...state,accountId,selectedEngineId:hydration.recipeBlocked?null:state.engineId,
   referenceImageCount:0,readyReferenceSizes:[],referenceSizeSignature:''});
 const handleRun=useImageGenerationRunner({...state,...setters,accountId,blocked:hydration.recipeBlocked,
   selectedEngine:engines[0],pricingSnapshot:pricing.pricingSnapshot,resolvedCopy:DEFAULT_COPY,mutateJobs:async()=>{},
   combinedReferenceUrls:[],readyReferenceUrls:[],readyReferenceSizes:[],selectedCharacterReferences:[],referenceMinRequired:0,
   hasAspectRatioField:true,hasThinkingLevelField:true});
 const fields=useImageSettingsFields({...state,...setters,selectedEngineCaps:caps,resolvedCopy:DEFAULT_COPY});
 globalThis.fixtureState=state;
 return <I18nProvider locale="en" dictionary={globalThis.fixtureConfig.dictionary} fallback={{}}><main className="app-workspace-main">
 <button data-account-switch onClick={()=>{setAccountId('other-account');setState(current=>({...current,prompt:'Other account prompt',error:'Other account state'}));}}>Switch fixture account</button>
 <button data-login onClick={()=>{sessionStorage.setItem('last-known:user-id','synthetic-account');setAccountId('synthetic-account');}}>Fixture login</button>
 <ImageWorkspaceComposerSurface {...Object.fromEntries(['handleAddToLibrary','handleCopy','handleDownload','handleEditSelectedPreview','handleOpenHistoryEntry',
 'handleReferenceFile','handleReferenceUrl','handleRemoveFromLibrary','handleRemoveReferenceSlot','openLibraryForSlot'].map(key=>[key,noop]))}
 {...state} {...setters} {...fields} advancedSettingsTitle="Advanced settings" booleanSelectOptions={[]} composerReferenceAssets={{}} compositePreviewEntry={null}
 composerError={state.error||(pricing.pricingError?'Price unavailable':null)} copiedUrl={null} currency="USD" engineCapsList={[caps]}
 estimatedCostAmount={pricing.pricingSnapshot?pricing.pricingSnapshot.totalCents/100:null} handleRun={handleRun} imageCountOptions={[{value:1,label:'1 image'}]}
 pendingGenerations={[]} isInLibrary={false} isRemovingFromLibrary={false} isSavingToLibrary={false} selectedEngineCaps={caps} selectedEngineId={state.engineId}
 resolvedCopy={DEFAULT_COPY} referenceAssetFields={[]} setNumImagesPreset={setters.setNumImages} setResolutionPreset={setters.setResolution}/>
 <output data-state>{JSON.stringify({engine:state.engineId,prompt:state.prompt,cap:state.maxOutputTokens,resolution:state.resolution,
 aspect:state.aspectRatio,thinking:state.thinkingLevel,blocked:hydration.recipeBlocked,auth:state.authModalOpen,error:state.error,historyLength:state.localHistory.length})}</output>
 </main></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;

test('ID hydration, current exact-cap quote and real image runner preserve 4096 without automatic or external generation', async () => {
  const recipe = nano21EditorialFixture();
  const engine = listBuildOnlyPrivateFalEngines().find(row => row.id === recipe.engineId)!.engine;
  const dictionary = JSON.parse(await readFile(join(frontend, 'messages/en.json'), 'utf8'));
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: frontend }, write: false, outdir: '/nano21-editorial-fixture',
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: join(frontend, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, plugins: [{ name: 'synthetic-authored-data-and-auth-only', setup(build) {
      build.onLoad({ filter: /nano21-editorial-recipes\.json$/ }, () => ({ contents: JSON.stringify([recipe]), loader: 'json' }));
      build.onLoad({ filter: /model-runtime\.json$/ }, async args => {
        const runtime = JSON.parse(await readFile(args.path, 'utf8'));
        const nano = runtime.models.find(row => row.id === recipe.engineId);
        nano.publication.model.published = true; nano.publication.app.published = true;
        return { contents: JSON.stringify(runtime), loader: 'json' };
      });
      build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'fixture-auth', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: `export const supabase={auth:{getSession:async()=>({data:{session:sessionStorage.getItem('last-known:user-id')?{access_token:'synthetic-token',user:{id:'synthetic-account'}}:null}})}};`, loader: 'js' }));
    } }] });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css'].map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: [{ raw: fixture, extension: 'tsx' }, ...tailwindConfig.content.map(pattern => join(frontend, pattern))] })])
    .process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const estimates: Record<string, unknown>[] = [], submissions: Array<{ body: Record<string, unknown>; revision?: string }> = [];
  const nativePayloads: unknown[] = [];
  let quotesOpen = false, stale = true, revision = 11, holdResponse = false;
  let releaseResponse: (()=>void) | undefined;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://fixture').pathname;
    if (path === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text); return; }
    if (path === '/fixture.css') { res.setHeader('content-type', 'text/css'); res.end(css.css); return; }
    if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); res.setHeader('content-type', 'application/json');
      if (path === '/api/images/estimate') {
        estimates.push(body);
        const available = quotesOpen && body.maxOutputTokens === 4096;
        res.statusCode = available ? 200 : 503;
        res.end(JSON.stringify(available ? { ok: true, pricing: { totalCents: 77, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: revision } } }
          : { ok: false, error: 'synthetic_missing_exact_cell' })); return;
      }
      if (path === '/api/images/generate') {
        submissions.push({ body, revision: req.headers['x-maxvideoai-customer-tariff'] as string });
        if (stale) { stale = false; revision = 12; res.statusCode = 409; res.end(JSON.stringify({ ok: false, error: { code: 'PRICING_REFRESH_REQUIRED', message: 'Synthetic quote expired' } })); return; }
        if (holdResponse) { releaseResponse = () => res.end(JSON.stringify({ok:true,mode:'t2i',images:[]})); return; }
        nativePayloads.push(buildGoogleVertexImagePayload({ ...body, imageSize: body.resolution as string, prompt: body.prompt as string, modelId: 'gemini-nano-banana-2.1' }));
        res.end(JSON.stringify({ ok: true, mode: 't2i', engineId: recipe.engineId, images: [] })); return;
      }
      res.statusCode = 404; res.end('{}'); return;
    }
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body class="app-experience"><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const evidence = process.env.NANO21_EDITORIAL_EVIDENCE_DIR;
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
    page.setDefaultTimeout(8000);
    const failures: string[] = [], externalRequests: string[] = [];
    page.on('pageerror', error => {failures.push(error.message);process.stderr.write(error.message+'\n');});
    await page.route('**/*', route => { if (route.request().url().startsWith(url)) return route.continue(); externalRequests.push(route.request().url()); return route.abort(); });
    await page.addInitScript(config => { (globalThis as unknown as {fixtureConfig: unknown}).fixtureConfig = config; }, { engine, dictionary });
    // A response already in flight must be fenced even if the transport ignores abort.
    await page.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const generation = String(input).includes('/api/images/generate');
        return nativeFetch(input, generation ? { ...init, signal: undefined } : init).finally(() => {
          if (generation) {
            const state = window as unknown as { fixtureSettled?: number };
            state.fixtureSettled = (state.fixtureSettled ?? 0) + 1;
          }
        });
      };
    });
    await page.goto(`${url}/?recipe=${recipe.id}`);
    await page.waitForFunction(() => document.querySelector('[data-state]')?.textContent?.includes('"cap":4096'));
    const state = JSON.parse(await page.locator('[data-state]').innerText());
    assert.deepEqual([state.engine, state.prompt, state.cap, state.resolution, state.aspect, state.thinking],
      [recipe.engineId, recipe.prompt, 4096, '1k', '16:9', 'medium']);
    const generate = page.locator('.app-generation-action');
    await page.getByRole('alert').filter({hasText:'Price unavailable'}).waitFor();
    assert.equal(await generate.isDisabled(), true); assert.equal(submissions.length, 0);
    assert.equal(estimates.at(-1)!.maxOutputTokens, 4096);
    quotesOpen = true;
    await page.evaluate(() => window.dispatchEvent(new Event('pricing:refresh-required')));
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
    await generate.click().catch(async error=>{process.stderr.write(JSON.stringify({estimates,submissions,state:await page.locator('[data-state]').innerText(),body:await page.locator('body').innerText()}));throw error;});
    await page.waitForFunction(() => document.querySelector('[data-state]')?.textContent?.includes('"auth":true'));
    assert.equal(submissions.length, 0, 'guest generation opens login before any submission');
    await page.locator('[data-login]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
    await page.getByRole('button', {name:'Options',exact:true}).click();
    const cap = page.getByLabel('Output token limit');
    await cap.waitFor(); assert.equal(await cap.inputValue(), '4096');
    await cap.fill('32768');
    await page.getByRole('alert').filter({hasText:'Price unavailable'}).waitFor();
    assert.equal(await generate.isDisabled(), true);
    await cap.fill('4096');
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
    assert.equal(submissions.length, 0, 'hydration, login and quote changes never generate');
    await generate.click().catch(async error=>{process.stderr.write(JSON.stringify({estimates,submissions,state:await page.locator('[data-state]').innerText(),body:await page.locator('body').innerText()}));throw error;});
    await page.getByRole('alert').filter({hasText:'Synthetic quote expired'}).waitFor();
    assert.equal(submissions.length, 1); assert.equal(nativePayloads.length, 0);
    await page.waitForTimeout(150); assert.equal(submissions.length, 1, 'expired quotes never auto-retry');
    await generate.click().catch(async error=>{process.stderr.write(JSON.stringify({estimates,submissions,state:await page.locator('[data-state]').innerText(),body:await page.locator('body').innerText()}));throw error;});
    await page.waitForFunction(() => document.querySelector('[data-state]')?.textContent?.includes('"error":null'));
    assert.equal(submissions.length, 2); assert.equal(submissions[0].revision, '11'); assert.equal(submissions[1].revision, '12');
    for (const entry of submissions) assert.deepEqual([entry.body.engineId, entry.body.prompt, entry.body.maxOutputTokens, entry.body.numImages, entry.body.thinkingLevel, entry.body.resolution, entry.body.aspectRatio],
      [recipe.engineId, recipe.prompt, 4096, 1, 'medium', '1k', '16:9']);
    assert.deepEqual(nativePayloads, [{ contents: [{ role: 'user', parts: [{ text: recipe.prompt }] }],
      generationConfig: { responseModalities: ['TEXT','IMAGE'], candidateCount: 1, maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: 'MEDIUM' }, imageConfig: { aspectRatio: '16:9', imageSize: '1K' } } }]);
    assert.ok(estimates.some(body=>body.maxOutputTokens===32768)); assert.ok(estimates.some(body=>body.maxOutputTokens===4096));
    if (evidence) {
      await mkdir(evidence,{recursive:true});
      await page.screenshot({path:join(evidence,'synthetic-composer-390.png'),fullPage:true});
      await page.setViewportSize({width:1440,height:950});
      await page.screenshot({path:join(evidence,'synthetic-composer-1440.png'),fullPage:true});
      await page.setViewportSize({width:390,height:950});
    }
    holdResponse = true;
    await generate.click();
    await page.waitForFunction(() => document.querySelector('[data-state]')?.textContent?.includes('"error":null'));
    await page.locator('[data-account-switch]').click();
    assert.ok(releaseResponse); releaseResponse();
    await page.waitForFunction(() => (window as unknown as { fixtureSettled?: number }).fixtureSettled === 3);
    const switched = JSON.parse(await page.locator('[data-state]').innerText());
    assert.equal(switched.prompt, 'Other account prompt'); assert.equal(switched.error, 'Other account state');
    assert.equal(switched.historyLength, 1, 'retired-account result cannot enter new account history');
    assert.equal(submissions.length, 3);
    for (const query of [`recipe=${recipe.id}&engine=nano-banana-2`, `recipe=${recipe.id}&job=synthetic-job`,
      `recipe=${recipe.id}&tool=storyboard`, `recipe=${recipe.id}&recipe=${recipe.id}`, 'recipe=nano21-unknown']) {
      const quoteCount = estimates.length;
      await page.goto(`${url}/?${query}`);
      await page.getByRole('alert').filter({hasText:/recipe/}).waitFor();
      assert.equal(await page.locator('.app-generation-action').isDisabled(), true);
      assert.equal(estimates.length, quoteCount, 'refused recipe never quotes an implicit fallback model');
      assert.equal(submissions.length, 3);
    }
    assert.deepEqual(failures, []); assert.deepEqual(externalRequests, []);
    if (evidence) await writeFile(join(evidence,'synthetic-capture.json'),JSON.stringify({synthetic:true,realProviderRequests:0,charges:0,estimates,submissions,nativePayloads},null,2));
  } finally { await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
