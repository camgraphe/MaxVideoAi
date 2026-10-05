import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {stageGuestCreation,consumeGuestCreation} from '../frontend/lib/guest-creation-continuation';

test('Studio validates the same-tab draft before creating a project, falling back on expired or replayed links',async()=>{
  const frontend=resolve('frontend');
  const stubs:Record<string,string>={
    '../conversation/[projectId]/image-conversation.module.css':'export default {};',
    'next/navigation':'export const useRouter=()=>({replace:fixture.replace,refresh(){}});',
    '@/lib/i18n/I18nProvider':'export const useI18n=()=>({locale:"fr"});',
    '@/hooks/useThemePreference':'export const useThemePreference=()=>({resolvedTheme:"light"});',
    '../_hooks/useStudioProjectCreation':'export const useStudioProjectCreation=(_account,onCreated)=>{fixture.onCreated=onCreated;return {create:fixture.create,error:null};};',
    '../conversation/[projectId]/_components/ConversationWelcome.client':'export const ConversationWelcome=()=>null;',
    '../conversation/[projectId]/_components/ImageConversationComposer.client':'export const ImageConversationComposer=()=>null;',
  };
  const bundled=await build({absWorkingDir:frontend,stdin:{contents:"export {StudioStart} from './app/(core)/(workspace)/app/studio/_components/StudioStart.client';",resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',loader:{'.css':'empty'},jsx:'automatic',plugins:[{name:'studio-entry-fixture',setup(builder){builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
  const require=createRequire(resolve(frontend,'package.json'));
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio',pretendToBeVisual:true});
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const routes:string[]=[],creates:string[]=[];
  const fixture={onCreated:(_id:string)=>{},replace:(url:string)=>{routes.push(url);},create:async(name:string)=>{creates.push(name);fixture.onCreated('new-project');}};
  const module={exports:{} as {StudioStart:React.ComponentType<{accountKey:string;recentProjectId?:string;starter?:string;continuationToken?:string}>}};
  runInNewContext(bundled.outputFiles[0].text,{module,exports:module.exports,fixture,require,React,console,window:dom.window,sessionStorage:dom.window.sessionStorage,URL,URLSearchParams,Date});
  const {createRoot}=require('react-dom/client');
  const token='10000000-0000-4000-8000-000000000001';
  let root:ReturnType<typeof createRoot>|null=null;
  try {
    for(const scenario of ['missing','expired','consumed','wrong-surface','malformed','valid','starter','first-visit']) {
      dom.window.sessionStorage.clear();routes.length=0;creates.length=0;
      dom.window.history.replaceState({},'',`/app/studio?continueDraft=${token}`);
      if(['expired','consumed','wrong-surface','malformed','valid'].includes(scenario)) {
        stageGuestCreation(dom.window.sessionStorage,scenario==='wrong-surface'?'/app':'/app/studio',JSON.stringify({message:scenario==='malformed'?42:'Mon propre produit'}),token,scenario==='expired'?Date.now()-31*60_000:Date.now());
        if(scenario==='consumed')consumeGuestCreation(dom.window.sessionStorage,'/app/studio',token);
      }
      root=createRoot(dom.window.document.getElementById('root')!);
      await act(async()=>{root!.render(React.createElement(module.exports.StudioStart,{accountKey:'owner',recentProjectId:scenario==='first-visit'?undefined:'recent',starter:scenario==='starter'?'product-ad':undefined,continuationToken:token}));});
      if(['valid','starter','first-visit'].includes(scenario)) {
        assert.equal(creates.length,1,scenario);
        const next=new URL(routes[0],'http://localhost');
        assert.equal(next.pathname,'/app/studio/conversation/new-project',scenario);
        assert.equal(next.searchParams.get('continueDraft'),scenario==='valid'?token:null,scenario);
        assert.equal(next.searchParams.get('starter'),scenario==='starter'?'product-ad':null,scenario);
        if(scenario==='valid')assert.equal(consumeGuestCreation(dom.window.sessionStorage,'/app/studio',token),'{"message":"Mon propre produit"}','entry validates without consuming the brief');
      }else {
        assert.equal(creates.length,0,scenario);
        assert.deepEqual(routes,['/app/studio/conversation/recent'],scenario);
      }
      if(scenario!=='valid')assert.equal(new URL(dom.window.location.href).searchParams.get('continueDraft'),null,scenario);
      await act(async()=>root!.unmount());root=null;
    }
  } finally {
    if(root)await act(async()=>root!.unmount());dom.window.close();
    for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
  }
});
