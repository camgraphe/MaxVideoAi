import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {ImageConversationTurn} from '../frontend/src/lib/studio/image-conversation-contract';

const operationId='00000000-0000-4000-8000-000000000001';
const quote={operationId,toolId:'subtitles',kind:'render',price:{amountCents:0,currency:'USD'},
  expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true,document:{id:'document',revision:2}};
const operation={operationId,toolId:'subtitles',state:'prepared',confirmationEnabled:true,jobId:null,retry:{afterSeconds:null},result:null};
const base={requestId:'00000000-0000-4000-8000-000000000002',message:'Render my captions',references:[],state:'ready',
  creatorQuote:quote,creatorOperation:operation} as unknown as ImageConversationTurn;

test('creator cards require explicit approval of included exports and expose the exact completed revision',async()=>{
  const require=createRequire(import.meta.url),css=require.extensions['.css'];
  require.extensions['.css']=module=>{module.exports={};};
  let component:typeof import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationCreatorOperation.client');
  try {component=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationCreatorOperation.client');}
  catch {assert.fail('Milo creator quote/result cards are required.');}
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio/conversation/project-A'});
  const old=new Map<string,PropertyDescriptor|undefined>();
  const posts:unknown[]=[];
  let acknowledge!:()=>void;const acknowledgement=new Promise<void>(resolve=>{acknowledge=resolve;});
  for(const[key,value]of Object.entries({React,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT:true,fetch:async(_url:string,init:RequestInit)=>{
      posts.push(JSON.parse(String(init.body)));
      await acknowledgement;
      return Response.json({ok:true,result:{...operation,state:'queued',confirmationEnabled:false,jobId:'saved-job'}});
    }})) {old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const root=createRoot(dom.window.document.getElementById('root')!);
  let turn=base,busy=false;
  const render=()=>act(async()=>root.render(React.createElement(component.ConversationCreatorOperation,{
    turn,projectId:'project-A',accountKey:'account-A',locale:'en',busy,onChange:async()=>{},onRenew:()=>{},
  })));
  try {
    await render();assert.equal(posts.length,0);
    const confirm=[...dom.window.document.querySelectorAll('button')].find(button=>/Export MP4/.test(button.textContent??''))!;
    assert.ok(confirm);assert.match(confirm.textContent??'',/included/);assert.doesNotMatch(confirm.textContent??'',/0\.00/);assert.equal(confirm.disabled,false);
    await act(async()=>confirm.click());assert.equal(posts.length,1);
    assert.match(dom.window.document.body.textContent??'',/Confirming/);
    assert.doesNotMatch(dom.window.document.body.textContent??'',/reply was lost/);
    await act(async()=>acknowledge());
    assert.deepEqual(posts[0],{requestId:base.requestId,confirmed:true,creator:{toolId:'subtitles',operationId,amountCents:0,currency:'USD'}});
    assert.doesNotMatch(dom.window.document.body.textContent??'',/Export MP4 — included/);
    turn={...base,creatorOperation:{...operation,state:'completed',confirmationEnabled:false,jobId:'saved-job',result:{outputs:[],document:{
      id:'document',revision:2,openUrl:'/app/tools/subtitles?document=document&revision=2',
      srtUrl:'/api/tools/subtitles/documents/document/download?format=srt&revision=2',
      vttUrl:'/api/tools/subtitles/documents/document/download?format=vtt&revision=2',
    }}}} as unknown as ImageConversationTurn;
    await render();
    const links=[...dom.window.document.querySelectorAll('a')].map(link=>link.getAttribute('href'));
    assert.deepEqual(links,[
      '/app/tools/subtitles?document=document&revision=2',
      '/api/tools/subtitles/documents/document/download?format=srt&revision=2',
      '/api/tools/subtitles/documents/document/download?format=vtt&revision=2',
    ]);
    assert.match(dom.window.document.body.textContent??'',/2/);assert.equal(posts.length,1);
    turn={...base,creatorQuote:{...quote,operationId:'00000000-0000-4000-8000-000000000003'},
      creatorOperation:{...operation,operationId:'00000000-0000-4000-8000-000000000003',needsAttention:true}} as unknown as ImageConversationTurn;
    await render();
    assert.equal([...dom.window.document.querySelectorAll('button')].some(button=>/Confirm/.test(button.textContent??'')&&!button.disabled),false);
    assert.match(dom.window.document.body.textContent??'',/attention/i);
    const privateOriginal='https://cdn.maxvideoai.com/result.mp4?read=private';
    turn={...base,creatorQuote:{...quote,toolId:'product-video-editor',kind:'generate'},creatorOperation:{...operation,
      toolId:'product-video-editor',state:'completed',confirmationEnabled:false,jobId:'saved-video',result:{outputs:[{
        ref:{type:'asset',assetId:'ma_'+'1'.repeat(32),kind:'video'},kind:'video',readUrl:privateOriginal,
        thumbnailReadUrl:'https://cdn.maxvideoai.com/poster.jpg?read=private',artifactDelivery:'available',
      }]}}} as unknown as ImageConversationTurn;
    await render();
    const video=dom.window.document.querySelector('video')!;
    assert.ok(video);assert.equal(video.preload,'none');assert.equal(video.autoplay,false);
    assert.equal(video.getAttribute('src'),privateOriginal);
    assert.equal(dom.window.document.querySelector('figcaption a')?.getAttribute('href'),privateOriginal);
    assert.equal(posts.length,1);
  } finally {
    await act(async()=>root.unmount());dom.window.close();for(const[key,value]of old)value?Object.defineProperty(globalThis,key,value):Reflect.deleteProperty(globalThis,key);
    if(css)require.extensions['.css']=css;else delete require.extensions['.css'];
  }
});
