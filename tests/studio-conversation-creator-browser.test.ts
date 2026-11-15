import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';

// Real card/hook/CSS against an isolated journal boundary. No supplier, wallet,
// authentication service or public media request can run from this fixture.
test('creator approval fits the mobile chat and a lost reply reopens the exact saved result',{timeout:60000},async()=>{
  const frontend=join(process.cwd(),'frontend');
  const operationId='00000000-0000-4000-8000-000000000001';
  const requestId='00000000-0000-4000-8000-000000000002';
  const quote={operationId,toolId:'subtitles',kind:'transcribe',price:{amountCents:37,currency:'USD'},
    expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true};
  const prepared={operationId,toolId:'subtitles',state:'prepared',confirmationEnabled:true,jobId:null,retry:{afterSeconds:null},result:null};
  const turn={requestId,message:'Caption the selected video',references:[],state:'ready',retryable:false,reply:'Review this exact quote.',
    quote:null,generation:null,createdAt:'2026-11-12T12:00:00.000Z',creatorQuote:quote,creatorOperation:prepared};
  const bundled=await build({absWorkingDir:frontend,bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,minify:true,
    outfile:join(frontend,'creator-fixture.js'),tsconfig:join(frontend,'tsconfig.json'),loader:{'.module.css':'local-css'},
    define:{'process.env.NODE_ENV':'"production"'},stdin:{loader:'tsx',resolveDir:frontend,contents:`
      import React,{useCallback,useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
      import{ConversationCreatorOperation}from'./app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationCreatorOperation.client';
      import styles from './app/(core)/(workspace)/app/studio/conversation/[projectId]/image-conversation.module.css';
      function Fixture(){const[turn,setTurn]=useState(null);const refresh=useCallback(async()=>{const response=await fetch('/journal');setTurn((await response.json()).turn);},[]);
        useEffect(()=>{void refresh();},[refresh]);return <main className={styles.studio}><section style={{width:'100%',maxWidth:700,padding:12,boxSizing:'border-box'}}>
        {turn&&<ConversationCreatorOperation turn={turn} projectId="project-A" accountKey="account-A" locale="en" busy={false} onChange={refresh} onRenew={()=>{}}/>}</section></main>}
      createRoot(document.getElementById('root')).render(<Fixture/>);`}});
  const script=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text;
  const css=bundled.outputFiles.find(file=>file.path.endsWith('.css'))!.text;
  let reads=0,accepted=false;
  const approvals:unknown[]=[];
  const server=createServer((incoming,outgoing)=>{
    const path=new URL(incoming.url??'/','http://fixture.invalid').pathname;
    if(path==='/journal'){
      reads++;
      const completed=accepted&&reads>=3;
      const creatorOperation=completed?{...prepared,state:'completed',confirmationEnabled:false,jobId:'saved-job',result:{outputs:[],document:{
        id:'saved-document',revision:2,openUrl:'/app/tools/subtitles?document=saved-document&revision=2',
        srtUrl:'/srt?revision=2',vttUrl:'/vtt?revision=2'}}}:prepared;
      outgoing.setHeader('content-type','application/json');outgoing.end(JSON.stringify({turn:{...turn,creatorOperation}}));return;
    }
    if(path==='/api/studio/projects/project-A/image-conversation/confirm'){
      assert.equal(incoming.method,'POST');let body='';incoming.on('data',chunk=>{body+=chunk;});incoming.on('end',()=>{
        approvals.push(JSON.parse(body));accepted=true;
        // Model an ambiguous application acknowledgement without socket-level browser retries.
        outgoing.writeHead(503,{'content-type':'application/json'});
        outgoing.end(JSON.stringify({ok:false,error:'ACKNOWLEDGEMENT_UNAVAILABLE',retryable:true}));
      });return;
    }
    const body=path==='/fixture.js'?script:path==='/fixture.css'?css:
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>Milo creator local fixture</title><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font:16px/1.5 system-ui}</style><div id="root"></div><script src="/fixture.js"></script></html>';
    outgoing.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');outgoing.end(body);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const origin=`http://127.0.0.1:${address.port}`;
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  try {
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
    const page=await context.newPage();const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
    await page.goto(origin);
    const card=page.getByLabel('Subtitles quote and result',{exact:true});
    await expect(card).toBeVisible();await expect(card.getByRole('button',{name:'Confirm · $0.37',exact:true})).toBeEnabled();
    assert.equal(approvals.length,0);
    await page.setViewportSize({width:390,height:844});
    const box=await card.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390,'The exact-price approval must fit the mobile chat.');
    const proof=process.env.MILO_CREATOR_PROOF_DIR;
    if(proof){await mkdir(proof,{recursive:true});await card.screenshot({path:join(proof,'creator-mobile-quote.png')});}
    await card.getByRole('button',{name:'Confirm · $0.37',exact:true}).click();
    await expect(card.getByRole('button',{name:'Recover this attempt',exact:true})).toBeVisible();
    assert.equal(approvals.length,1);
    await page.reload();
    await expect(card.getByRole('link',{name:'Edit subtitles',exact:true})).toHaveAttribute('href','/app/tools/subtitles?document=saved-document&revision=2');
    await expect(card.getByRole('link',{name:'Download SRT',exact:true})).toHaveAttribute('href','/srt?revision=2');
    assert.equal(approvals.length,1,'Reload and result recovery cannot repeat the paid POST.');
    assert.deepEqual(approvals[0],{requestId,confirmed:true,creator:{toolId:'subtitles',operationId,amountCents:37,currency:'USD'}});
    assert.deepEqual(errors,[]);
    if(proof)await card.screenshot({path:join(proof,'creator-mobile-recovered.png')});
    await context.close();
  } finally {await browser?.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
