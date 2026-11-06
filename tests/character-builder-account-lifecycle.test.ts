import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { sanitizeRequest } from '../frontend/src/server/tools/character-builder/sanitize';
import { buildPrompt } from '../frontend/src/server/tools/character-builder/prompt';

const frontend = path.join(process.cwd(), 'frontend');
const stateKey = 'maxvideoai.character-builder.v1';
const pendingKey = 'maxvideoai.character-builder.pending-runs.v1';

async function mountWorkspace(options: { userId?: string | null; loading?: boolean; storage?: Record<string, string>; query?: string } = {}) {
  const stubs: Record<string, string> = {
    'next/navigation': `export const usePathname=()=>'/app/tools/character-builder'; export const useSearchParams=()=>new URLSearchParams(window.location.search);`,
    'next/link': `export default function Link({children}){return children;}`,
    '@/hooks/useRequireAuth': `export const useRequireAuth=()=>window.fixtureAuth;`,
    '@/lib/authFetch': `export const authFetch=(url,init)=>window.fixtureFetch(url,init);`,
    '@/lib/i18n/I18nProvider': `export const useI18n=()=>({t:(_key,fallback)=>fallback});`,
    '@/content/feature-flags': `export const FEATURES={workflows:{toolsSection:true}};`,
    '@/lib/analytics-client': `export const dispatchAnalyticsEvent=()=>{};`,
    '@/lib/client-image-upload': `export const prepareImageFileForUpload=(file)=>window.prepareUpload(file);`,
    '@/lib/api': `export {runCharacterBuilderTool} from './lib/api-generation'; export {saveImageToLibrary} from './lib/api-assets'; const jobs=[]; const pages=[]; const noop=()=>Promise.resolve(); export const useInfiniteJobs=()=>({data:pages,stableJobs:jobs,mutate:noop,setSize:noop,isLoading:false,isValidating:false});`,
    '@/components/MediaLightbox': `export const MediaLightbox=()=>null;`,
    '@/components/ui/Button': `export const ButtonLink=({children})=>children;`,
    '@/components/ui/Card': `export const Card=({children})=>children;`,
    './character-builder/_components/character-builder-workspace-components': `export const CharacterBuilderResultsGallery=(props)=>{window.resultActions=props;return null};export const CharacterReferenceLibraryModal=()=>null;export const SectionTitle=()=>null;`,
    './character-builder/_components/CharacterStudioComposer.client': `import React from 'react';export const CharacterStudioComposer=(props)=>{window.controls={...props,onGenerateOne:props.onGenerate};window.frames.push({user:window.fixtureAuth.user?.id,notes:props.state.advancedNotes,referenceIds:props.state.referenceImages.map(x=>x.id),runIds:props.state.runs.map(x=>x.id)});return <>{props.navigation}<pre id="draft">{JSON.stringify(props.state)}</pre></>};`,
    './character-builder/_components/CharacterStudioReference.client': `export {CharacterStudioReferenceInputs} from './src/components/tools/character-builder/_components/CharacterStudioReference.client';export const CharacterStudioReference=()=>null;`,
    './character-builder/_components/CharacterStudioOverlays.client': `export const CharacterStudioOverlays=(props)=>{window.overlayControls=props;return null};`,
    './character-builder/_components/character-builder-page-shell': `import React from 'react';export const CharacterBuilderAuthGateModal=()=>null;export const CharacterBuilderDisabledState=()=>null;export const CharacterBuilderLoadingSkeleton=()=> <p id="loading">Loading</p>;export const CharacterBuilderPageFrame=({children,overlays})=><>{children}{overlays}</>;`,
  };
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"test"', 'process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB': '"25"' },
    tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'character-workspace-host', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React,{act} from 'react';import {createRoot} from 'react-dom/client';import Workspace from './src/components/tools/CharacterBuilderWorkspace';
      import {createDefaultCharacterBuilderState} from './src/lib/character-builder';
      window.IS_REACT_ACT_ENVIRONMENT=true;window.frames=[];window.requests=[];
      window.makeState=(notes)=>({...createDefaultCharacterBuilderState(),advancedNotes:notes});
      window.prepareUpload=async(file)=>file;
      window.fixtureFetch=async(url,init={})=>{
        if(url.startsWith('/api/images/estimate'))return {ok:true,json:async()=>({ok:true,pricing:{totalCents:7,currency:'USD',meta:{pricingMode:'manual_tariff',customerTariffRevision:1}}})};
        return new Promise(resolve=>window.requests.push({url,init,resolve}));
      };
      const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<Workspace/>),unmount:()=>root.unmount()};
    ` },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/tools/character-builder', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window as any;
  w.MessageChannel = class { port1 = { onmessage: () => {} }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) }; };
  w.process = { env: {} };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w, 'fixtureQuery', {
    get: () => w.location.search.slice(1),
    set: (query: string) => w.history.replaceState(w.history.state, '', `/app/tools/character-builder${query ? `?${query}` : ''}`),
  });
  w.fixtureQuery = options.query ?? '';
  w.fixtureIntervals = new Map();
  let nextInterval = 0;
  w.setInterval = (callback: () => void, delay: number) => { const id = ++nextInterval; w.fixtureIntervals.set(id, { callback, delay }); return id; };
  w.clearInterval = (id: number) => w.fixtureIntervals.delete(id);
  const auth = (userId: string | null, loading = false) => ({ loading, user: userId ? { id: userId } : null, session: userId ? { user: { id: userId }, access_token: `token-${userId}` } : null });
  w.fixtureAuth = auth(options.userId === undefined ? 'account-A' : options.userId, options.loading);
  for (const [key, value] of Object.entries(options.storage ?? {})) w.localStorage.setItem(key, value);
  w.eval(bundle.outputFiles[0].text);
  await w.fx.act(async () => w.fx.render());
  const tick = () => w.fx.act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  await tick();
  await w.fx.act(async () => [...w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'My images')?.click());
  return {
    w,
    draft: () => JSON.parse(w.document.getElementById('draft')?.textContent ?? 'null'),
    tick,
    edit: (notes: string) => w.fx.act(async () => w.controls.setState((state: any) => ({ ...state, advancedNotes: notes }))),
    auth: async (userId: string | null, loading = false) => { await w.fx.act(async () => { w.fixtureAuth = auth(userId, loading); w.fx.render(); }); await tick(); },
    respond: async (request: any, body: unknown) => { await w.fx.act(async () => request.resolve({ ok: true, status: 200, json: async () => body })); await tick(); },
    close: async () => { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); },
  };
}

const legacyState = JSON.stringify({ version: 1, state: { advancedNotes: 'A private draft', referenceImages: [{ id: 'A-ref', role: 'identity', url: 'https://example.invalid/A.png' }], runs: [{ id: 'A-run', jobId: 'A-job', results: [{ id: 'A-result', url: 'https://example.invalid/result.png' }] }] } });

test('a Recast entry survives auth resolution without resetting the character draft or starting a render', async () => {
  const key = `${stateKey}:account-A`;
  const f = await mountWorkspace({ userId: null, loading: true, query: 'mode=recast', storage: { [key]: JSON.stringify({ version: 1, state: { advancedNotes: 'Saved identity direction' } }) } });
  try {
    assert.equal(f.draft(), null);
    await f.auth('account-A');
    const modes = () => [...f.w.document.querySelectorAll('[role="group"][aria-label="Character Studio"] button')];
    const recastButtons = modes().filter((button: any) => button.textContent === 'Recast');
    assert.ok(recastButtons.length > 0);
    assert.ok(recastButtons.every((button: any) => button.getAttribute('aria-pressed') === 'true'));
    assert.equal(f.draft().advancedNotes, 'Saved identity direction');
    const character = modes().find((button: any) => button.textContent.includes('Character')) as any;
    assert.ok(character);
    await f.w.fx.act(async () => character.click());
    await f.edit('Continue the character draft');
    assert.equal(character.getAttribute('aria-pressed'), 'true', 'the URL sets the entry mode once and does not lock subsequent navigation');
    assert.equal(f.draft().advancedNotes, 'Continue the character draft');
    assert.equal(f.w.requests.filter((entry: any) => entry.init.method === 'POST').length, 0, 'opening or switching tabs must never submit a generation');
  } finally { await f.close(); }
});

test('an unknown Character Studio entry mode retains the default character editor', async () => {
  const f = await mountWorkspace({ query: 'mode=unknown' });
  try {
    const character = [...f.w.document.querySelectorAll('[role="group"][aria-label="Character Studio"] button')].find((button: any) => button.textContent.includes('Character')) as any;
    assert.equal(character?.getAttribute('aria-pressed'), 'true');
  } finally { await f.close(); }
});

test('an authenticated account never adopts ownerless Character Builder drafts or pending jobs', async () => {
  const f = await mountWorkspace({ userId: 'account-B', storage: { [stateKey]: legacyState, [pendingKey]: JSON.stringify({ version: 1, runs: [{ id: 'pending-A', jobId: 'job-A', createdAt: '2026-10-17T10:00:00Z' }] }) } });
  try {
    assert.equal(f.draft().advancedNotes, '');
    assert.deepEqual(f.draft().referenceImages, []);
    assert.deepEqual(f.draft().runs, []);
    assert.equal(f.w.requests.length, 0, 'legacy pending jobs must not be polled under B');
  } finally { await f.close(); }
});

test('unresolved authentication neither hydrates nor rewrites confirmed account storage', async () => {
  const owned = JSON.stringify({ version: 1, state: { advancedNotes: 'A saved draft' } });
  const key = `${stateKey}:account-A`;
  const f = await mountWorkspace({ userId: null, loading: true, storage: { [key]: owned, [stateKey]: legacyState } });
  try {
    assert.equal(f.draft(), null);
    assert.equal(f.w.localStorage.getItem(key), owned);
    assert.equal(f.w.localStorage.getItem(stateKey), legacyState);
    await f.auth('account-A');
    assert.equal(f.draft().advancedNotes, 'A saved draft');
  } finally { await f.close(); }
});

test('mounted A to B and back keeps each confirmed draft without exposing A in a B render', async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('A private draft');
    await f.auth('account-B');
    assert.equal(f.draft().advancedNotes, '');
    assert.ok(f.w.frames.filter((frame: any) => frame.user === 'account-B').every((frame: any) => frame.notes !== 'A private draft'));
    await f.edit('B private draft');
    await f.auth('account-A');
    assert.equal(f.draft().advancedNotes, 'A private draft');
    assert.equal(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-B`)).state.advancedNotes, 'B private draft');
    const saved = f.w.localStorage.getItem(`${stateKey}:account-A`);
    const reload = await mountWorkspace({ storage: { [`${stateKey}:account-A`]: saved } });
    try { assert.equal(reload.draft().advancedNotes, 'A private draft'); } finally { await reload.close(); }
  } finally { await f.close(); }
});

test('a generation accepted for A cannot populate B or persist in B after an account switch', async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('A generation');
    await f.w.fx.act(async () => f.w.controls.onGenerateOne());
    const request = f.w.requests.find((entry: any) => entry.url === '/api/tools/character-builder');
    assert.ok(request);
    await f.auth('account-B');
    await f.respond(request, { ok: true, run: { id: 'A-run', jobId: 'A-job', results: [{ id: 'A-output', url: 'https://example.invalid/A.png' }] } });
    assert.deepEqual(f.draft().runs, []);
    assert.equal(f.draft().advancedNotes, '');
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-B`)).state.runs, []);
    assert.equal(new f.w.Headers(request.init.headers).get('Authorization'), 'Bearer token-account-A');
  } finally { await f.close(); }
});

test('an upload prepared for A is not dispatched after switching accounts', async () => {
  const f = await mountWorkspace();
  try {
    let finishPreparation!: (file: File) => void;
    f.w.prepareUpload = () => new Promise(resolve => { finishPreparation = resolve; });
    const file = new f.w.File(['image'], 'reference.png', { type: 'image/png' });
    const input = f.w.document.querySelector('input[data-character-reference=identity]');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    await f.auth('account-B');
    await f.w.fx.act(async () => finishPreparation(file));
    await f.tick();
    assert.equal(f.w.requests.filter((entry: any) => entry.url === '/api/uploads/image').length, 0);
    assert.deepEqual(f.draft().referenceImages, []);
  } finally { await f.close(); }
});

test('a guest can edit locally without exposing or overwriting the last authenticated draft', async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('A private draft');
    await f.auth(null);
    assert.equal(f.draft().advancedNotes, '');
    await f.edit('Guest draft');
    assert.equal(f.draft().advancedNotes, 'Guest draft');
    assert.equal(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-A`)).state.advancedNotes, 'A private draft');
    await f.auth('account-B');
    assert.equal(f.draft().advancedNotes, '');
    await f.auth('account-A');
    assert.equal(f.draft().advancedNotes, 'A private draft');
  } finally { await f.close(); }
});

test('late owned job snapshots and historical settings cannot overwrite a new account', async () => {
  const f = await mountWorkspace({ query: 'job=job-A' });
  try {
    const queryRequest = f.w.requests.find((entry: any) => entry.url === '/api/jobs/job-A');
    assert.ok(queryRequest);
    await f.w.fx.act(async () => { void f.w.resultActions.onDuplicateHistoricalSettings({ id: 'history-A', jobId: 'history-job-A' }); });
    const historicalRequest = f.w.requests.find((entry: any) => entry.url === '/api/jobs/history-job-A');
    assert.ok(historicalRequest);
    f.w.fixtureQuery = '';
    await f.auth('account-B');
    await f.edit('B current draft');
    const response = { ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', builder: { advancedNotes: 'A stale snapshot', referenceImages: [{ id: 'A-ref', role: 'identity', url: 'https://example.invalid/A.png' }] } } };
    await f.respond(queryRequest, response);
    await f.respond(historicalRequest, response);
    assert.equal(f.draft().advancedNotes, 'B current draft');
    assert.deepEqual(f.draft().referenceImages, []);
    for (const request of [queryRequest, historicalRequest]) {
      assert.equal(new f.w.Headers(request.init.headers).get('Authorization'), 'Bearer token-account-A');
      assert.equal(request.init.signal.aborted, true);
    }
  } finally { await f.close(); }
});

test('same-account pending jobs resume, while their late polling response cannot populate another account', async () => {
  const pending = { id: 'pending-A', jobId: 'job-A', createdAt: '2026-10-17T10:00:00Z', action: 'generate', outputMode: 'portrait-reference', qualityMode: 'draft', formatMode: 'standard', generateCount: 1 };
  const f = await mountWorkspace({ storage: { [`${pendingKey}:account-A`]: JSON.stringify({ version: 1, runs: [pending] }) } });
  try {
    const request = f.w.requests.find((entry: any) => entry.url === '/api/jobs/job-A');
    assert.ok(request, 'confirmed account resumes its own pending job');
    await f.auth('account-B');
    await f.respond(request, { ok: true, status: 'completed', renderIds: ['https://example.invalid/A-output.png'] });
    assert.deepEqual(f.draft().runs, []);
    assert.equal(f.w.localStorage.getItem(`${pendingKey}:account-B`), null);
    assert.equal(JSON.parse(f.w.localStorage.getItem(`${pendingKey}:account-A`)).runs[0].jobId, 'job-A');
    assert.equal(request.init.signal.aborted, true);
  } finally { await f.close(); }
});

test('same-account generation completion and token refresh retain the draft and result', async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('A current draft');
    await f.w.fx.act(async () => {
      f.w.fixtureAuth.session.access_token = 'token-account-A-refreshed';
      f.w.fx.render();
    });
    await f.w.fx.act(async () => f.w.controls.onGenerateOne());
    const request = f.w.requests.find((entry: any) => entry.url === '/api/tools/character-builder');
    assert.equal(new f.w.Headers(request.init.headers).get('Authorization'), 'Bearer token-account-A-refreshed');
    await f.respond(request, { ok: true, run: { id: 'A-run', jobId: 'A-job', results: [{ id: 'A-output', url: 'https://example.invalid/A.png' }] } });
    assert.equal(f.draft().advancedNotes, 'A current draft');
    assert.equal(f.draft().runs[0].id, 'A-run');
    assert.equal(f.draft().selectedResultId, 'A-output');
    assert.equal(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-A`)).state.runs[0].id, 'A-run');
    assert.equal(f.w.localStorage.getItem(`${pendingKey}:account-A`), null);
  } finally { await f.close(); }
});

test('an in-flight library save stays authorized to its initiating account', async () => {
  const f = await mountWorkspace();
  try {
    await f.w.fx.act(async () => { void f.w.resultActions.onSaveResult({ id: 'A-result', jobId: 'A-job', url: 'https://example.invalid/A.png' }); });
    const request = f.w.requests.find((entry: any) => entry.url === '/api/media-library/ensure');
    assert.ok(request);
    assert.equal(new f.w.Headers(request.init.headers).get('Authorization'), 'Bearer token-account-A');
    await f.auth('account-B');
    await f.respond(request, { ok: true, asset: { id: 'saved-A', url: 'https://example.invalid/A.png' } });
    assert.equal(f.draft().advancedNotes, '');
    assert.equal(request.init.signal.aborted, true);
    assert.doesNotMatch(f.w.document.body.textContent, /saved to (?:your )?(?:media|library)/i);
  } finally { await f.close(); }
});

test('an upload response cannot add A references to B even if cancellation loses the response race', async () => {
  const f = await mountWorkspace();
  try {
    const file = new f.w.File(['image'], 'reference.png', { type: 'image/png' });
    const input = f.w.document.querySelector('input[data-character-reference=identity]');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    const request = f.w.requests.find((entry: any) => entry.url === '/api/uploads/image');
    assert.ok(request);
    assert.equal(new f.w.Headers(request.init.headers).get('Authorization'), 'Bearer token-account-A');
    await f.auth('account-B');
    await f.respond(request, { ok: true, asset: { url: 'https://example.invalid/A-reference.png', name: 'reference.png' } });
    assert.deepEqual(f.draft().referenceImages, []);
    assert.equal(request.init.signal.aborted, true);
  } finally { await f.close(); }
});

test('refreshing the same account token does not reload a job snapshot over edited input', async () => {
  const f = await mountWorkspace({ query: 'job=job-A' });
  try {
    const request = f.w.requests.find((entry: any) => entry.url === '/api/jobs/job-A');
    assert.ok(request);
    await f.respond(request, { ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', builder: { advancedNotes: 'Saved job prompt' } } });
    await f.edit('My edited draft');
    await f.w.fx.act(async () => {
      f.w.fixtureAuth.session.access_token = 'token-account-A-refreshed';
      f.w.fx.render();
    });
    await f.tick();
    assert.equal(f.w.requests.filter((entry: any) => entry.url === '/api/jobs/job-A').length, 1);
    assert.equal(f.draft().advancedNotes, 'My edited draft');
  } finally { await f.close(); }
});

test('pending-job polling uses the refreshed token and retains a valid completion for its owner', async () => {
  const pending = { id: 'pending-A', jobId: 'job-A', createdAt: '2026-10-17T10:00:00Z', action: 'generate', outputMode: 'portrait-reference', qualityMode: 'draft', formatMode: 'standard', generateCount: 1 };
  const f = await mountWorkspace({ storage: { [`${pendingKey}:account-A`]: JSON.stringify({ version: 1, runs: [pending] }) } });
  try {
    const first = f.w.requests.find((entry: any) => entry.url === '/api/jobs/job-A');
    assert.ok(first);
    await f.respond(first, { ok: true, status: 'pending', renderIds: [] });
    await f.w.fx.act(async () => {
      f.w.fixtureAuth.session.access_token = 'token-account-A-refreshed';
      f.w.fx.render();
    });
    const poll = [...f.w.fixtureIntervals.values()].find((entry: any) => entry.delay === 8000) as any;
    assert.ok(poll);
    await f.w.fx.act(async () => poll.callback());
    const next = f.w.requests.filter((entry: any) => entry.url === '/api/jobs/job-A').at(-1);
    assert.notEqual(next, first);
    assert.equal(new f.w.Headers(next.init.headers).get('Authorization'), 'Bearer token-account-A-refreshed');
    await f.respond(next, { ok: true, status: 'completed', renderIds: ['https://example.invalid/A-output.png'] });
    assert.equal(f.draft().runs[0].jobId, 'job-A');
    assert.equal(f.w.localStorage.getItem(`${pendingKey}:account-A`), null);
  } finally { await f.close(); }
});

test('new-character navigation clears only the draft while keeping finished outputs and pending jobs', async () => {
  const ownedKey = `${stateKey}:account-A`;
  const ownedPendingKey = `${pendingKey}:account-A`;
  const pending = { id: 'pending-A', jobId: 'pending-job-A', createdAt: '2026-11-03T10:00:00Z', action: 'generate', generateCount: 1, outputMode: 'portrait-reference', qualityMode: 'draft', formatMode: 'standard' };
  const f = await mountWorkspace({ storage: { [ownedKey]: legacyState, [ownedPendingKey]: JSON.stringify({ version: 1, runs: [pending] }) } });
  try {
    await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find((button: any) => button.getAttribute('aria-label') === 'New character')?.click());
    assert.equal(f.draft().advancedNotes, '');
    assert.deepEqual(f.draft().referenceImages, []);
    assert.equal(f.draft().runs[0].id, 'A-run');
    assert.equal(JSON.parse(f.w.localStorage.getItem(ownedPendingKey)).runs[0].jobId, 'pending-job-A');
    assert.equal(f.w.document.querySelector('nav [aria-pressed="true"]')?.textContent, 'Explore');
    await f.w.fx.act(async () => f.w.document.querySelector('[aria-label="Use inspiration Iris"]').click());
    assert.equal(f.draft().traits.hairstyle.value, 'curly');
    assert.equal(f.draft().traits.outfitStyle.value, 'bohemian');
    assert.equal(f.draft().runs[0].id, 'A-run');
  } finally { await f.close(); }
});

function assertFreshCharacter(draft: any) {
  assert.equal(draft.characterId ?? null, null);
  assert.equal(draft.sourceMode, 'scratch');
  assert.deepEqual(draft.referenceImages, []);
  assert.equal(draft.referenceStrength, null);
  assert.equal(draft.consistencyMode, 'balanced');
  assert.equal(draft.outputMode, 'portrait-reference');
  assert.equal(draft.qualityMode, 'draft');
  assert.equal(draft.formatMode, 'standard');
  assert.equal(draft.advancedNotes, '');
  assert.deepEqual(draft.mustRemainVisible, []);
  assert.equal(draft.selectedResultId, null);
  assert.equal(draft.pinnedReferenceResultId, null);
  assert.deepEqual(draft.outputOptions, { fullBodyRequired: false, includeCloseUps: true, neutralStudioBackground: true, preserveFacialDetails: true, avoid3dRenderLook: true });
  for (const key of ['characterType', 'genderPresentation', 'ageRange', 'skinTone', 'faceCues', 'eyeColor', 'eyeShape', 'hairColor', 'hairLength', 'hairstyle', 'bodyBuild', 'outfitStyle']) {
    assert.deepEqual(draft.traits[key], { value: null, source: 'manual' }, key);
  }
  for (const key of ['customCharacterDescription', 'customGenderDescription', 'customHairDescription', 'customOutfitDescription', 'customSceneDescription', 'customDetailsDescription']) assert.equal(draft.traits[key], '', key);
  assert.equal(draft.traits.sceneId, null);
  assert.equal(draft.traits.realismStyle, 'photoreal');
  assert.equal(draft.traits.hairEnabled, false);
  assert.equal(draft.traits.outfitEnabled, false);
  assert.deepEqual(draft.traits.accessories, []);
  assert.deepEqual(draft.traits.distinctiveFeatures, []);
}

async function clickNewCharacter(f: Awaited<ReturnType<typeof mountWorkspace>>) {
  await f.w.fx.act(async () => {
    const button = f.w.document.querySelector('button[aria-label="New character"]');
    assert.ok(button);
    button.click();
  });
}

const restoredDraftNotice = (f: Awaited<ReturnType<typeof mountWorkspace>>) =>
  [...f.w.document.querySelectorAll('[role="status"]')].find((node: any) => node.textContent === 'Your previous character draft was restored.');

test('a restored draft is explained once and the notice can start a genuinely fresh persisted draft', async () => {
  const key = `${stateKey}:account-A`;
  const f = await mountWorkspace({ storage: { [key]: legacyState } });
  try {
    assert.ok(restoredDraftNotice(f));
    const notice = restoredDraftNotice(f) as any;
    await f.w.fx.act(async () => [...notice.parentElement.querySelectorAll('button')].find((button: any) => button.textContent === 'Start from scratch').click());
    assert.equal(restoredDraftNotice(f), undefined);
    assertFreshCharacter(f.draft());
    assertFreshCharacter(JSON.parse(f.w.localStorage.getItem(key)).state);
  } finally { await f.close(); }
});

test('dismissing the restored draft notice keeps choices and does not reappear on tab or mode switches', async () => {
  const f = await mountWorkspace({ storage: { [`${stateKey}:account-A`]: legacyState } });
  try {
    assert.ok(restoredDraftNotice(f));
    await f.w.fx.act(async () => f.w.document.querySelector('button[aria-label="Dismiss draft notice"]').click());
    for (const label of ['Recast', 'CharacterAI', 'My characters', 'My images']) {
      await f.w.fx.act(async () => {
        const button = [...f.w.document.querySelectorAll('button')].find((candidate: any) => candidate.textContent === label) as any;
        assert.ok(button, label); button.click();
      });
      assert.equal(restoredDraftNotice(f), undefined);
      assert.equal(f.draft().advancedNotes, 'A private draft');
    }
    await f.auth('account-B');
    assert.equal(restoredDraftNotice(f), undefined);
    await f.auth('account-A');
    assert.ok(restoredDraftNotice(f), 'a fresh account mount explains its restored draft');
  } finally { await f.close(); }
});

test('an empty persisted draft with completed history does not claim to restore previous choices', async () => {
  const f = await mountWorkspace({ storage: { [`${stateKey}:account-A`]: JSON.stringify({ version: 1, state: { runs: [{ id: 'finished', results: [] }], selectedResultId: 'finished-result' } }) } });
  try { assert.equal(restoredDraftNotice(f), undefined); } finally { await f.close(); }
});

for (const state of [{ traits: { customOutfitDescription: 'A red coat' } }, { formatMode: '4k' }]) {
  test(`restoration notice covers ${'traits' in state ? 'custom clothing alone' : 'output settings alone'}`, async () => {
    const f = await mountWorkspace({ storage: { [`${stateKey}:account-A`]: JSON.stringify({ version: 1, state }) } });
    try {
      assert.ok(restoredDraftNotice(f));
      await clickNewCharacter(f);
      assert.equal(restoredDraftNotice(f), undefined);
      assertFreshCharacter(f.draft());
    } finally { await f.close(); }
  });
}

for (const role of ['identity', 'style']) test(`New rejects a late ${role} upload without restoring its source or clothing reference`, async () => {
  const f = await mountWorkspace();
  try {
    const file = new f.w.File(['image'], `${role}.png`, { type: 'image/png' });
    const input = f.w.document.querySelector(`input[data-character-reference=${role}]`);
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    const upload = f.w.requests.find((entry: any) => entry.url === '/api/uploads/image');
    assert.ok(upload);
    await clickNewCharacter(f);
    await f.respond(upload, { ok: true, asset: { url: `https://example.invalid/${role}.png`, name: `${role}.png` } });
    assertFreshCharacter(f.draft());
    assertFreshCharacter(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-A`)).state);
  } finally { await f.close(); }
});

test('New clears all custom and hidden overrides from persisted state and the next generation payload after reopening', async () => {
  const key = `${stateKey}:account-A`;
  const f = await mountWorkspace();
  let saved = '';
  try {
    await f.w.fx.act(async () => f.w.controls.setState((state: any) => ({
      ...state, characterId: '17', sourceMode: 'reference-image', referenceStrength: 'strong', consistencyMode: 'strict',
      referenceImages: [{ id: 'old-identity', role: 'identity', url: 'https://example.invalid/old-identity.png' }, { id: 'old-style', role: 'style', url: 'https://example.invalid/old-style.png' }],
      outputMode: 'character-sheet', qualityMode: 'final', formatMode: '4k', advancedNotes: 'OLD extra direction', mustRemainVisible: ['OLD badge'],
      selectedResultId: 'old-result', pinnedReferenceResultId: 'old-pin',
      outputOptions: { fullBodyRequired: true, includeCloseUps: false, neutralStudioBackground: false, preserveFacialDetails: false, avoid3dRenderLook: false },
      traits: {
        characterType: { value: 'alien', source: 'manual' }, customCharacterDescription: 'OLD glass creature', genderPresentation: { value: 'custom', source: 'manual' }, customGenderDescription: 'OLD personal description',
        ageRange: { value: 'senior', source: 'manual' }, skinTone: { value: '#a1b2c3', source: 'manual' }, faceCues: { value: 'angular', source: 'manual' },
        eyeColor: { value: '#c3b2a1', source: 'manual' }, eyeShape: { value: 'almond', source: 'manual' }, bodyBuild: { value: 'athletic', source: 'manual' },
        hairEnabled: true, customHairDescription: 'OLD silver braids', hairstyle: { value: 'curly', source: 'manual' }, hairLength: { value: 'long', source: 'manual' }, hairColor: { value: '#123abc', source: 'manual' },
        outfitEnabled: true, outfitStyle: { value: 'fantasy', source: 'manual' }, customOutfitDescription: 'OLD red cloak', accessories: ['glasses'], distinctiveFeatures: ['freckles'], customDetailsDescription: 'OLD tattoo',
        sceneId: 'comfy_cafe', customSceneDescription: 'OLD lunar castle', realismStyle: 'animated',
      },
    })));
    const dirty = f.draft();
    for (const text of ['Recast', 'CharacterAI', 'My characters', 'My images']) {
      await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find((button: any) => button.textContent === text)?.click());
      assert.deepEqual(f.draft(), dirty, `switching ${text} preserves the intentional draft`);
    }
    await clickNewCharacter(f);
    assertFreshCharacter(f.draft());
    saved = f.w.localStorage.getItem(key);
    assertFreshCharacter(JSON.parse(saved).state);
  } finally { await f.close(); }
  const reopened = await mountWorkspace({ storage: { [key]: saved } });
  try {
    assertFreshCharacter(reopened.draft());
    await reopened.w.fx.act(async () => reopened.w.controls.onGenerateOne());
    const generation = reopened.w.requests.find((entry: any) => entry.url === '/api/tools/character-builder');
    assert.ok(generation);
    const payload = JSON.parse(generation.init.body);
    assertFreshCharacter(payload);
    assert.equal(payload.selectedResultUrl, null);
    assert.equal(payload.pinnedReferenceResultUrl, null);
    const prompt = buildPrompt(sanitizeRequest({ ...payload, userId: 'account-A' }));
    assert.doesNotMatch(prompt, /OLD|#a1b2c3|#c3b2a1|#123abc|cozy cafe|red cloak|silver braids|glass creature/);
    assert.match(prompt, /clean neutral studio background/);
  } finally { await reopened.close(); }
});

test('New removes the old job entry so reopening cannot restore its previous custom instructions', async () => {
  const key = `${stateKey}:account-A`;
  const f = await mountWorkspace({ query: 'job=old-job&mode=character&campaign=kept' });
  let saved = '', query = '';
  try {
    const old = f.w.requests.find((entry: any) => entry.url === '/api/jobs/old-job');
    assert.ok(old);
    await f.respond(old, { ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', builder: { advancedNotes: 'OLD restored instruction', traits: { customOutfitDescription: 'OLD red cloak' } } } });
    await clickNewCharacter(f);
    saved = f.w.localStorage.getItem(key);
    query = f.w.location.search.slice(1);
    assert.equal(new URLSearchParams(query).get('job'), null);
    assert.equal(new URLSearchParams(query).get('campaign'), 'kept');
  } finally { await f.close(); }
  const reopened = await mountWorkspace({ query, storage: { [key]: saved } });
  try {
    assertFreshCharacter(reopened.draft());
    assert.equal(reopened.w.requests.filter((entry: any) => entry.url === '/api/jobs/old-job').length, 0);
  } finally { await reopened.close(); }
});

test('New makes a fresh Character entry after arriving through a Recast link', async () => {
  const f = await mountWorkspace({ query: 'mode=recast&campaign=kept' });
  try {
    await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'CharacterAI')?.click());
    await clickNewCharacter(f);
    assert.equal(new URLSearchParams(f.w.location.search).get('mode'), null);
    assert.equal(new URLSearchParams(f.w.location.search).get('campaign'), 'kept');
    assertFreshCharacter(f.draft());
  } finally { await f.close(); }
});

test('a generation completed after New remains in history without selecting its abandoned result', async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('OLD generation direction');
    await f.w.fx.act(async () => f.w.controls.onGenerateOne());
    const generation = f.w.requests.find((entry: any) => entry.url === '/api/tools/character-builder');
    assert.ok(generation);
    await clickNewCharacter(f);
    await f.respond(generation, { ok: true, run: { id: 'old-run', jobId: 'old-job', results: [{ id: 'old-result', url: 'https://example.invalid/old.png' }] } });
    assert.equal(f.draft().runs[0].id, 'old-run');
    assertFreshCharacter(f.draft());
    assertFreshCharacter(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-A`)).state);
  } finally { await f.close(); }
});

test('an old pending job recovered after New remains in history without selecting its result', async () => {
  const pending = { id: 'old-pending', jobId: 'old-job', createdAt: '2026-11-03T10:00:00Z', action: 'generate', generateCount: 1, outputMode: 'portrait-reference', qualityMode: 'draft', formatMode: 'standard' };
  const f = await mountWorkspace({ storage: { [`${pendingKey}:account-A`]: JSON.stringify({ version: 1, runs: [pending] }) } });
  try {
    const first = f.w.requests.find((entry: any) => entry.url === '/api/jobs/old-job');
    await f.respond(first, { ok: true, status: 'pending', renderIds: [] });
    await clickNewCharacter(f);
    const poll = [...f.w.fixtureIntervals.values()].find((entry: any) => entry.delay === 8000) as any;
    await f.w.fx.act(async () => poll.callback());
    const request = f.w.requests.filter((entry: any) => entry.url === '/api/jobs/old-job').at(-1);
    await f.respond(request, { ok: true, status: 'completed', renderIds: ['https://example.invalid/old.png'] });
    assert.equal(f.draft().runs[0].jobId, 'old-job');
    assertFreshCharacter(f.draft());
  } finally { await f.close(); }
});

async function savedCharacterFixture(f: Awaited<ReturnType<typeof mountWorkspace>>) {
  const character = { id: '17', name: 'Alba', identity: { jobId: 'identity-A', imageUrl: 'https://example.invalid/identity.png', thumbUrl: 'https://example.invalid/thumb.png', settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', builder: f.w.makeState('saved A') } }, looks: [], lookCount: 0, nextLookCursor: null };
  const click = async (name: string) => f.w.fx.act(async () => {
    const button = [...f.w.document.querySelectorAll('button')].find((el: any) => el.textContent === name) as any;
    assert.ok(button, `button ${name}`); button.click();
  });
  await click('My characters');
  await f.respond(f.w.requests.find((r: any) => r.url === '/api/character-studio/characters'), { ok: true, characters: [character], nextCursor: null });
  return { character, click, start: async () => { await click('New look'); return f.w.requests.filter((r: any) => r.url === '/api/character-studio/characters/17').at(-1); } };
}

test('newer local settings win over a pending new look through actual workspace navigation', async () => {
  const f = await mountWorkspace();
  try {
    const saved = await savedCharacterFixture(f);
    const pending = await saved.start(); assert.ok(pending);
    await saved.click('My images');
    await f.w.fx.act(async () => f.w.resultActions.onDuplicateSettings({ builder: f.w.makeState('Newer B') }, 'B-result'));
    await f.respond(pending, { ok: true, character: saved.character });
    assert.equal(f.draft().advancedNotes, 'Newer B');
    assert.equal(f.draft().characterId, null);
  } finally { await f.close(); }
});

test('a newer saved look wins over pending historical settings reuse', async () => {
  const f = await mountWorkspace();
  try {
    const saved = await savedCharacterFixture(f);
    await saved.click('My images');
    await f.w.fx.act(async () => { f.w.resultActions.onDuplicateHistoricalSettings({ id: 'B-result', jobId: 'historical-B' }); });
    const historical = f.w.requests.find((r: any) => r.url === '/api/jobs/historical-B'); assert.ok(historical);
    await saved.click('My characters');
    const pending = await saved.start();
    await f.respond(pending, { ok: true, character: saved.character });
    assert.equal(f.draft().characterId, '17');
    await f.respond(historical, { ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', builder: f.w.makeState('Stale B') } });
    assert.equal(f.draft().characterId, '17');
    assert.notEqual(f.draft().advancedNotes, 'Stale B');
  } finally { await f.close(); }
});

for (const role of ['identity', 'style']) test(`a pending ${role} upload cannot alter a newly selected saved character`, async () => {
  const f = await mountWorkspace();
  try {
    const input = f.w.document.querySelector(`[data-character-reference="${role}"]`);
    Object.defineProperty(input, 'files', { value: [new f.w.File(['fixture'], 'previous.png', { type: 'image/png' })] });
    await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    const upload = f.w.requests.find((r: any) => r.init.method === 'POST'); assert.ok(upload);
    const saved = await savedCharacterFixture(f);
    const pending = await saved.start();
    await f.respond(pending, { ok: true, character: saved.character });
    await f.respond(upload, { ok: true, asset: { url: 'https://example.invalid/stale-upload.png', name: 'previous.png' } });
    assert.equal(f.draft().referenceImages.length, 1);
    assert.equal(f.draft().referenceImages[0].url, saved.character.identity.imageUrl);
  } finally { await f.close(); }
});


async function chooseReferenceFile(f: Awaited<ReturnType<typeof mountWorkspace>>, role: 'identity' | 'style', name: string) {
  const file = new f.w.File(['image'], name, { type: 'image/png' });
  const input = f.w.document.querySelector(`input[data-character-reference=${role}]`);
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
  return file;
}

const referenceUploads = (f: Awaited<ReturnType<typeof mountWorkspace>>) =>
  f.w.requests.filter((request: any) => request.url === '/api/uploads/image');
const uploadedReference = (name: string) => ({ ok: true, asset: { url: `https://example.invalid/${name}.png`, name: `${name}.png` } });
const referenceControl = (f: Awaited<ReturnType<typeof mountWorkspace>>, role: 'identity' | 'style') =>
  f.w.controls[role === 'identity' ? 'identitySlot' : 'styleSlot'].props;

for (const role of ['identity', 'style'] as const) {
  test(`the newest ${role} upload remains selected when an older response arrives last`, async () => {
    const f = await mountWorkspace();
    try {
      await chooseReferenceFile(f, role, 'older.png');
      await chooseReferenceFile(f, role, 'newer.png');
      const requests = referenceUploads(f);
      assert.equal(requests.length, 2);
      await f.respond(requests[1], uploadedReference('newer'));
      await f.respond(requests[0], uploadedReference('older'));
      assert.equal(f.draft().referenceImages.find((image: any) => image.role === role).url, 'https://example.invalid/newer.png');
      assert.equal(JSON.parse(f.w.localStorage.getItem(`${stateKey}:account-A`)).state.referenceImages[0].url, 'https://example.invalid/newer.png');
    } finally { await f.close(); }
  });

  test(`a newer ${role} upload supersedes an older file still being prepared`, async () => {
    const f = await mountWorkspace();
    try {
      let finishPreparation!: (file: File) => void;
      f.w.prepareUpload = (file: File) => file.name === 'older.png'
        ? new Promise(resolve => { finishPreparation = resolve; })
        : Promise.resolve(file);
      const older = await chooseReferenceFile(f, role, 'older.png');
      await chooseReferenceFile(f, role, 'newer.png');
      await f.w.fx.act(async () => finishPreparation(older));
      await f.tick();
      const requests = referenceUploads(f);
      assert.equal(requests.length, 1, 'superseded image preparation must not dispatch an upload');
      await f.respond(requests[0], uploadedReference('newer'));
      assert.equal(f.draft().referenceImages[0].url, 'https://example.invalid/newer.png');
    } finally { await f.close(); }
  });

  test(`removing a ${role} reference invalidates its pending replacement`, async () => {
    const f = await mountWorkspace();
    try {
      await chooseReferenceFile(f, role, 'existing.png');
      await f.respond(referenceUploads(f)[0], uploadedReference('existing'));
      await chooseReferenceFile(f, role, 'replacement.png');
      await f.w.fx.act(async () => referenceControl(f, role).onRemove());
      assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'), 'removal clears the abandoned upload status immediately');
      await f.respond(referenceUploads(f)[1], uploadedReference('replacement'));
      assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'), 'late response must not revive the abandoned upload status');
      assert.deepEqual(f.draft().referenceImages, []);
      if (role === 'identity') assert.equal(f.draft().sourceMode, 'scratch');
    } finally { await f.close(); }
  });

  test(`a library ${role} selection wins over a pending upload for that slot`, async () => {
    const f = await mountWorkspace();
    try {
      await chooseReferenceFile(f, role, 'pending.png');
      await f.w.fx.act(async () => referenceControl(f, role).onLibrary());
      await f.w.fx.act(async () => f.w.overlayControls.onSelectReference({ id: 'library-image', url: 'https://example.invalid/library.png', width: 800, height: 1000 }));
      await f.respond(referenceUploads(f)[0], uploadedReference('pending'));
      assert.equal(f.draft().referenceImages.find((image: any) => image.role === role).url, 'https://example.invalid/library.png');
    } finally { await f.close(); }
  });
}

test('independent identity and style uploads both survive out-of-order completion', async () => {
  const f = await mountWorkspace();
  try {
    await chooseReferenceFile(f, 'identity', 'identity.png');
    await chooseReferenceFile(f, 'style', 'style.png');
    const requests = referenceUploads(f);
    await f.respond(requests[1], uploadedReference('style'));
    await f.respond(requests[0], uploadedReference('identity'));
    assert.equal(f.draft().referenceImages.find((image: any) => image.role === 'identity').url, 'https://example.invalid/identity.png');
    assert.equal(f.draft().referenceImages.find((image: any) => image.role === 'style').url, 'https://example.invalid/style.png');
  } finally { await f.close(); }
});

test('New invalidates reference uploads during both preparation and response delivery', async () => {
  const f = await mountWorkspace();
  try {
    await chooseReferenceFile(f, 'identity', 'sent.png');
    const sent = referenceUploads(f)[0];
    let finishPreparation!: (file: File) => void;
    f.w.prepareUpload = () => new Promise(resolve => { finishPreparation = resolve; });
    const preparing = await chooseReferenceFile(f, 'style', 'preparing.png');
    await clickNewCharacter(f);
    await f.w.fx.act(async () => finishPreparation(preparing));
    await f.tick();
    await f.respond(sent, uploadedReference('sent'));
    assert.equal(referenceUploads(f).length, 1);
    assert.deepEqual(f.draft().referenceImages, []);
    assert.equal(f.draft().sourceMode, 'scratch');
  } finally { await f.close(); }
});


for (const role of ['identity', 'style'] as const) test(`removing ${role} keeps the other reference upload status while it is active`, async () => {
  const f = await mountWorkspace();
  const otherRole = role === 'identity' ? 'style' : 'identity';
  try {
    await chooseReferenceFile(f, role, 'existing.png');
    await f.respond(referenceUploads(f)[0], uploadedReference('existing'));
    await chooseReferenceFile(f, otherRole, 'other-pending.png');
    await chooseReferenceFile(f, role, 'replacement.png');
    await f.w.fx.act(async () => referenceControl(f, role).onRemove());
    const expectedStatus = otherRole === 'identity' ? 'Uploading identity reference…' : 'Uploading style reference…';
    assert.equal(f.w.document.querySelector('[role=status]')?.textContent, expectedStatus);
    await f.respond(referenceUploads(f)[2], uploadedReference('replacement'));
    assert.equal(f.w.document.querySelector('[role=status]')?.textContent, expectedStatus);
    await f.respond(referenceUploads(f)[1], uploadedReference('other-pending'));
    assert.equal(f.draft().referenceImages.length, 1);
    assert.equal(f.draft().referenceImages[0].role, otherRole);
    assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'));
  } finally { await f.close(); }
});

test('reference removal cannot revive an upload status belonging to a draft abandoned with New', async () => {
  const f = await mountWorkspace();
  try {
    await chooseReferenceFile(f, 'style', 'old-draft.png');
    await clickNewCharacter(f);
    await chooseReferenceFile(f, 'identity', 'existing.png');
    await f.respond(referenceUploads(f)[1], uploadedReference('existing'));
    await chooseReferenceFile(f, 'identity', 'replacement.png');
    await f.w.fx.act(async () => referenceControl(f, 'identity').onRemove());
    assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'));
    await f.respond(referenceUploads(f)[0], uploadedReference('old-draft'));
    await f.respond(referenceUploads(f)[2], uploadedReference('replacement'));
    assert.deepEqual(f.draft().referenceImages, []);
    assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'));
  } finally { await f.close(); }
});

for (const navigation of ['same-mode', 'mode-round-trip'] as const) test(`an identity upload survives ${navigation} navigation without losing the current draft`, async () => {
  const f = await mountWorkspace();
  try {
    await f.edit('Keep this draft');
    await chooseReferenceFile(f, 'identity', 'reference.png');
    const clickMode = async (label: string) => f.w.fx.act(async () => {
      const button = [...f.w.document.querySelectorAll('[role="group"][aria-label="Character Studio"] button')]
        .find((candidate: any) => candidate.textContent.includes(label)) as any;
      assert.ok(button); button.click();
    });
    if (navigation === 'mode-round-trip') await clickMode('Recast');
    await clickMode('Character');
    await f.respond(referenceUploads(f)[0], uploadedReference('reference'));
    assert.equal(f.draft().referenceImages[0]?.url, 'https://example.invalid/reference.png');
    assert.equal(f.draft().advancedNotes, 'Keep this draft');
    assert.ok(!f.w.document.querySelector('[role=status]')?.textContent?.includes('Uploading'));
  } finally { await f.close(); }
});

test('choosing an inspiration explains the applied preset without submitting a generation', async () => {
  const f = await mountWorkspace();
  try {
    await clickNewCharacter(f);
    const inspiration = f.w.document.querySelector('[aria-label="Use inspiration Noor"]');
    assert.ok(inspiration);
    await f.w.fx.act(async () => inspiration.click());
    assert.match(f.w.document.querySelector('[role=status]')?.textContent ?? '', /Noor/);
    assert.match(f.w.document.querySelector('[role=status]')?.textContent ?? '', /applied/i);
    assert.ok(f.draft().traits.hairstyle.value);
    assert.equal(f.w.requests.filter((request: any) => request.url === '/api/tools/character-builder').length, 0);
  } finally { await f.close(); }
});
