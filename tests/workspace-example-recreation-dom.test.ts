import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { buildExampleRecreationHref } from '../frontend/lib/example-recreation';
import { resolveWorkspaceRequestParams } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';
import type { SharedVideoPreview } from '../frontend/lib/video-preview-group';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { VideoGroup } from '../frontend/types/video-groups';

test('comparison click hydrates the chosen draft once, without fetching the original private job', async () => {
  const href=buildExampleRecreationHref('example','wan-3',{durationSec:22,resolution:'720p',aspectRatio:'16:9',audio:true,mode:'t2v'});
  const request=resolveWorkspaceRequestParams(new URL(href,'http://localhost').searchParams,'/app');
  assert.equal(request.loginRedirectTarget,href,'the complete comparison survives the login return URL');
  const dom=new JSDOM('<div id="root"></div>',{url:`http://localhost${href}`});
  const saved=new Map<string,PropertyDescriptor|undefined>(),calls:string[]=[];
  let reply!: (response:Response)=>void;
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:(url:string)=>{calls.push(url);assert.equal(url,'/api/videos/example');return new Promise<Response>(resolve=>{reply=resolve;});}})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const engines=getBaseEngines(),engineMap=new Map(engines.map(e=>[e.id,e]));
  const noop=()=>{},notices:string[]=[],replacements:string[]=[];
  const replaceRoute=(href:string)=>replacements.push(href);
  const setNotice:Parameters<typeof useWorkspaceVideoSettings>[0]['setNotice']=notice=>{if(typeof notice==='string')notices.push(notice);};
  let observed:{form:FormState|null;prompt:string}={form:null,prompt:''};
  let activeHref=href;
  let editPrompt!:(value:string)=>void;
  function Fixture(){
    const [form,setForm]=React.useState<FormState|null>(null),[prompt,setPrompt]=React.useState('old draft');
    const [sharedVideoSettings,setSharedVideoSettings]=React.useState<SharedVideoPreview|null>(null);
    const [compositeOverride,setCompositeOverride]=React.useState<VideoGroup|null>(null);
    observed={form,prompt};editPrompt=setPrompt;
    useWorkspaceVideoSettings({locale:'fr',accountScope:'public',activeDraftReady:true,engines,engineMap,provider:'fal',fromVideoId:'example',requestedJobId:null,searchString:activeHref.split('?')[1],sharedVideoSettings,authChecked:true,hydratedForScope:'public',storageScope:'public',effectiveRequestedEngineId:'wan-3',effectiveRequestedEngineToken:'wan3',rendersLength:0,compositeOverride,compositeOverrideSummary:null,focusComposer:noop,readScopedStorage:()=>null,writeScopedStorage:noop,replaceRoute,setNotice,setPrompt,setForm,setSharedVideoSettings,setCompositeOverride,setNegativePrompt:noop,setMemberTier:noop,setCfgScale:noop,setShotType:noop,setVoiceIdsInput:noop,setMultiPromptEnabled:noop,setMultiPromptScenes:noop,setInputAssets:noop,setKlingElements:noop,setSelectedPreview:noop,setCompositeOverrideSummary:noop,setSharedPrompt:noop});
    return null;
  }
  const root=createRoot(dom.window.document.getElementById('root')!);
  try{
    await act(async()=>root.render(React.createElement(Fixture)));
    await act(async()=>reply(new Response(JSON.stringify({ok:true,video:{id:'example',engineId:'wan-3-prime',engineLabel:'Wan 3 Prime',prompt:'The full public prompt',durationSec:22,aspectRatio:'16:9',createdAt:''}}),{status:200})));
    const result=observed as {form:FormState|null;prompt:string};
    assert.equal(result.form?.engineId,'wan-3');assert.equal(result.form?.durationSec,22);assert.equal(result.form?.resolution,'720p');assert.equal(result.form?.audio,true);assert.equal(result.prompt,'The full public prompt');assert.deepEqual(calls,['/api/videos/example']);assert.deepEqual(notices,[]);
    await act(async()=>editPrompt('My own edit'));
    await act(async()=>root.render(React.createElement(Fixture)));
    assert.equal(observed.prompt,'My own edit');assert.deepEqual(calls,['/api/videos/example']);
    assert.ok(replacements[0].includes('engine=wan-3'));assert.ok(!replacements[0].includes('from='));
    // A new intentional choice for the same video must not be mistaken for background revalidation.
    activeHref=buildExampleRecreationHref('example','wan-3-prime',{durationSec:22,resolution:'720p',aspectRatio:'16:9',audio:true,mode:'t2v'});
    await act(async()=>root.render(React.createElement(Fixture)));
    await act(async()=>reply(new Response(JSON.stringify({ok:true,video:{id:'example',engineId:'wan-3-prime',engineLabel:'Wan 3 Prime',prompt:'The full public prompt',durationSec:22,aspectRatio:'16:9',createdAt:''}}),{status:200})));
    assert.equal(observed.form?.engineId,'wan-3-prime');
    assert.deepEqual(calls,['/api/videos/example','/api/videos/example']);

  }finally{
    await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});
