import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

  const boundaries = {
    'next/navigation': 'export const useRouter=()=>({replace(){},push(){},back(){}});',
    '@/lib/analytics-client': 'export const dispatchAnalyticsEvent=()=>{};export const persistPendingAnalyticsEvent=()=>{};',
    '@/lib/analytics/commercial-client': 'export const resolveBrowserCommercialAnalyticsAuthContext=async()=>{};',
    '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=()=>window.loadClient();',
    './useLoginNextTarget': "export const useLoginNextTarget=()=>({authRedirectOrigin:'https://example.invalid',nextPath:'/app',nextPathReady:window.authNextReady!==false,persistNextTarget(){},safeNextPath:'/app'});",
    './useLoginAuthenticatedRedirect': 'export const useLoginAuthenticatedRedirect=()=>({redirectFromExistingBrowserSession(){}});',
    './useLoginAuthHashSession': 'export const useLoginAuthHashSession=()=>{};',
    './useLoginOAuthCodeExchange': 'export const useLoginOAuthCodeExchange=()=>{};',
  };

const bundle = bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLoginPageController}from'./app/(core)/login/_hooks/useLoginPageController';import{LoginAuthSurface}from'./app/(core)/login/_components/LoginAuthSurface';window.IS_REACT_ACT_ENVIRONMENT=true;function Page(){const state=useLoginPageController({initialMode:window.mode,initialLocale:window.locale,initialMcpConnection:false});window.controller=state;return <LoginAuthSurface {...state} isMcpStaging={false}/>;}const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<Page/>),unmount:()=>root.unmount()};`, boundaries);

async function mount(mode = 'signup', locale = 'en', authNextReady = true) {
  const dom = createClientFlowDom('/login'); const w = dom.window;
  const requests: Array<ReturnType<typeof deferred<unknown>>> = [];
  const authRequest = () => { const r=deferred<unknown>(); requests.push(r); return r.promise; };
  const resendRequests: Array<ReturnType<typeof deferred<unknown>>> = [];
  const resendInputs: unknown[] = [];
  const client = { auth: { signUp: authRequest, signInWithPassword: authRequest, resend: (input: unknown) => { resendInputs.push(input); const r=deferred<unknown>(); resendRequests.push(r); return r.promise; } } };
  let consents = 0;
  w.mode = mode; w.locale = locale; w.authNextReady = authNextReady; w.loadClient = async () => client;
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
  return { w, requests, resendRequests, resendInputs, client, change, get consents(){return consents;},
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

test('unconfirmed email offers one explicit resend without suggesting account creation', async () => {
  const f = await mount('signin');
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } }));
    assert.match(f.w.controller.error ?? '', /confirm your email/i);
    assert.equal(f.w.controller.signupSuggestion, null);
    const resend = f.w.document.querySelector<HTMLButtonElement>('[data-testid="resend-confirmation"]')!;
    assert.ok(resend);
    const explanation = [...f.w.document.querySelectorAll('[role="alert"]')].find(node => node.textContent?.includes('Confirm your email'))!;
    assert.ok(explanation.compareDocumentPosition(resend) & f.w.Node.DOCUMENT_POSITION_FOLLOWING, 'explain confirmation before offering resend');
    await f.w.fx.act(async () => { resend.click(); resend.click(); });
    assert.equal(f.resendRequests.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.resendInputs[0])), { type: 'signup', email: 'synthetic@example.invalid', options: { emailRedirectTo: 'https://example.invalid/auth/callback?next=%2Fapp&lang=en&flow=signup' } });
    assert.equal(resend.disabled, true);
    await f.w.fx.act(async () => f.resendRequests[0].resolve({ error: null }));
    assert.match(f.w.controller.status ?? '', /check your inbox/i);
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
  } finally { await f.dispose(); }
});

test('unconfirmed guidance belongs only to the email that received the auth error', async () => {
  const f = await mount('signin');
  try {
    assert.equal(f.w.controller.unconfirmedEmail, null);
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } }));
    assert.match(f.w.controller.error ?? '', /Confirm your email/);
    assert.ok(f.w.document.querySelector('[data-testid="resend-confirmation"]'));
    await f.change('#auth-email', 'other@example.invalid');
    assert.equal(f.w.controller.email, 'other@example.invalid');
    assert.equal(f.w.controller.unconfirmedEmail, null);
    assert.equal(f.w.controller.error, null);
    assert.doesNotMatch([...f.w.document.querySelectorAll('[role="alert"]')].map(node => node.textContent).join(' '), /Confirm your email/);
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
    await f.change('#auth-email', 'synthetic@example.invalid');
    assert.equal(f.w.controller.error, null);
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
    assert.equal(f.resendRequests.length, 0);
  } finally { await f.dispose(); }
});

test('editing the email does not erase an unrelated provider error', async () => {
  const f = await mount('signin');
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'provider_unavailable', status: 503, message: 'Provider unavailable' } }));
    await f.change('#auth-email', 'other@example.invalid');
    assert.equal(f.w.controller.error, 'Provider unavailable');
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
  } finally { await f.dispose(); }
});

test('autofill synchronization clears confirmation guidance when its address changes', async () => {
  const f = await mount('signin');
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } }));
    await f.w.fx.act(async () => {
      const input = f.w.document.querySelector('#auth-email')!;
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'autofilled@example.invalid');
      f.w.controller.onSyncInputState();
    });
    assert.equal(f.w.controller.email, 'autofilled@example.invalid');
    assert.equal(f.w.controller.error, null);
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
    assert.equal(f.resendRequests.length, 0);
  } finally { await f.dispose(); }
});

test('password submission waits for the client continuation and has no native GET fallback', async () => {
  const f = await mount('signin', 'en', false);
  try {
    assert.equal(f.submit.disabled, true);
    assert.equal(f.w.document.querySelector('form')!.getAttribute('method'), 'post');
    await f.w.fx.act(async () => { f.w.authNextReady = true; f.w.fx.render(); });
    assert.equal(f.submit.disabled, false);
    await f.submitTwice();
    assert.equal(f.requests.length, 1);
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { message: 'Synthetic failure', status: 503 } }));
  } finally { await f.dispose(); }
});

for (const [locale, expected] of [
  ['fr', /adresse e-mail n’est pas encore confirmée/],
  ['es', /correo aún no está confirmado/],
] as const) test(`unconfirmed email guidance is specific in ${locale}`, async () => {
  const f = await mount('signin', locale);
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', status: 400, message: 'Provider message' } }));
    assert.match(f.w.controller.error ?? '', expected);
    assert.equal(f.w.controller.signupSuggestion, null);
    assert.ok(f.w.document.querySelector('[data-testid="resend-confirmation"]'));
  } finally { await f.dispose(); }
});

test('resend rate limit keeps the action recoverable and does not claim delivery', async () => {
  const f = await mount('signin');
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' } }));
    await f.w.fx.act(async () => f.w.document.querySelector<HTMLButtonElement>('[data-testid="resend-confirmation"]')!.click());
    await f.w.fx.act(async () => f.resendRequests[0].resolve({ error: { code: 'over_email_send_rate_limit', status: 429 } }));
    assert.match(f.w.controller.error ?? '', /wait a few minutes/i);
    assert.equal(f.w.controller.status, null);
    assert.equal(f.w.document.querySelector<HTMLButtonElement>('[data-testid="resend-confirmation"]')!.disabled, false);
  } finally { await f.dispose(); }
});

test('a generic HTTP 400 remains separate from the unconfirmed-email recovery action', async () => {
  const f = await mount('signin');
  try {
    await f.submitTwice();
    await f.w.fx.act(async () => f.requests[0].resolve({ data: { user: null, session: null }, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } }));
    assert.equal(f.w.document.querySelector('[data-testid="resend-confirmation"]'), null);
    assert.ok(f.w.controller.signupSuggestion);
  } finally { await f.dispose(); }
});
test('signup confirmation stays visible after a duplicate submission attempt',async()=>{
 const f=await mount();
 try {await f.submitTwice(); await f.w.fx.act(async()=>f.requests[0].resolve(success));
   assert.equal(f.requests.length,1); assert.equal(f.consents,1);
   assert.match(f.w.document.querySelector('[role=status]')?.textContent??'',/click “Confirm my email”/);
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
    assert.match(f.w.controller.status, /click “Confirm my email”/);
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
