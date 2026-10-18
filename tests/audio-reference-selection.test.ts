import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { newAudioDraft } from '../frontend/src/lib/audio-creation';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));
const mocks: Record<string, string> = {
  'next/navigation': `import {useSyncExternalStore} from 'react';const subscribe=fn=>{window.addEventListener('popstate',fn);window.addEventListener('audio-history',fn);return()=>{window.removeEventListener('popstate',fn);window.removeEventListener('audio-history',fn)}};export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>window.location.search));export const usePathname=()=>'/app/audio'; const router={replace(){throw Error('Unexpected RSC navigation')},push(){throw Error('Unexpected RSC navigation')}};export const useRouter=()=>router;`,
  './AudioWorkspace': `export default ()=>null;`,
  'next/dynamic': `import React from 'react';export default loader=>String(loader).includes('AudioReferenceLibrary')?function Picker({onSelect}){return React.createElement('button',{onClick:()=>onSelect({url:'https://fixture.example/library-B.wav',name:'Library B'})},'Choose library B')}:()=>null;`,
  '@/hooks/useRequireAuth': `export const useRequireAuth=()=>({user:{id:globalThis.audioReferenceFixture.owner}});`,
  '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en'});`,
  '@/lib/api': `export const runAudioGenerate=body=>new Promise(resolve=>globalThis.audioReferenceFixture.runs.push({body,resolve}));export const useInfiniteJobs=()=>({stableJobs:[{jobId:'old-job',prompt:'Restore previous job',createdAt:'2026-09-08',status:'completed',audioUrl:'https://fixture.example/old-job.mp3',engineLabel:'MMAudio V2',pricing:{currency:'USD',totalCents:5}}],mutate:()=>{globalThis.audioReferenceFixture.refreshes++},isLoading:false});`,
  './_lib/audio-workspace-helpers': `export const uploadAsset=()=>new Promise((resolve,reject)=>globalThis.audioReferenceFixture.uploads.push(Object.assign(resolve,{reject})));export const fetchJobDetail=()=>new Promise(resolve=>globalThis.audioReferenceFixture.restores.push(resolve));`,
};

test('audio reference upload preserves a later library selection or removal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-workspace-test-'));
  const output = join(directory, 'workspace.cjs');
  const compiled = await build({ entryPoints: [resolve('frontend/app/(core)/(workspace)/app/audio/AudioCreationWorkspace.tsx')], outfile: output, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json', packages: 'external', loader: { '.css': 'empty', '.module.css': 'empty' }, plugins: [{name:'audio-fixture',setup(builder) {
    builder.onResolve({filter:/.*/}, args => {
      if (args.path in mocks) return { path: args.path, namespace: 'fixture' };
      if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
      // The bundle lives in /tmp, outside pnpm's package resolution tree.
      if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) {
        return { path: frontendRequire.resolve(args.path), external: true };
      }
      return undefined;
    });
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
  }}] });
  await writeFile(output, compiled.outputFiles[0].contents);
  const Workspace = require(output).default;
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/app/audio'});
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  dom.window.HTMLMediaElement.prototype.load = () => {};
  const nativePush = dom.window.history.pushState.bind(dom.window.history);
  dom.window.history.pushState = (data, unused, url) => {
    nativePush(data, unused, url);
    // Model Next's native history subscription; the browser integration is verified separately.
    dom.window.dispatchEvent(new dom.window.Event('audio-history'));
  };
  const review = { owner:'a', runs:[] as any[], uploads:[] as any[], restores:[] as any[], refreshes:0 };
  const globals = { window:dom.window, document:dom.window.document, navigator:dom.window.navigator, localStorage:dom.window.localStorage, CustomEvent:dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT:true, audioReferenceFixture:review,
    Audio: class { duration=1; onloadedmetadata=()=>{}; onerror=()=>{}; set src(_value:string) {queueMicrotask(()=>this.onloadedmetadata())} removeAttribute(){} load(){} },
    fetch: async () => new Response(JSON.stringify({ok:true,inputKey:'same-config',expiresAt:Date.now()+60000,pricing:{currency:'USD',totalCents:20}})),
  };
  const saved = new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = (owner:string) => act(async()=>{review.owner=owner;root.render(React.createElement(Workspace));});
  const tick = () => act(async()=>{await new Promise(resolve=>setTimeout(resolve,390));});
  const click = (text:string) => act(async()=>{const button=[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent?.startsWith(text) || button.getAttribute('aria-label')===text);assert.ok(button,text);button.click();});
  try {
    const stored = () => JSON.parse(localStorage.getItem('maxvideoai.audio.creation.v1:a')!).drafts.voice.reference;
    const startUpload = async () => {
      await act(async()=>{const input=dom.window.document.querySelector('input[type=file]')!;Object.defineProperty(input,'files',{configurable:true,value:[new File(['audio'],'upload-A.wav',{type:'audio/wav'})]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
      assert.ok(review.uploads.length);return review.uploads.at(-1);
    };
    for (const scenario of ['replace','remove']) {
      localStorage.setItem('maxvideoai.audio.creation.v1:a',JSON.stringify({version:1,drafts:{voice:{...newAudioDraft('voice'),voiceModel:'seed',script:'My script'}}}));
      await render('a');await tick();
      const upload = await startUpload();
      await click('Choose from Media');await click('Choose library B');
      assert.equal(stored().name,'Library B');
      if(scenario==='remove'){await click('Remove');assert.equal(stored(),null);}
      await act(async()=>upload({url:'https://fixture.example/upload-A.wav',name:'Upload A'}));
      assert.equal(stored()?.name ?? null,scenario==='replace'?'Library B':null,'obsolete upload must not replace the later choice');
      assert.ok(!dom.window.document.body.textContent?.includes('Upload A'));
      await tick();await click('Generate');
      assert.equal(review.runs.at(-1).body.voiceSampleUrl,scenario==='replace'?'https://fixture.example/library-B.wav':undefined);
      await act(async()=>root.render(null));
    }
    for(const scenario of ['new-upload','model','intent','reuse','late-error']) {
      localStorage.setItem('maxvideoai.audio.creation.v1:a',JSON.stringify({version:1,drafts:{voice:{...newAudioDraft('voice'),voiceModel:'seed',script:'My script'}}}));
      await render('a');await tick();
      const first=await startUpload();
      if(scenario==='new-upload' || scenario==='late-error') {
        await click('Choose from Media');await click('Choose library B');
        if(scenario==='late-error'){
          await act(async()=>first.reject(Error('retired upload')));
          assert.ok(!document.body.textContent?.includes('Use an MP3 or WAV'));
          assert.equal(stored().name,'Library B');
        }else{
          await click('Remove');const second=await startUpload();
          await act(async()=>first({url:'https://fixture.example/old.wav',name:'Retired upload'}));await tick();
          const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Generate'))!;
          assert.ok(button.disabled,'old completion cannot end the newer upload busy state');
          assert.equal(stored(),null);
          await act(async()=>second({url:'https://fixture.example/current.wav',name:'Current upload'}));
          assert.equal(stored().name,'Current upload');
        }
      }else{
        if(scenario==='model')await act(async()=>{const select=document.querySelector('select[aria-label=Model]') as HTMLSelectElement;select.value='minimax';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
        if(scenario==='intent'){
          const choose=async(name:string)=>act(async()=>{const button=[...document.querySelectorAll('nav button')].find(b=>b.textContent?.includes(name));assert.ok(button);button.click()});
          await choose('Sound effects');await choose('Voice');
        }
        if(scenario==='reuse'){
          await click('Restore previous job');await act(async()=>review.restores.at(-1)({jobId:'old-job',status:'completed',audioUrl:'https://fixture.example/old-job.mp3',settingsSnapshot:{pack:'voice_only',script:'Restored script',voiceModel:'seed',refs:{voiceSampleUrl:'https://fixture.example/reused.wav'}}}));
          await click('Reuse settings');
        }
        await act(async()=>first({url:'https://fixture.example/old.wav',name:'Retired upload'}));
        assert.equal(stored()?.url ?? null,scenario==='reuse'?'https://fixture.example/reused.wav':null);
      }
      await act(async()=>root.render(null));
    }
  } finally {
    await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}await rm(directory,{recursive:true,force:true});
  }
});
