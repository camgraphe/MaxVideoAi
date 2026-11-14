import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));
const routeRoot = 'frontend/app/(core)/(workspace)/app/audio';

test('Audio restoration survives same-account session refresh and shows completed media before source probing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-restore-'));
  const output = join(directory, 'hook.cjs');
  const mocks: Record<string,string> = {
    '@/lib/authFetch': "export const authFetch=()=>{throw Error('unexpected list request')}",
    '../_lib/audio-workspace-helpers': `export const fetchJobDetail=id=>new Promise(resolve=>globalThis.restoreTest.requests.push({id,resolve})); export const probeVideoDuration=url=>new Promise(resolve=>globalThis.restoreTest.probes.push({url,resolve})); export const inferOutputKind=()=> 'video+audio'; export const formatCopy=s=>s; export const resolveUiErrorMessage=e=>e.message; export const DEFAULT_INTENSITY='subtle',DEFAULT_LANGUAGE='english',DEFAULT_MANUAL_DURATION_SEC=5,DEFAULT_MOOD='documentary',DEFAULT_PACK='music_only',DEFAULT_VOICE_DELIVERY='neutral',DEFAULT_VOICE_GENDER='male',DEFAULT_VOICE_PROFILE='narrator';`,
  };
  const compiled = await build({entryPoints:[resolve(routeRoot,'_hooks/useAudioWorkspaceRestoration.ts')],outfile:output,bundle:true,write:false,platform:'node',format:'cjs',tsconfig:'frontend/tsconfig.json',packages:'external',plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/.*/},a=>{
      if(a.path in mocks)return {path:a.path,namespace:'fixture'};
      if(a.path==='react'||a.path.startsWith('react/'))return {path:require.resolve(a.path),external:true};
      if(!a.path.startsWith('.')&&!a.path.startsWith('/')&&!a.path.startsWith('@/'))return {path:frontendRequire.resolve(a.path),external:true};
    });
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'js'}));
  }}]});
  await writeFile(output,compiled.outputFiles[0].contents);
  const {useAudioWorkspaceRestoration}=require(output);
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/audio'});
  const state={requests:[] as any[],probes:[] as any[],result:null as any,pack:null as any,source:null as any,override:null as any};
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,React,IS_REACT_ACT_ENVIRONMENT:true,restoreTest:state};
  const saved=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
  const names=['ActiveJob','ExportAudioFile','Intensity','Language','ManualDurationSec','MusicBpm','Mood','MusicModel','MusicEnabled','Notice','Pack','Prompt','Result','Script','SeedAudioOutputFormat','SeedAudioPitch','SeedAudioSampleRate','SeedAudioSpeed','SeedAudioVoice','SeedAudioVolume','SourceVideo','VoiceDelivery','VoiceGender','VoiceProfile','VoiceSample'];
  const setters=Object.fromEntries(names.map(n=>['set'+n,(v:any)=>{if(n==='Result')state.result=v;if(n==='Pack')state.pack=v;if(n==='SourceVideo')state.source=v}]));
  const copy={messages:{loadSourceJob:'Unable to load job.',loadLatestJob:'Unable to load latest.'},source:{restoredLabel:'Restored',jobLabel:'Job',sourceLabel:'Source'}};
  function Harness({owner,job}:{owner:string;job:string}){
    const value=useAudioWorkspaceRestoration({copy,user:{id:owner},queryJobId:job,...setters});
    state.override=value.manualWorkspaceOverrideRef;
    return null;
  }
  const root=createRoot(dom.window.document.getElementById('root')!);
  const render=(owner:string,job='audio-job')=>act(async()=>{root.render(React.createElement(Harness,{owner,job}))});
  const detail=(id='audio-job')=>({jobId:id,surface:'audio',status:'completed',videoUrl:'https://private.test/movie.mp4',audioUrl:'https://private.test/sound.m4a',settingsSnapshot:{pack:'cinematic',sourceVideoUrl:'https://private.test/source.mp4'}});
  try {
    await render('owner'); const request=state.requests.at(-1);
    await render('owner');
    await act(async()=>request.resolve(detail()));
    // Old code starts a second read; resolving it keeps the test focused on restoration.
    if(state.requests.at(-1)!==request)await act(async()=>state.requests.at(-1).resolve(detail()));
    assert.equal(state.result?.jobId,'audio-job','completed result must not disappear after same-owner auth refresh or wait on source metadata');
    assert.equal(state.pack,'cinematic');
    assert.equal(state.result.videoUrl,'https://private.test/movie.mp4','restoration preserves the canonical original; presentation resolves read access');
    assert.match(state.probes.at(-1)?.url,/\/api\/audio\/media\/audio-job\?kind=source/);
    await render('owner','late-job'); const late=state.requests.at(-1);
    await render('other','other-job');state.result=null;state.source=null;
    await act(async()=>late.resolve(detail('late-job')));
    assert.equal(state.result,null,'retired account response cannot restore private output');
    await act(async()=>state.probes[0].resolve(5));
    assert.equal(state.source,null,'retired source probe cannot restore another account source');
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k]}
    await rm(directory,{recursive:true,force:true});
  }
});
