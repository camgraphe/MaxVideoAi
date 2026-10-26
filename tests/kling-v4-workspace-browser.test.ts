import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import tailwindConfig from '../frontend/tailwind.config';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';

// Exercise the actual route surface, state hooks and controls with a library-selection fixture.
// Generation is captured locally: this fixture never calls a provider or spends credits.
const source = `
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './lib/i18n/I18nProvider';
import { WorkspaceComposerSurface } from './app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
import { useWorkspaceComposerState } from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import { useWorkspaceInputSchemaState } from './app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import { coerceFormState } from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { buildWorkspacePreflightInputs } from './app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
const noop = () => {};
const workflowCopy = { generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio', clearReferencesToUseStartEnd: 'Clear references', clearStartEndToUseReferences: 'Clear frames' };
const original = { id: 'owned-source', fieldId: 'video_url', kind: 'video', name: 'Owned source.mp4', type: 'video/mp4', size: 1000, status: 'ready', assetId: 'owned-source', durationSec: 4.25, url: 'https://example.test/exact-original.mp4', previewUrl: 'https://example.test/display-preview.mp4' };
function Fixture() {
  const [engine,setEngine] = useState(globalThis.klingFixtureEngine);
  const [multiPromptEnabled,setMultiPromptEnabled]=useState(false);
  const [multiPromptScenes,setMultiPromptScenes]=useState([{id:'one',prompt:'First shot',duration:15},{id:'two',prompt:'Second shot',duration:15}]);
  const [klingElements,setKlingElements]=useState(Array.from({length:7},(_,i)=>({id:'subject-'+i,frontal:null,references:[null,null,null],video:null})));
  const [form, setForm] = useState(() => coerceFormState(engine, 't2v', null));
  const [inputAssets, setInputAssets] = useState({});
  const [prompt, setPrompt] = useState('Change the lighting while preserving the camera movement.');
  const [captured, setCaptured] = useState(null);
  const [quoted, setQuoted] = useState(true);
  const [cfgScale, setCfgScale] = useState(null);
  const mode = useWorkspaceComposerState({ engines: [engine], form, setForm, inputAssets, klingElements, prompt, multiPromptEnabled,setMultiPromptEnabled,multiPromptScenes,setMultiPromptScenes, voiceIdsInput:'',shotType:'customize',setShotType:noop,
    effectiveRequestedEngineToken: null, authChecked: true, hydratedForScope: 'owner', storageScope: 'owner', preserveStoredDraftRef: useRef(false), requestedEngineOverrideIdRef: useRef(null), requestedEngineOverrideTokenRef: useRef(null), requestedModeOverrideRef: useRef(null), writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: noop });
  const schema = useWorkspaceInputSchemaState({ ...mode, uiLocale: 'en', authChecked: true, authLoading: false, authenticatedUserId: 'owner', uploadLockedCopy: 'Sign in', setInputAssets, setForm });

  return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
    <main className="app-workspace-main"><h1>Offline Kling 4.0 editor fixture</h1>{['t2v','i2v','ref2v','v2v'].map(value=><button key={value} onClick={()=>mode.handleModeChange(value)}>Fixture {value}</button>)}
    <button onClick={()=>setInputAssets({video_url:[original]})}>Restore owned source</button>
    <button onClick={()=>setKlingElements(values=>values.map((value,index)=>({...value,video:index<3?original:null})))}>Restore three video subjects</button>
    <button onClick={()=>setEngine(current=>({...current,modeAvailability:Object.fromEntries(current.modes.map(mode=>[mode,{available:false,reason:'provider_disabled'}]))}))}>Close fixture modes</button>
    <WorkspaceComposerSurface {...mode} selectedEngine={engine} form={form} setForm={setForm} prompt={prompt} setPrompt={setPrompt} negativePrompt="" setNegativePrompt={noop}
      price={quoted ? 1.23 : null} currency="USD" isPricing={false} isSubmitting={false} preflight={quoted ? {ok:true,total:123} : null} preflightError={quoted ? undefined : 'Quote unavailable'} pendingGenerations={[]}
      startRender={() => setCaptured({ mode: mode.submissionMode, resolution: form.resolution, inputs: buildWorkspacePreflightInputs(inputAssets) })}
      inputSchemaSummary={schema.inputSchemaSummary} inputAssets={inputAssets} workflowCopy={workflowCopy} guestUploadLockedReason={null} uiLocale="en"
      handleAssetAdd={noop} handleAssetRemove={(field,index) => setInputAssets(current => ({ ...current, [field.id]: (current[field.id] ?? []).filter((_,i) => i !== index) }))}
      handleOpenAssetLibrary={(field) => setInputAssets(current => ({ ...current, [field.id]: [original] }))} showNotice={noop}
      multiPromptEnabled={multiPromptEnabled} setMultiPromptEnabled={setMultiPromptEnabled} multiPromptScenes={multiPromptScenes}
      voiceControlEnabled={false} cfgScale={cfgScale} setCfgScale={setCfgScale} shotType="customize" setShotType={noop} voiceIdsInput="" setVoiceIdsInput={noop}
      seedValue="" handleSeedChange={noop} cameraFixedValue={false} handleCameraFixedChange={noop} safetyCheckerValue={true} handleSafetyCheckerChange={noop}
      klingElements={klingElements} handleKlingElementAdd={()=>setKlingElements(values=>[...values,{id:'extra',frontal:null,references:[null,null,null],video:null}])} handleKlingElementRemove={id=>setKlingElements(values=>values.filter(value=>value.id!==id))} handleKlingElementAssetAdd={noop} handleKlingElementAssetRemove={noop} handleOpenKlingAssetLibrary={noop} setViewMode={noop} />
    <output hidden data-mode>{mode.submissionMode}</output><output hidden data-assets>{JSON.stringify(inputAssets)}</output><output hidden data-scenes>{JSON.stringify(multiPromptScenes)}</output><output hidden data-captured>{JSON.stringify(captured)}</output></main>
  </I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
`;

test('offline V4 workspace edits thirty-second shots, preserves modes and subjects, and keeps unsupported controls absent', {timeout:120_000}, async (t) => {
  const frontend=join(process.cwd(),'frontend');
  const bundle=await build({stdin:{contents:source,loader:'tsx',resolveDir:frontend},write:false,bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(frontend,'tsconfig.json'),outdir:'/kling-v4-fixture',define:{'process.env.NODE_ENV':'"production"'}});
  const script=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text;
  const requireFrontend = createRequire(join(frontend, 'package.json'));
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css'].map(path => readFile(join(frontend, path), 'utf8')));
  const productionCss = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig, content: [
    ...tailwindConfig.content.map(pattern => join(frontend, pattern)), { raw: source, extension: 'tsx' },
  ] })]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const css=productionCss.css;
  const server=createServer((request,response)=>{const path=new URL(request.url??'/','http://fixture').pathname;response.setHeader('content-type',path==='/fixture.js'?'text/javascript':path==='/fixture.css'?'text/css':'text/html');response.end(path==='/fixture.js'?script:path==='/fixture.css'?css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="app-experience"><div id="root"></div></body></html>');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:1000}});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://example.test/**',route=>route.abort());
  try {
    await page.goto(`http://127.0.0.1:${address.port}/app`);
    await page.evaluate(engine=>{(globalThis as any).klingFixtureEngine=engine;(globalThis as any).process={env:{NODE_ENV:'production'}};},KLING_V4_ENGINE);
    await page.addScriptTag({url:`http://127.0.0.1:${address.port}/fixture.js`});
    await page.locator('.app-generation-action').waitFor();
    await page.getByRole('button',{name:'Multi-prompt',exact:true}).click();
    assert.match(await page.locator('body').innerText(),/Total: 30s.*Max 30s/);
    const durations=page.locator('input[type="number"]');
    assert.equal(await durations.first().getAttribute('min'),'1');
    await durations.first().fill('14.5');
    assert.match(await page.locator('body').innerText(),/whole seconds/);
    assert.equal(await durations.first().inputValue(),'14.5');
    assert.equal(await page.locator('.app-generation-action').isDisabled(),true);
    await durations.first().fill('15');
    await page.getByRole('button',{name:'Fixture ref2v',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mode]')?.textContent==='ref2v');
    assert.equal(await page.getByRole('button',{name:'+ Subject',exact:true}).isDisabled(),true);
    assert.equal(await page.locator('input[accept="video/*"]').count(),7,'each empty R2V subject can use a video; selections share the three-video limit');
    await page.getByRole('button',{name:'Restore three video subjects',exact:true}).click();
    assert.equal(await page.locator('input[accept="video/*"]:disabled').count(),4,'three selected video subjects disable adding a fourth');
    assert.match(await page.locator('body').innerText(),/Voices remain unavailable without a verified owned binding/i);
    assert.equal(await page.locator('input[placeholder*="voice" i]').count(),0);
    await page.getByRole('button',{name:'Fixture v2v',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mode]')?.textContent==='v2v');
    assert.equal(await page.getByRole('button',{name:'Multi-prompt',exact:true}).count(),0);
    assert.equal(await page.locator('input[accept="video/*"]:enabled').count(),0,'Edit offers no video subject inputs; existing videos stay visible for removal');
    assert.match(await page.locator('body').innerText(),/Edit accepts image subjects only/);
    await page.getByRole('button',{name:'Restore owned source',exact:true}).click();
    await page.getByRole('button',{name:'Fixture i2v',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mode]')?.textContent==='i2v');
    assert.match(await page.locator('[data-assets]').innerText(),/exact-original.mp4/);
    assert.match(await page.locator('body').innerText(),/Media from other modes stays saved/);
    await page.getByRole('button',{name:'Fixture t2v',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mode]')?.textContent==='t2v');
    assert.equal(await page.getByRole('textbox',{name:'Scene 1 prompt'}).inputValue(),'First shot');
    await page.getByRole('button',{name:'Multi-prompt on',exact:true}).click();
    await page.locator('textarea').first().fill('x'.repeat(26001));
    assert.match(await page.locator('body').innerText(),/26001\/26000/);
    assert.equal(await page.locator('.app-generation-action').isDisabled(),true);
    await page.locator('textarea').first().fill('An authored scene.');
    assert.equal(await page.locator('body').innerText().then(text=>/CFG|Shot type|Voice IDs/.test(text)),false);
    await page.getByRole('button',{name:'Close fixture modes',exact:true}).click();
    await page.getByRole('button',{name:'Fixture v2v',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-mode]')?.textContent==='v2v');
    assert.equal(await page.locator('.app-generation-action').isDisabled(),true);
    assert.match(await page.locator('body').innerText(),/temporarily unavailable/);
    if(process.env.KLING_V4_BROWSER_EVIDENCE_DIR){await mkdir(process.env.KLING_V4_BROWSER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.KLING_V4_BROWSER_EVIDENCE_DIR,'workspace-v4-controls.png'),fullPage:true});}
    assert.deepEqual(errors,[]);t.diagnostic(`Chromium ${browser.version()}: actual workspace hooks and composer, no provider calls.`);
  } finally {await browser.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
