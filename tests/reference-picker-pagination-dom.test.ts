import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { installMediaGridGeometry } from './helpers/media-grid-dom';

const bundle = bundleClientFlow(`
import React,{act}from'react';import{createRoot}from'react-dom/client';
import{ReferenceLibraryPicker}from'./components/library/ReferenceLibraryPicker.client';
function App(){const p=window.props;return <ReferenceLibraryPicker {...p}
 title="References" searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match"
 availableSources={['all','upload','recent']} sourceLabels={{all:'All',upload:'Uploads',recent:'Recent'}}
 onSourceChange={source=>{window.props={...p,source};window.fx.render()}}
 onSearchQueryChange={searchQuery=>{window.props={...p,searchQuery};window.fx.render()}}
 onLoadMore={()=>window.calls.push([p.owner,p.source,p.searchQuery])} onRetry={()=>window.retries++}
 renderAssetActions={()=>null}
 selection={{ownerId:p.owner,scope:p.scope,allowOrganizationBrowse:false,busy:p.busy,
 getEligibility:asset=>({status:asset.blocked?'blocked':'usable',reason:'kind'}),
 onConfirmMany:assets=>{window.accepted=assets}}}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
`, {
  '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});`,
});

const asset = (id: string) => ({ id, name: `Source ${id}`, kind: 'image', url: `https://example.invalid/${id}.png` });

async function fixture(height = 3000, initial: Record<string, unknown> = {}) {
  const dom = createClientFlowDom('/app'), w = dom.window as any;
  installMediaGridGeometry(w);
  w.props = { assets: [asset('one'), asset('two')], owner: null, scope: 'model:pool', source: 'all',
    assetType: 'image', searchQuery: '', isLoading: false, hasMore: true, ...initial };
  w.calls = []; w.retries = 0;
  let scrollHeight = height, frameId = 0, timerId = 100_000;
  const frames = new Map<number, () => void>(), timers = new Map<number, () => void>();
  w.requestAnimationFrame = (callback: () => void) => { frames.set(++frameId, callback); return frameId; };
  w.cancelAnimationFrame = (id: number) => frames.delete(id);
  const setTimeout = w.setTimeout.bind(w), clearTimeout = w.clearTimeout.bind(w);
  w.setTimeout = (callback: () => void, delay: number, ...args: unknown[]) => {
    if (delay === 15_000) { timers.set(++timerId, callback); return timerId; }
    return setTimeout(callback, delay, ...args);
  };
  w.clearTimeout = (id: number) => { timers.delete(id); clearTimeout(id); };
  Object.defineProperty(w.HTMLElement.prototype, 'scrollHeight', { configurable: true, get() {
    return this.classList.contains('compact-media-grid') ? scrollHeight : 0;
  } });
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  const flush = async () => w.fx.act(async () => {
    const callbacks = [...frames.values()]; frames.clear();
    for (const callback of callbacks) callback();
  });
  const grid = () => w.document.querySelector('.compact-media-grid') as HTMLDivElement;
  const more = () => w.document.querySelector('.app-picker-load-more button') as HTMLButtonElement | null;
  return { w, grid, more, timers, flush,
    setHeight(value: number) { scrollHeight = value; },
    async render(patch: Record<string, unknown>) {
      await w.fx.act(async () => { w.props = { ...w.props, ...patch }; w.fx.render(); });
    },
    async scroll(top: number) {
      await w.fx.act(async () => { grid().scrollTop = top; grid().dispatchEvent(new w.Event('scroll')); });
      await flush();
    },
    async close() { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); },
  };
}

test('reference scroll loads one page per visible progress and preserves staged originals and manual keyboard fallback', async () => {
  const f = await fixture();
  try {
    await f.flush(); assert.equal(f.w.calls.length, 0, 'initial browsing does not fetch unseen pages');
    await f.w.fx.act(async () => f.w.document.querySelector('.compact-media-check input').click());
    assert.equal(f.w.document.querySelectorAll('[data-basket-item]').length, 1);
    assert.equal(f.more()!.dataset.autoLoad, 'true');
    assert.equal(f.more()!.tabIndex, 0, 'automatic pagination retains a native tab stop');
    assert.ok(f.more()!.classList.contains('focus:not-sr-only'), 'the manual control is revealed by focus');
    await f.scroll(2300); await f.scroll(2400);
    assert.equal(f.w.calls.length, 1, 'scroll events are deduplicated before loading state arrives');
    await f.render({ isLoadingMore: true }); await f.scroll(2400);
    assert.equal(f.w.calls.length, 1); assert.equal(f.more()!.disabled, true);
    assert.match(f.w.document.querySelector('.app-picker-load-more [role=status]').textContent, /Loading media/);
    f.setHeight(5000);
    await f.render({ isLoadingMore: false, assets: [...f.w.props.assets, asset('three')] });
    await f.flush(); assert.equal(f.w.calls.length, 1, 'appending a page waits for its end to enter view');
    await f.scroll(4350); assert.equal(f.w.calls.length, 2);
    assert.equal(f.w.document.querySelectorAll('[data-basket-item]').length, 1, 'paging does not replace the ordered basket');
    await f.w.fx.act(async () => { f.more()!.focus(); f.more()!.click(); });
    assert.equal(f.w.document.activeElement, f.more()); assert.equal(f.w.calls.length, 3);
    await f.render({ hasMore: false }); await f.scroll(4400);
    assert.equal(f.more(), null); assert.equal(f.w.calls.length, 3, 'the last cursor stops automatic loading');
  } finally { await f.close(); }
});

test('a page with no visible matches stops automatic reads; query, source, filter and account scopes retire callbacks', async () => {
  const f = await fixture(400);
  try {
    await f.flush(); assert.equal(f.w.calls.length, 1, 'a short visible page fills once');
    await f.render({ isLoadingMore: true });
    await f.render({ isLoadingMore: false, assets: [...f.w.props.assets, { ...asset('blocked'), blocked: true }] });
    await f.flush(); await f.scroll(0);
    assert.equal(f.w.calls.length, 1, 'incompatible additions cannot drain invisible pages');
    const oldTimer = [...f.timers.values()][0]; assert.ok(oldTimer);
    await f.w.fx.act(async () => oldTimer());
    assert.equal(f.more()!.dataset.autoLoad, undefined, 'stalled progress exposes manual recovery');
    await f.render({ searchQuery: 'absent' }); await f.flush();
    assert.equal(f.w.calls.length, 2); assert.equal(f.more()!.dataset.autoLoad, 'true');
    await f.w.fx.act(async () => oldTimer());
    assert.equal(f.more()!.dataset.autoLoad, 'true', 'a retired scope cannot reveal its old recovery state');
    await f.render({ assets: [...f.w.props.assets, asset('also-unmatched')] }); await f.flush();
    assert.equal(f.w.calls.length, 2, 'a local search without new matches fetches at most one automatic page');
    await f.render({ source: 'upload' }); await f.flush(); assert.equal(f.w.calls.length, 3);
    await f.w.fx.act(async () => f.grid().dispatchEvent(new f.w.Event('scroll')));
    await f.render({ owner: 'owner-B', source: 'recent', searchQuery: '' }); await f.flush();
    assert.equal(f.w.calls.length, 4);
    assert.deepEqual(Array.from(f.w.calls.at(-1)), ['owner-B', 'recent', ''], 'queued callbacks use only the current owner and source');
    const select = f.w.document.querySelector('[data-compatibility-filter]');
    await f.w.fx.act(async () => { select.value = 'all'; select.dispatchEvent(new f.w.Event('change', { bubbles: true })); });
    await f.flush(); assert.equal(f.w.calls.length, 5, 'compatibility changes have a fresh automatic budget');
  } finally { await f.close(); }
});

test('inactive, preview, busy and failed reference views do not paginate in the background', async () => {
  const f = await fixture(400, { active: false });
  try {
    await f.flush(); assert.equal(f.w.calls.length, 0);
    await f.render({ active: true, busy: true }); await f.flush(); assert.equal(f.w.calls.length, 0);
    await f.render({ busy: false, error: 'Page failed' }); await f.flush();
    assert.equal(f.w.calls.length, 0); assert.equal(f.more()!.dataset.autoLoad, undefined);
    assert.equal(f.more()!.textContent, 'Retry');
    await f.w.fx.act(async () => f.more()!.click()); assert.equal(f.w.retries, 1);
    await f.render({ error: null });
    await f.w.fx.act(async () => f.w.document.querySelector('.compact-media-inspect').click());
    await f.flush(); await f.scroll(0); assert.equal(f.w.calls.length, 0, 'inspection retires a queued grid read');
    await f.w.fx.act(async () => [...f.w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'Back').click());
    await f.flush(); assert.equal(f.w.calls.length, 1, 'returning to the visible grid resumes its current page');
  } finally { await f.close(); }
});

test('reference captions use generation facts while preserving upload names, accessible controls and exact selection', async () => {
  const generated = { ...asset('generated'), source: 'saved_job_output', name: 'render_fedcba9876543210fedcba9876543210.png', createdAt: '2026-11-10T10:15:00Z' };
  const upload = { ...asset('upload'), source: 'upload', name: 'Our selected autumn storyboard with a deliberately long descriptive original file name.png' };
  const f = await fixture(3000, { assets: [generated, upload], hasMore: false });
  try {
    await f.flush();
    const rows = [...f.w.document.querySelectorAll('[data-media-key]')] as HTMLElement[];
    const caption = rows[0].querySelector('.compact-media-name')!.textContent!;
    assert.match(caption, /^Image · /); assert.doesNotMatch(caption, /render_|fedcba/);
    assert.equal(rows[0].querySelector('.compact-media-preview')!.getAttribute('aria-label'), `Add ${caption}`);
    assert.equal(rows[0].querySelector('input')!.getAttribute('aria-label'), `Select ${caption}`);
    assert.equal(rows[1].querySelector('.compact-media-name')!.textContent, upload.name);
    assert.equal(rows[1].querySelector('input')!.getAttribute('aria-label'), `Select ${upload.name}`);
    for (const row of rows) await f.w.fx.act(async () => row.querySelector<HTMLInputElement>('input')!.click());
    const selected = [...f.w.document.querySelectorAll('[data-basket-item] > span')].map((node: any) => node.textContent);
    assert.deepEqual(selected, [`1. ${caption}`, `2. ${upload.name}`]);
    await f.w.fx.act(async () => f.w.document.querySelector('.app-picker-use').click());
    assert.deepEqual(Array.from(f.w.accepted).map((item: any) => [item.id, item.url, item.name]), [generated, upload].map(item => [item.id, item.url, item.name]));
    await f.render({ searchQuery: 'fedcba' }); await f.flush();
    assert.equal(f.w.document.querySelectorAll('[data-media-key]').length, 1, 'the original technical filename remains searchable');
  } finally { await f.close(); }
});
