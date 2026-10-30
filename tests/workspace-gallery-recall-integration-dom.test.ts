import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { mockBrowserSession } from './helpers/browser-session-fixture';
import { useGalleryRecallHarness } from './helpers/workspace-gallery-recall-harness';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { groupJobsIntoSummaries } from '../frontend/lib/job-groups';
import { decodeWorkspaceActiveDraft, workspaceActiveDraftKey } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-active-draft';
import { buildRenderGroups, buildPendingGroupSummaries } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-render-groups';
import type { Job } from '../frontend/types/jobs';
import { sanitizePublicRecreationSnapshot } from '../frontend/server/marketing-media/public-recreation';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';

const source = { slotId: 'video_url', kind: 'video', url: 'https://assets.test/source-original.mp4',
  assetId: 'owned-video', durationSec: 7.5, width: 1080, height: 1920, size: 4096, type: 'video/mp4' };
const cases = [
  { label: 'Wan Modify', engineId: 'wan-3', inputMode: 'v2v', core: { durationSec: 5, resolution: '1080p', aspectRatio: '9:16' } },
  { label: 'Wan Extend', engineId: 'wan-3', inputMode: 'extend', core: { durationSec: 8, resolution: '720p', aspectRatio: '9:16' } },
  { label: 'Kling Edit', engineId: 'kling-o3-pro', inputMode: 'v2v', operation: 'kling-edit', core: { resolution: '1080p' } },
  { label: 'H3 Recast', engineId: 'minimax-h3-max', inputMode: 'v2v', operation: 'h3-recast', core: { resolution: '1080P' },
    refs: { inputs: [source, { slotId: 'reference_image_urls', kind: 'image', url: 'https://assets.test/portrait.jpg' }] } },
  { label: 'H3 Relight', engineId: 'minimax-h3-max', inputMode: 'v2v', operation: 'h3-relight', core: { resolution: '768P', aspectRatio: '9:16' },
    refs: { inputs: [source, { slotId: 'reference_image_url', kind: 'image', url: 'https://assets.test/sphere.jpg' }] } },
  { label: 'Flux FAST Edit', engineId: 'flux-3', inputMode: 'v2v', operation: 'flux-fast-edit', core: { resolution: '720p' } },
  { label: 'Flux Draft Enhance', engineId: 'flux-3-draft', inputMode: 'v2v', operation: 'flux-draft-enhance', core: { resolution: '1080p' },
    sourceJobId: 'job_original-draft', sourceOutputId: 'output-draft', refs: { inputs: [] } },
  { label: 'Luma Extend', engineId: 'luma-ray-3-2', inputMode: 'extend', operation: 'luma-extend', core: { durationSec: 5, resolution: '720p' },
    sourceJobId: 'job_original-luma', sourceOutputId: 'output-luma', advanced: { extraInputValues: { extend_direction: 'backward' } }, refs: { inputs: [] } },
] as const;
function snapshot(entry: typeof cases[number] = cases[0], prompt = `${entry.label} complete prompt`) {
  return { schemaVersion: 1, surface: 'video', prompt, refs: { inputs: [source] }, ...entry };
}
function group(id: string, entry: typeof cases[number] = cases[0], includeSnapshot = false) {
  const job: Job = { jobId: id, engineId: entry.engineId, engineLabel: entry.label,
    durationSec: 5, prompt: `${entry.label} tile prompt`, aspectRatio: '16:9',
    videoUrl: 'https://assets.test/result.mp4', createdAt: '2026-10-01T10:00:00Z', status: 'completed', finalPriceCents: 1, currency: 'USD',
    ...(includeSnapshot ? { settingsSnapshot: snapshot(entry) } : {}) };
  return groupJobsIntoSummaries([job], { includeSinglesAsGroups: true }).groups[0];
}
function localRenders(entry: typeof cases[number]) {
  return buildRenderGroups([{ id: 'job_recalled', jobId: 'job_recalled', localKey: 'local-recall', batchId: 'batch-recall',
    engineId: entry.engineId, engineLabel: entry.label, prompt: entry.label + ' tile prompt',
    iterationIndex: 0, iterationCount: 1, durationSec: 5, aspectRatio: '16:9',
    createdAt: '2026-10-01T10:00:00Z', status: 'completed', progress: 100, message: '',
    videoUrl: 'https://assets.test/result.mp4', startedAt: 0, minReadyAt: 0, priceCents: 1,
  }]);
}
async function mount(activeRenderGroups = new Map(), deferImports = false, initialOwner = 'recall-owner', initialFromVideoId: string | null = null, followRoutes = false, initialStorage: Record<string, string> = {}, rememberedJobId: string | null = null) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test/app' });
  for (const [key, value] of Object.entries(initialStorage)) dom.window.sessionStorage.setItem(key, value);
  const requests: { url: string; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  const imports: { init: RequestInit; payload: Record<string, unknown>; resolve: (response: Response) => void }[] = [];
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      if (url === '/api/media-library/ensure') {
        const payload = JSON.parse(init.body as string);
        imports.push({ init, payload, resolve });
        if (!deferImports) resolve(new Response(JSON.stringify({ ok: true, asset: {
          id: `owned-public-${imports.length}`, url: payload.url, durationSec: payload.durationSec,
        } })));
        return;
      }
      assert.match(url, /^\/api\/(?:jobs|videos)\//, 'only synthetic job/public-video detail reads are allowed');
      requests.push({ url, resolve, reject });
    }),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const session = await mockBrowserSession(initialOwner === 'public' ? null : initialOwner);
  let owner: string | null = initialOwner, catalogRevision = 0;
  let fromVideoId = initialFromVideoId;
  const routes: string[] = [];
  const replaceRoute = (href: string) => {
    routes.push(href);
    if (followRoutes) {
      fromVideoId = new URL(href, 'https://fixture.test').searchParams.get('from');
      queueMicrotask(() => render());
    }
  };
  let current!: ReturnType<typeof useGalleryRecallHarness>;
  function Fixture() { current = useGalleryRecallHarness({ owner, catalogRevision, activeRenderGroups, rememberedJobId,
    fromVideoId, searchString: fromVideoId ? `from=${fromVideoId}` : '', replaceRoute }); return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture)));
  await act(async () => render());
  return {
    get current() { return current; }, requests, imports, routes,
    async imported(request: typeof imports[number]) {
      await act(async () => request.resolve(new Response(JSON.stringify({ ok: true, asset: {
        id: 'owned-public-reference', url: request.payload.url, durationSec: request.payload.durationSec,
      } }))));
    },
    async reply(request: typeof requests[number], value: unknown) {
      await act(async () => request.resolve(new Response(JSON.stringify({ ok: true, settingsSnapshot: value }))));
    },
    async publicReply(request: typeof requests[number], entry: typeof cases[number], recipe: unknown) {
      await act(async () => request.resolve(new Response(JSON.stringify({ ok: true, video: {
        id: request.url.split('/').at(-1), engineId: entry.engineId, engineLabel: entry.label,
        prompt: 'Public video summary', durationSec: 5, aspectRatio: '16:9',
        createdAt: '2026-10-01T10:00:00Z', recreationSnapshot: sanitizePublicRecreationSnapshot(recipe),
      } }))));
    },
    async fail(request: typeof requests[number], status: number) {
      await act(async () => request.resolve(new Response(JSON.stringify({ ok: false }), { status })));
    },
    async reject(request: typeof requests[number]) {
      await act(async () => request.reject(new Error('Synthetic detail transport failure')));
    },
    async refreshCatalog() { catalogRevision++; await act(async () => render()); },
    async account(next: string | null) { owner = next; session.setUserId(next === 'public' ? null : next); await act(async () => render()); },
    saved() { return decodeWorkspaceActiveDraft(dom.window.sessionStorage.getItem(workspaceActiveDraftKey(owner ?? 'public')), owner ?? 'public').current?.setup; },
    async close() {
      await act(async () => root.unmount()); await session.restore(); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
function assertRestored(view: Awaited<ReturnType<typeof mount>>, entry: typeof cases[number]) {
  const current = view.current;
  assert.equal(current.form?.engineId, entry.engineId);
  assert.equal(current.composer.submissionMode, entry.inputMode);
  assert.equal(current.form?.operation, 'operation' in entry ? entry.operation : undefined);
  assert.equal(current.form?.resolution, entry.core.resolution);
  if ('durationSec' in entry.core) assert.equal(current.form?.durationSec, entry.core.durationSec);
  if ('aspectRatio' in entry.core) assert.equal(current.form?.aspectRatio, entry.core.aspectRatio);
  if ('sourceJobId' in entry) {
    assert.equal(current.form?.extraInputValues.source_job_id, entry.sourceJobId);
    assert.equal(current.form?.extraInputValues.source_output_id, entry.sourceOutputId);
    assert.equal(Object.values(current.inputAssets).flat().filter(Boolean).length, 0, 'owned generation identity does not become an uploaded clip');
  } else {
    const asset = current.inputAssets.video_url?.[0];
    assert.equal(asset?.url, source.url);
    assert.equal(asset?.durationSec, source.durationSec);
    assert.equal(asset?.width, source.width);
    assert.equal(asset?.height, source.height);
  }
  const request = buildWorkspacePreflightRequest({ ...current, ...current.composer, form: current.form!, selectedEngine: current.composer.selectedEngine! });
  for (const key of ['priceCents', 'finalPriceCents', 'pricingSnapshot']) {
    assert.equal(Object.hasOwn(request, key), false, 'a recalled job must request current pricing from its restored settings');
  }
  assert.equal(request.engine, entry.engineId);
  assert.equal(request.mode, entry.inputMode);
  assert.equal(request.operation, 'operation' in entry ? entry.operation : undefined);
  if ('sourceJobId' in entry) {
    assert.equal(request.sourceJobId, entry.sourceJobId);
    assert.equal(request.sourceOutputId, entry.sourceOutputId);
    assert.deepEqual(request.inputs, []);
  } else {
    assert.equal(request.inputs?.find(input => input.slotId === 'video_url')?.assetId, source.assetId);
  }
  assert.deepEqual(view.saved()?.form, JSON.parse(JSON.stringify(current.form)), 'the active draft records the final reconciled form');
}

for (const sourceKind of ['history', 'active'] as const) for (const entry of cases) for (const action of ['open', 'continue', 'refine'] as const) {
  test(`${sourceKind} ${entry.label} gallery ${action} survives delayed details and catalog/schema reconciliation`, async () => {
    const renders = localRenders(entry);
    const selected = sourceKind === 'active' ? buildPendingGroupSummaries(renders, {})[0] : group('job_recalled', entry);
    const view = await mount(renders);
    try {
      await act(async () => view.current.gallery.handleGalleryGroupAction(selected, action));
      const request = view.requests.at(-1)!;
      assert.equal(request?.url, '/api/jobs/job_recalled');
      await view.reply(request, snapshot(entry));
      assertRestored(view, entry);
      assert.equal(view.current.prompt, `${entry.label} complete prompt${action === 'refine' ? '\n\n// refine here' : ''}`);
      await view.refreshCatalog();
      assertRestored(view, entry);
    } finally { await view.close(); }
  });
}

for (const departure of ['prompt', 'settings', 'mode', 'selection', 'account'] as const) {
  test(`delayed gallery recall cannot overwrite later ${departure}`, async () => {
    const view = await mount();
    try {
      await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old'), 'open'));
      const old = view.requests.at(-1)!;
      if (departure === 'prompt') await act(async () => view.current.setPrompt('My newer prompt'));
      if (departure === 'settings') await act(async () => view.current.composer.handleResolutionChange('1080p'));
      if (departure === 'mode') await act(async () => view.current.composer.handleModeChange(view.current.composer.submissionMode === 'extend' ? 't2v' : 'extend'));
      if (departure === 'account') await view.account('another-owner');
      if (departure === 'selection') {
        await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_new', cases[1]), 'open'));
        await view.reply(view.requests.at(-1)!, snapshot(cases[1]));
      }
      const before = JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets });
      await view.reply(old, snapshot(cases[0], 'Stale response'));
      assert.equal(JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets }), before);
    } finally { await view.close(); }
  });
}

for (const entry of cases) for (const action of ['open', 'continue', 'refine'] as const) test(`${entry.label} gallery ${action} retains the stored snapshot before detail arrives`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_inline', entry, true), action));
    assertRestored(view, entry);
    assert.equal(view.current.prompt, `${entry.label} complete prompt${action === 'refine' ? '\n\n// refine here' : ''}`);
  } finally { await view.close(); }
});

for (const reload of [false, true]) test(`a complete gallery recipe abandons earlier parked sources${reload ? ' across reload' : ''}`, async () => {
  let view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old_source', cases[0], true), 'open'));
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    assert.equal(view.current.inputAssets.video_url, undefined);
    const selected = group('job_new_recipe', cases[0], true);
    selected.hero.job!.settingsSnapshot = {
      schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: 't2v', prompt: 'An independent new recipe',
      core: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' }, refs: { inputs: null, elements: null },
    };
    await act(async () => view.current.gallery.handleGalleryGroupAction(selected, 'open'));
    assert.equal(view.current.prompt, 'An independent new recipe');
    if (reload) {
      const storage: Record<string, string> = {};
      for (let index = 0; index < window.sessionStorage.length; index++) {
        const key = window.sessionStorage.key(index)!;
        storage[key] = window.sessionStorage.getItem(key)!;
      }
      await view.close();
      view = await mount(new Map(), false, 'recall-owner', null, false, storage);
    }
    await act(async () => view.current.composer.handleComposerModeToggle('v2v'));
    assert.equal(view.current.inputAssets.video_url?.[0], undefined, 'the abandoned source must not join the recalled prompt');
    assert.equal(view.current.prompt, 'An independent new recipe');
  } finally { await view.close(); }
});

test('new explicit gallery references survive invalidation of an earlier parked source', async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old_source', cases[0], true), 'open'));
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    const selected = group('job_new_source', cases[0], true);
    selected.hero.job!.settingsSnapshot = {
      ...snapshot(cases[0], 'A recipe using the new source'),
      refs: { inputs: [{ ...source, assetId: 'new-owned-source', url: 'https://assets.test/new-owned-source.mp4' }] },
    };
    await act(async () => view.current.gallery.handleGalleryGroupAction(selected, 'open'));
    assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'new-owned-source');
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    await act(async () => view.current.composer.handleComposerModeToggle('v2v'));
    assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'new-owned-source');
    assert.equal(view.current.prompt, 'A recipe using the new source');
  } finally { await view.close(); }
});

test('a failed parked-source invalidation preserves the prior complete setup', async () => {
  const view = await mount();
  const prototype = Object.getPrototypeOf(window.sessionStorage);
  const removeItem = prototype.removeItem;
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old_source', cases[0], true), 'open'));
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    const before = JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets });
    prototype.removeItem = () => { throw new Error('Synthetic storage refusal'); };
    let applied: boolean | undefined;
    await act(async () => { applied = view.current.settings.applyVideoSettingsSnapshot({
      schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: 't2v', prompt: 'A replacement recipe',
      core: {}, refs: { inputs: null },
    }); });
    assert.equal(applied, false);
    assert.equal(JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets }), before);
  } finally { prototype.removeItem = removeItem; await view.close(); }
});

for (const legacy of [false, true]) test(`${legacy ? 'legacy preview' : 'active draft'} hydration preserves ordinary parked mode history`, async () => {
  let view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_ordinary_source', cases[0], true), 'open'));
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    const storage: Record<string, string> = {};
    for (let index = 0; index < window.sessionStorage.length; index++) {
      const key = window.sessionStorage.key(index)!;
      if (!legacy || key.startsWith('maxvideoai:parked-video-sources:')) storage[key] = window.sessionStorage.getItem(key)!;
    }
    await view.close();
    view = await mount(new Map(), false, 'recall-owner', null, false, storage, legacy ? 'job_legacy_preview' : null);
    if (legacy) {
      const request = view.requests.at(-1)!;
      assert.equal(request?.url, '/api/jobs/job_legacy_preview');
      await act(async () => request.resolve(new Response(JSON.stringify({
        ok: true, videoUrl: 'https://assets.test/legacy-result.mp4', status: 'completed',
        settingsSnapshot: { schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: 't2v',
          prompt: 'The ordinary restored draft', core: {}, refs: { inputs: null } },
      }))));
      assert.equal(view.current.prompt, 'The ordinary restored draft');
    }
    await act(async () => view.current.composer.handleComposerModeToggle('v2v'));
    assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'owned-video');
  } finally { await view.close(); }
});


// Curated feeds expose metadata only. Future inline public recipes must preserve the same source-binding sanitation as public detail.
function curatedGroup(entry: typeof cases[number] = cases[0]) {
  const selected = group('job_curated', entry);
  selected.hero.job!.curated = true;
  return selected;
}
test('a sanitized public Modify recipe imports owned references before a strict current-price request', async () => {
  const view = await mount(new Map(), true);
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
    await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
    assert.equal(view.current.settings.recallPending, true, 'URL-only public inputs are not ready for pricing');
    assert.equal(view.imports.length, 1, 'the selected original reference is saved into this account');
    const imported = view.imports[0];
    assert.equal(imported.payload.url, source.url);
    assert.equal(imported.payload.kind, 'video');
    assert.equal(imported.payload.jobId, null);
    assert.equal(imported.payload.sourceOutputId, null);
    assert.equal(new Headers(imported.init.headers).get('Authorization'), 'Bearer synthetic-token-recall-owner');
    await view.imported(imported);
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'owned-public-reference');
    const request = buildWorkspacePreflightRequest({ ...view.current, ...view.current.composer,
      form: view.current.form!, selectedEngine: view.current.composer.selectedEngine! });
    assert.equal(parsePreflightRequestPayload(request).ok, true, 'the real preflight schema accepts newly owned references');
    assert.equal(JSON.stringify(request).includes('owned-video'), false, 'the creator’s asset identity never returns');
  } finally { await view.close(); }
});
for (const entryPoint of ['gallery', 'shared-from'] as const) {
  test(`guest ${entryPoint} retains its selected public recipe until sign-in and owned-reference import`, async () => {
    const view = await mount(new Map(), true, 'public', entryPoint === 'shared-from' ? 'job_curated' : null);
    try {
      if (entryPoint === 'gallery') await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
      await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
      assert.equal(view.current.settings.recallPending, false, 'login remains usable after the guest request settles');
      assert.equal(view.current.settings.sharedVideoImportPending, false);
      assert.match(view.current.settings.recallError ?? '', /sign in.*current price/i);
      assert.equal(view.imports.length, 0, 'a guest cannot create owned asset identities');
      assert.deepEqual(view.routes, entryPoint === 'gallery' ? ['/app?from=job_curated'] : [], '`from` stays available across sign-in');
      await view.account(null);
      await view.account('signed-in-visitor');
      const request = view.requests.at(-1)!;
      assert.equal(request.url, '/api/videos/job_curated', 'the selected example automatically resumes after authentication');
      await view.publicReply(request, cases[0], snapshot());
      assert.equal(view.current.settings.recallPending, true);
      const imported = view.imports.at(-1)!;
      assert.equal(new Headers(imported.init.headers).get('Authorization'), 'Bearer synthetic-token-signed-in-visitor');
      assert.equal(view.routes.length, entryPoint === 'gallery' ? 1 : 0, 'route intent remains until the complete import commits');
      await view.imported(imported);
      assert.equal(view.current.settings.recallBlocked, false);
      assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'owned-public-reference');
      assert.equal(view.current.form?.mode, 'v2v');
      assert.equal(view.routes.length, 1);
    } finally { await view.close(); }
  });
}
test('guest gallery recall survives the login page unmount and returns through its public from URL', async () => {
  const guest = await mount(new Map(), true, 'public', null, true);
  let returnUrl: string;
  try {
    await act(async () => guest.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
    await guest.publicReply(guest.requests.at(-1)!, cases[0], snapshot());
    returnUrl = guest.routes.at(-1)!;
    assert.equal(returnUrl, '/app?from=job_curated');
    assert.equal(guest.requests.length, 1, 'persisting the selected URL reuses the settled guest detail');
    assert.equal(guest.current.settings.sharedVideoImportPending, false, 'real search-param updates keep the shell and login usable');
  } finally { await guest.close(); }
  const selectedId = new URL(returnUrl, 'https://fixture.test').searchParams.get('from');
  const signedIn = await mount(new Map(), true, 'visitor-after-login', selectedId);
  try {
    await signedIn.publicReply(signedIn.requests.at(-1)!, cases[0], snapshot());
    assert.equal(signedIn.current.settings.recallPending, true);
    await signedIn.imported(signedIn.imports[0]);
    assert.equal(signedIn.current.settings.recallBlocked, false);
    assert.equal(signedIn.current.form?.mode, 'v2v');
    assert.deepEqual(signedIn.routes, ['/app']);
  } finally { await signedIn.close(); }
});
test('a newer guest selection replaces the public identity retained for login', async () => {
  const view = await mount(new Map(), true, 'public', null, true);
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
    await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
    const next = group('job_other', cases[1]);
    next.hero.job!.curated = true;
    await act(async () => view.current.gallery.handleGalleryGroupAction(next, 'open'));
    await view.publicReply(view.requests.at(-1)!, cases[1], snapshot(cases[1]));
    assert.equal(view.routes.at(-1), '/app?from=job_other');
    assert.equal(view.current.settings.sharedVideoImportPending, false);
  } finally { await view.close(); }
});
test('a deliberate guest edit removes the retained public login intent', async () => {
  const view = await mount(new Map(), true, 'public');
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
    await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
    await act(async () => view.current.setPrompt('Use my newer guest draft'));
    assert.equal(view.routes.at(-1), '/app');
    const before = view.requests.length;
    await view.account('visitor');
    assert.equal(view.requests.length, before, 'authentication cannot revive the abandoned example');
  } finally { await view.close(); }
});
for (const departure of ['prompt', 'selection', 'account'] as const) {
  test(`a public reference import cannot overwrite a later ${departure}`, async () => {
    const view = await mount(new Map(), true);
    try {
      await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
      await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
      const imported = view.imports[0];
      assert.equal(view.current.settings.recallPending, true);
      if (departure === 'prompt') await act(async () => view.current.setPrompt('A newer draft wins'));
      if (departure === 'account') await view.account('another-account');
      if (departure === 'selection') {
        await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_new', cases[1]), 'open'));
        await view.reply(view.requests.at(-1)!, snapshot(cases[1]));
      }
      const before = JSON.stringify({ form: view.current.form, prompt: view.current.prompt, assets: view.current.inputAssets });
      await view.imported(imported);
      assert.equal(JSON.stringify({ form: view.current.form, prompt: view.current.prompt, assets: view.current.inputAssets }), before);
      assert.equal(imported.init.signal?.aborted, true, 'obsolete imports are cancelled');
    } finally { await view.close(); }
  });
}
test('a public reference import failure keeps the previous draft and offers source replacement', async () => {
  const view = await mount(new Map(), true);
  try {
    const before = JSON.stringify({ form: view.current.form, prompt: view.current.prompt, assets: view.current.inputAssets });
    await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
    await view.publicReply(view.requests.at(-1)!, cases[0], snapshot());
    await act(async () => view.imports[0].resolve(new Response(JSON.stringify({ ok: false, error: 'URL_UNAVAILABLE' }), { status: 422 })));
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, true);
    assert.match(view.current.settings.recallError ?? '', /replace its media/i);
    assert.equal(JSON.stringify({ form: view.current.form, prompt: view.current.prompt, assets: view.current.inputAssets }), before);
  } finally { await view.close(); }
});
for (const entry of [cases[0], cases[1], cases[2], cases[4], cases[7]]) {
  for (const action of ['open', 'continue', 'refine'] as const) {
    test(`signed-in curated ${entry.label} ${action} reads the public recipe and excludes private source identity`, async () => {
      const view = await mount();
      try {
        await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(entry), action));
        const request = view.requests.at(-1)!;
        assert.equal(request?.url, '/api/videos/job_curated', 'curated jobs are not owned by the signed-in viewer');
        assert.equal(view.requests.some(value => value.url.startsWith('/api/jobs/')), false);
        const recipe = { ...snapshot(entry), sourceJobId: 'private-owner-job', sourceOutputId: 'private-output',
          advanced: { extraInputValues: { source_job_id: 'private-owner-job', source_output_id: 'private-output' } } };
        await view.publicReply(request, entry, recipe);
        assert.equal(view.current.composer.submissionMode, entry.inputMode);
        assert.equal(view.current.form?.engineId, entry.engineId);
        assert.equal(view.current.form?.resolution, entry.core.resolution);
        assert.equal(view.current.form?.operation, 'operation' in entry ? entry.operation : undefined);
        assert.equal(view.current.prompt, `${entry.label} complete prompt${action === 'refine' ? '\n\n// refine here' : ''}`);
        assert.equal(view.current.form?.extraInputValues.source_job_id, undefined);
        assert.equal(view.current.form?.extraInputValues.source_output_id, undefined);
        assert.equal(view.current.inputAssets.video_url?.[0]?.url, 'sourceJobId' in entry ? undefined : source.url);
        assert.equal(JSON.stringify(view.saved()).includes('private-owner-job'), false);
      } finally { await view.close(); }
    });
  }
}
for (const departure of ['prompt', 'settings', 'mode', 'selection', 'account'] as const) {
  test(`delayed curated public recall cannot overwrite later ${departure}`, async () => {
    const view = await mount();
    try {
      await act(async () => view.current.gallery.handleGalleryGroupAction(curatedGroup(), 'open'));
      const old = view.requests.at(-1)!;
      assert.equal(old?.url, '/api/videos/job_curated');
      if (departure === 'prompt') await act(async () => view.current.setPrompt('My newer prompt'));
      if (departure === 'settings') await act(async () => view.current.composer.handleResolutionChange('1080p'));
      if (departure === 'mode') await act(async () => view.current.composer.handleModeChange(view.current.composer.submissionMode === 'extend' ? 't2v' : 'extend'));
      if (departure === 'account') await view.account('another-owner');
      if (departure === 'selection') {
        await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_new', cases[1]), 'open'));
        await view.reply(view.requests.at(-1)!, snapshot(cases[1]));
      }
      const before = JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets });
      await view.publicReply(old, cases[0], snapshot(cases[0], 'Stale public response'));
      assert.equal(JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets }), before);
    } finally { await view.close(); }
  });
}


for (const action of ['open', 'continue', 'refine'] as const) test(`incomplete active ${action} preserves the committed draft until full details commit`, async () => {
  const renders = localRenders(cases[0]);
  const view = await mount(renders);
  try {
    const before = JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets });
    const savedBefore = JSON.stringify(view.saved());
    await act(async () => view.current.gallery.handleGalleryGroupAction(buildPendingGroupSummaries(renders, {})[0], action));
    assert.equal(JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets }), before, 'an incomplete tile cannot replace the committed draft with guessed defaults');
    assert.equal(JSON.stringify(view.saved()), savedBefore, 'reload must retain the prior committed setup while detail is unresolved');
    assert.equal(view.current.settings.recallPending, true);
    assert.equal(view.current.settings.recallBlocked, true);
    assert.equal(view.current.settings.recallError, undefined);
    await view.refreshCatalog();
    assert.equal(view.current.settings.recallPending, true, 'catalog refresh does not resolve the missing recipe');
    await view.reply(view.requests.at(-1)!, snapshot(cases[0]));
    assertRestored(view, cases[0]);
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.settings.recallError, undefined);
  } finally { await view.close(); }
});

for (const failure of ['404', '500', 'transport', 'missing-snapshot', 'invalid-snapshot'] as const) test(`incomplete recall ${failure} keeps generation blocked until a deliberate edit`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_incomplete'), 'open'));
    const request = view.requests.at(-1)!;
    if (failure === 'transport') await view.reject(request);
    else if (failure === 'missing-snapshot') await view.reply(request, undefined);
    else if (failure === 'invalid-snapshot') await view.reply(request, { schemaVersion: 99 });
    else await view.fail(request, Number(failure));
    assert.equal(view.current.settings.recallPending, false, 'the failed recall leaves the composer editable');
    assert.equal(view.current.settings.recallBlocked, true, 'a failed detail read cannot authorize recreation with the previous setup');
    assert.match(view.current.settings.recallError ?? '', /settings/i);
    await view.refreshCatalog();
    assert.equal(view.current.settings.recallBlocked, true, 'an incidental rerender is not consent to use the fallback');
    await act(async () => view.current.setPrompt(view.current.prompt + ' Deliberately revised setup'));
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.settings.recallError, undefined);
  } finally { await view.close(); }
});

test('complete inline recall remains usable when its optional detail enrichment fails', async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_complete', cases[0], true), 'open'));
    assertRestored(view, cases[0]);
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, false);
    await view.fail(view.requests.at(-1)!, 404);
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.settings.recallError, undefined);
  } finally { await view.close(); }
});

for (const outcome of ['success', 'failure'] as const) test(`old recall ${outcome} cannot release the newer selection's loading guard`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old'), 'open'));
    const old = view.requests.at(-1)!;
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_new', cases[1]), 'open'));
    const newer = view.requests.at(-1)!;
    if (outcome === 'success') await view.reply(old, snapshot(cases[0]));
    else await view.fail(old, 404);
    assert.equal(view.current.settings.recallPending, true);
    assert.equal(view.current.settings.recallBlocked, true);
    assert.equal(view.current.settings.recallError, undefined);
    await view.reply(newer, snapshot(cases[1]));
    assertRestored(view, cases[1]);
    assert.equal(view.current.settings.recallBlocked, false);
  } finally { await view.close(); }
});

for (const departure of ['prompt', 'mode', 'account'] as const) test(`newer ${departure} immediately releases only its obsolete recall guard`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old'), 'open'));
    const old = view.requests.at(-1)!;
    if (departure === 'prompt') await act(async () => view.current.setPrompt('My choice'));
    if (departure === 'mode') await act(async () => view.current.composer.handleModeChange(view.current.composer.submissionMode === 'extend' ? 't2v' : 'extend'));
    if (departure === 'account') await view.account('other-owner');
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, false);
    await view.fail(old, 404);
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.settings.recallError, undefined);
  } finally { await view.close(); }
});


test('a detail failure before the immediate tile commit still blocks the resulting setup', async () => {
  const view = await mount();
  try {
    await act(async () => {
      view.current.gallery.handleGalleryGroupAction(group('job_immediate-failure'), 'open');
      while (!view.requests.length) await Promise.resolve();
      view.requests[0].resolve(new Response(JSON.stringify({ ok: false }), { status: 404 }));
    });
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, true);
    assert.match(view.current.settings.recallError ?? '', /settings/i);
  } finally { await view.close(); }
});

for (const settled of [false, true]) test(`${settled ? 'failed' : 'pending'} recall cannot revive after a deliberate edit is undone`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_obsolete'), 'open'));
    const original = view.current.prompt, request = view.requests.at(-1)!;
    if (settled) await view.fail(request, 404);
    await act(async () => view.current.setPrompt('An explicit newer draft'));
    await act(async () => view.current.setPrompt(original));
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.settings.recallBlocked, false);
    if (!settled) {
      await view.reply(request, snapshot(cases[1]));
      assert.equal(view.current.prompt, original);
      assert.equal(view.current.settings.recallBlocked, false);
    }
  } finally { await view.close(); }
});


test('failed incomplete recall preserves the last valid saved draft', async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_valid', cases[0], true), 'open'));
    const savedBefore = JSON.stringify(view.saved());
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_missing', cases[1]), 'open'));
    await view.fail(view.requests.at(-1)!, 404);
    assert.equal(JSON.stringify(view.saved()), savedBefore);
    assertRestored(view, cases[0]);
    assert.equal(view.current.settings.recallBlocked, true);
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_valid-again', cases[0], true), 'open'));
    assert.equal(view.current.settings.recallBlocked, false);
    assert.equal(view.current.settings.recallError, undefined);
  } finally { await view.close(); }
});


test('a newer rejected inline recipe still cancels an older detail request', async () => {
  const view = await mount();
  try {
    const before = JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets });
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_old'), 'open'));
    const old = view.requests.at(-1)!;
    const invalid = group('job_rejected', cases[1]);
    invalid.hero.job!.settingsSnapshot = { schemaVersion: 99 };
    await act(async () => view.current.gallery.handleGalleryGroupAction(invalid, 'open'));
    await view.reply(old, snapshot(cases[0], 'Obsolete older selection'));
    assert.equal(JSON.stringify({ prompt: view.current.prompt, form: view.current.form, assets: view.current.inputAssets }), before);
    assert.equal(view.current.settings.recallPending, false);
  } finally { await view.close(); }
});

for (const [engineId, firstField, lastField] of [
  ['veo-3-1', 'first_frame_url', 'last_frame_url'],
  ['flux-3', 'start_image_url', 'end_image_url'],
  ['gemini-omni-flash', 'image_url', 'end_image_url'],
] as const) test(`${engineId}: gallery two-frame recall and parked Extend sources coexist after catalog refresh`, async () => {
  const view = await mount();
  try {
    await act(async () => view.current.gallery.handleGalleryGroupAction(group('job_two_frames'), 'open'));
    assert.equal(view.current.settings.recallPending, true);
    await view.reply(view.requests.at(-1)!, {
      schemaVersion: 1, surface: 'video', engineId, inputMode: 'fl2v', prompt: 'A continuous shot between both frames',
      core: {}, refs: { inputs: [firstField, lastField].map(slotId => ({
        slotId, kind: 'image', assetId: slotId, url: `https://assets.test/${slotId}.png`,
        width: 1280, height: 720, size: 1024, type: 'image/png',
      })) },
    });
    assert.equal(view.current.settings.recallPending, false);
    assert.equal(view.current.composer.submissionMode, 'fl2v');
    const recalledForm = JSON.parse(JSON.stringify(view.current.form));
    await act(async () => view.current.composer.handleComposerModeToggle('extend'));
    assert.equal(view.current.composer.activeManualMode, 'extend');
    await act(async () => view.current.setInputAssets({ video_url: [{
      id: 'extend-source', assetId: 'extend-source', fieldId: 'video_url', kind: 'video', status: 'ready',
      name: 'Extend source.mp4', type: 'video/mp4', size: 4096, durationSec: 4, width: 1280, height: 720,
      url: 'https://assets.test/extend-original.mp4', previewUrl: 'https://assets.test/extend-original.mp4',
    }] }));
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    await view.refreshCatalog();
    assert.equal(view.current.composer.submissionMode, 'fl2v', JSON.stringify({ form: view.current.form, assets: view.current.inputAssets, activeManualMode: view.current.composer.activeManualMode }));
    assert.equal(view.current.inputAssets[firstField]?.[0]?.assetId, firstField);
    assert.equal(view.current.inputAssets[lastField]?.[0]?.assetId, lastField);
    assert.equal(view.current.inputAssets.video_url, undefined, 'the Extend source never becomes a Create reference');
    for (const field of ['durationSec', 'durationOption', 'resolution', 'aspectRatio', 'audio'] as const) {
      assert.equal(view.current.form?.[field], recalledForm[field]);
    }
    await act(async () => view.current.composer.handleComposerModeToggle('extend'));
    assert.equal(view.current.inputAssets.video_url?.[0]?.assetId, 'extend-source');
    await act(async () => view.current.composer.handleComposerModeToggle(null));
    assert.equal(view.current.composer.submissionMode, 'fl2v');
    assert.equal(view.current.inputAssets[lastField]?.[0]?.assetId, lastField);
  } finally { await view.close(); }
});
