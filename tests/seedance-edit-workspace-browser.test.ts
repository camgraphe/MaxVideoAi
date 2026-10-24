import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { isWorkspaceModeAvailable, coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import {resolveVideoOperationEngine} from '../frontend/lib/video-operation';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';

// Exercise the actual route surface, state hooks and controls with a library-selection fixture.
// Generation is captured locally: this fixture never calls a provider or spends credits.
const source = `
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './lib/i18n/I18nProvider';
import { WorkspaceComposerSurface } from './app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
import { useWorkspaceEngineModeState } from './app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import { useWorkspacePricingGate } from './app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate';
import { useWorkspaceInputSchemaState } from './app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import { coerceFormState } from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { buildWorkspacePreflightInputs } from './app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
const noop = () => {};
const account={userId:'owner',token:'fixture-only'};
const workflowCopy = { generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio', clearReferencesToUseStartEnd: 'Clear references', clearStartEndToUseReferences: 'Clear frames' };
const original = { id: 'owned-source', fieldId: 'video_url', kind: 'video', name: 'Owned source.mp4', type: 'video/mp4', size: 1000, status: 'ready', assetId: 'owned-source', durationSec: 4.25, url: 'https://example.test/exact-original.mp4', previewUrl: 'https://example.test/display-preview.mp4' };
function Fixture() {
  const [engine, setEngine] = useState(globalThis.seedanceFixtureEngine);
  const [form, setForm] = useState(() => coerceFormState(engine, 't2v', null));
  const [inputAssets, setInputAssets] = useState({});
  const [prompt, setPrompt] = useState('Change the lighting while preserving the camera movement.');
  const [captured, setCaptured] = useState(null);
  const [quoted, setQuoted] = useState(true);
  const [rejected,setRejected]=useState(false);
  const [cfgScale, setCfgScale] = useState(null);
  const mode = useWorkspaceEngineModeState({ engines: [engine], form, setForm, inputAssets, klingElements: [], shotType: 'customize', setShotType: noop,
    effectiveRequestedEngineToken: null, authChecked: true, hydratedForScope: 'owner', storageScope: 'owner', preserveStoredDraftRef: useRef(false), requestedEngineOverrideIdRef: useRef(null), requestedEngineOverrideTokenRef: useRef(null), requestedModeOverrideRef: useRef(null), writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: noop });
  const schema = useWorkspaceInputSchemaState({ ...mode, uiLocale: 'en', authChecked: true, authLoading: false, authenticatedUserId: 'owner', uploadLockedCopy: 'Sign in', setInputAssets, setForm });
  const quote=useWorkspacePricingGate({accessToken:account.token,authChecked:true,locale:'en',memberTier:'Member',setMemberTier:noop,topUpCopy:{},selectedEngine:mode.selectedEngine,submissionMode:mode.submissionMode,form,effectiveDurationSec:mode.effectiveDurationSec,supportsAudioToggle:mode.supportsAudioToggle,voiceControlEnabled:false,inputAssets});
  const toggle = available => setEngine(current => ({ ...current, modeAvailability: { ...current.modeAvailability, v2v: { available, reason: available ? 'available' : 'provider_disabled' } } }));
  return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
    <main><button onClick={() => toggle(true)}>Enable Edit fixture</button><button onClick={() => toggle(false)}>Disable Edit fixture</button>
    <button onClick={() => setForm(current=>({...current,durationSec:10,durationOption:'10',aspectRatio:'9:16',audio:false,seed:123,extraInputValues:{...current.extraInputValues,safety_tolerance:3}}))}>Restore native Draft settings fixture</button>
    <button onClick={() => setInputAssets({ video_url: [original] })}>Restore saved Edit fixture</button>
    <button onClick={() => setRejected(true)}>Reject quote fixture</button><button onClick={() => setRejected(false)}>Accept quote fixture</button><button onClick={() => setQuoted(false)}>Missing Edit tariff fixture</button><button onClick={() => setQuoted(true)}>Restore Edit quote fixture</button>
    <WorkspaceComposerSurface {...mode} sourceAccount={account} form={form} setForm={setForm} prompt={prompt} setPrompt={setPrompt} negativePrompt="" setNegativePrompt={noop}
      price={quoted ? quote.price : null} currency="USD" isPricing={quote.isPricing} isSubmitting={false} preflight={rejected ? {ok:false,error:'Fixture rejected'} : quoted ? quote.preflight : null} preflightError={quoted ? quote.preflightError : 'Quote unavailable'} pendingGenerations={[]}
      startRender={() => setCaptured({ mode: mode.submissionMode, resolution: form.resolution, inputs: buildWorkspacePreflightInputs(inputAssets) })}
      inputSchemaSummary={schema.inputSchemaSummary} inputAssets={inputAssets} workflowCopy={workflowCopy} guestUploadLockedReason={null} uiLocale="en"
      handleAssetAdd={noop} handleAssetRemove={(field,index) => setInputAssets(current => ({ ...current, [field.id]: (current[field.id] ?? []).filter((_,i) => i !== index) }))}
      handleOpenAssetLibrary={(field) => setInputAssets(current => ({ ...current, [field.id]: [original] }))} showNotice={noop}
      multiPromptEnabled={false} setMultiPromptEnabled={noop} multiPromptScenes={[]} multiPromptTotalSec={0} multiPromptActive={false} multiPromptInvalid={false} multiPromptError={null}
      handleMultiPromptAddScene={noop} handleMultiPromptRemoveScene={noop} handleMultiPromptUpdateScene={noop}
      voiceControlEnabled={false} cfgScale={cfgScale} setCfgScale={setCfgScale} shotType="customize" setShotType={noop} voiceIdsInput="" setVoiceIdsInput={noop}
      seedValue="" handleSeedChange={noop} cameraFixedValue={false} handleCameraFixedChange={noop} safetyCheckerValue={true} handleSafetyCheckerChange={noop}
      klingElements={[]} handleKlingElementAdd={noop} handleKlingElementRemove={noop} handleKlingElementAssetAdd={noop} handleKlingElementAssetRemove={noop} handleOpenKlingAssetLibrary={noop} setViewMode={noop} />
    <output data-form>{JSON.stringify(form)}</output><output data-quote>{JSON.stringify(quote.preflight)}</output><output data-mode>{mode.submissionMode}</output><output data-resolution>{form.resolution}</output><output data-captured>{JSON.stringify(captured)}</output></main>
  </I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
`;

test('real workspace source selection enables Edit and preserves unavailable saved sources', { timeout: 120_000 }, async (t) => {
  const frontend = join(process.cwd(), 'frontend');
  const bundle = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: frontend }, write: false, bundle: true,
    platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: join(frontend, 'tsconfig.json'), outdir: '/seedance-edit-fixture', define: { 'process.env.NODE_ENV': '"production"' } });
  const script = bundle.outputFiles.find((file) => file.path.endsWith('.js'))!.text;
  const css = bundle.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '';
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://fixture').pathname;
    if(pathname==='/api/preflight'){let body='';request.on('data',chunk=>{body+=chunk;});request.on('end',()=>{const value=JSON.parse(body);response.setHeader('content-type','application/json');response.end(JSON.stringify({ok:true,total:value.sourceJobId?0:123}));});return;}
    if(pathname==='/api/jobs/source-options'){response.setHeader('content-type','application/json');response.end(JSON.stringify({ok:true,sources:[{sourceJobId:'native-owned',sourceOutputId:'native-output',label:'Owned native generation',createdAt:'2026-10-24',durationSec:5,preparation:'ready'}],nextCursor:null}));return;}
    response.setHeader('content-type', pathname === '/fixture.js' ? 'text/javascript' : pathname === '/fixture.css' ? 'text/css' : 'text/html');
    response.end(pathname === '/fixture.js' ? script : pathname === '/fixture.css' ? css : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://example.test/**', (route) => route.abort());
  try {
    await page.goto(`http://127.0.0.1:${address.port}/app`);
    const engine = getBaseEnginesByCategory('video').find(({ id }) => id === 'seedance-2-5')!;
    await page.evaluate((engine) => { (globalThis as any).seedanceFixtureEngine = { ...engine, modeAvailability: { v2v: { available: false, reason: 'provider_disabled' } } }; (globalThis as any).process = { env: { NODE_ENV: 'production' } }; }, engine);
    await page.addScriptTag({ url: `http://127.0.0.1:${address.port}/fixture.js` });
    await page.locator('.app-generation-action').waitFor();
    assert.equal(await page.locator('[data-mode]').innerText(), 't2v');
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
    await page.locator('[data-reference-command="collections"]').click();
    await page.locator('[data-reference-role="video_url"]').click();
    assert.equal(await page.locator('[data-reference-field="video_url"] .app-reference-add-target').isDisabled(), true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Enable Edit fixture' }).click();
    await page.locator('[data-reference-command="collections"]').click();
    await page.locator('[data-reference-role="video_url"]').click();
    await page.locator('[data-reference-field="video_url"] .app-reference-library-target').click();
    await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 'v2v');
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
    await page.locator('.app-generation-action').click();
    await page.waitForFunction(() => document.querySelector('[data-captured]')?.textContent !== 'null');
    const captured = JSON.parse(await page.locator('[data-captured]').innerText());
    assert.equal(captured.mode, 'v2v'); assert.ok(['480p', '720p'].includes(captured.resolution));
    assert.deepEqual(captured.inputs, [{ assetId: 'owned-source', slotId: 'video_url', kind: 'video', url: 'https://example.test/exact-original.mp4' }]);
    await page.getByRole('button', { name: 'Missing Edit tariff fixture' }).click();
    assert.equal(await page.locator('.app-generation-action').isDisabled(), true);
    await page.getByRole('button', { name: 'Restore Edit quote fixture' }).click();
    assert.equal(await page.locator('.app-generation-action').isDisabled(), false);
    await page.getByRole('button', { name: 'Disable Edit fixture' }).click();
    assert.equal(await page.locator('.app-generation-action').isDisabled(), true);
    assert.match(await page.locator('body').innerText(), /temporarily unavailable/);
    const savedSource = page.getByRole('button', { name: 'Manage · Source video · Owned source.mp4', exact: true });
    await expect(savedSource).toBeVisible();
    await expect(page.locator('.app-reference-selected-manage')).toHaveText('Source video');
    await expect(savedSource).toBeEnabled(); // A saved source stays manageable when its provider is unavailable.
    await savedSource.click();
    await expect(page.locator('[data-reference-field="video_url"] video')).toHaveAttribute('src', 'https://example.test/display-preview.mp4');
    await expect(page.locator('[data-reference-field="video_url"] video')).toHaveAttribute('aria-label', 'Owned source.mp4');
    await page.locator('[data-reference-field="video_url"] button').filter({ hasText: 'Remove' }).click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 't2v');
    await page.getByRole('button', { name: 'Restore saved Edit fixture' }).click();
    await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 'v2v');
    assert.equal(await page.locator('.app-generation-action').isDisabled(), true);
    if (process.env.SEEDANCE_EDIT_BROWSER_EVIDENCE_DIR) {
      await mkdir(process.env.SEEDANCE_EDIT_BROWSER_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.SEEDANCE_EDIT_BROWSER_EVIDENCE_DIR, 'seedance-edit-unavailable.png'), fullPage: true });
    }
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of ['seedance-2-5', 'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'kling-o3-standard', 'kling-o3-pro']) {
        await page.goto(`http://127.0.0.1:${address.port}/app`);
        const engine = getBaseEnginesByCategory('video').find(engine => engine.id === id)!;
        await page.evaluate(engine => { (globalThis as any).seedanceFixtureEngine = engine; (globalThis as any).process = { env: { NODE_ENV: 'production' } }; }, engine);
        await page.addScriptTag({ url: `http://127.0.0.1:${address.port}/fixture.js` });
        const modify = page.getByRole('button', { name: 'Modify Video', exact: true });
        await modify.click();
        await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 'v2v');
        assert.equal(await modify.getAttribute('aria-pressed'), 'true', `${id}/${width}: explicit empty Modify`);
        assert.equal(await page.locator('.app-generation-action').isDisabled(), true, 'source is required');
        assert.equal(await page.locator('[data-reference-command="image_url"]').count(), 0, 'creation frames do not leak into Modify');
        await page.locator('[data-reference-command="video_url"]').click();
        await page.locator('[data-reference-field="video_url"] .app-reference-library-target').click();
        await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
        await page.locator('.app-generation-action').click();
        const request = JSON.parse(await page.locator('[data-captured]').innerText());
        assert.equal(request.mode, 'v2v');
        assert.equal(request.inputs[0].assetId, 'owned-source');
        assert.equal(request.inputs[0].url, 'https://example.test/exact-original.mp4');
        if (process.env.SEEDANCE_EDIT_BROWSER_EVIDENCE_DIR) {
          await page.screenshot({ path: join(process.env.SEEDANCE_EDIT_BROWSER_EVIDENCE_DIR, `${id}-${width}-modify.png`), fullPage: true });
        }
        await page.locator('[data-reference-command="video_url"]').click();
        await page.locator('[data-reference-field="video_url"] button').filter({ hasText: 'Remove' }).click();
        await page.keyboard.press('Escape');
        assert.equal(await modify.getAttribute('aria-pressed'), 'true', 'removing a source retains Modify');
        await page.getByRole('button', { name: 'Generate', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 't2v');
        assert.equal(await page.locator('[data-reference-command="image_url"]').count(), 1, 'Create restores frame inputs');
        const extend = page.getByRole('button', { name: 'Extend Video', exact: true });
        if (id.startsWith('seedance')) {
          await extend.click();
          await page.waitForFunction(() => document.querySelector('[data-mode]')?.textContent === 'extend');
          assert.equal(await extend.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.app-generation-action').isDisabled(), true);
          await page.locator('[data-reference-command="extension_source_videos"]').click();
          await page.locator('[data-reference-field="extension_source_videos"] .app-reference-library-target').first().click();
          await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled);
          await page.locator('.app-generation-action').click();
          const extended = JSON.parse(await page.locator('[data-captured]').innerText());
          assert.equal(extended.mode, 'extend');
          assert.equal(extended.inputs[0].slotId, 'extension_source_videos');
          assert.equal(extended.inputs[0].assetId, 'owned-source');
        } else assert.equal(await extend.count(), 0, 'Kling has no supported Extend endpoint');
      }
    }
    let catalogCases = 0;
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const engine of getBaseEnginesByCategory('video')) {
        await page.goto(`http://127.0.0.1:${address.port}/app`);
        await page.evaluate(engine => { (globalThis as any).seedanceFixtureEngine = engine; (globalThis as any).process = { env: { NODE_ENV: 'production' } }; }, engine);
        await page.addScriptTag({ url: `http://127.0.0.1:${address.port}/fixture.js` });
        await page.locator('[data-mode]').waitFor();
        for (const [mode, label] of [['v2v', 'Modify Video'], ['extend', 'Extend Video'], ['reframe', 'Reframe Video']] as const) {
          const action = page.getByRole('button', { name: label, exact: true });
          assert.equal(await action.count(), isWorkspaceModeAvailable(engine, mode) ? 1 : 0, `${engine.id}/${width}/${mode}: action matches public capabilities`);
          if (!isWorkspaceModeAvailable(engine, mode)) continue;
          await action.click();
          await page.waitForFunction(mode => document.querySelector('[data-mode]')?.textContent === mode, mode);
          assert.equal(await action.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.app-generation-action').isDisabled(), true, `${engine.id}/${mode}: source is required before generating; ${await page.locator('body').innerText()}`);
          const form = coerceFormState(engine, mode, null);
          const projected=resolveVideoOperationEngine(engine,mode,form.operation);
          const workflow = resolveWorkspaceWorkflow({ engine:projected, form, inputAssets: {}, klingElements: [] });
          const summary = summarizeWorkspaceInputSchema({ selectedEngine:projected, ...workflow, uiLocale: 'en' });
          const commands = await page.locator('[data-reference-command]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-reference-command')));
          const source = summary.assetFields.find(({ field, required }) => field.type === 'video' && required)!;
          const owned=(engine.id==='luma-ray-3-2'&&mode==='extend')||(engine.id==='flux-3-draft'&&mode==='v2v');
          if(owned){
            await page.getByTestId('owned-generation-source-picker').waitFor();
            assert.equal(await page.getByTestId('owned-generation-source-picker').getAttribute('data-operation'),engine.id==='flux-3-draft'?'flux-draft-enhance':'luma-extend');
            assert.equal(await page.locator('input[type=file]').count(),0,'only an owned generation supplies source authority');
            assert.equal(commands.length,0);
            const picker=page.getByTestId('owned-generation-source-picker');
            await picker.locator('select').selectOption('native-owned');
            await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.app-generation-action')?.disabled).catch(async error=>{throw new Error(`${engine.id}/${mode}: ${await page.locator('body').innerText()}`,{cause:error});});
            assert.match(await page.locator('.app-generation-quote').innerText(),/0[.,]00/,'a valid zero-cent quote remains executable');
            await page.getByRole('button',{name:'Missing Edit tariff fixture'}).click();
            assert.equal(await page.locator('.app-generation-action').isDisabled(),true,'absent quote blocks owned-source submission');
            await page.getByRole('button',{name:'Restore Edit quote fixture'}).click();
            assert.equal(await page.locator('.app-generation-action').isDisabled(),false);
            await page.getByRole('button',{name:'Reject quote fixture'}).click();
            assert.equal(await page.locator('.app-generation-action').isDisabled(),true,'invalid quote blocks submission');
            await page.getByRole('button',{name:'Accept quote fixture'}).click();
            assert.equal(await page.locator('.app-generation-action').isDisabled(),false,'valid zero-cent quote remains executable');
            await picker.getByRole('button',{name:'Remove source',exact:true}).click();
            assert.equal(await page.locator('.app-generation-action').isDisabled(),true,'removal revokes source and quote immediately');
          } else if (engine.id === 'luma-ray-3-2' && mode === 'v2v') {
            const editor = page.locator('section').filter({ hasText: 'Ray 3.2 Modify' });
            await editor.locator('input[type="file"][accept*="video"]').waitFor({ state: 'attached' });
            assert.equal(await page.locator('[data-reference-command="video_url"]').count(), 0, 'Luma keyframe editor owns its source without a duplicate picker');
          } else assert.equal(commands[0], source.field.id, `${engine.id}/${mode}: source comes first`);
          for (const id of commands) {
            if (id === 'collections') {
              await page.locator('[data-reference-command="collections"]').click();
              const referenceIds = await page.locator('[data-reference-field]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-reference-field')));
              assert.ok(referenceIds.length, 'reference menu must not be empty');
              for (const ref of referenceIds) assert.ok(summary.assetFields.some(({ field }) => field.id === ref && field.id !== source.field.id), `${engine.id}/${mode}: extraneous ${ref} reference`);
              await page.keyboard.press('Escape');
            } else assert.ok(summary.assetFields.some(({ field }) => field.id === id), `${engine.id}/${mode}: extraneous ${id} control`);
          }
          assert.equal(await page.getByRole('button', { name: 'Storyboard', exact: true }).count(), 0);
          catalogCases++;
        }
        if(engine.id==='flux-3'||engine.id==='flux-3-draft') {
          if(await page.locator('[data-mode]').innerText()!=='extend')await page.getByRole('button',{name:'Extend Video',exact:true}).click();
          await page.getByRole('button',{name:'Restore native Draft settings fixture'}).click();
          await page.locator('[data-reference-command="video_url"]').click();
          await page.locator('[data-reference-field="video_url"] .app-reference-library-target').click();
          await page.waitForFunction(()=>document.querySelector('[data-quote]')?.textContent!=='null');
          const native=JSON.parse(await page.locator('[data-form]').innerText());
          const held:import('@playwright/test').Route[]=[];
          await page.route('**/api/preflight',route=>{held.push(route);});
          await page.getByRole('button',{name:'Modify Video',exact:true}).click();
          assert.equal(await page.locator('[data-quote]').innerText(),'null','changing native Extend to an operation revokes the old quote');
          assert.equal(await page.getByRole('button',{name:'Extend Video',exact:true}).count(),1,'native Extend stays navigable from an operation');
          if(engine.id==='flux-3') {
            await expect.poll(()=>held.length).toBe(1);
            assert.equal(held.length,1);assert.equal(held[0].request().postDataJSON().operation,'flux-fast-edit');
            await held.shift()!.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,total:123})});
            await page.waitForFunction(()=>document.querySelector('[data-quote]')?.textContent!=='null');
          } else assert.equal(held.length,0,'Enhance cannot quote an uploaded Extend source');
          await page.getByRole('button',{name:'Extend Video',exact:true}).click();
          assert.equal(await page.locator('[data-quote]').innerText(),'null','returning to native Extend requires its own fresh quote');
          const restored=JSON.parse(await page.locator('[data-form]').innerText());
          for(const key of ['durationSec','durationOption','resolution','aspectRatio','audio','seed'])assert.equal(restored[key],native[key],engine.id+': native '+key);
          assert.equal(restored.extraInputValues.safety_tolerance,3);assert.equal(restored.operation,undefined);
          await expect.poll(()=>held.length).toBe(1);
          assert.equal(held.length,1);assert.equal(held[0].request().postDataJSON().mode,'extend');assert.equal(held[0].request().postDataJSON().operation,undefined);
          await held.shift()!.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,total:123})});
          await page.unroute('**/api/preflight');
        }
      }
    }
    assert.deepEqual(errors, []);
    t.diagnostic(`Chromium ${browser.version()}: six Seedance/Kling variants preserve exact source capture; ${catalogCases} source workflows across the entire public video catalog pass on desktop/mobile.`);
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
