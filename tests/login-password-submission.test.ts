import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

  const boundaries = {
    'next/navigation': 'export const useRouter=()=>({replace(){},push(){},back(){}});',
    '@/lib/analytics-client': 'export const dispatchAnalyticsEvent=()=>{};export const persistPendingAnalyticsEvent=()=>{};',
    '@/lib/analytics/commercial-client': 'export const resolveBrowserCommercialAnalyticsAuthContext=async()=>{};',
    '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=()=>window.loadClient();',
    './useLoginNextTarget': "export const useLoginNextTarget=()=>({authRedirectOrigin:'https://example.invalid',nextPath:'/app',nextPathReady:true,persistNextTarget(){},safeNextPath:'/app'});",
    './useLoginAuthenticatedRedirect': 'export const useLoginAuthenticatedRedirect=()=>({redirectFromExistingBrowserSession(){}});',
    './useLoginAuthHashSession': 'export const useLoginAuthHashSession=()=>{};',
    './useLoginOAuthCodeExchange': 'export const useLoginOAuthCodeExchange=()=>{};',
  };

const bundle = bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLoginPageController}from'./app/(core)/login/_hooks/useLoginPageController';import{LoginAuthSurface}from'./app/(core)/login/_components/LoginAuthSurface';window.IS_REACT_ACT_ENVIRONMENT=true;function Page(){const state=useLoginPageController({initialMode:window.mode,initialLocale:'en',initialMcpConnection:false});window.controller=state;return <LoginAuthSurface {...state} isMcpStaging={false}/>;}const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<Page/>),unmount:()=>root.unmount()};`, boundaries);

async function mount(mode = 'signup') {
  const dom = createClientFlowDom('/login'); const w = dom.window;
  const requests: Array<ReturnType<typeof deferred<unknown>>> = [];
  const authRequest = () => { const r=deferred<unknown>(); requests.push(r); return r.promise; };
  const client = { auth: { signUp: authRequest, signInWithPassword: authRequest } };
  let consents = 0;
  w.mode = mode; w.loadClient = async () => client;
  w.fetch = async (url: string) => { assert.equal(url, '/api/legal/consents'); consents++; return {ok:true,json:async()=>({ok:true})}; };
  w.eval(await bundle); await w.fx.act(async () => w.fx.render());
  const change = async (selector: string, value: string) => w.fx.act(async () => {
    const input = w.document.querySelector(selector)!;
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new w.Event('input',{bubbles:true}));
  });
  await change('input[type=email]','synthetic@example.invalid'); await change('#auth-password','SyntheticPassword123!');
  if(mode==='signup') {
    await change('#auth-confirm','SyntheticPassword123!');
    await w.fx.act(async () => { const boxes=w.document.querySelectorAll<HTMLInputElement>('input[type=checkbox]'); boxes[0].click(); boxes[1].click(); });
  }
  return { w, requests, client, get consents(){return consents;},
    get submit(){return w.document.querySelector<HTMLButtonElement>('button[type=submit]')!;},
    async submitTwice() { await w.fx.act(async () => { const form=w.document.querySelector('form')!; form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); }); },
    async dispose(){await w.fx.act(async()=>w.fx.unmount());w.close();}
  };
}
const success = {data:{user:{id:'synthetic-account',identities:[{provider:'email'}]},session:null},error:null};
for(const mode of ['signin','signup']) test(`${mode} allows one synchronous submit and disables the pending action`,async()=>{
 const f=await mount(mode);
 try { await f.submitTwice(); assert.equal(f.requests.length,1); assert.equal(f.submit.disabled,true); assert.equal(f.submit.getAttribute('aria-busy'),'true');
   await f.w.fx.act(async()=>f.requests[0].resolve({data:{user:null,session:null},error:{message:'Provider unavailable',status:503}}));
   assert.equal(f.submit.disabled,false); assert.match([...f.w.document.querySelectorAll('[role=alert]')].map(node=>node.textContent).join(' '),/Provider unavailable/);
   await f.submitTwice(); assert.equal(f.requests.length,2);
 }finally{await f.dispose();}
});
test('signup confirmation stays visible after a duplicate submission attempt',async()=>{
 const f=await mount();
 try {await f.submitTwice(); await f.w.fx.act(async()=>f.requests[0].resolve(success));
   assert.equal(f.requests.length,1); assert.equal(f.consents,1);
   assert.match(f.w.document.querySelector('[role=status]')?.textContent??'',/check your inbox/);
   assert.equal(f.w.controller.error,null); assert.equal(f.submit.disabled,false);
 }finally{await f.dispose();}
});
for (const nextMode of ['signup', 'signin', 'reset']) test(`pending signup keeps its mode and consent workflow when ${nextMode} is requested`, async () => {
  const f = await mount();
  try {
    await f.submitTwice();
    assert.ok([...f.w.document.querySelectorAll<HTMLButtonElement>('[role=group] button[aria-pressed]')].every(button => button.disabled));
    await f.w.fx.act(async () => f.w.controller.onModeChange(nextMode));
    assert.equal(f.w.controller.mode, 'signup');
    await f.submitTwice();
    assert.equal(f.requests.length, 1);
    await f.w.fx.act(async () => f.requests[0].resolve(success));
    assert.equal(f.consents, 1);
    assert.match(f.w.controller.status, /check your inbox/);
    assert.equal(f.submit.disabled, false);
    await f.w.fx.act(async () => f.w.controller.onModeChange('signin'));
    assert.equal(f.w.controller.mode, 'signin');
    assert.equal(f.w.controller.status, null);
  } finally { await f.dispose(); }
});

test('a dispatched signup still persists captured consent after leaving the form', async () => {
  const f = await mount();
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.w.fx.unmount());
    await f.w.fx.act(async () => f.requests[0].resolve(success));
    assert.equal(f.consents, 1);
  } finally { await f.dispose(); }
});
test('unmount before client readiness prevents signup dispatch',async()=>{
 const f=await mount(); const loader=deferred<unknown>(); f.w.loadClient=()=>loader.promise;
 try {await f.submitTwice(); await f.w.fx.act(async()=>f.w.fx.unmount()); await f.w.fx.act(async()=>loader.resolve(f.client)); assert.equal(f.requests.length,0);}
 finally{await f.dispose();}
});
for(const boundary of ['loader','provider']) test(`${boundary} rejection gives recoverable feedback and releases the submission`,async()=>{
 const f=await mount();
 try {
   if(boundary==='loader') f.w.loadClient=async()=>{throw new Error('network failure')};
   await f.submitTwice();
   if(boundary==='provider') await f.w.fx.act(async()=>f.requests[0].reject(new Error('network failure')));
   assert.equal(f.submit.disabled,false); assert.ok(f.w.controller.error); assert.equal(f.w.controller.status,null);
   f.w.loadClient=async()=>f.client; await f.submitTwice(); assert.equal(f.requests.length,boundary==='loader'?1:2);
 }finally{await f.dispose();}
});
