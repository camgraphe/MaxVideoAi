import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { installMediaGridGeometry } from './helpers/media-grid-dom';

// Real library, modal, SWR and account binding; only session and HTTP are controlled.
const bundle = bundleClientFlow(`
import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRConfig}from'swr';
import{CompactLibraryBrowser}from'./components/library/CompactLibraryBrowser.client';
import{LibraryStorageUsage}from'./components/library/LibraryStorageUsage.client';
import{libraryCacheRevision,invalidateLibraryMedia}from'./hooks/useLibraryCacheRevision';
const cache=new Map();
function Scene(){return <><CompactLibraryBrowser locale={window.locale} title="Media" assets={[]} assetType="all" isLoading={false} management={{userId:window.owner,scope:window.scope,onScopeChange:()=>{},totalCount:0}} source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} emptyLabel="Empty" emptySearchLabel="No match" searchPlaceholder="Search"/><LibraryStorageUsage userId={window.owner} locale={window.locale}/></>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<SWRConfig value={{provider:()=>cache,dedupingInterval:0,shouldRetryOnError:false}}><Scene/></SWRConfig>),revision:owner=>libraryCacheRevision(owner),invalidate:owner=>invalidateLibraryMedia(owner),unmount:()=>root.unmount()};
`, {
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{user:{id:window.owner},access_token:"token-"+window.owner}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});',
});
type Call = { url: string; owner: string | null; body: any; signal?: AbortSignal | null };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const snapshot = (id = 'snapshot-1', totalCount = 3, expiresAt = '2099-01-01T00:00:00Z') =>
  response({ ok: true, snapshot: { id, totalCount, expiresAt, keys: ['one', 'two', 'three'].slice(0, totalCount) } });
const usage = (pendingDeletionFiles = 0, failedDeletionFiles = 0) => ({
  recordedBytes: 2_000_000_000, measuredFiles: 8, totalFiles: 10,
  limitBytes: null, enforcement: false, pendingDeletionFiles,
  pendingDeletionBytes: pendingDeletionFiles * 100_000_000, failedDeletionFiles,
  trashedFiles: 3, trashedBytes: 300_000_000,
});
async function fixture() {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  installMediaGridGeometry(w);
  w.owner = 'A'; w.locale = 'en';
  w.scope = { view: 'saved', kind: 'image', sort: 'name', trash: true, q: 'no match', collectionId: 'filtered', source: 'angle' };
  const calls: Call[] = [];
  let readSelection = () => Promise.resolve(snapshot());
  let emptyTrash = () => Promise.resolve(response({ ok: true, requestedCount: 3, queuedCount: 3, alreadyQueuedCount: 0 }));
  let storage = usage();
  w.fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, owner: new Headers(init.headers).get('Authorization'), body: init.body ? JSON.parse(init.body as string) : undefined, signal: init.signal });
    if (url === '/api/media-library/selection') return readSelection();
    if (url === '/api/media-library/trash/empty') return emptyTrash();
    if (url === '/api/media-library/storage') return response({ ok: true, usage: storage });
    return response({ ok: true, items: [], nextCursor: null, hasMore: false });
  };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  const button = (label: string, within: ParentNode = w.document) => {
    const value = [...within.querySelectorAll('button')].find((node) => node.textContent?.trim() === label) as HTMLButtonElement | undefined;
    assert.ok(value, `button "${label}" is available`); return value;
  };
  const click = async (label: string) => w.fx.act(async () => button(label).click());
  return {
    w, calls, button, click,
    select: (fn: typeof readSelection) => { readSelection = fn; },
    empty: (fn: typeof emptyTrash) => { emptyTrash = fn; },
    storage: (value: ReturnType<typeof usage>) => { storage = value; },
    close: async () => { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); },
  };
}

test('empty Trash reviews all files despite zero filtered results, and cancel never requests deletion', async () => {
  const f = await fixture();
  try {
    assert.equal(f.calls.some(call => call.url.endsWith('/selection')), false);
    await f.click('Empty Trash');
    const selections = f.calls.filter(call => call.url.endsWith('/selection'));
    assert.equal(selections.length, 1);
    assert.deepEqual(selections[0].body, { scope: { view: 'all', kind: 'all', sort: 'recent', trash: true } });
    const dialog = f.w.document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.match(dialog.textContent, /3 items/);
    assert.match(dialog.textContent, /all items in Trash/i);
    assert.match(dialog.textContent, /cannot be undone/i);
    assert.match(dialog.textContent, /Studio/);
    assert.match(dialog.textContent, /ongoing work/i);
    assert.equal(f.calls.some(call => call.url.endsWith('/trash/empty')), false);
    await f.w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 5)));
    assert.equal(f.w.document.activeElement, f.button('Cancel'), 'the safe action receives initial focus');
    await f.click('Cancel');
    assert.equal(f.w.document.querySelector('[role="dialog"]'), null);
    assert.equal(f.calls.some(call => call.url.endsWith('/trash/empty')), false);
    assert.equal(f.w.fx.revision('A'), 0);
  } finally { await f.close(); }
});

test('explicit confirmation submits once, revalidates owner data and reports deferred cleanup without freed bytes', async () => {
  const f = await fixture();
  let resolve!: (value: ReturnType<typeof response>) => void;
  try {
    f.empty(() => new Promise(done => { resolve = done; }));
    await f.click('Empty Trash');
    const confirm = f.button('Permanently delete 3 items');
    await f.w.fx.act(async () => { confirm.click(); confirm.click(); });
    const writes = f.calls.filter(call => call.url.endsWith('/trash/empty'));
    assert.equal(writes.length, 1, 'duplicate clicks cannot submit another deletion');
    assert.deepEqual(writes[0].body, { snapshotId: 'snapshot-1', confirmation: 'empty-trash' });
    assert.equal(writes[0].owner, 'Bearer token-A');
    assert.ok(f.button('Cancel').disabled);
    f.storage(usage(3));
    await f.w.fx.act(async () => resolve(response({ ok: true, requestedCount: 3, queuedCount: 2, alreadyQueuedCount: 1 })));
    assert.equal(f.w.document.querySelector('[role="dialog"]'), null);
    assert.equal(f.w.fx.revision('A'), 1);
    assert.equal(f.calls.filter(call => call.url.endsWith('/storage')).length, 2);
    assert.match(f.w.document.body.textContent, /Deletion requested for 3 items/);
    assert.match(f.w.document.body.textContent, /1 already queued/);
    assert.match(f.w.document.body.textContent, /3 pending deletion/);
    assert.match(f.w.document.body.textContent, /Storage · 2 GB/);
    assert.doesNotMatch(f.w.document.body.textContent, /freed|reclaimed|3 items deleted/i);
  } finally { await f.close(); }
});

test('changed snapshot requires a new review and an additional confirmation', async () => {
  const f = await fixture();
  try {
    f.empty(async () => response({ ok: false, error: 'SOURCE_CHANGED' }, 409));
    await f.click('Empty Trash'); await f.click('Permanently delete 3 items');
    assert.ok(f.w.document.querySelector('[role="alert"]'));
    assert.equal(f.w.fx.revision('A'), 0);
    assert.equal([...f.w.document.querySelectorAll('button')].some((node: any) => node.textContent === 'Permanently delete 3 items'), false);
    f.select(async () => snapshot('snapshot-2', 2));
    await f.click('Review Trash again');
    assert.equal(f.calls.filter(call => call.url.endsWith('/trash/empty')).length, 1);
    f.empty(async () => response({ ok: true, requestedCount: 2, queuedCount: 2, alreadyQueuedCount: 0 }));
    await f.click('Permanently delete 2 items');
    assert.equal(f.calls.filter(call => call.url.endsWith('/trash/empty'))[1].body.snapshotId, 'snapshot-2');
  } finally { await f.close(); }
});

test('retired account snapshot cannot appear or delete in the next account', async () => {
  const f = await fixture();
  let resolve!: (value: ReturnType<typeof response>) => void;
  try {
    f.select(() => new Promise(done => { resolve = done; }));
    await f.click('Empty Trash');
    await f.w.fx.act(async () => { f.w.owner = 'B'; f.w.fx.render(); });
    await f.w.fx.act(async () => resolve(snapshot('stale-A', 3)));
    assert.equal(f.w.document.querySelector('[role="dialog"]'), null);
    assert.equal(f.calls.some(call => call.url.endsWith('/trash/empty')), false);
    f.select(async () => snapshot('fresh-B', 2));
    await f.click('Empty Trash');
    assert.match(f.w.document.querySelector('[role="dialog"]').textContent, /2 items/);
    assert.equal(f.calls.filter(call => call.url.endsWith('/selection')).at(-1)?.owner, 'Bearer token-B');
  } finally { await f.close(); }
});

test('an empty or locally expired review cannot submit a deletion request', async () => {
  const f = await fixture();
  try {
    f.select(async () => snapshot('empty', 0));
    await f.click('Empty Trash');
    assert.match(f.w.document.querySelector('[role="dialog"]').textContent, /Trash is empty/);
    assert.equal([...f.w.document.querySelectorAll('button')].some((node: any) => node.textContent.startsWith('Permanently delete')), false);
    await f.click('Cancel');
    f.select(async () => snapshot('expired', 3, '2000-01-01T00:00:00Z'));
    await f.click('Empty Trash'); await f.click('Permanently delete 3 items');
    assert.equal(f.calls.some(call => call.url.endsWith('/trash/empty')), false);
    assert.ok(f.button('Review Trash again'));
  } finally { await f.close(); }
});

test('a session switch before React updates cannot submit using the replacement account', async () => {
  const f = await fixture();
  try {
    await f.click('Empty Trash');
    f.w.owner = 'B';
    await f.click('Permanently delete 3 items');
    assert.equal(f.calls.some(call => call.url.endsWith('/trash/empty')), false);
    assert.match(f.w.document.querySelector('[role="alert"]').textContent, /could not be confirmed/);
    assert.equal(f.w.fx.revision('A'), 0);
    assert.equal(f.w.fx.revision('B'), 0);
  } finally { await f.close(); }
});

test('late confirmed deletion updates only its initiating account and cannot reopen the dialog', async () => {
  const f = await fixture();
  let resolve!: (value: ReturnType<typeof response>) => void;
  try {
    f.empty(() => new Promise(done => { resolve = done; }));
    await f.click('Empty Trash'); await f.click('Permanently delete 3 items');
    await f.w.fx.act(async () => { f.w.owner = 'B'; f.w.fx.render(); });
    const readsBefore = f.calls.filter(call => call.url.endsWith('/storage')).length;
    await f.w.fx.act(async () => resolve(response({ ok: true, requestedCount: 3, queuedCount: 3, alreadyQueuedCount: 0 })));
    assert.equal(f.w.fx.revision('A'), 1);
    assert.equal(f.w.fx.revision('B'), 0);
    assert.equal(f.w.document.querySelector('[role="dialog"]'), null);
    assert.doesNotMatch(f.w.document.body.textContent, /Deletion requested/);
    assert.equal(f.calls.filter(call => call.url.endsWith('/storage')).length, readsBefore);
  } finally { await f.close(); }
});

test('an unconfirmed transport result requires review without claiming deletion or rollback', async () => {
  const f = await fixture();
  try {
    f.empty(async () => { throw new Error('connection lost'); });
    await f.click('Empty Trash'); await f.click('Permanently delete 3 items');
    assert.match(f.w.document.querySelector('[role="alert"]').textContent, /could not be confirmed/);
    assert.doesNotMatch(f.w.document.body.textContent, /Deletion requested|deleted no items|freed/);
    assert.ok(f.button('Review Trash again'));
    assert.equal(f.w.fx.revision('A'), 0);
  } finally { await f.close(); }
});
