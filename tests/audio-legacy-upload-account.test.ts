import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { resolve } from 'node:path';

const bundle = build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{act,useRef,useState} from 'react';
    import{createRoot}from'react-dom/client';
    import{useAudioSourceMediaHandlers}from'./frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioSourceMediaHandlers';
    import{DEFAULT_AUDIO_WORKSPACE_COPY as copy}from'./frontend/app/(core)/(workspace)/app/audio/copy';
    import AudioWorkspace from './frontend/app/(core)/(workspace)/app/audio/AudioWorkspace';
    window.IS_REACT_ACT_ENVIRONMENT=true;
    function Fixture({userId}){
      const[voice,setVoiceSample]=useState({url:'/saved.wav',name:'Saved voice'});
      const[busy,setIsUploadingVoice]=useState(false),[notice,setNotice]=useState(null);
      const voiceInputRef=useRef(null),sourceInputRef=useRef(null),manualWorkspaceOverrideRef=useRef(false);
      const handlers=useAudioSourceMediaHandlers({userId,copy,manualWorkspaceOverrideRef,voiceInputRef,sourceInputRef,setIsUploadingVoice,setVoiceSample,setNotice,setGeneratedPickerOpen(){},setIsUploadingSource(){},setResult(){},setSourceVideo(){}});
      return <><input type="file" ref={voiceInputRef} onChange={e=>void handlers.handleVoiceFileSelect(e.target.files)}/><button onClick={handlers.handleClearVoiceSample??(()=>setVoiceSample(null))}>Remove</button><output data-busy={busy}>{voice?.name}</output><aside>{notice}</aside></>;
    }
    const root=createRoot(document.getElementById('root'));
    window.fx={act,render:owner=>root.render(<Fixture key={owner} userId={owner}/>),renderWorkspace:()=>root.render(<AudioWorkspace/>),unmount:()=>root.unmount()};
  ` },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
  define: { 'process.env.NODE_ENV': '"test"' },
  nodePaths: [resolve('frontend/node_modules')],
  plugins: [{ name: 'session-boundary', setup(builder) {
    const mocks = {
      'next/navigation': `export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/app/audio';export const useRouter=()=>({replace:url=>{window.lastNavigation=url}});`,
      '@/hooks/useRequireAuth': `export const useRequireAuth=()=>({user:{id:'A'},loading:false});`,
      '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en',t:(_key,fallback)=>fallback});`,
      '@/components/ui/Button': `export const ButtonLink=()=>null;`,
      './AudioLatestRendersRail': `export default()=>null;`,
      './_components/audio-generated-video-picker': `export const AudioGeneratedVideoPickerModal=()=>null;`,
      './_components/audio-workspace-composer-surface': `import React from'react';export const AudioWorkspaceComposerSurface=p=><><input type="file" ref={p.voiceInputRef} onChange={e=>void p.onVoiceFileSelect(e.target.files)}/><button onClick={()=>p.handlePackChange('voice_only')}>Voice</button><button onClick={()=>p.handlePackChange('music_only')}>Music</button><button onClick={()=>p.handleSelectLatestJob('saved-job')}>History</button><output data-busy={p.isUploadingVoice}>{p.voiceSample?.name}</output></>;`,
      './_hooks/useAudioActiveJobPolling': `export const useAudioActiveJobPolling=()=>{};`,
      './_hooks/useAudioGenerationRunner': `export const useAudioGenerationRunner=()=>({generate(){},quote:null,canSubmit:false});`,
      './_hooks/useAudioGeneratedVideos': `export const useAudioGeneratedVideos=()=>({generatedVideos:[],generatedVideosError:null,isGeneratedVideosLoading:false});`,
      './_hooks/useAudioWorkspaceRestoration': `import{useRef}from'react';export const useAudioWorkspaceRestoration=()=>({manualWorkspaceOverrideRef:useRef(false)});`,
    };
    builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'workspace-fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'workspace-fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
    builder.onResolve({ filter: /^@\/lib\/supabaseClient$/ }, () => ({ path: 'session', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase={auth:{getSession:()=>window.getSession()}};' }));
  } }],
}).then(result => result.outputFiles[0].text);

async function fixture() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/audio?intent=video', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window as any;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  w.Headers = Headers;
  w.MessageChannel = class {
    port1 = { onmessage() {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  };
  w.sessionStorage.setItem('last-known:user-id', 'A');
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null });
  w.fetch = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ ok: true, asset: { url: 'https://example.invalid/uploaded.wav', name: 'Uploaded voice' } }));
  };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render('A'));
  return { w, requests,
    async select() { await w.fx.act(async () => {
      const input = w.document.querySelector('input');
      Object.defineProperty(input, 'files', { configurable: true, value: [new w.File(['synthetic'], 'private-A.wav', { type: 'audio/wav' })] });
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
    }); },
    async close() { await w.fx.act(async () => w.fx.unmount()); w.close(); },
  };
}

test('the existing soundtrack voice picker uses the owned transport and displays a successful upload', async () => {
  const f = await fixture();
  try {
    await f.select();
    assert.equal(f.requests.length, 1);
    assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'), 'Bearer token-A');
    assert.equal(f.requests[0].init.credentials, 'omit');
    assert.ok(f.requests[0].init.signal);
    assert.equal(f.w.document.querySelector('output').textContent, 'Uploaded voice');
    assert.equal(f.w.document.querySelector('output').dataset.busy, 'false');
  } finally { await f.close(); }
});

for (const transition of ['remove', 'account', 'unmount']) test(`soundtrack voice upload cannot dispatch after ${transition} during session lookup`, async () => {
  const f = await fixture();
  let resolve!: (value: unknown) => void;
  f.w.getSession = () => new Promise(r => { resolve = r; });
  try {
    await f.select();
    assert.equal(typeof resolve, 'function', 'the picker must pass owner options and reach session validation');
    if (transition === 'remove') await f.w.fx.act(async () => f.w.document.querySelector('button').click());
    if (transition === 'account') await f.w.fx.act(async () => { f.w.sessionStorage.setItem('last-known:user-id', 'B'); f.w.fx.render('B'); });
    if (transition === 'unmount') await f.w.fx.act(async () => f.w.fx.unmount());
    await f.w.fx.act(async () => resolve({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null }));
    assert.deepEqual(f.requests, []);
    if (transition === 'remove') assert.equal(f.w.document.querySelector('output').textContent, '');
    if (transition === 'account') assert.equal(f.w.document.querySelector('output').textContent, 'Saved voice');
  } finally { if (transition !== 'unmount') await f.close(); else f.w.close(); }
});

for (const transition of ['Music', 'History']) test(`the actual soundtrack workspace retires a pending upload on ${transition}`, async () => {
  const f = await fixture();
  let resolve!: (value: unknown) => void;
  f.w.getSession = () => new Promise(r => { resolve = r; });
  try {
    await f.w.fx.act(async () => f.w.fx.renderWorkspace());
    await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find(button => button.textContent === 'Voice').click());
    await f.select();
    assert.equal(typeof resolve, 'function');
    await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find(button => button.textContent === transition).click());
    await f.w.fx.act(async () => resolve({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null }));
    assert.deepEqual(f.requests, [], 'retired intent must not upload the file');
    assert.equal(f.w.document.querySelector('output').textContent, '');
    assert.equal(f.w.document.querySelector('output').dataset.busy, 'false');
    if (transition === 'History') assert.equal(f.w.lastNavigation, '/app/audio?intent=video&job=saved-job');
  } finally { await f.close(); }
});
