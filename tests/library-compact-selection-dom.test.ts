import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

// Catches lost captured identities on page replacement, wrong snapshot membership,
// client truncation and accidental reprocessing of confirmed chunks.
const selectionPath = 'frontend/lib/library-management-selection.ts';
const row = (n: number) => ({
  id: 'row-' + n,
  url: 'https://example.invalid/' + n + '.png',
  kind: 'image' as const,
  organization: { key: 'key-' + n, favorite: false, trashedAt: null, collectionIds: [] },
  libraryRef: { type: 'asset' as const, assetId: 'ma-' + n, kind: 'image' as const },
  sourceRevision: 'rev-' + n,
});
test('loaded selection retains ordered exact sources across pages, range changes and atomic cap rejection', async () => {
  assert.ok(existsSync(selectionPath), 'management selection owner exists');
  const { changeLoadedSelection, emptyManagementSelection, selectionCount } = await import(
    '../frontend/lib/library-management-selection'
  );
  let s = changeLoadedSelection(
    emptyManagementSelection(),
    [row(1), row(2), row(3)],
    new Set(['key-1', 'key-3'])
  );
  s = changeLoadedSelection(s, [row(4)], new Set(['key-4']));
  assert.deepEqual([...s.records.keys()], ['key-1', 'key-3', 'key-4']);
  assert.equal(s.records.get('key-1')?.sourceRevision, 'rev-1');
  s = changeLoadedSelection(s, [row(1), row(2), row(3)], new Set(['key-1', 'key-2', 'key-3']));
  assert.deepEqual([...s.records.keys()], ['key-1', 'key-3', 'key-4', 'key-2']);
  assert.equal(selectionCount(s), 4);
  assert.throws(
    () =>
      changeLoadedSelection(
        s,
        Array.from({ length: 10001 }, (_, i) => row(i)),
        'all'
      ),
    /SELECTION_LIMIT/
  );
  assert.equal(selectionCount(s), 4);
});
test('frozen selection counts exact snapshot members, excludes toggles and never selects new arrivals', async () => {
  assert.ok(existsSync(selectionPath), 'management selection owner exists');
  const {
    frozenManagementSelection,
    changeLoadedSelection,
    selectedManagementKeys,
    selectionCount,
  } = await import('../frontend/lib/library-management-selection');
  let s = frozenManagementSelection({
    id: 'snapshot',
    keys: ['key-1', 'key-2'],
    totalCount: 2,
    expiresAt: '2099-01-01T00:00:00Z',
  });
  assert.deepEqual([...selectedManagementKeys(s, [row(1), row(3)])], ['key-1']);
  s = changeLoadedSelection(s, [row(1), row(3)], new Set());
  assert.equal(selectionCount(s), 1);
  assert.deepEqual([...selectedManagementKeys(s, [row(2), row(3)])], ['key-2']);
});
test('manual 600 mutation uses serial <=500 exact revisions and failed-only retry without replaying successes', async () => {
  assert.ok(existsSync(selectionPath), 'management selection owner exists');
  const { runManualOrganization } = await import('../frontend/lib/library-management-selection');
  const calls: any[] = [];
  let active = 0;
  const mutate = async (_owner: string, request: any) => {
    assert.equal(active++, 0);
    calls.push(request);
    await Promise.resolve();
    active--;
    return {
      ok: true,
      results: request.references.map((reference: any) => ({
        reference,
        status: reference.assetId === 'ma-503' ? 'failed' : 'succeeded',
        error: 'SOURCE_UNAVAILABLE',
      })),
      succeededCount:
        request.references.length -
        (request.references.some((r: any) => r.assetId === 'ma-503') ? 1 : 0),
      failedCount: request.references.some((r: any) => r.assetId === 'ma-503') ? 1 : 0,
      affectedCount: request.references.length,
    };
  };
  const result = await runManualOrganization({
    userId: 'A',
    records: Array.from({ length: 600 }, (_, i) => row(i)),
    operation: 'trash',
    isCurrent: () => true,
    mutate,
  });
  assert.deepEqual(
    calls.map((c) => c.references.length),
    [500, 100]
  );
  assert.equal(calls[1].references[3].sourceRevision, 'rev-503');
  assert.equal(result.confirmed.length, 599);
  assert.equal(result.failed.length, 1);
  assert.equal(result.unconfirmed.length, 0);
  assert.equal(result.unattempted.length, 0);
  await runManualOrganization({
    userId: 'A',
    records: result.failed.map((f) => f.asset),
    operation: 'restore',
    isCurrent: () => true,
    mutate,
  });
  assert.deepEqual(
    calls[2].references.map((r: any) => r.assetId),
    ['ma-503']
  );
});
test('retirement stops later chunks and keeps confirmed outcomes; transport failure distinguishes uncertainty from unattempted', async () => {
  assert.ok(existsSync(selectionPath), 'management selection owner exists');
  const { runManualOrganization } = await import('../frontend/lib/library-management-selection');
  let current = true,
    calls = 0;
  const result = await runManualOrganization({
    userId: 'A',
    records: Array.from({ length: 600 }, (_, i) => row(i)),
    operation: 'favorite',
    isCurrent: () => current,
    mutate: async (_owner, request: any) => {
      calls++;
      current = false;
      return {
        ok: true,
        results: request.references.map((reference: any) => ({ reference, status: 'succeeded' })),
        succeededCount: 500,
        failedCount: 0,
        affectedCount: 500,
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.confirmed.length, 500);
  assert.equal(result.unattempted.length, 100);
  const uncertain = await runManualOrganization({
    userId: 'A',
    records: Array.from({ length: 600 }, (_, i) => row(i)),
    operation: 'favorite',
    isCurrent: () => true,
    mutate: async () => {
      throw new Error('NETWORK');
    },
  });
  assert.equal(uncertain.confirmed.length, 0);
  assert.equal(uncertain.failed.length, 0);
  assert.equal(uncertain.unconfirmed.length, 500);
  assert.equal(uncertain.unattempted.length, 100);
});

test('actual management hook retains selection on loading/sort, announces filter reset and retires account', async () => {
  assert.ok(
    existsSync('frontend/components/library/useLibraryManagementSelection.ts'),
    'management hook exists'
  );
  const bundle = await bundleClientFlow(
    `import React,{act} from 'react';import{createRoot}from'react-dom/client';import{useLibraryManagementSelection}from'./components/library/useLibraryManagementSelection';function Scene(){window.s=useLibraryManagementSelection({userId:window.owner,scope:window.scope,assets:window.assets});return <output>{window.s.count}:{window.s.announcement}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}})}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  Object.assign(w, {
    owner: 'A',
    scope: { view: 'all', kind: 'all', sort: 'recent' },
    assets: [row(1), row(2), row(3)],
  });
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.s.change(new Set(['key-1', 'key-2'])));
    assert.equal(w.s.count, 2);
    await w.fx.act(async () => {
      w.assets = [];
      w.scope = { ...w.scope, sort: 'oldest' };
      w.fx.render();
    });
    assert.equal(w.s.count, 2);
    assert.equal(w.s.selection.records.get('key-1').url, row(1).url);
    await w.fx.act(async () => {
      w.scope = { ...w.scope, q: 'other' };
      w.fx.render();
    });
    assert.equal(w.s.count, 0);
    assert.ok(w.s.announcement);
    await w.fx.act(async () => {
      w.assets = [row(3)];
      w.fx.render();
    });
    await w.fx.act(async () => w.s.change(new Set(['key-3'])));
    await w.fx.act(async () => {
      w.owner = 'B';
      w.fx.render();
    });
    assert.equal(w.s.count, 0);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('compact grid keeps contained full ratios, audio rows and distinct thumbnail roles with checkbox/preview separation', async () => {
  assert.ok(
    existsSync('frontend/components/library/CompactMediaGrid.client.tsx'),
    'compact production grid exists'
  );
  const bundle = await bundleClientFlow(
    `import React,{act,useState}from'react';import{createRoot}from'react-dom/client';import{CompactMediaGrid}from'./components/library/CompactMediaGrid.client';function Scene(){const[keys,setKeys]=useState(new Set());return <CompactMediaGrid userId="A" assets={window.assets} selectedKeys={keys} onSelectionChange={setKeys} onOpen={asset=>window.opened.push(asset)} density={128} locale="en" virtualized={false}/>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}})}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.opened = [];
  w.assets = [
    {
      ...row(1),
      name: 'portrait',
      width: 400,
      height: 1200,
      thumbUrl: 'https://example.invalid/portrait.webp',
    },
    { ...row(2), name: 'legacy', thumbUrl: row(2).url },
    { ...row(3), kind: 'video', name: 'clip', thumbUrl: 'https://example.invalid/clip.mp4' },
    { ...row(4), kind: 'audio', name: 'song' },
  ];
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(w.document.querySelectorAll('video,audio').length, 0);
    assert.equal(w.document.querySelectorAll('img').length, 1);
    assert.equal(
      w.document.querySelector('img')?.getAttribute('src'),
      'https://example.invalid/portrait.webp'
    );
    assert.equal(w.document.querySelector('img')?.getAttribute('width'), '400');
    assert.equal(w.document.querySelector('img')?.getAttribute('height'), '1200');
    const checkbox = w.document.querySelector('input[type=checkbox]');
    await w.fx.act(async () => checkbox.click());
    assert.equal(w.opened.length, 0);
    assert.equal(checkbox.checked, true);
    const preview = w.document.querySelector('[aria-label="Preview portrait"]');
    await w.fx.act(async () => preview.click());
    assert.equal(w.opened.length, 1);
    assert.equal(w.opened[0].url, row(1).url);
    assert.equal(checkbox.checked, true);
    await w.fx.act(async () => {
      w.assets = [{ ...row(4), kind: 'audio', name: 'song', durationSec: 12 }];
      w.fx.render();
    });
    assert.equal(
      w.document.querySelector('[data-layout]')?.getAttribute('data-layout'),
      'audio-list'
    );
    assert.equal(w.document.querySelectorAll('audio').length, 0);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('collection CRUD persists through owned transport, publishes confirmed changes and keeps validation/account fences', async () => {
  assert.ok(
    existsSync('frontend/components/library/useLibraryCollections.ts'),
    'durable collection hook exists'
  );
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRProvider}from'./components/swr/SWRProvider';import{useLibraryCollections}from'./components/library/useLibraryCollections';import{libraryCacheRevision}from'./hooks/useLibraryCacheRevision';function Scene(){window.c=useLibraryCollections(window.owner);return <output>{window.c.items.map(i=>i.name).join(',')}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<SWRProvider><Scene/></SWRProvider>),revision:()=>libraryCacheRevision(window.owner),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.owner = 'A';
  let collections: any[] = [],
    calls: any[] = [];
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token-' + w.owner } },
  });
  w.fetch = async (url: string, init: RequestInit = {}) => {
    calls.push([url, init.method]);
    if (init.method === 'POST')
      collections = [{ id: 'lc-first', name: JSON.parse(init.body as string).name }];
    if (init.method === 'PATCH') collections[0].name = JSON.parse(init.body as string).name;
    if (init.method === 'DELETE') collections = [];
    return {
      ok: true,
      json: async () => ({
        ok: true,
        items: w.owner === 'A' ? collections : [],
        collection: collections[0],
        hasMore: false,
        nextCursor: null,
      }),
    };
  };
  w.eval(bundle);
  const settle = async (p: () => boolean) => {
    for (let i = 0; i < 70 && !p(); i++)
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.ok(p());
  };
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.c.write('POST', undefined, '  Project  '));
    await settle(() => w.c.items[0]?.name === 'Project');
    assert.equal(w.fx.revision(), 1);
    await w.fx.act(async () => w.c.write('PATCH', 'lc-first', 'Renamed'));
    await settle(() => w.c.items[0]?.name === 'Renamed');
    assert.equal(w.fx.revision(), 2);
    await w.fx.act(async () => w.c.write('DELETE', 'lc-first'));
    await settle(() => w.c.items.length === 0);
    assert.equal(w.fx.revision(), 3);
    await w.fx.act(async () => w.c.write('POST', undefined, '😀'.repeat(120)));
    await settle(() => w.c.items[0]?.name === '😀'.repeat(120));
    const before = calls.length;
    await w.fx.act(async () => w.c.write('POST', undefined, ' '));
    assert.equal(calls.length, before);
    assert.ok(w.c.error);
    await w.fx.act(async () => {
      w.owner = 'B';
      w.fx.render();
    });
    assert.equal(w.c.items.length, 0);
    assert.equal(w.c.error, null);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('real organization hook uses frozen snapshot/exclusions, retains failed sources and never physical-deletes', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLibraryManagementSelection}from'./components/library/useLibraryManagementSelection';function Scene(){window.s=useLibraryManagementSelection({userId:window.owner,scope:window.scope,assets:window.assets});return <output>{window.s.count}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  Object.assign(w, {
    owner: 'A',
    scope: { view: 'all', kind: 'all', sort: 'recent' },
    assets: [row(1), row(2), row(3)],
  });
  const calls: any[] = [];
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token' } },
  });
  w.fetch = async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    calls.push({ url, method: init.method, ...body });
    return {
      ok: true,
      json: async () =>
        url.endsWith('/selection')
          ? {
              ok: true,
              snapshot: {
                id: 'ls-fixed',
                keys: ['key-1', 'key-2'],
                totalCount: 2,
                expiresAt: '2099-01-01T00:00:00Z',
              },
            }
          : {
              ok: true,
              succeededCount: 1,
              failedCount: 1,
              affectedCount: 2,
              succeededKeys: ['key-1'],
              failed: [{ key: 'key-2', errorCode: 'SOURCE_UNAVAILABLE' }],
            },
    };
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.s.selectAllResults());
    assert.equal(w.s.count, 2);
    assert.deepEqual([...w.s.keys], ['key-1', 'key-2']);
    await w.fx.act(async () => w.s.run('trash'));
    assert.equal(w.s.count, 1);
    assert.deepEqual([...w.s.keys], ['key-2']);
    assert.equal(calls[1].snapshotId, 'ls-fixed');
    assert.deepEqual(calls[1].excludedKeys, []);
    await w.fx.act(async () => w.s.run('restore'));
    assert.deepEqual(calls[2].excludedKeys, ['key-1']);
    assert.equal(
      calls.some((c) => c.method === 'DELETE'),
      false
    );
    await w.fx.act(async () => w.s.selectLoaded());
    assert.equal(w.s.selection.snapshot, null);
    assert.equal(w.s.count, 3);
    assert.deepEqual([...w.s.keys], ['key-1', 'key-2', 'key-3']);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('production compact browser preserves slots, exact totals and independent viewer through replacement loading', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{AssetLibraryBrowser}from'./components/library/AssetLibraryBrowser';function Scene(){return <AssetLibraryBrowser locale={window.locale??"en"} layout="page" title="Media" hideTitle assetType="all" assets={window.assets} isLoading={window.loading} management={{userId:window.owner,scope:window.scope,onScopeChange:patch=>{window.scope={...window.scope,...patch};window.fx.render()},totalCount:window.total}} source="all" availableSources={['all','recent']} sourceLabels={{all:'All',recent:'Recent'}} onSourceChange={()=>{}} searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" headerLeadingActions={<span data-type-slot>Types</span>} headerActions={<span data-header-slot>Import</span>} renderAssetActions={a=><button data-save={a.id}>Save output</button>} renderContinuation={a=><button data-destination={a.id}>Real destination</button>} getAssetHref={a=>'/app?job='+a.jobId} getAssetHrefLabel={()=>'Open source'}/>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});`,
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  Object.assign(w, {
    owner: 'A',
    scope: { view: 'all', kind: 'all', sort: 'recent' },
    assets: [
      {
        ...row(1),
        name: 'first',
        jobId: 'job-first',
        thumbUrl: 'https://example.invalid/first.webp',
      },
    ],
    loading: false,
    total: 91,
  });
  w.ResizeObserver = class {
    cb: any;
    constructor(cb: any) {
      this.cb = cb;
    }
    observe(target: any) {
      Promise.resolve().then(() =>
        this.cb([
          {
            target,
            contentRect: { width: 900, height: 600 },
            borderBoxSize: [{ inlineSize: 900, blockSize: 600 }],
          },
        ])
      );
    }
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperties(w.HTMLElement.prototype, {
    clientWidth: {
      get() {
        return 900;
      },
    },
    clientHeight: {
      get() {
        return 600;
      },
    },
    offsetWidth: {
      get() {
        return 900;
      },
    },
    offsetHeight: {
      get() {
        return 600;
      },
    },
  });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 900,
    height: 600,
    top: 0,
    left: 0,
    right: 900,
    bottom: 600,
  });
  w.HTMLElement.prototype.getClientRects = function () {
    return [this.getBoundingClientRect()];
  };
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token' } },
  });
  w.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, items: [], nextCursor: null, hasMore: false }),
  });
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.ok(w.document.querySelector('[data-type-slot]'));
    assert.ok(w.document.querySelector('[data-header-slot]'));
    assert.match(w.document.body.textContent, /91 results/);
    for (const area of ['filters','collections','selection']) {
      const toggle=w.document.querySelector(`.compact-library-${area} > .compact-library-disclosure-toggle`);
      assert.ok(toggle, `${area} has a mobile disclosure`);
      assert.equal(toggle.getAttribute('aria-expanded'),'false');
      assert.ok(w.document.getElementById(toggle.getAttribute('aria-controls')));
    }
    const filters=w.document.querySelector('.compact-library-filters > button');
    filters.focus(); await w.fx.act(async()=>filters.click());
    assert.equal(filters.getAttribute('aria-expanded'),'true');
    assert.ok(w.document.querySelector('.compact-library-filters select[aria-label="Sort"]'));
    assert.ok(w.document.querySelector('.compact-library-filters input[type="range"]'));
    await w.fx.act(async()=>filters.click());assert.equal(w.document.activeElement,filters);
    await w.fx.act(async()=>w.document.querySelector('.compact-library-selection > button').click());

    const select = [...w.document.querySelectorAll('button')].find(
      (b: any) => b.textContent === 'Select loaded'
    );
    assert.ok(select);
    await w.fx.act(async () => select.click());
    assert.match(w.document.body.textContent, /1 selected/);
    assert.equal(w.document.querySelector('.compact-library-selection > button').getAttribute('aria-expanded'),'true');
    await w.fx.act(async () => { w.locale = "fr"; w.fx.render(); });
    assert.equal(w.document.querySelector(".compact-library-selection .compact-library-disclosure-content > span")?.textContent, "1 sélectionné");
    await w.fx.act(async () => { w.locale = "en"; w.fx.render(); });
    const mediaMatch = w.matchMedia;
    w.matchMedia = (query: string) => mediaMatch?.(query) ?? { matches: query === '(max-width: 767px)', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
    const clear = [...w.document.querySelectorAll('button')].find((b: any) => b.textContent === 'Clear selection');
    clear.focus();
    await w.fx.act(async () => clear.click());
    assert.ok(w.document.activeElement === w.document.querySelector('.compact-library-selection > button'), 'cleared mobile command returns focus to Select');
    assert.equal(w.document.activeElement.getAttribute('aria-expanded'), 'false');
    await w.fx.act(async () => select.click());
    filters.focus();
    await w.fx.act(async () => clear.click());
    assert.ok(w.document.activeElement === filters, 'a different focused control keeps focus');
    await w.fx.act(async () => select.click());
    const preview = w.document.querySelector('[aria-label="Preview first"]');
    assert.ok(preview, 'virtualized actual browser mounts visible card');
    await w.fx.act(async () => preview.click());
    assert.equal(w.document.querySelector('[data-save]')?.getAttribute('data-save'), 'row-1');
    assert.ok(w.document.querySelector('[data-destination]'));
    assert.match(
      w.document.querySelector('a[aria-label="Open original"]')?.getAttribute('href') ?? '',
      /1.png/
    );
    await w.fx.act(async () => {
      w.loading = true;
      w.assets = [];
      w.total = 0;
      w.fx.render();
    });
    assert.match(w.document.body.textContent, /1 selected/);
    assert.ok(w.document.querySelector('[role=dialog]'));
    assert.ok(w.document.querySelector('[data-loading-placeholder]'));
    assert.doesNotMatch(
      w.document.querySelector('.compact-library-total')?.textContent ?? '',
      /^0 /
    );
    await w.fx.act(async () => {
      w.scope = { ...w.scope, q: 'changed' };
      w.fx.render();
    });
    assert.equal(w.document.querySelector('[role=dialog]'), null);
    assert.match(w.document.body.textContent, /Selection cleared/);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('page data common browsing forwards server filters and preserves full exact DTO identity instead of merging kind pages', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRProvider}from'./components/swr/SWRProvider';import{useLibraryPageData}from'./app/(core)/(workspace)/app/library/_hooks/useLibraryPageData';function Scene(){window.d=useLibraryPageData({userId:'A',activeView:'all',activeKind:'all',activeSource:'all',toolsEnabled:true,organizationScope:{favorite:true,collectionId:'lc-1',sort:'oldest'}});return <output>{window.d.currentAssets.length}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<SWRProvider><Scene/></SWRProvider>),unmount:()=>root.unmount()};`,
    {
      'next/navigation':
        "export const useRouter=()=>({replace(){}});export const usePathname=()=>'/app/library';export const useSearchParams=()=>new URLSearchParams();",
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any,
    requests: string[] = [];
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token' } } });
  const full = {
    ...row(7),
    kind: 'audio',
    assetId: 'ma-7',
    sourceOutputId: 'output-7',
    jobId: 'job-7',
    readAccessOwnerId: 'A',
    readAccessRef: { type: 'asset', assetId: 'ma-7', kind: 'audio' },
    readAccessRevision: 'ra-7',
    accessUrl: 'https://private.invalid/7?grant',
    thumbnailAccessUrl: 'https://private.invalid/thumb?grant',
    isSaved: false,
  };
  w.fetch = async (url: string) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => ({
        ok: true,
        assets: [full],
        totalCount: 137,
        hasMore: false,
        nextCursor: null,
      }),
    };
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for (let i = 0; i < 80 && !w.d.currentAssets.length; i++)
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/browse\?/);
    assert.match(requests[0], /kind=all/);
    assert.match(requests[0], /favorite=true/);
    assert.match(requests[0], /collectionId=lc-1/);
    assert.match(requests[0], /sort=oldest/);
    assert.equal(w.d.totalCount, 137);
    assert.equal(w.d.currentAssets[0].sourceOutputId, 'output-7');
    assert.equal(w.d.currentAssets[0].readAccessRevision, 'ra-7');
    assert.equal(w.d.currentAssets[0].libraryRef.assetId, 'ma-7');
    assert.equal(w.d.currentAssets[0].url, row(7).url);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('actual manual bulk owner keeps cumulative confirmed results and retries only failures through favorite/collection/trash/restore', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLibraryManagementSelection}from'./components/library/useLibraryManagementSelection';function Scene(){window.s=useLibraryManagementSelection({userId:'A',scope:{view:'all',kind:'all',sort:'recent'},assets:window.assets});return <output>{window.s.count}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.assets = Array.from({ length: 600 }, (_, i) => row(i));
  const calls: any[] = [];
  let failed = true;
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token' } } });
  w.fetch = async (url: string, init: RequestInit) => {
    assert.equal(url, '/api/media-library/organization');
    assert.equal(init.method, 'POST');
    const request = JSON.parse(init.body as string);
    calls.push(request);
    const results = request.references.map((reference: any) => ({
      reference,
      key: reference.assetId.replace('ma-', 'key-'),
      status: failed && reference.assetId === 'ma-503' ? 'failed' : 'succeeded',
      error: 'SOURCE_UNAVAILABLE',
    }));
    return {
      ok: true,
      json: async () => ({
        ok: true,
        results,
        succeededCount: results.filter((r: any) => r.status === 'succeeded').length,
        failedCount: results.filter((r: any) => r.status === 'failed').length,
        affectedCount: results.length,
      }),
    };
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.s.selectLoaded());
    assert.equal(w.s.count, 600);
    await w.fx.act(async () => w.s.run('favorite'));
    assert.equal(w.s.count, 1);
    assert.equal(w.s.outcome.confirmed.length, 599);
    failed = false;
    await w.fx.act(async () => w.s.retry());
    assert.equal(w.s.outcome.confirmed.length, 600);
    assert.equal(w.s.count, 0);
    assert.deepEqual(
      calls.map((c) => c.references.length),
      [500, 100, 1]
    );
    for (const operation of [
      'unfavorite',
      'add-to-collection',
      'remove-from-collection',
      'trash',
      'restore',
    ]) {
      await w.fx.act(async () => w.s.change(new Set(['key-2'])));
      await w.fx.act(async () =>
        w.s.run(operation, operation.includes('collection') ? 'lc-project' : undefined)
      );
      assert.equal(calls.at(-1).operation, operation);
      assert.equal(calls.at(-1).references[0].sourceRevision, 'rev-2');
      if (operation.includes('collection')) assert.equal(calls.at(-1).collectionId, 'lc-project');
      assert.equal(w.s.count, 0);
    }
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('compact keyboard selection uses loaded range and Enter previews without changing checkbox membership', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act,useState}from'react';import{createRoot}from'react-dom/client';import{CompactMediaGrid}from'./components/library/CompactMediaGrid.client';function Scene(){const[keys,setKeys]=useState(new Set());window.keys=keys;return <CompactMediaGrid userId="A" assets={window.assets} selectedKeys={keys} onSelectionChange={setKeys} onOpen={a=>window.opened.push(a)} density={128} locale="en" virtualized={false}/>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {}
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.assets = [row(1), row(2), row(3)];
  w.opened = [];
  w.CSS = { escape: (s: string) => s };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    const rows = [...w.document.querySelectorAll('[role=row]')];
    assert.equal(rows.length, 3);
    const press = async (target: any, key: string, shiftKey = false) =>
      w.fx.act(async () => {
        target.focus();
        target.dispatchEvent(new w.KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
        target.dispatchEvent(new w.KeyboardEvent('keyup', { key, shiftKey, bubbles: true }));
      });
    await press(rows[0], ' ');
    assert.deepEqual([...w.keys], ['key-1']);
    await press(rows[2], ' ', true);
    assert.deepEqual([...w.keys], ['key-1', 'key-2', 'key-3']);
    assert.equal(w.opened.length, 0);
    await press(rows[2], 'Enter');
    assert.equal(w.opened.length, 1);
    assert.equal(w.opened[0].id, 'row-3');
    assert.deepEqual([...w.keys], ['key-1', 'key-2', 'key-3']);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('actual manual owner retirement stops chunk two, returns confirmed A outcomes and leaves B selection empty', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLibraryManagementSelection}from'./components/library/useLibraryManagementSelection';function Scene(){window.s=useLibraryManagementSelection({userId:window.owner,scope:window.scope,assets:window.assets});return <output>{window.s.count}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  Object.assign(w, {
    owner: 'A',
    scope: { view: 'all', kind: 'all', sort: 'recent' },
    assets: Array.from({ length: 600 }, (_, i) => row(i)),
  });
  let resolve: any;
  const pending = new Promise((r) => (resolve = r)),
    calls: any[] = [];
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token-' + w.owner } },
  });
  w.fetch = async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    return pending;
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.s.selectLoaded());
    let operation: any;
    await w.fx.act(async () => {
      operation = w.s.run('trash');
    });
    assert.equal(calls.length, 1);
    await w.fx.act(async () => {
      w.owner = 'B';
      w.fx.render();
    });
    assert.equal(w.s.count, 0);
    let result: any;
    await w.fx.act(async () => {
      resolve({
        ok: true,
        json: async () => ({
          ok: true,
          results: calls[0].references.map((reference: any) => ({
            reference,
            status: 'succeeded',
          })),
          succeededCount: 500,
          failedCount: 0,
          affectedCount: 500,
        }),
      });
      result = await operation;
    });
    assert.equal(calls.length, 1);
    assert.equal(result.confirmed.length, 500);
    assert.equal(result.unattempted.length, 100);
    assert.equal(w.s.count, 0);
    assert.equal(w.s.outcome, null);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('expired/global over-cap selections require explicit reselection and never process a silent subset', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{useLibraryManagementSelection}from'./components/library/useLibraryManagementSelection';function Scene(){window.s=useLibraryManagementSelection({userId:'A',scope:{view:'all',kind:'all',sort:'recent'},assets:window.assets});return <output>{window.s.count}</output>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};`,
    {
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.assets = [row(1), row(2), row(3)];
  let phase = 'expired',
    mutations = 0;
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token' } } });
  w.fetch = async (url: string) => {
    if (url.endsWith('/organization')) {
      mutations++;
      throw Error('must not process');
    }
    return {
      ok: phase !== 'cap',
      json: async () =>
        phase === 'cap'
          ? { ok: false, error: 'SELECTION_LIMIT' }
          : {
              ok: true,
              snapshot: {
                id: 'ls-' + phase,
                keys: phase === 'fresh' ? ['key-2', 'key-3'] : ['key-1', 'key-2'],
                totalCount: 2,
                expiresAt: phase === 'expired' ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
              },
            },
    };
  };
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.s.selectAllResults());
    await w.fx.act(async () => w.s.run('trash'));
    assert.equal(mutations, 0);
    assert.equal(w.s.error, 'SNAPSHOT_EXPIRED');
    assert.equal(w.s.count, 2);
    phase = 'cap';
    await w.fx.act(async () => w.s.selectAllResults());
    assert.equal(w.s.error, 'SELECTION_LIMIT');
    assert.equal(w.s.selection.snapshot.id, 'ls-expired');
    phase = 'fresh';
    await w.fx.act(async () => w.s.selectAllResults());
    assert.equal(w.s.error, null);
    assert.deepEqual([...w.s.keys], ['key-2', 'key-3']);
    await w.fx.act(async () => w.s.run('trash'));
    assert.equal(w.s.globalUnconfirmedCount, 2);
    assert.equal(w.s.globalOutcome, null);
    assert.equal(w.s.count, 2);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

test('real All page saves the exact second output and refreshes Saved without closing its retained inspector', async () => {
  const bundle = await bundleClientFlow(
    `import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRProvider}from'./components/swr/SWRProvider';import{LibraryPageClient}from'./app/(core)/(workspace)/app/library/_components/LibraryPageClient';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<SWRProvider><LibraryPageClient/></SWRProvider>),unmount:()=>root.unmount()};`,
    {
      '@/components/HeaderBar': 'export const HeaderBar=()=>null;',
      '@/components/AppSidebar': 'export const AppSidebar=()=>null;',
      '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:{id:"A"},loading:false});',
      '@/lib/i18n/I18nProvider':
        'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});',
      'next/navigation':
        "export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({replace(){},push(){}});export const usePathname=()=>'/app/library';",
      '@/lib/supabaseClientLoader':
        'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});',
    }
  );
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.ResizeObserver = class {
    cb: any;
    constructor(cb: any) {
      this.cb = cb;
    }
    observe(target: any) {
      Promise.resolve().then(() =>
        this.cb([
          {
            target,
            contentRect: { width: 900, height: 600 },
            borderBoxSize: [{ inlineSize: 900, blockSize: 600 }],
          },
        ])
      );
    }
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperties(w.HTMLElement.prototype, {
    clientWidth: {
      get() {
        return 900;
      },
    },
    clientHeight: {
      get() {
        return 600;
      },
    },
    offsetWidth: {
      get() {
        return 900;
      },
    },
    offsetHeight: {
      get() {
        return 600;
      },
    },
  });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 900,
    height: 600,
    top: 0,
    left: 0,
    right: 900,
    bottom: 600,
  });
  w.HTMLElement.prototype.getClientRects = function () {
    return [this.getBoundingClientRect()];
  };
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token' } } });
  let saved = false,
    trashed = false;
  const writes: any[] = [];
  w.fetch = async (url: string, init: RequestInit = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body as string);
      writes.push({ url, ...body });
      if (url.endsWith('/organization')) {
        trashed = true;
        return {
          ok: true,
          json: async () => ({
            ok: true,
            results: body.references.map((reference: any) => ({ reference, status: 'succeeded' })),
            succeededCount: 1,
            failedCount: 0,
            affectedCount: 1,
          }),
        };
      }
      saved = true;
      return { ok: true, json: async () => ({ ok: true }) };
    }
    const assets = [1, 2]
      .map((n) => ({
        ...row(n),
        id: 'output:out-' + n,
        name: 'sibling-' + n,
        jobId: 'job-real',
        sourceOutputId: 'out-' + n,
        source: 'saved_job_output',
        isSaved: n === 2 && saved,
        libraryRef: { type: 'job-output', jobId: 'job-real', outputId: 'out-' + n, kind: 'image' },
      }))
      .filter((a) => !trashed || a.sourceOutputId !== 'out-2');
    return {
      ok: true,
      json: async () =>
        url.includes('/collections')
          ? { ok: true, items: [], nextCursor: null, hasMore: false }
          : { ok: true, assets, totalCount: 2, nextCursor: null, hasMore: false },
    };
  };
  w.eval(bundle);
  const settle = async (p: () => boolean, label: string) => {
    for (let i = 0; i < 100 && !p(); i++)
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.ok(p(), label);
  };
  try {
    await w.fx.act(async () => w.fx.render());
    await settle(
      () => Boolean(w.document.querySelector('[aria-label="Preview sibling-2"]')),
      'second real output'
    );
    await w.fx.act(async () =>
      w.document.querySelector('[aria-label="Preview sibling-2"]').click()
    );
    const save = [...w.document.querySelectorAll('[role=dialog] button')].find(
      (b: any) => b.textContent === 'Save to Media'
    );
    assert.ok(save);
    await w.fx.act(async () => save.click());
    assert.deepEqual(writes, [
      { url: '/api/media-library/save-output', jobId: 'job-real', outputId: 'out-2' },
    ]);
    await settle(
      () => Boolean(w.document.querySelector('[role=dialog] button[aria-label="Saved"]')),
      'retained inspector receives confirmed Saved projection'
    );
    assert.equal(w.document.querySelector('[role=dialog] h2')?.textContent, 'sibling-2');
    const trash = [...w.document.querySelectorAll('[role=dialog] button')].find(
      (b: any) => b.textContent === 'Trash'
    );
    assert.ok(trash);
    await w.fx.act(async () => trash.click());
    assert.equal(writes[1].url, '/api/media-library/organization');
    assert.equal(writes[1].operation, 'trash');
    assert.deepEqual(writes[1].references, [
      {
        type: 'job-output',
        jobId: 'job-real',
        outputId: 'out-2',
        kind: 'image',
        sourceRevision: 'rev-2',
      },
    ]);
    assert.equal(w.document.querySelector('[role=dialog]'), null);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    dom.window.close();
  }
});

// Real compact browser/grid/inspector/mutation owner; only external SDK and HTTP are controlled.
const viewerLifecycleBundle = bundleClientFlow(
  `
import React,{act}from'react';import{createRoot}from'react-dom/client';
import{CompactLibraryBrowser}from'./components/library/CompactLibraryBrowser.client';
import{libraryCacheRevision}from'./hooks/useLibraryCacheRevision';
function Scene(){return <CompactLibraryBrowser locale="en" layout="page" title="Media" assetType="all" assets={window.assets} isLoading={window.loading} management={{userId:window.owner,scope:window.scope,onScopeChange:patch=>{window.scope={...window.scope,...patch};window.fx.render()},totalCount:2}} source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<Scene/>),revision:owner=>libraryCacheRevision(owner),unmount:()=>root.unmount()};
`,
  {
    '@/lib/supabaseClientLoader':
      'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});',
  }
);
async function viewerLifecycleFixture(trashed = false) {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  const assets = [
    { ...row(1), name: 'item-1' },
    { ...row(2), name: 'item-2' },
  ];
  Object.assign(w, {
    owner: 'A',
    scope: { view: 'all', kind: 'all', sort: 'recent', ...(trashed ? { trash: true } : {}) },
    assets,
    loading: false,
  });
  w.ResizeObserver = class {
    cb: any;
    constructor(cb: any) {
      this.cb = cb;
    }
    observe(target: any) {
      Promise.resolve().then(() =>
        this.cb([
          {
            target,
            contentRect: { width: 900, height: 600 },
            borderBoxSize: [{ inlineSize: 900, blockSize: 600 }],
          },
        ])
      );
    }
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperties(w.HTMLElement.prototype, {
    clientWidth: {
      get() {
        return 900;
      },
    },
    clientHeight: {
      get() {
        return 600;
      },
    },
    offsetWidth: {
      get() {
        return 900;
      },
    },
    offsetHeight: {
      get() {
        return 600;
      },
    },
  });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 900,
    height: 600,
    top: 0,
    left: 0,
    right: 900,
    bottom: 600,
  });
  w.HTMLElement.prototype.getClientRects = function () {
    return [this.getBoundingClientRect()];
  };
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token-' + w.owner } },
  });
  const requests: { body: any; owner: string | null; resolve: (value: any) => void }[] = [];
  w.fetch = async (url: string, init: RequestInit = {}) => {
    if (url === '/api/media-library/organization')
      return new Promise((resolve) =>
        requests.push({
          body: JSON.parse(init.body as string),
          owner: new Headers(init.headers).get('Authorization'),
          resolve,
        })
      );
    return {
      ok: true,
      json: async () => ({ ok: true, items: [], nextCursor: null, hasMore: false }),
    };
  };
  w.eval(await viewerLifecycleBundle);
  await w.fx.act(async () => w.fx.render());
  const title = () => w.document.querySelector('[role=dialog] h2')?.textContent ?? null;
  const open = async (n: number) => {
    const button = w.document.querySelector(`[aria-label="Preview item-${n}"]`);
    assert.ok(button, 'real visible preview');
    await w.fx.act(async () => button.click());
  };
  const mutate = async (queuedPreview?: number) => {
    const button = [...w.document.querySelectorAll('[role=dialog] button')].find(
      (b: any) => b.textContent === (trashed ? 'Restore' : 'Trash')
    );
    assert.ok(button, 'real inspector management action');
    const close = w.document.querySelector('[role=dialog] button[aria-label="Close"]');
    const preview = queuedPreview
      ? w.document.querySelector(`[aria-label="Preview item-${queuedPreview}"]`)
      : null;
    // Exercise a queued preview intent before the pending-disabled render commits.
    await w.fx.act(async () => {
      button.click();
      if (preview) {
        close.click();
        preview.click();
      }
    });
    assert.equal(requests.length, 1);
  };
  const resolve = async () => {
    const request = requests[0];
    await w.fx.act(async () =>
      request.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          results: request.body.references.map((reference: any) => ({
            reference,
            status: 'succeeded',
          })),
          succeededCount: 1,
          failedCount: 0,
          affectedCount: 1,
        }),
      })
    );
  };
  return {
    w,
    assets,
    requests,
    title,
    open,
    mutate,
    resolve,
    render: async () => w.fx.act(async () => w.fx.render()),
    close: async () => {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}

test('actual compact inspector permanently retires A→B→A filters while retaining sort and same-scope replacement', async () => {
  const f = await viewerLifecycleFixture();
  try {
    await f.open(1);
    assert.equal(f.title(), 'item-1');
    f.w.scope = { ...f.w.scope, sort: 'oldest' };
    await f.render();
    assert.equal(f.title(), 'item-1', 'sort retains exact opened source');
    f.w.loading = true;
    f.w.assets = [];
    await f.render();
    assert.equal(f.title(), 'item-1', 'replacement loading retains exact opened source');
    f.w.loading = false;
    f.w.assets = f.assets;
    await f.render();
    assert.equal(f.title(), 'item-1', 'settled same-scope replacement retains viewer');
    f.w.scope = { ...f.w.scope, q: 'B' };
    await f.render();
    assert.equal(f.title(), null);
    f.w.scope = { ...f.w.scope, q: undefined };
    await f.render();
    assert.equal(f.title(), null, 'returning to retired A cannot reopen its old inspector');
    await f.open(2);
    assert.equal(f.title(), 'item-2', 'new explicit preview still opens');
  } finally {
    await f.close();
  }
});

for (const operation of ['trash', 'restore'] as const)
  for (const transition of ['filter', 'same-context', 'same-source-reopen', 'owner'] as const)
    test(`late ${operation} cannot close a newer ${transition} inspector and still publishes the initiating account`, async () => {
      const f = await viewerLifecycleFixture(operation === 'restore');
      try {
        const next = transition === 'same-source-reopen' ? 1 : 2;
        const queued = transition === 'same-context' || transition === 'same-source-reopen';
        await f.open(1);
        await f.mutate(queued ? next : undefined);
        assert.equal(f.requests[0].body.operation, operation);
        assert.equal(f.requests[0].owner, 'Bearer token-A');
        if (transition === 'filter') {
          f.w.scope = { ...f.w.scope, q: 'B' };
          await f.render();
        } else if (transition === 'owner') {
          f.w.owner = 'B';
          await f.render();
        }
        if (!queued) await f.open(next);
        assert.equal(f.title(), 'item-' + next, 'new preview intent opens before old response');
        await f.resolve();
        assert.equal(
          f.title(),
          'item-' + next,
          'old confirmed operation cannot close the new inspector'
        );
        assert.equal(f.w.fx.revision('A'), 1, 'confirmed initiating-owner write still publishes');
        assert.equal(f.w.fx.revision('B'), 0, 'late A result never publishes into B');
      } finally {
        await f.close();
      }
    });

for (const operation of ['trash', 'restore'] as const)
  test(`confirmed ${operation} still closes its own initiating inspector`, async () => {
    const f = await viewerLifecycleFixture(operation === 'restore');
    try {
      await f.open(1);
      await f.mutate();
      await f.resolve();
      assert.equal(f.title(), null);
      assert.equal(f.w.fx.revision('A'), 1);
    } finally {
      await f.close();
    }
  });
