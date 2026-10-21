import assert from 'node:assert/strict';
import test from 'node:test';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {useConversationMediaShelf} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationMediaShelf';
import type {ImageConversationTurn} from '../frontend/src/lib/studio/image-conversation-contract';

const image='ma_'+'a'.repeat(32),video='ma_'+'b'.repeat(32);
const history=[{references:[image],attachments:[{type:'asset',assetId:video,kind:'video'}],referenceMentions:[{assetId:image,label:'Image 2'},{assetId:video,label:'Video 1'}]}] as ImageConversationTurn[];

test('selected media survive a follow-up and reload, while removal and account/project boundaries remain explicit',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio'});
  Object.defineProperty(dom.window,'matchMedia',{value:()=>({matches:true,addEventListener(){},removeEventListener(){}})});
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value});
  const root=createRoot(dom.window.document.getElementById('root')!);
  let state!:ReturnType<typeof useConversationMediaShelf>;
  function Probe({scope,ready,turns}:{scope:string;ready:boolean;turns:ImageConversationTurn[]}) {
    state=useConversationMediaShelf(turns,'en',true,scope.split(':')[0],{scopeKey:scope,ready});return null;
  }
  const render=async(scope='account-a:project-a',ready=true,turns=history)=>act(async()=>{root.render(React.createElement(Probe,{key:scope,scope,ready,turns}));});
  try {
    await render('account-a:project-a',false,[]);
    assert.deepEqual(state.references,[]);
    await render();
    assert.deepEqual(state.references.map(ref=>[ref.assetId,ref.kind,ref.label]),[[image,'image','Image 2'],[video,'video','Video 1']]);
    await render('account-a:project-a',true,[...history,{references:[],referenceMentions:[]} as unknown as ImageConversationTurn]);
    assert.equal(state.references.length,2,'polling does not clear an active selection');
    await act(async()=>state.detach(video));
    await act(async()=>{root.render(null);});await render();
    assert.deepEqual(state.references.map(ref=>ref.assetId),[image],'removed media must not reappear from historical messages');
    await act(async()=>state.clear());
    await act(async()=>{root.render(null);});await render();
    assert.deepEqual(state.references,[],'an explicitly empty selection survives reload');
    await render('account-b:project-a',true,[]);assert.deepEqual(state.references,[]);
    await act(async()=>state.attach({assetId:image,kind:'image',url:'https://private.test/signed?token=secret'}));
    await render('account-b:project-b',true,[]);assert.deepEqual(state.references,[]);
    assert.doesNotMatch(JSON.stringify(dom.window.sessionStorage),/private|secret|https/,'selection storage contains identities, never private URLs');
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
  }
});
