import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const frontend = path.join(process.cwd(), 'frontend');
const stateKey = 'maxvideoai.character-builder.v1';
const pendingKey = 'maxvideoai.character-builder.pending-runs.v1';

async function mountWorkspace(options: { userId?: string | null; loading?: boolean; storage?: Record<string, string>; query?: string } = {}) {
  const stubs: Record<string, string> = {
    'next/navigation': `export const usePathname=()=>'/app/tools/character-builder'; export const useSearchParams=()=>new URLSearchParams(window.fixtureQuery);`,
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
    './character-builder/_components/character-builder-build-look-section': `import React from 'react';export const CharacterBuilderBuildLookSection=(props)=>{window.controls=props;window.frames.push({user:window.fixtureAuth.user?.id,notes:props.state.advancedNotes,referenceIds:props.state.referenceImages.map(x=>x.id),runIds:props.state.runs.map(x=>x.id)});return <pre id="draft">{JSON.stringify(props.state)}</pre>};`,
    './character-builder/_components/character-builder-start-section': `export const CharacterBuilderStartSection=()=>null;`,
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
        if(url.startsWith('/api/billing-products'))return {ok:true,json:async()=>({ok:true,product:{unitPriceCents:10}})};
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
    const input = f.w.document.querySelector('input[type=file]');
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
    const input = f.w.document.querySelector('input[type=file]');
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
