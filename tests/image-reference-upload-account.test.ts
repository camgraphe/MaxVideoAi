import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

const bundle = bundleClientFlow(`
  import React,{act,useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import {useImageReferenceSlots} from './app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlots';
  import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
  function Harness(){
    const [error,setError]=useState(null);
    const state=useImageReferenceSlots({accountId:window.owner,autoModeFromReferences:false,mode:'i2i',resolvedCopy:DEFAULT_COPY,
      setError,supportedReferenceFormats:['png','jpeg','webp'],supportedReferenceFormatsLabel:'PNG, JPEG, WEBP',toolsEnabled:true});
    window.probe=state;
    return <><output data-reference>{state.readyReferenceUrls.join(',')}</output>{error?<p role="alert">{error}</p>:null}</>;
  }
  const root=createRoot(document.getElementById('root'));
  window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<Harness key={window.owner}/>),unmount:()=>root.unmount()};
`, { '@/lib/supabaseClient': 'export const supabase={auth:{getSession:()=>window.getSession()}};' });

async function mount() {
  const dom=createClientFlowDom('/app/image');
  const w=dom.window as any;
  const requests:any[]=[];
  const logs:any[]=[];
  w.console.error=(...args:any[])=>logs.push(args.map(String));
  w.owner='account-A';
  w.sessionStorage.setItem('last-known:user-id',w.owner);
  w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});
  w.createImageBitmap=async()=>({width:10,height:10,close(){}});
  w.URL.createObjectURL=(file:File)=>'blob:'+file.name;
  w.URL.revokeObjectURL=()=>{};
  w.fetch=(url:string,init:RequestInit)=>{
    const response=deferred<any>();
    requests.push({url,init,...response});
    return response.promise;
  };
  w.eval(await bundle);
  await w.fx.act(async()=>w.fx.render());
  return { w,requests,logs,
    async upload(name='private-A.png', index=0) {
      let pending!:Promise<void>;
      await w.fx.act(async()=>{pending=w.probe.handleReferenceFile(index,new w.File(['synthetic'],name,{type:'image/png'}));});
      return {pending};
    },
    async library() { await w.fx.act(async()=>w.probe.handleLibrarySelect({id:'B',url:'https://example.invalid/B.png',mime:'image/png'},0)); },
    async dispose() { await w.fx.act(async()=>w.fx.unmount());dom.window.close(); },
  };
}

test('a failed older image upload preserves the newer library selection',async()=>{
  const f=await mount();
  try {
    const {pending}=await f.upload();
    assert.equal(f.requests.length,1);
    await f.library();
    assert.equal(f.w.document.querySelector('output').textContent,'https://example.invalid/B.png');
    await f.w.fx.act(async()=>{f.requests[0].reject(new Error('synthetic network failure'));await pending;});
    assert.equal(f.w.document.querySelector('output').textContent,'https://example.invalid/B.png');
    assert.equal(f.w.probe.persistableReferenceSlots.filter(Boolean).length,1,'the replacement stays in the persisted draft');
    assert.equal(f.w.document.querySelector('[role=alert]'),null,'a retired error stays silent');
  } finally {await f.dispose();}
});

test('control: successful older image upload does not overwrite a later library choice',async()=>{
  const f=await mount();
  try {
    const {pending}=await f.upload();await f.library();
    await f.w.fx.act(async()=>{f.requests[0].resolve({ok:true,json:async()=>({ok:true,asset:{id:'A',url:'https://example.invalid/A.png'}})});await pending;});
    assert.equal(f.w.document.querySelector('output').textContent,'https://example.invalid/B.png');
    assert.equal(f.w.document.querySelector('[role=alert]'),null);
  } finally {await f.dispose();}
});

test('account remount cancels a reference waiting on its session',async()=>{
  const f=await mount();const session=deferred<any>();const entered=deferred<void>();
  f.w.getSession=()=>{entered.resolve();return session.promise;};
  try {
    const {pending}=await f.upload();await entered.promise;
    await f.w.fx.act(async()=>{f.w.owner='account-B';f.w.sessionStorage.setItem('last-known:user-id','account-B');f.w.fx.render();});
    await f.w.fx.act(async()=>session.resolve({data:{session:{user:{id:'account-B'},access_token:'token-B'}},error:null}));
    assert.equal(f.requests.length,0,'retired reference cannot dispatch under the new account');
    await pending;
    assert.equal(f.w.document.querySelector('output').textContent,'');
  } finally {await f.dispose();}
});

test('control: uninterrupted image upload uses A and updates the reference',async()=>{
  const f=await mount();
  try {
    const {pending}=await f.upload();
    assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'),'Bearer token-account-A');
    assert.equal(f.requests[0].init.credentials,'omit');
    assert.ok(f.requests[0].init.signal);
    await f.w.fx.act(async()=>{f.requests[0].resolve({ok:true,json:async()=>({ok:true,asset:{id:'A',url:'https://example.invalid/A.png'}})});await pending;});
    assert.equal(f.w.document.querySelector('output').textContent,'https://example.invalid/A.png');
  } finally {await f.dispose();}
});

test('account remount cancels a reference waiting on image preparation',async()=>{
  const f=await mount();const decode=deferred<any>();
  f.w.createImageBitmap=()=>decode.promise;
  try {
    const {pending}=await f.upload();assert.equal(f.requests.length,0);
    await f.w.fx.act(async()=>{f.w.owner='account-B';f.w.sessionStorage.setItem('last-known:user-id','account-B');f.w.fx.render();});
    await f.w.fx.act(async()=>decode.resolve({width:10,height:10,close(){}}));
    assert.equal(f.requests.length,0,'retired preparation cannot dispatch');
    await pending;
  } finally {await f.dispose();}
});

for (const session of [null, {user:{id:'account-B'},access_token:'token-B'}]) {
  test(`image reference refuses ${session ? 'a different session before the UI switches' : 'a missing session'}`, async () => {
    const f = await mount();
    try {
      f.w.getSession = async () => ({data:{session},error:null});
      const {pending} = await f.upload();
      await f.w.fx.act(async () => pending);
      assert.equal(f.requests.length, 0);
      assert.ok(f.w.document.querySelector('[role=alert]'));
      assert.equal(f.w.probe.displayedReferenceSlots.filter(Boolean).length, 0);
    } finally { await f.dispose(); }
  });
}

test('switching A to B and back cannot revive an upload waiting on A session', async () => {
  const f = await mount(); const session = deferred<any>(); const entered = deferred<void>();
  f.w.getSession = () => { entered.resolve(); return session.promise; };
  try {
    const {pending} = await f.upload(); await entered.promise;
    for (const owner of ['account-B', 'account-A']) {
      await f.w.fx.act(async () => { f.w.owner = owner; f.w.fx.render(); });
    }
    await f.w.fx.act(async () => {
      session.resolve({data:{session:{user:{id:'account-A'},access_token:'token-A'}},error:null});
      await pending;
    });
    assert.equal(f.requests.length, 0);
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
  } finally { await f.dispose(); }
});

test('account remount aborts dispatched image uploads and ignores their late result', async () => {
  const f = await mount();
  try {
    const {pending} = await f.upload();
    await f.w.fx.act(async () => { f.w.owner = 'account-B'; f.w.fx.render(); });
    assert.equal(f.requests[0].init.signal.aborted, true);
    await f.library();
    await f.w.fx.act(async () => {
      f.requests[0].resolve({ok:true,json:async()=>({ok:true,asset:{url:'https://example.invalid/A.png'}})});
      await pending;
    });
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/B.png');
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
  } finally { await f.dispose(); }
});

for (const replacement of ['url', 'remove', 'hydrate', 'character'] as const) {
  test(`replacing an uploading reference via ${replacement} aborts only that operation`, async () => {
    const f = await mount();
    try {
      const {pending} = await f.upload();
      await f.w.fx.act(async () => {
        if (replacement === 'url') f.w.probe.handleReferenceUrl(0, 'https://example.invalid/new.png', 'paste');
        if (replacement === 'remove') f.w.probe.handleRemoveReferenceSlot(0);
        if (replacement === 'hydrate') f.w.probe.setReferenceSlots([{id:'restored',url:'https://example.invalid/restored.png',status:'ready',source:'library'}]);
        if (replacement === 'character') {
          f.w.probe.openLibraryForSlot(0);
        }
      });
      if (replacement === 'character') await f.w.fx.act(async () => f.w.probe.toggleCharacterReference({id:'character',imageUrl:'https://example.invalid/character.png',jobId:'job'}));
      const before = f.w.document.querySelector('output').textContent;
      assert.equal(f.requests[0].init.signal.aborted, true);
      await f.w.fx.act(async () => { f.requests[0].reject(new Error('old error')); await pending; });
      assert.equal(f.w.document.querySelector('output').textContent, before);
      assert.equal(f.w.document.querySelector('[role=alert]'), null);
    } finally { await f.dispose(); }
  });
}

test('replacing a reference before image decoding finishes prevents dispatch', async () => {
  const f = await mount(); const decode = deferred<any>();
  f.w.createImageBitmap = () => decode.promise;
  try {
    const {pending} = await f.upload(); await f.library();
    await f.w.fx.act(async () => { decode.resolve({width:10,height:10,close(){}}); await pending; });
    assert.equal(f.requests.length, 0);
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/B.png');
  } finally { await f.dispose(); }
});

test('replacement during response parsing keeps the new reference and retires the upload', async () => {
  const f = await mount(); const body = deferred<any>(); const entered = deferred<void>();
  try {
    const {pending} = await f.upload();
    await f.w.fx.act(async () => f.requests[0].resolve({ok:true,json:()=>{entered.resolve(); return body.promise;}}));
    await entered.promise;
    await f.library();
    await f.w.fx.act(async () => {body.resolve({ok:true,asset:{url:'https://example.invalid/old.png'}}); await pending;});
    assert.equal(f.requests[0].init.signal.aborted, true);
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/B.png');
  } finally { await f.dispose(); }
});

test('an old failure in the same React batch cannot erase a new selection', async () => {
  const f = await mount();
  try {
    const {pending} = await f.upload();
    await f.w.fx.act(async () => {
      f.w.probe.handleLibrarySelect({id:'B',url:'https://example.invalid/B.png',mime:'image/png'},0);
      f.requests[0].reject(new Error('old error'));
      await pending;
    });
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/B.png');
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
  } finally { await f.dispose(); }
});

test('two reference uploads remain independent when one fails', async () => {
  const f = await mount();
  try {
    const first = await f.upload('first.png', 0);
    const second = await f.upload('second.png', 1);
    await f.w.fx.act(async () => { f.requests[0].reject(new Error('current failure')); await first.pending; });
    assert.ok(f.w.document.querySelector('[role=alert]'), 'a current failure remains visible');
    assert.equal(f.requests[1].init.signal.aborted, false);
    await f.w.fx.act(async () => {
      f.requests[1].resolve({ok:true,json:async()=>({ok:true,asset:{url:'https://example.invalid/second.png'}})});
      await second.pending;
    });
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/second.png');
  } finally { await f.dispose(); }
});

test('re-uploading a slot cannot be cleared by the previous file failure', async () => {
  const f = await mount();
  try {
    const first = await f.upload('first.png');
    const second = await f.upload('second.png');
    assert.equal(f.requests[0].init.signal.aborted, true);
    await f.w.fx.act(async () => {f.requests[0].reject(new Error('first failure')); await first.pending;});
    assert.equal(f.w.probe.displayedReferenceSlots[0].name, 'second.png');
    assert.equal(f.w.probe.displayedReferenceSlots[0].status, 'uploading');
    assert.equal(f.requests[1].init.signal.aborted, false);
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
    await f.w.fx.act(async () => {f.requests[1].resolve({ok:true,json:async()=>({ok:true,asset:{url:'https://example.invalid/second.png'}})}); await second.pending;});
    assert.equal(f.w.document.querySelector('output').textContent, 'https://example.invalid/second.png');
  } finally { await f.dispose(); }
});
