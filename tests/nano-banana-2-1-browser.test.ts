import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { listBuildOnlyPrivateFalEngines } from '../scripts/lib/private-engine-catalog-projection';
import { normalizeNano21Settings } from '../frontend/src/lib/nano-banana-2-1';
import { buildGoogleVertexImagePayload } from '../frontend/src/server/images/google-vertex-image-payload';
import { GoogleVertexImageClient } from '../frontend/src/server/images/google-vertex-image-client';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const fixture = `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageWorkspaceComposerSurface } from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import { useImageWorkspacePricing } from './app/(core)/(workspace)/app/image/_hooks/useImageWorkspacePricing';
import { DEFAULT_COPY } from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import { I18nProvider } from './lib/i18n/I18nProvider';
const engine=globalThis.fixtureConfig.engine, noop=()=>{};
function Fixture(){
 const [resolution,setResolution]=useState('1k'),[thinkingLevel,setThinkingLevel]=useState('medium'),[prompt,setPrompt]=useState('A synthetic studio still');
 const pricing=useImageWorkspacePricing({selectedEngineId:engine.id,mode:'t2i',numImages:1,resolution,thinkingLevel,aspectRatio:'1:1',quality:null,
   customImageWidth:'',customImageHeight:'',enableWebSearch:false,referenceImageCount:0,readyReferenceSizes:[],referenceSizeSignature:''});
 const options=values=>values.map(value=>({value,label:value.toUpperCase()}));
 return <I18nProvider locale="en" dictionary={globalThis.fixtureConfig.dictionary} fallback={{}}><main className="app-workspace-main">
 <ImageWorkspaceComposerSurface {...Object.fromEntries(['handleAddToLibrary','handleCopy','handleDownload','handleEditSelectedPreview','handleOpenHistoryEntry',
 'handleReferenceFile','handleReferenceUrl','handleRemoveFromLibrary','handleRemoveReferenceSlot','openLibraryForSlot','setAspectRatio','setBackground',
 'setCustomImageHeight','setCustomImageWidth','setEnableWebSearch','setEngineId','setError','setLimitGenerations','setMaskUrl','setMode','setNumImagesPreset',
 'setOutputFormat','setQuality','setSeed','setSelectedPreviewImageIndex','setStyle','setWatermark'].map(key=>[key,noop]))}
 advancedSettingsTitle="Advanced settings" aspectRatio="1:1" aspectRatioSelectOptions={options(engine.aspectRatios)} booleanSelectOptions={[]} backgroundSelectOptions={[]}
 composerError={pricing.pricingError?'Price unavailable':null} composerReferenceAssets={{}} compositePreviewEntry={null} copiedUrl={null} currency="USD"
 customImageHeight="" customImageWidth="" enableWebSearch={false} engineCapsList={[engine]} estimatedCostAmount={pricing.pricingSnapshot?pricing.pricingSnapshot.totalCents/100:null}
 handleRun={async()=>{await fetch('/fixture/generate',{method:'POST',body:JSON.stringify({resolution,thinkingLevel,prompt})});globalThis.fixtureSubmitted=true;}}
 imageCountOptions={[{value:1,label:'1 image'}]} pendingGenerations={[]} isInLibrary={false} isRemovingFromLibrary={false} isResolutionLocked={false} isSavingToLibrary={false}
 limitGenerations={false} maskUrl="" mode="t2i" numImages={1} outputFormatSelectOptions={[]} prompt={prompt} qualitySelectOptions={[]} referenceAssetFields={[]}
 resolution={resolution} resolutionSelectOptions={options(engine.resolutions)} resolvedCopy={DEFAULT_COPY} seed="" selectedEngineCaps={engine} selectedEngineId={engine.id}
 selectedPreviewImageIndex={0} styleSelectOptions={[]} setPrompt={setPrompt} setResolutionPreset={setResolution} setThinkingLevel={setThinkingLevel}
 showAspectRatioControl showResolutionControl showThinkingLevelControl showNumImagesControl thinkingLevel={thinkingLevel} thinkingLevelSelectOptions={options(['minimal','medium','high'])}
 statusMessage={null} watermark={false} />
 <output data-thinking>{thinkingLevel}</output><output data-resolution>{resolution}</output>
 </main></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;

test('real image composer binds reasoning to its quote, disables missing prices and captures one unpaid fake Vertex POST', async () => {
  const engine = listBuildOnlyPrivateFalEngines().find(row => row.id === 'nano-banana-2-1')!.engine;
  const dictionary = JSON.parse(await readFile(join(frontend, 'messages/en.json'), 'utf8'));
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: frontend }, write: false, outdir: '/nano21-browser-fixture',
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: join(frontend, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}'  } });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css'].map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: [{ raw: fixture, extension: 'tsx' }, ...tailwindConfig.content.map(pattern => join(frontend, pattern))] })])
    .process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  let quoteEnabled = false;
  const estimates: Record<string, unknown>[] = [];
  const providerPosts: Array<{ url: string; payload: unknown }> = [];
  const client = new GoogleVertexImageClient({ projectId: 'synthetic-existing-project', location: 'europe-west4',
    apiBaseUrl: 'https://aiplatform.googleapis.com', serviceAccount: { client_email: 'fixture@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'synthetic', fetchFn: async (url, init) => {
      providerPosts.push({ url: String(url), payload: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'c3ludGhldGlj' } }] } }] }));
    } });
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://fixture').pathname;
    if (path === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text); return; }
    if (path === '/fixture.css') { res.setHeader('content-type', 'text/css'); res.end(css.css); return; }
    if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      res.setHeader('content-type', 'application/json');
      if (path === '/api/images/estimate') {
        estimates.push(body);
        res.statusCode = quoteEnabled ? 200 : 503;
        res.end(JSON.stringify(quoteEnabled ? { ok: true, pricing: { totalCents: 77, currency: 'USD', meta: { customerTariffRevision: 11 } } } : { ok: false, error: 'synthetic_missing_cell' }));
        return;
      }
      if (path === '/fixture/generate') {
        const settings = normalizeNano21Settings(body);
        await client.generateContent('gemini-nano-banana-2.1', buildGoogleVertexImagePayload({ ...settings, modelId: 'gemini-nano-banana-2.1', prompt: body.prompt, aspectRatio: '1:1' }));
        res.end(JSON.stringify({ ok: true })); return;
      }
      res.statusCode = 404; res.end('{}'); return;
    }
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="app-experience"><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const evidence = process.env.NANO21_BROWSER_EVIDENCE_DIR;
  try {
    for (const width of [1440, 390]) {
      quoteEnabled = false;
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const failures: string[] = [];
      page.on('pageerror', error => { failures.push(error.message); process.stderr.write(`Fixture browser error: ${error.message}\n`); });
      await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
      await page.addInitScript(config => { (globalThis as unknown as { fixtureConfig: unknown }).fixtureConfig = config; }, { engine, dictionary });
      await page.goto(url);
      const generate = page.locator('.app-generation-action');
      await page.waitForFunction(() => document.querySelector('.app-generation-action') || document.body.textContent?.includes('Application error'), { timeout: 10000 }).catch(async error => { process.stderr.write(await page.locator('body').innerText()); throw error; });
      await page.getByRole('alert').filter({hasText:'Price unavailable'}).waitFor({timeout:10000}).catch(async error => { process.stderr.write(JSON.stringify({failures,estimates,body:await page.locator('body').innerText()})); throw error; });
      assert.equal(await generate.isDisabled(), true);
      assert.equal(providerPosts.length, width === 1440 ? 0 : 1);
      quoteEnabled = true;
      await page.getByRole('button', { name: /Resolution:.*1K/i }).click();
      await page.getByRole('option', { name: /Resolution:.*4K/i }).click({timeout:5000}).catch(async error=>{process.stderr.write(JSON.stringify({body:await page.locator('body').innerText(),failures}));throw error;});
      await page.getByRole('button', { name: 'Options', exact: true }).click();
      await page.locator('.app-advanced-content button[aria-haspopup="listbox"]').click({timeout:5000}).catch(async error=>{process.stderr.write(JSON.stringify({body:await page.locator('body').innerText(),failures}));throw error;});
      await page.getByRole('option').filter({hasText:/^HIGH$/}).click();
      await page.waitForFunction(() => document.querySelector('[data-thinking]')?.textContent === 'high');
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
      assert.ok(estimates.some(body => body.resolution === '4k' && body.thinkingLevel === 'high'));
      await generate.click();
      await page.waitForFunction(() => Boolean((globalThis as unknown as { fixtureSubmitted?: boolean }).fixtureSubmitted));
      const captured = providerPosts.at(-1)!.payload as { generationConfig: { thinkingConfig: { thinkingLevel: string }; maxOutputTokens: number; imageConfig: { imageSize: string } } };
      assert.equal(captured.generationConfig.thinkingConfig.thinkingLevel, 'HIGH');
      assert.equal(captured.generationConfig.imageConfig.imageSize, '4K');
      assert.equal(captured.generationConfig.maxOutputTokens, 32768);
      assert.match(providerPosts.at(-1)!.url, /\/locations\/global\//);
      assert.deepEqual(failures, []);
      if (evidence) { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: join(evidence, `composer-${width}.png`), fullPage: true }); }
      await page.close();
    }
    assert.equal(providerPosts.length, 2, 'one intercepted native POST per explicit fixture click');
    if (evidence) await writeFile(join(evidence, 'capture.json'), JSON.stringify({ synthetic: true, realProviderRequests: 0, charges: 0, estimates, providerPosts }, null, 2));
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
