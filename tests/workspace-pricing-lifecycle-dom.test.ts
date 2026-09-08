import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { useWorkspacePricingGate } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate';

type Options = Parameters<typeof useWorkspacePricingGate>[0];
async function mount() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ resolve: (response: Response) => void; reject: (error: Error) => void }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined,
    fetch: (url: string) => {
      assert.equal(url, '/api/preflight');
      return new Promise<Response>((resolve, reject) => requests.push({ resolve, reject }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { useWorkspacePricingGate: useGate } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate');
  let options = {
    accessToken: 'fixture-a', authChecked: true, locale: 'en', memberTier: 'Member', setMemberTier: () => {},
    topUpCopy: {}, selectedEngine: { id: 'seedance-2-0', modeCaps: {} }, submissionMode: 't2v',
    form: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 1, audio: false, extraInputValues: {} },
    effectiveDurationSec: 5, supportsAudioToggle: false, voiceControlEnabled: false, inputAssets: {},
  } as Options;
  const { useWorkspaceWalletPreflight } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceWalletPreflight');
  let wallet!: ReturnType<typeof useWorkspaceWalletPreflight>;
  let current!: ReturnType<typeof useGate>;
  const observed: Array<typeof current> = [];
  function Fixture() {
    current = useGate(options);
    wallet = useWorkspaceWalletPreflight({ workspaceCopy: { wallet: { insufficient: 'Insufficient', insufficientWithAmount: 'Need {amount}' } }, setTopUpModal: current.setTopUpModal, showComposerError: current.showComposerError });
    observed.push(current); return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  return {
    requests, observed, get wallet() { return wallet; }, get current() { return current; }, get options() { return options; },
    async update(patch: Partial<Options>) { observed.length = 0; options = { ...options, ...patch }; await act(async () => root.render(React.createElement(Fixture))); },
    async tick() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 230)); }); },
    async respond(index: number, response = { ok: true, total: 125 }) { await act(async () => requests[index].resolve(new Response(JSON.stringify(response)))); },
    async dispose() { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
}
function masked(fixture: Awaited<ReturnType<typeof mount>>) {
  assert.ok(fixture.observed.every(value => value.preflight === null && value.price === null));
}
test('current draft masks a resolved quote synchronously before debounce and scopes iteration totals', async () => {
  const f = await mount();
  try {
    await f.tick(); await f.respond(0); assert.equal(f.current.price, 1.25);
    await f.update({ form: { ...f.options.form!, iterations: 3 } }); assert.equal(f.current.price, 3.75);
    await f.update({ effectiveDurationSec: 10 }); masked(f); assert.equal(f.current.isPricing, true);
    await f.tick(); await f.respond(f.requests.length - 1, { ok: false, total: 900 });
    assert.equal(f.current.preflight, null); assert.equal(f.current.price, null);
  } finally { await f.dispose(); }
});

test('engine, inputs and account changes mask every render and superseded responses cannot install', async () => {
  const f = await mount();
  try {
    await f.tick(); await f.respond(0);
    const engine = { ...f.options.selectedEngine!, id: 'veo-3-1' };
    await f.update({ selectedEngine: engine, form: { ...f.options.form!, engineId: engine.id } }); masked(f);
    await f.tick();
    await f.update({ inputAssets: { image_url: [{ id: 'reference', fieldId: 'image_url', kind: 'image', status: 'ready', url: 'https://example.com/original.jpg', previewUrl: 'https://example.com/preview.jpg' } as never] } }); masked(f);
    await f.tick(); await f.respond(1); assert.equal(f.current.price, null);
    await f.respond(2); assert.equal(f.current.price, 1.25);
    await f.update({ accessToken: 'fixture-b' }); masked(f); assert.equal(f.current.isPricing, true);
    await f.tick(); await f.respond(3); assert.equal(f.current.price, 1.25);
    await f.update({ accessToken: null }); masked(f); assert.equal(f.current.isPricing, false);
    await f.tick(); assert.equal(f.requests.length, 4);
    await f.update({ accessToken: 'fixture-b', authChecked: false }); masked(f);
    await f.tick(); assert.equal(f.requests.length, 4);
    await f.update({ authChecked: true }); masked(f); await f.tick(); await f.respond(4);
    await f.update({ form: null }); masked(f); assert.equal(f.current.isPricing, false);
  } finally { await f.dispose(); }
});

test('rapid A to B to A starts a new quote, failures stay empty, and caller errors survive quote completion', async () => {
  const f = await mount();
  try {
    await f.tick(); // A in flight
    await f.update({ effectiveDurationSec: 10 }); masked(f);
    await f.tick(); // B in flight
    await f.update({ effectiveDurationSec: 5 }); masked(f);
    await f.tick(); // new A in flight
    await f.respond(0); assert.equal(f.current.price, null);
    await f.respond(1); assert.equal(f.current.price, null);
    await act(async () => f.requests[2].reject(new Error('Quote unavailable')));
    assert.equal(f.current.price, null); assert.equal(f.current.preflightError, 'Quote unavailable'); assert.equal(f.current.isPricing, false);
    await f.update({ authChecked: false }); masked(f); assert.equal(f.current.preflightError, undefined);
    await f.update({ authChecked: true }); await f.tick();
    await act(async () => f.current.showComposerError('A prompt is required'));
    await f.respond(3); assert.equal(f.current.price, 1.25); assert.equal(f.current.preflightError, 'A prompt is required');
    await act(async () => f.current.setPreflightError(undefined)); assert.equal(f.current.preflightError, undefined);
    await f.update({ effectiveDurationSec: 10 }); masked(f);
    await f.update({ effectiveDurationSec: 5 }); masked(f);
    await f.tick(); await f.respond(4, { ok: false, total: 125 }); assert.equal(f.current.price, null); assert.equal(f.current.preflight, null);
  } finally { await f.dispose(); }
});

test('semantically equal objects and live iteration changes do not restart a matching quote', async () => {
  const f = await mount();
  try {
    await f.tick(); await f.respond(0);
    await f.update({ form: { ...f.options.form!, iterations: 3 }, selectedEngine: { ...f.options.selectedEngine! }, inputAssets: {} });
    assert.equal(f.current.price, 3.75); await f.tick(); assert.equal(f.requests.length, 1);
    await f.update({ selectedEngine: null }); masked(f); assert.equal(f.current.isPricing, false);
  } finally { await f.dispose(); }
});


test('existing wallet preflight blocks null, failed and invalid quotes before any wallet request', async () => {
  const f = await mount();
  try {
    for (const preflight of [null, { ok: false, total: 125 }, { ok: true }, { ok: true, total: NaN }, { ok: true, total: -1 }]) {
      let accepted: boolean | undefined;
      await act(async () => { accepted = await f.wallet.verifyWalletBalance({ preflight, iterationCount: 1, currencyCode: 'USD' }); });
      assert.equal(accepted, false);
    }
    await f.tick(); await f.respond(0);
    await f.update({ effectiveDurationSec: 10 });
    let accepted: boolean | undefined;
    await act(async () => { accepted = await f.wallet.verifyWalletBalance({ preflight: f.current.preflight, iterationCount: 1, currencyCode: 'USD' }); });
    assert.equal(accepted, false, 'the current recalculation window cannot pass the existing submit preflight');
    await act(async () => { accepted = await f.wallet.verifyWalletBalance({ preflight: { ok: true, total: 0 }, iterationCount: 1, currencyCode: 'USD' }); });
    assert.equal(accepted, true, 'a valid free quote needs no wallet request');
  } finally { await f.dispose(); }
});

test('a previous account response stays masked through logout and reauthentication', async () => {
  const f = await mount();
  try {
    await f.tick();
    await f.update({ accessToken: null }); masked(f);
    await f.respond(0); masked(f);
    await f.update({ accessToken: 'fixture-b' }); await f.tick();
    await f.update({ accessToken: 'fixture-c' }); masked(f);
    await f.tick(); await f.respond(1); assert.equal(f.current.preflight, null); assert.equal(f.current.price, null);
    await f.respond(2); assert.equal(f.current.price, 1.25);
  } finally { await f.dispose(); }
});

test('explicit quote retry creates a fresh observation for identical wire input and ignores superseded completion', async () => {
  const dom = new JSDOM('<div id="retry-root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{body: string; resolve: (response: Response) => void; reject: (error: Error) => void}> = [];
  for (const [key, value] of Object.entries({ window:dom.window, document:dom.window.document,navigator:dom.window.navigator, IS_REACT_ACT_ENVIRONMENT:true, fetch:(_url:string, init:RequestInit) => new Promise<Response>((resolve,reject)=>requests.push({body:String(init.body),resolve,reject})) })) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const {useWorkspacePreflightQuote}=await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreflightQuote');
  let quote!: ReturnType<typeof useWorkspacePreflightQuote>;
  const request={engine:'seedance-2-0',mode:'t2v',durationSec:5,fps:24,inputs:{},user:{memberTier:'Member'}} as Parameters<typeof useWorkspacePreflightQuote>[0]['request'];
  function Fixture(){quote=useWorkspacePreflightQuote({request,iterations:1,accessToken:'retry-token',authChecked:true});return null;}
  const root=createRoot(dom.window.document.getElementById('retry-root')!);
  const tick=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,230));});
  try {
    await act(async()=>root.render(React.createElement(Fixture)));await tick();
    await act(async()=>requests[0].reject(new Error('Offline')));assert.equal(quote.preflightError,'Offline');
    await act(async()=>quote.retry());assert.equal(quote.price,null);assert.equal(quote.preflightError,undefined);await tick();
    const oldRetry=quote.retry;await act(async()=>quote.retry());await tick();
    await act(async()=>requests[1].resolve(new Response(JSON.stringify({ok:true,total:999}))));assert.equal(quote.price,null);
    await act(async()=>requests[2].resolve(new Response(JSON.stringify({ok:true,total:125}))));assert.equal(quote.price,1.25);
    await act(async()=>oldRetry());assert.equal(quote.price,1.25);await tick();assert.equal(requests.length,3);
    assert.ok(requests.every(entry=>entry.body===requests[0].body));assert.doesNotMatch(requests[0].body,/nonce|retry/);
  } finally {await act(async()=>root.unmount());dom.window.close();for (const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
