import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

  const boundaries = {
    '@/components/HeaderBar': 'export const HeaderBar=()=>null;',
    '@/components/AppSidebar': 'export const AppSidebar=()=>null;',
    '@/components/library/MediaDestinationActions.client': 'export const MediaDestinationActions=()=>null;',
    '@/components/library/AssetLibraryBrowser': 'export const AssetLibraryBrowser=p=><section>{p.headerActions}</section>;',
    '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:window.actor,loading:false});',
    '@/lib/i18n/I18nProvider': "export const useI18n=()=>({locale:'en',t:(_key,fallback)=>fallback});",
    'next/navigation': "export const useSearchParams=()=>new URLSearchParams('kind='+window.kind);export const useRouter=()=>({replace(){}});export const usePathname=()=>'/app/library';",
    'next/link': 'export default ({children,...props})=><a>{children}</a>;',
    'next/image': 'export default ({priority,unoptimized,fill,...props})=><img {...props}/>;',
    '../_hooks/useLibraryPageData': "export const useLibraryPageData=()=>({currentAssets:[],mutateAssets:async()=>{window.refreshes++},mutateRecentOutputs:async()=>{},searchQuery:'',setSearchQuery(){},hasMore:false,loadMore(){},clearJobFilter(){}});",
    '@/lib/supabaseClient': 'export const supabase={auth:{getSession:()=>window.getSession()}};',
  };

const bundle = bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{LibraryPageClient}from'./app/(core)/(workspace)/app/library/_components/LibraryPageClient';window.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<LibraryPageClient/>),unmount:()=>root.unmount()};`, boundaries);

async function mount(kind = 'image') {
  const dom = createClientFlowDom('/app/library');
  const w = dom.window;
  const decode = deferred<unknown>();
  const requests: Array<{ url: string; init: RequestInit; body: FormData } & ReturnType<typeof deferred<unknown>>> = [];
  w.actor = { id: 'account-A' }; w.kind = kind; w.refreshes = 0;
  w.sessionStorage.setItem('last-known:user-id', 'account-A');
  w.getSession = async () => ({ data: { session: w.actor ? { user: w.actor, access_token: 'token-'+w.actor.id } : null }, error: null });
  w.createImageBitmap = () => decode.promise;
  w.fetch = (url: string, init: RequestInit) => {
    assert.equal(url, '/api/uploads/'+kind);
    const request = { url, init, body: init.body as FormData, ...deferred<unknown>() }; requests.push(request); return request.promise;
  };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  return { w, requests,
    async select(name = 'private-A.png') {
      await w.fx.act(async () => {
        const input = w.document.querySelector('input[type=file]')!;
        Object.defineProperty(input, 'files', { configurable: true, value: [new w.File(['synthetic'], name, { type: kind+'/png' })] });
        input.dispatchEvent(new w.Event('change', { bubbles: true }));
      });
    },
    async decode() { await w.fx.act(async () => decode.resolve({ width: 10, height: 10, close() {} })); },
    async switchTo(id: string | null) {
      w.actor = id ? { id } : null;
      if(id) w.sessionStorage.setItem('last-known:user-id', id); else w.sessionStorage.removeItem('last-known:user-id');
      await w.fx.act(async () => w.fx.render());
    },
    async dispose() { await w.fx.act(async () => w.fx.unmount()); w.close(); },
  };
}

for (const next of ['account-B', null]) test(`pending image decoding cannot upload after switching to ${next}`, async () => {
  const f = await mount();
  try { await f.select(); await f.switchTo(next); await f.decode(); assert.equal(f.requests.length, 0); }
  finally { await f.dispose(); }
});

test('leaving the library cancels pending decoding', async () => {
  const f = await mount();
  try { await f.select(); await f.w.fx.act(async () => f.w.fx.unmount()); await f.decode(); assert.equal(f.requests.length, 0); }
  finally { await f.dispose(); }
});

for (const kind of ['image','video','audio']) test(`${kind} import refuses a changed session before account UI catches up`, async () => {
  const f = await mount(kind);
  const session = deferred<unknown>();
  f.w.getSession = () => session.promise;
  try {
    await f.select(); await f.decode();
    await f.w.fx.act(async () => session.resolve({ data: { session: { user: {id:'account-B'}, access_token:'token-B' } }, error:null }));
    assert.equal(f.requests.length, 0);
  } finally { await f.dispose(); }
});

test('in-flight upload aborts on account change and ignores a late completion', async () => {
  const f = await mount();
  try {
    await f.select(); await f.decode(); assert.equal(f.requests.length, 1);
    assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'), 'Bearer token-account-A');
    assert.equal(f.requests[0].body.get('file')?.name, 'private-A.png');
    await f.switchTo('account-B');
    assert.equal(f.requests[0].init.signal?.aborted, true);
    await f.w.fx.act(async () => f.requests[0].resolve({ok:true,json:async()=>({ok:true,asset:{url:'https://example.invalid/synthetic.png'}})}));
    assert.equal(f.w.refreshes, 0);
  } finally { await f.dispose(); }
});

test('current upload succeeds and refreshes saved media', async () => {
  const f = await mount();
  try {
    await f.select(); await f.decode();
    assert.equal(f.requests.length, 1);
    await f.w.fx.act(async () => f.requests[0].resolve({ok:true,json:async()=>({ok:true,asset:{url:'https://example.invalid/synthetic.png'}})}));
    assert.equal(f.w.refreshes, 1);
  } finally { await f.dispose(); }
});

for (const transition of ['switch', 'unmount']) test(`session lookup finishing after ${transition} cannot dispatch an upload`, async () => {
  const f = await mount('video');
  const session = deferred<unknown>();
  f.w.getSession = () => session.promise;
  try {
    await f.select();
    if (transition === 'switch') await f.switchTo('account-B');
    else await f.w.fx.act(async () => f.w.fx.unmount());
    await f.w.fx.act(async () => session.resolve({ data: { session: { user: { id: 'account-A' }, access_token: 'token-A' } }, error: null }));
    assert.equal(f.requests.length, 0);
  } finally { await f.dispose(); }
});

test('a replacement upload aborts its predecessor and only the current result refreshes media', async () => {
  const f = await mount('video');
  try {
    await f.select('first.mp4');
    await f.select('second.mp4');
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[0].init.signal?.aborted, true);
    await f.w.fx.act(async () => f.requests[0].resolve({ ok: true, json: async () => ({ ok: true, asset: { url: 'https://example.invalid/first.mp4' } }) }));
    assert.equal(f.w.refreshes, 0);
    await f.w.fx.act(async () => f.requests[1].resolve({ ok: true, json: async () => ({ ok: true, asset: { url: 'https://example.invalid/second.mp4' } }) }));
    assert.equal(f.w.refreshes, 1);
  } finally { await f.dispose(); }
});
