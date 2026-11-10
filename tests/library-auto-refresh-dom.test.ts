import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {SWRConfig} from 'swr';
import {useLibraryBrowse} from './hooks/useLibraryBrowse';
const cache = new Map();
function Reader(){window.read=useLibraryBrowse({userId:window.owner,scope:{view:'all',kind:'image',sort:'recent'}});return <output>{window.read.assets.map(a=>a.id).join(',')}</output>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<SWRConfig value={{provider:()=>cache,dedupingInterval:0}}><Reader/></SWRConfig>),unmount:()=>root.unmount()};
`, {'@/lib/owned-auth-fetch': 'export const ownedAuthFetch=(...args)=>window.fetch(...args);'});

test('automatic refresh retains loaded media, skips hidden/offline and paginated browsing, and retires the previous owner', async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  let now = 0, timerId = 0, nextId = 'first', pending: ((value: unknown) => void) | undefined;
  const timers = new Map<number, () => void>(), requests: string[] = [];
  w.Date.now = () => now;
  w.setInterval = (fn: () => void) => { timers.set(++timerId, fn); return timerId; };
  w.clearInterval = (id: number) => timers.delete(id);
  w.owner = 'A';
  const response = (id: string) => ({ok: true, json: async () => ({ok: true, assets: [{id, organization:{key:id}}], totalCount: 2, hasMore: true, nextCursor: 'second'})});
  w.fetch = (url: string, owner: string) => {
    requests.push(owner + ':' + url);
    return pending === undefined ? Promise.resolve(response(url.includes('cursor=') ? 'second' : nextId)) : new Promise(resolve => { pending = resolve; });
  };
  w.eval(await bundle);
  const tick = async () => { now += 30_000; await w.fx.act(async () => { for (const fn of [...timers.values()]) fn(); }); };
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(requests.length, 1);
    Object.defineProperty(w.document, 'visibilityState', {configurable:true, value:'hidden'});
    await tick(); assert.equal(requests.length, 1);
    Object.defineProperty(w.document, 'visibilityState', {configurable:true, value:'visible'});
    Object.defineProperty(w.navigator, 'onLine', {configurable:true, value:false});
    await tick(); assert.equal(requests.length, 1);
    Object.defineProperty(w.navigator, 'onLine', {configurable:true, value:true});
    pending = () => {};
    await tick(); assert.equal(requests.length, 2);
    assert.equal(w.document.querySelector('output').textContent, 'first', 'in-flight refresh keeps the current images');
    assert.equal(w.read.isLoading, false);
    await tick(); assert.equal(requests.length, 2, 'one outstanding refresh');
    await w.fx.act(async () => { pending!(response('new')); pending = undefined; });
    assert.equal(w.read.assets[0].id, 'new');
    await w.fx.act(async () => w.read.loadMore());
    assert.equal(w.read.assets.length, 2);
    const afterPagination = requests.length;
    await tick(); assert.equal(requests.length, afterPagination, 'no polling of all visited pages');
    await w.fx.act(async () => { w.owner = 'B'; nextId = 'B'; w.fx.render(); });
    assert.equal(w.read.assets[0].id, 'B');
    const previousTimer = [...timers.values()][0];
    await w.fx.act(async () => { w.owner = null; w.fx.render(); });
    const afterLogout = requests.length;
    now += 30_000; await w.fx.act(async () => previousTimer());
    assert.equal(requests.length, afterLogout, 'a retired callback cannot read the prior account');
    assert.equal(w.read.assets.length, 0);
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
});
