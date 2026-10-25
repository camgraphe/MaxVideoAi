import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

const bundle=bundleClientFlow(`
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {SWRProvider} from './components/swr/SWRProvider';
  import {useLibraryPageData} from './app/(core)/(workspace)/app/library/_hooks/useLibraryPageData';
  function Library(){
    const state=useLibraryPageData({userId:window.owner,activeView:window.activeView,activeKind:'image',activeSource:'all',toolsEnabled:true});
    window.probe=state;
    return <output>{state.currentAssets.map(a=>a.url).join(',')}</output>;
  }
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<SWRProvider><Library key={window.owner}/></SWRProvider>),unmount:()=>root.unmount()};
`,{
  'next/navigation':`export const usePathname=()=>'/app/library';export const useRouter=()=>({replace(){}});export const useSearchParams=()=>new URLSearchParams();`,
  '@/lib/supabaseClient':'export const supabase={auth:{getSession:()=>window.getSession()}};',
});

for (const activeView of ['saved', 'review']) for (const changedSession of [true,false]) test(`[${activeView}] ` + (changedSession
  ? 'an A-keyed library read rejects a changed session and never caches B media'
  : 'control: a read authenticated as A stays correctly isolated in A cache'),async()=>{
  const dom=createClientFlowDom('/app/library');const w=dom.window as any;
  const oldSession=deferred<any>();const entered=deferred<void>();const ownResponse=deferred<any>();
  const requests:any[]=[];let reads=0;let blockOwnRefresh=false;
  w.activeView=activeView; w.owner='A';w.sessionStorage.setItem('last-known:user-id','A');
  w.getSession=()=>{reads++;if(reads===1){entered.resolve();return oldSession.promise;}return Promise.resolve({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});};
  const response=(owner:string)=>({ok:true,json:async()=>({ok:true,[activeView==='saved'?'assets':'outputs']:[{id:owner+'-asset',url:'https://example.invalid/'+owner+'/private.png',kind:'image',source:'upload',accessUrl:'https://example.invalid/'+owner+'/private.png?signature=original',thumbnailAccessUrl:'https://example.invalid/'+owner+'/poster.webp?signature=poster'}],nextCursor:null,hasMore:false})});
  w.fetch=(url:string,init:RequestInit)=>{
    const bearer=new Headers(init.headers).get('Authorization');requests.push({url,bearer});
    return blockOwnRefresh&&bearer==='Bearer token-A'?ownResponse.promise:Promise.resolve(response(bearer==='Bearer token-A'?'A':'B'));
  };
  w.eval(await bundle);
  async function settle(predicate:()=>boolean,label:string){
    for(let n=0;n<100;n++){if(predicate())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}
    assert.fail(label);
  }
  try {
    await w.fx.act(async()=>w.fx.render());await entered.promise;
    await w.fx.act(async()=>{w.owner='B';w.sessionStorage.setItem('last-known:user-id','B');w.fx.render();});
    await settle(()=>w.document.querySelector('output').textContent.includes('/B/'),'B receives its own media');
    const lateOwner=changedSession?'B':'A';
    await w.fx.act(async()=>oldSession.resolve({data:{session:{user:{id:lateOwner},access_token:'token-'+lateOwner}},error:null}));
    assert.deepEqual(requests.map(r=>r.bearer),changedSession?['Bearer token-B']:['Bearer token-B','Bearer token-A']);
    blockOwnRefresh=true;
    await w.fx.act(async()=>{w.owner='A';w.sessionStorage.setItem('last-known:user-id','A');w.fx.render();});
    assert.equal(w.document.querySelector('output').textContent,changedSession?'':'https://example.invalid/A/private.png');
    await w.fx.act(async()=>ownResponse.resolve(response('A')));
    await settle(()=>w.document.querySelector('output').textContent==='https://example.invalid/A/private.png','A receives only its own media');
    if(activeView==='saved'){
      assert.equal(w.probe.currentAssets[0].accessUrl,'https://example.invalid/A/private.png?signature=original');
      assert.equal(w.probe.currentAssets[0].thumbnailAccessUrl,'https://example.invalid/A/poster.webp?signature=poster');
    }
  } finally {await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
