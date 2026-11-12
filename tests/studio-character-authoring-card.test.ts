import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createDefaultCharacterBuilderState} from '../frontend/src/lib/character-builder';
import {prepareCharacterBuilderRequest} from '../frontend/src/server/tools/character-builder/preparation';
import {projectCharacterBuilderRecipe} from '../frontend/server/character-studio/authoring-output';
import {characterBuilderCanonicalRequest} from '../frontend/server/character-studio/authoring-preparation';
import type {ImageConversationTurn} from '../frontend/src/lib/studio/image-conversation-contract';

test('the native Builder card shows its real recipe and requires the exact quote action while its purchase gate is open',async()=>{
  const require=createRequire(import.meta.url),css=require.extensions['.css'];require.extensions['.css']=module=>{module.exports={};};
  const {ImageQuoteCard}=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageQuoteCard.client');
  const dom=new JSDOM('<div id="root"></div>');const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const[key,value]of Object.entries({React,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const input={...createDefaultCharacterBuilderState(),action:'generate' as const,generateCount:1,userId:'owner'};
  input.traits.customDetailsDescription='One small cheek freckle';
  const prepared=prepareCharacterBuilderRequest(input);
  const quote={quoteId:'12345678-1234-4234-8234-123456789abc',requestHash:'a'.repeat(64),summary:characterBuilderCanonicalRequest(prepared),
    price:{amountCents:23,currency:'USD'},wallet:{amountCents:1000,currency:'USD'},expiresAt:'2099-01-01T00:00:00.000Z',
    state:'prepared',modelLabel:'Character Builder',fundingMode:'wallet',confirmationRequired:true,
    characterBuilder:{confirmationEnabled:false,recipe:projectCharacterBuilderRecipe(prepared.settingsSnapshot)}};
  let turn={requestId:'turn',state:'ready',quote,generation:null} as unknown as ImageConversationTurn;
  let confirmations=0;
  const root=createRoot(dom.window.document.getElementById('root')!);
  const render=()=>act(async()=>root.render(React.createElement(ImageQuoteCard,{turn,busy:false,locale:'en',
    onConfirm:()=>{confirmations++;},onRenew:()=>{},onRefresh:()=>{}})));
  try{
    await render();assert.equal(confirmations,0);assert.match(dom.window.document.body.textContent??'',/Character Builder/);
    let create=[...dom.window.document.querySelectorAll('button')].find(button=>/Create|Confirm character/.test(button.textContent??''))!;
    assert.equal(create,undefined);assert.match(dom.window.document.body.textContent??'',/confirmation is currently unavailable/);
    assert.doesNotMatch(dom.window.document.body.textContent??'',/Creation started/);
    turn={...turn,quote:{...turn.quote!,characterBuilder:{...quote.characterBuilder,confirmationEnabled:true}}};await render();
    create=[...dom.window.document.querySelectorAll('button')].find(button=>/Create|Confirm character/.test(button.textContent??''))!;
    assert.equal(create.disabled,false);assert.match(create.textContent??'',/0.23/);
    assert.match(dom.window.document.querySelector('summary')?.textContent??'',/character recipe/i);
    assert.match(dom.window.document.body.textContent??'',/One small cheek freckle/);
    await act(async()=>create.click());assert.equal(confirmations,1);
  }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,value]of previous)value?Object.defineProperty(globalThis,key,value):Reflect.deleteProperty(globalThis,key);
    if(css)require.extensions['.css']=css;else delete require.extensions['.css'];}
});
