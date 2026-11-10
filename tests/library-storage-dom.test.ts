import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRConfig}from'swr';
import{LibraryStorageUsage}from'./components/library/LibraryStorageUsage.client';
import{invalidateLibraryMedia}from'./hooks/useLibraryCacheRevision';
const cache=new Map(),root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<SWRConfig value={{provider:()=>cache,dedupingInterval:0}}><LibraryStorageUsage userId={window.owner} locale="en"/></SWRConfig>),invalidate:owner=>invalidateLibraryMedia(owner),unmount:()=>root.unmount()};
`, {
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{user:{id:window.owner},access_token:"token-"+window.owner}}})}});',
});

test('storage polls only pending cleanup, stops after completion and retires old account timers', async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  w.owner = 'A';
  const reads: string[] = [];
  let pending = 0, shared = 0, measuredBytes = 2_000_000_000, id = 100_000;
  const timers = new Map<number, () => void>();
  const intervals = new Set<number>();
  const originalSetTimeout = w.setTimeout.bind(w), originalClearTimeout = w.clearTimeout.bind(w);
  w.setTimeout = (fn: () => void, delay: number, ...args: unknown[]) => {
    if (delay >= 10_000 && delay <= 15_000) { timers.set(++id, fn); return id; }
    return originalSetTimeout(fn, delay, ...args);
  };
  w.clearTimeout = (timer: number) => { timers.delete(timer); originalClearTimeout(timer); };
  w.setInterval = (fn: () => void, delay: number) => {
    assert.ok(delay >= 10_000 && delay <= 15_000);
    timers.set(++id, fn); intervals.add(id); return id;
  };
  w.clearInterval = (timer: number) => { timers.delete(timer); intervals.delete(timer); };
  w.fetch = async (_url: string, init: RequestInit) => {
    reads.push(new Headers(init.headers).get('Authorization')!);
    return { ok: true, json: async () => ({ ok: true, usage: {
      recordedBytes: measuredBytes, measuredFiles: 8, totalFiles: 10, limitBytes: null, enforcement: false,
      pendingDeletionFiles: pending, pendingDeletionBytes: pending * 100_000_000, failedDeletionFiles: 0, trashedFiles: 0, trashedBytes: 0,
      sharedDeletionFiles: shared, sharedDeletionBytes: shared * 100_000_000,
    } }) };
  };
  w.eval(await bundle);
  const runPoll = async () => {
    // A real 12-second interval has already released SWR's zero-duration dedupe receipt.
    await w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    const [timerId, run] = [...timers][0] ?? [];
    assert.ok(run, 'pending deletion schedules a bounded 10–15 second read');
    if (!intervals.has(timerId)) timers.delete(timerId);
    await w.fx.act(async () => run());
  };
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(timers.size, 0, 'ordinary storage reads do not poll');
    assert.equal(reads.length, 1);
    pending = 2;
    await w.fx.act(async () => w.fx.invalidate('A'));
    assert.match(w.document.body.textContent, /2 pending deletion/);
    const scheduled = [...timers.keys()];
    await w.fx.act(async () => w.fx.render());
    assert.ok(scheduled.some(timer => timers.has(timer)), 'unrelated renders cannot keep postponing the pending cleanup read');
    await runPoll();
    assert.equal(reads.length, 3);
    assert.match(w.document.body.textContent, /Storage · 2 GB/, 'pending cleanup does not subtract bytes locally');
    pending = 0; measuredBytes = 1_800_000_000;
    await runPoll();
    assert.match(w.document.body.textContent, /Storage · 1.8 GB/);
    assert.doesNotMatch(w.document.body.textContent, /pending deletion/);
    assert.equal(timers.size, 0, 'completed cleanup stops polling');
    pending = 1;
    await w.fx.act(async () => w.fx.invalidate('A'));
    const oldPoll = [...timers.values()][0];
    assert.ok(oldPoll);
    pending = 0; w.owner = 'B';
    await w.fx.act(async () => w.fx.render());
    assert.equal(reads.at(-1), 'Bearer token-B');
    const afterSwitch = reads.length;
    await w.fx.act(async () => oldPoll());
    assert.equal(reads.length, afterSwitch, 'retired callback cannot send another account read');
    assert.equal(timers.size, 0);
    shared = 2;
    await w.fx.act(async () => w.fx.invalidate('B'));
    assert.match(w.document.body.textContent, /2 shared files retained/);
    assert.equal(timers.size, 0, 'shared retention is explained without perpetual polling');
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
});
