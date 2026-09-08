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
const mocks: Record<string, string> = {
  'next/navigation': `import {useSyncExternalStore} from 'react';const subscribe=fn=>{window.addEventListener('popstate',fn);window.addEventListener('audio-history',fn);return()=>{window.removeEventListener('popstate',fn);window.removeEventListener('audio-history',fn)}};export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>window.location.search));export const usePathname=()=>'/app/audio'; const router={replace(){throw Error('Unexpected RSC navigation')},push(){throw Error('Unexpected RSC navigation')}};export const useRouter=()=>router;`,
  './AudioWorkspace': `export default ()=>null;`,
  'next/dynamic': `export default ()=>()=>null;`,
  '@/hooks/useRequireAuth': `export const useRequireAuth=()=>({user:{id:globalThis.audioReview.owner}});`,
  '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en'});`,
  '@/lib/api': `export const runAudioGenerate=body=>new Promise(resolve=>globalThis.audioReview.runs.push({body,resolve}));export const useInfiniteJobs=()=>({stableJobs:[{jobId:'old-job',prompt:'Restore previous job',createdAt:'2026-09-08'}],mutate:()=>{globalThis.audioReview.refreshes++},isLoading:false});`,
  './_lib/audio-workspace-helpers': `export const uploadAsset=()=>new Promise(resolve=>globalThis.audioReview.uploads.push(resolve));export const fetchJobDetail=()=>new Promise(resolve=>globalThis.audioReview.restores.push(resolve));`,
};

test('actual workspace handles local intent history and retires stale asynchronous responses', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-workspace-test-'));
  const output = join(directory, 'workspace.cjs');
  const compiled = await build({ entryPoints: [resolve('frontend/app/(core)/(workspace)/app/audio/AudioCreationWorkspace.tsx')], outfile: output, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json', packages: 'external', loader: { '.css': 'empty', '.module.css': 'empty' }, plugins: [{name:'audio-fixture',setup(builder) {
    builder.onResolve({filter:/.*/}, args => args.path in mocks ? { path: args.path, namespace:'fixture' } : args.path === 'react' || args.path.startsWith('react/') ? { path: require.resolve(args.path), external: true } : undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
  }}] });
  await writeFile(output, compiled.outputFiles[0].contents);
  const Workspace = require(output).default;
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/app/audio'});
  const nativePush = dom.window.history.pushState.bind(dom.window.history);
  dom.window.history.pushState = (data, unused, url) => {
    nativePush(data, unused, url);
    // Model Next's native history subscription; the browser integration is verified separately.
    dom.window.dispatchEvent(new dom.window.Event('audio-history'));
  };
  const review = { owner:'a', runs:[] as any[], uploads:[] as any[], restores:[] as any[], refreshes:0 };
  const globals = { window:dom.window, document:dom.window.document, navigator:dom.window.navigator, localStorage:dom.window.localStorage, CustomEvent:dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT:true, audioReview:review,
    Audio: class { duration=1; onloadedmetadata=()=>{}; onerror=()=>{}; set src(_value:string) {queueMicrotask(()=>this.onloadedmetadata())} removeAttribute(){} load(){} },
    fetch: async () => new Response(JSON.stringify({ok:true,inputKey:'same-config',expiresAt:Date.now()+60000,pricing:{currency:'USD',totalCents:20}})),
  };
  const saved = new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = (owner:string) => act(async()=>{review.owner=owner;root.render(React.createElement(Workspace));});
  const tick = () => act(async()=>{await new Promise(resolve=>setTimeout(resolve,390));});
  const click = (text:string) => act(async()=>{const button=[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent?.startsWith(text));assert.ok(button,text);button.click();});
  const generateResult = (id:string) => ({ok:true,jobId:id,status:'completed',audioUrl:`https://fixture.example/${id}.mp3`,durationSec:1,providers:{},pricing:{currency:'USD',totalCents:20}});
  let notifications=0;dom.window.addEventListener('jobs:status',()=>notifications++);
  try {
    localStorage.setItem('maxvideoai.audio.creation.v1:a',JSON.stringify({version:1,drafts:{
      voice:{...newAudioDraft('voice'),script:'Voice draft'},
      sfx:{...newAudioDraft('sfx'),prompt:'An electric click'},
      ambience:{...newAudioDraft('ambience'),prompt:'Gentle rain'},
    }}));
    dom.window.history.replaceState(null,'','?intent=voice&job=linked-job&reuse=1&context=studio');
    await render('a');await tick();
    const linkedRestore=review.restores.at(-1);
    const intent = () => dom.window.document.querySelector('main')?.getAttribute('data-audio-creation');
    const choose = (name:string) => act(async()=>{
      const button=[...dom.window.document.querySelectorAll('nav button')].find(button=>button.textContent?.includes(name));
      assert.ok(button,name);button.click();
    });
    const generateButton = () => [...dom.window.document.querySelectorAll('button')].find(button=>button.textContent?.startsWith('Generate'))!;
    await choose('Sound effects');
    assert.equal(intent(),'sfx','selection and editor change without waiting for a server response');
    assert.equal(dom.window.document.querySelector('textarea')?.value,'An electric click');
    assert.equal(dom.window.location.search,'?intent=sfx&context=studio','manual choice retires job/reuse while preserving unrelated context');
    assert.ok(generateButton().disabled,'old voice quote is invalidated immediately');
    await act(async()=>linkedRestore({jobId:'linked-job',status:'completed',audioUrl:'https://fixture.example/stale.mp3',settingsSnapshot:{pack:'voice_only',script:'Wrong restoration'}}));
    assert.equal(dom.window.document.querySelector('audio'),null,'retired query-job callback cannot change current result');
    await choose('Ambiences');await choose('Sound effects');
    assert.equal(intent(),'sfx');
    const traverse = (direction:'back'|'forward') => act(async()=>{
      await new Promise<void>(resolve=>{dom.window.addEventListener('popstate',()=>resolve(),{once:true});dom.window.history[direction]();});
    });
    await traverse('back');assert.equal(intent(),'ambience');
    await traverse('back');assert.equal(intent(),'sfx');
    await traverse('back');assert.equal(intent(),'voice');
    assert.equal(new URLSearchParams(dom.window.location.search).get('job'),'linked-job');
    assert.equal(dom.window.document.querySelector('textarea')?.value,'Voice draft');
    await traverse('forward');assert.equal(intent(),'sfx');
    await act(async()=>root.render(null));
    dom.window.history.replaceState(null,'','/app/audio');
    for(const transition of ['roundtrip','remount']) {
      localStorage.setItem('maxvideoai.audio.creation.v1:a',JSON.stringify({version:1,drafts:{voice:{...newAudioDraft('voice'),script:'An owned script'}}}));
      await render('a');await tick();
      await click('Generate');const oldRun=review.runs.at(-1);
      await act(async()=>{const input=dom.window.document.querySelector('input[type=file]')!;Object.defineProperty(input,'files',{configurable:true,value:[new File(['audio'],'reference.wav',{type:'audio/wav'})]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
      assert.ok(review.uploads.length);const oldUpload=review.uploads.at(-1);
      await click('Restore previous job');const oldRestore=review.restores.at(-1);
      if(transition==='roundtrip')await render('b');else await act(async()=>root.render(null));
      await render('a');await tick();
      assert.equal(dom.window.document.querySelector('audio'),null,'no retired result or reference displayed');
      await click('Generate');const currentRun=review.runs.at(-1);assert.notEqual(currentRun,oldRun);
      await act(async()=>currentRun.resolve(generateResult('current-'+transition)));
      const notificationsBefore=notifications;
      await act(async()=>{oldRun.resolve(generateResult('retired'));oldUpload({url:'https://fixture.example/retired.wav',name:'Retired reference'});oldRestore(generateResult('retired-job'));});
      assert.equal(notifications,notificationsBefore,'retired run cannot announce into current history');
      assert.equal(dom.window.document.querySelector('audio')?.getAttribute('src'),`https://fixture.example/current-${transition}.mp3`);
      assert.equal(JSON.parse(localStorage.getItem('maxvideoai.audio.creation.v1:a')!).drafts.voice.reference,null,'late upload cannot overwrite fresh draft');
      await act(async()=>root.render(null));
    }
  } finally {
    await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}await rm(directory,{recursive:true,force:true});
  }
});
