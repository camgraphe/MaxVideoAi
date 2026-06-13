# Studio Library Access Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Studio access to the full signed-in media library without long initial loads, with fast image/video/audio filtering in the project media import flow.

**Architecture:** Keep the first request small, then page through the library with cursor pagination. The server owns deterministic ordering and pagination metadata; the Studio hook owns cache, append, and filter state; the route-local browser component renders filters and a load-more control. Existing node-specific pickers keep their fixed media kind, while the project media picker can switch between all, image, video, and audio.

**Tech Stack:** Next.js App Router route handlers, PostgreSQL via `query`, React client hooks, CSS modules, Node test runner, Playwright editor tests.

---

## Current Audit

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets.ts` hardcodes `limit=60` in `buildWorkspaceUserLibraryUrl`. Studio can only receive one page.
- `frontend/app/api/media-library/assets/route.ts` and `frontend/app/api/media-library/recent-outputs/route.ts` return arrays only. Neither route returns `nextCursor` or `hasMore`.
- `frontend/server/media-library/assets.ts` and `frontend/server/media-library/job-outputs.ts` query `ORDER BY created_at DESC LIMIT $2`, with no cursor condition. The canonical and legacy asset merge is deduped, sorted, then sliced, so pagination must happen after the merged list is normalized.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts` stores a single `assets` array per `kind:source` cache key. It has no append state, no load-more function, and no cache key for a project-media media-kind filter.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx` only filters source tabs and local search over the loaded items. There is no image/video/audio filter for the project media library modal.
- The existing grid in `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/asset-library.module.css` already scrolls internally. Do not load every media item at once; append pages into this scrollable surface.

## File Map

- Create `frontend/server/media-library/pagination.ts`: cursor encode/decode, limit clamp, deterministic page slicing.
- Modify `frontend/server/media-library/assets.ts`: add paginated listing while preserving existing `listLibraryAssets` array API for older routes.
- Modify `frontend/server/media-library/job-outputs.ts`: add paginated recent-output listing while preserving existing `listRecentOutputs` array API.
- Modify `frontend/app/api/media-library/assets/route.ts`: parse `cursor`, return `nextCursor` and `hasMore`.
- Modify `frontend/app/api/media-library/recent-outputs/route.ts`: parse `cursor`, return `nextCursor` and `hasMore`.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets.ts`: add URL pagination options and payload page normalization.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`: add paginated cache, load-more, and project media kind filter.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx`: add optional media kind segmented filter and load-more button.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx`: pass the project-media kind filter and load-more props.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx`: pass load-more props for fixed-kind node pickers.
- Modify `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/asset-library.module.css`: style filter row and load-more footer.
- Modify `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`, `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`: localize media kind filters and load-more states.
- Modify tests:
  - `tests/media-library-contract.test.ts`
  - `tests/maxvideoai-editor-workspace-architecture.test.ts`
  - `tests/e2e/editor/editor-library.spec.ts`

### Task 1: Server Cursor Pagination Contract

**Files:**
- Create: `frontend/server/media-library/pagination.ts`
- Modify: `frontend/server/media-library/assets.ts`
- Modify: `frontend/server/media-library/job-outputs.ts`
- Modify: `frontend/app/api/media-library/assets/route.ts`
- Modify: `frontend/app/api/media-library/recent-outputs/route.ts`
- Test: `tests/media-library-contract.test.ts`

- [ ] **Step 1: Write failing contract tests**

Append these tests to `tests/media-library-contract.test.ts`:

```ts
test('media library routes expose cursor pagination metadata', () => {
  const assetsRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/media-library/assets/route.ts'),
    'utf8'
  );
  const recentRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/media-library/recent-outputs/route.ts'),
    'utf8'
  );

  assert.match(assetsRoute, /cursor:\s*req\.nextUrl\.searchParams\.get\('cursor'\)/);
  assert.match(assetsRoute, /nextCursor:\s*page\.nextCursor/);
  assert.match(assetsRoute, /hasMore:\s*page\.hasMore/);
  assert.match(recentRoute, /cursor:\s*req\.nextUrl\.searchParams\.get\('cursor'\)/);
  assert.match(recentRoute, /nextCursor:\s*page\.nextCursor/);
  assert.match(recentRoute, /hasMore:\s*page\.hasMore/);
});

test('media library server keeps pagination helpers outside route handlers', () => {
  const paginationPath = path.join(process.cwd(), 'frontend/server/media-library/pagination.ts');
  const assetsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/assets.ts'),
    'utf8'
  );
  const jobOutputsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/job-outputs.ts'),
    'utf8'
  );

  assert.ok(fs.existsSync(paginationPath), 'media library pagination helpers should be shared server code');
  assert.match(assetsSource, /export async function listLibraryAssetPage/);
  assert.match(assetsSource, /listLibraryAssetPage\(\{[\s\S]*cursor:/);
  assert.match(assetsSource, /ORDER BY created_at DESC,\s*id DESC/i);
  assert.match(assetsSource, /ORDER BY created_at DESC,\s*asset_id DESC/i);
  assert.match(jobOutputsSource, /export async function listRecentOutputPage/);
  assert.match(jobOutputsSource, /ORDER BY o\.created_at DESC,\s*o\.id DESC/i);
});
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/media-library-contract.test.ts
```

Expected: FAIL because `pagination.ts`, `listLibraryAssetPage`, `listRecentOutputPage`, `nextCursor`, and `hasMore` are not implemented yet.

- [ ] **Step 3: Add shared pagination helpers**

Create `frontend/server/media-library/pagination.ts`:

```ts
export type MediaLibraryCursor = {
  createdAt: string;
  id: string;
};

export type MediaLibraryPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_MEDIA_LIBRARY_LIMIT = 60;
const MAX_MEDIA_LIBRARY_LIMIT = 100;

function normalizeLimit(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

export function resolveMediaLibraryLimit(value: unknown): number {
  const normalized = normalizeLimit(value) ?? DEFAULT_MEDIA_LIBRARY_LIMIT;
  return Math.min(MAX_MEDIA_LIBRARY_LIMIT, Math.max(1, normalized));
}

export function encodeMediaLibraryCursor(cursor: MediaLibraryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeMediaLibraryCursor(value: string | null | undefined): MediaLibraryCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<MediaLibraryCursor>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    if (!Number.isFinite(Date.parse(parsed.createdAt)) || parsed.id.trim().length === 0) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function sliceMediaLibraryPage<T extends { id: string; createdAt?: string | null }>(
  items: T[],
  limit: number
): MediaLibraryPage<T> {
  const sorted = [...items].sort((a, b) => {
    const timeDiff = Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '');
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
  const visibleItems = sorted.slice(0, limit);
  const lastVisibleItem = visibleItems.at(-1) ?? null;
  const hasMore = sorted.length > limit;
  return {
    items: visibleItems,
    hasMore,
    nextCursor: hasMore && lastVisibleItem?.createdAt
      ? encodeMediaLibraryCursor({ createdAt: lastVisibleItem.createdAt, id: lastVisibleItem.id })
      : null,
  };
}
```

- [ ] **Step 4: Add paginated asset listing and keep the existing array API**

In `frontend/server/media-library/assets.ts`, import the helpers:

```ts
import {
  decodeMediaLibraryCursor,
  resolveMediaLibraryLimit,
  sliceMediaLibraryPage,
  type MediaLibraryPage,
} from './pagination';
```

Change the listing signature to add a page API:

```ts
export async function listLibraryAssets(params: {
  userId: string;
  kind?: MediaKind | null;
  source?: string | null;
  originUrl?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<MediaAssetRecord[]> {
  const page = await listLibraryAssetPage(params);
  return page.items;
}

export async function listLibraryAssetPage(params: {
  userId: string;
  kind?: MediaKind | null;
  source?: string | null;
  originUrl?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<MediaLibraryPage<MediaAssetRecord>> {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();
  const limit = resolveMediaLibraryLimit(params.limit);
  const pageLimit = limit + 1;
  const cursor = decodeMediaLibraryCursor(params.cursor);
  const source = params.source && params.source !== 'all' ? normalizeMediaAssetSource(params.source) : null;
  const originUrl = normalizeString(params.originUrl) ?? null;
  const values: unknown[] = [
    params.userId,
    pageLimit,
    params.kind ?? null,
    source,
    originUrl,
    cursor?.createdAt ?? null,
    cursor?.id ?? null,
  ];
```

In the canonical `media_assets` query, add cursor filtering and deterministic ordering:

```sql
        AND (
          $6::timestamptz IS NULL
          OR (created_at, id) < ($6::timestamptz, $7::text)
        )
      ORDER BY created_at DESC, id DESC
      LIMIT $2
```

In the legacy `user_assets` query, add cursor filtering and deterministic ordering:

```sql
        AND (
          $6::timestamptz IS NULL
          OR (created_at, asset_id) < ($6::timestamptz, $7::text)
        )
      ORDER BY created_at DESC, asset_id DESC
      LIMIT $2
```

Replace the final return in `listLibraryAssetPage`:

```ts
  return sliceMediaLibraryPage(assets, limit);
}
```

- [ ] **Step 5: Add paginated recent outputs and keep the existing array API**

In `frontend/server/media-library/job-outputs.ts`, import the helpers:

```ts
import {
  decodeMediaLibraryCursor,
  resolveMediaLibraryLimit,
  sliceMediaLibraryPage,
  type MediaLibraryPage,
} from './pagination';
```

Replace the current `listRecentOutputs` with an array wrapper and a page function:

```ts
export async function listRecentOutputs(params: {
  userId: string;
  kind?: import('../media-library-records').MediaKind | null;
  surface?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<JobOutputRecord[]> {
  const page = await listRecentOutputPage(params);
  return page.items;
}

export async function listRecentOutputPage(params: {
  userId: string;
  kind?: import('../media-library-records').MediaKind | null;
  surface?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<MediaLibraryPage<JobOutputRecord>> {
  await ensureMediaLibrarySchema();
  const limit = resolveMediaLibraryLimit(params.limit);
  const cursor = decodeMediaLibraryCursor(params.cursor);
  const rows = await query<DbJobOutputRow>(
    `SELECT o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.preview_url, o.mime_type,
            o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at,
            saved.id AS saved_asset_id,
            j.prompt AS job_prompt,
            j.duration_sec AS job_duration_sec,
            j.aspect_ratio AS job_aspect_ratio
       FROM job_outputs o
       JOIN app_jobs j ON j.job_id = o.job_id
       LEFT JOIN media_assets saved
         ON saved.user_id = $1
        AND saved.source_output_id = o.id
        AND saved.deleted_at IS NULL
      WHERE o.user_id = $1
        AND j.hidden IS NOT TRUE
        AND o.status = 'ready'
        AND ($3::text IS NULL OR o.kind = $3::text)
        AND ($4::text IS NULL OR j.surface = $4::text OR j.settings_snapshot->>'surface' = $4::text)
        AND ($4::text IS NULL OR $4::text <> 'storyboard' OR o.job_id NOT LIKE 'storyboard_kling_first_frame_%')
        AND (
          $5::timestamptz IS NULL
          OR (o.created_at, o.id) < ($5::timestamptz, $6::text)
        )
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $2`,
    [params.userId, limit + 1, params.kind ?? null, params.surface ?? null, cursor?.createdAt ?? null, cursor?.id ?? null]
  );
  return sliceMediaLibraryPage(rows.map(mapOutputRow), limit);
}
```

- [ ] **Step 6: Return pagination metadata from route handlers**

In `frontend/app/api/media-library/assets/route.ts`, import `listLibraryAssetPage` and replace the page loading block:

```ts
import { deleteLibraryAsset, listLibraryAssetPage, type MediaKind } from '@/server/media-library';
```

```ts
  let page: Awaited<ReturnType<typeof listLibraryAssetPage>>;
  try {
    page = await listLibraryAssetPage({
      userId,
      kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
      source: req.nextUrl.searchParams.get('source'),
      limit: Number(req.nextUrl.searchParams.get('limit') ?? 60),
      cursor: req.nextUrl.searchParams.get('cursor'),
    });
  } catch (error) {
    console.error('[media-library] failed to list assets', error);
    return NextResponse.json({ ok: false, assets: [], error: 'LOAD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    assets: page.items.map((asset) => ({
      id: asset.id,
      url: asset.url,
      thumbUrl: asset.thumbUrl,
      previewUrl: asset.previewUrl,
      mime: asset.mimeType,
      width: asset.width,
      height: asset.height,
      size: asset.sizeBytes,
      kind: asset.kind,
      source: asset.source,
      jobId: asset.sourceJobId,
      sourceOutputId: asset.sourceOutputId,
      createdAt: asset.createdAt,
    })),
  });
```

In `frontend/app/api/media-library/recent-outputs/route.ts`, import `listRecentOutputPage` and use `page.items`:

```ts
import {
  listRecentOutputPage,
  listStoryboardKlingFirstFrameOutputs,
  type JobOutputRecord,
  type MediaKind,
} from '@/server/media-library';
```

```ts
  let page: Awaited<ReturnType<typeof listRecentOutputPage>>;
  const surface = req.nextUrl.searchParams.get('surface');
  try {
    page = await listRecentOutputPage({
      userId,
      kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
      surface,
      limit: Number(req.nextUrl.searchParams.get('limit') ?? 60),
      cursor: req.nextUrl.searchParams.get('cursor'),
    });
  } catch (error) {
    console.error('[media-library] failed to list recent outputs', error);
    return NextResponse.json({ ok: false, outputs: [], error: 'LOAD_FAILED' }, { status: 500 });
  }

  const outputs = page.items;
```

Add `nextCursor` and `hasMore` to the JSON response:

```ts
  return NextResponse.json({
    ok: true,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    outputs: outputs.map((output) => ({
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/media-library-contract.test.ts
```

Expected: PASS.

Commit:

```bash
git add frontend/server/media-library/pagination.ts frontend/server/media-library/assets.ts frontend/server/media-library/job-outputs.ts frontend/app/api/media-library/assets/route.ts frontend/app/api/media-library/recent-outputs/route.ts tests/media-library-contract.test.ts
git commit -m "feat: paginate media library endpoints"
```

### Task 2: Studio Library Request and Payload Helpers

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Write failing helper contract tests**

In `tests/maxvideoai-editor-workspace-architecture.test.ts`, update the existing `buildWorkspaceUserLibraryUrl` assertions to include pagination options:

```ts
  assert.equal(buildWorkspaceUserLibraryUrl('video'), '/api/media-library/assets?limit=60&kind=video');
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'recent'),
    '/api/media-library/recent-outputs?limit=60&kind=video'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('image', 'generated', { cursor: 'cursor_2' }),
    '/api/media-library/assets?limit=60&kind=image&cursor=cursor_2&source=generated'
  );
  assert.equal(buildWorkspaceUserLibraryUrl(null, 'all', { limit: 48 }), '/api/media-library/assets?limit=48');
```

Add a payload metadata source assertion near the same test:

```ts
  assert.match(workspaceLibraryAssetsSource, /export function normalizeWorkspaceUserLibraryPage/);
  assert.match(workspaceLibraryAssetsSource, /nextCursor:\s*typeof record\.nextCursor === 'string'/);
  assert.match(workspaceLibraryAssetsSource, /hasMore:\s*record\.hasMore === true/);
```

- [ ] **Step 2: Run the focused architecture test and confirm it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: FAIL because the helper signature and page normalization do not exist yet.

- [ ] **Step 3: Extend the Studio library URL helper**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets.ts`, add:

```ts
export type WorkspaceLibraryRequestOptions = {
  cursor?: string | null;
  limit?: number;
};

export type WorkspaceUserLibraryPage = {
  assets: WorkspaceLibraryAsset[];
  nextCursor: string | null;
  hasMore: boolean;
};
```

Replace `buildWorkspaceUserLibraryUrl` with:

```ts
export function buildWorkspaceUserLibraryUrl(
  kind: WorkspaceLibraryKind | null,
  source: WorkspaceLibrarySource = 'all',
  options: WorkspaceLibraryRequestOptions = {}
): string {
  const params = new URLSearchParams({ limit: String(options.limit ?? 60) });
  if (kind) params.set('kind', kind);
  if (options.cursor) params.set('cursor', options.cursor);
  if (source === 'recent') return `/api/media-library/recent-outputs?${params.toString()}`;
  if (source !== 'all') params.set('source', source);
  return `/api/media-library/assets?${params.toString()}`;
}
```

- [ ] **Step 4: Add page payload normalization without breaking old callers**

Replace `normalizeWorkspaceUserLibraryPayload` with a page helper plus the old array wrapper:

```ts
export function normalizeWorkspaceUserLibraryPage(
  payload: unknown,
  kind: WorkspaceLibraryKind | null
): WorkspaceUserLibraryPage {
  const record = payload && typeof payload === 'object'
    ? (payload as { assets?: unknown; outputs?: unknown; nextCursor?: unknown; hasMore?: unknown })
    : {};
  const rawItems = Array.isArray(record.assets) ? record.assets : Array.isArray(record.outputs) ? record.outputs : [];
  return {
    assets: rawItems
      .map((item) => workspaceLibraryAssetFromUploadedAsset(item, kind))
      .filter((asset): asset is WorkspaceLibraryAsset => Boolean(asset)),
    nextCursor: typeof record.nextCursor === 'string' && record.nextCursor.length > 0 ? record.nextCursor : null,
    hasMore: record.hasMore === true,
  };
}

export function normalizeWorkspaceUserLibraryPayload(
  payload: unknown,
  kind: WorkspaceLibraryKind | null
): WorkspaceLibraryAsset[] {
  return normalizeWorkspaceUserLibraryPage(payload, kind).assets;
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: PASS.

Commit:

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-library-assets.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: add studio library page helpers"
```

### Task 3: Paginated Studio Hook and Cache

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Write failing hook architecture test**

Add this test to `tests/maxvideoai-editor-workspace-architecture.test.ts`:

```ts
test('studio editor asset library hook owns pagination and project media kind filters', () => {
  const editorAssetLibraryHookSource = fs.readFileSync(editorAssetLibraryHookPath, 'utf8');

  assert.match(editorAssetLibraryHookSource, /type WorkspaceLibraryKindFilter = 'all' \| WorkspaceLibraryKind/);
  assert.match(editorAssetLibraryHookSource, /loadMore/);
  assert.match(editorAssetLibraryHookSource, /isLoadingMore/);
  assert.match(editorAssetLibraryHookSource, /hasMore/);
  assert.match(editorAssetLibraryHookSource, /nextCursor/);
  assert.match(editorAssetLibraryHookSource, /setKindFilter/);
  assert.match(editorAssetLibraryHookSource, /buildWorkspaceUserLibraryUrl\(effectiveLibraryKind, activeSource,\s*\{/);
  assert.match(editorAssetLibraryHookSource, /normalizeWorkspaceUserLibraryPage/);
});
```

- [ ] **Step 2: Run the focused architecture test and confirm it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: FAIL because pagination state is not implemented in the hook.

- [ ] **Step 3: Update imports and cache types**

In `useWorkspaceEditorAssetLibrary.ts`, add imports:

```ts
  normalizeWorkspaceUserLibraryPage,
  type WorkspaceLibraryKind,
  type WorkspaceUserLibraryPage,
```

Replace the cache entry and cache key helpers with:

```ts
type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;

type WorkspaceEditorAssetLibraryCacheEntry = WorkspaceUserLibraryPage & {
  error: string | null;
};

const WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE = new Map<string, WorkspaceEditorAssetLibraryCacheEntry>();

function buildWorkspaceEditorAssetLibraryCacheKey(
  kind: WorkspaceLibraryKind | null,
  source: WorkspaceLibrarySource
): string {
  return `${kind ?? 'all'}:${source}`;
}
```

- [ ] **Step 4: Add kind filter and page state**

Inside `useWorkspaceEditorAssetLibrary`, after `libraryKind`, add:

```ts
  const [kindFilter, setKindFilter] = useState<WorkspaceLibraryKindFilter>('all');
  const effectiveLibraryKind = libraryKind ?? (kindFilter === 'all' ? null : kindFilter);
  const canFilterKind = nodeKind === null;
```

Replace the state declarations:

```ts
  const [userAssets, setUserAssets] = useState<WorkspaceLibraryAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = isEnabled ? buildWorkspaceEditorAssetLibraryCacheKey(effectiveLibraryKind, activeSource) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
```

- [ ] **Step 5: Reset source and kind filter safely**

Keep the source reset effect. Add a second effect:

```ts
  useEffect(() => {
    if (!canFilterKind && kindFilter !== 'all') {
      setKindFilter('all');
    }
  }, [canFilterKind, kindFilter]);
```

- [ ] **Step 6: Replace the single-page loader with page loading**

Inside the hook, define this function before the `useEffect` that loads the library:

```ts
  async function loadPage(mode: 'replace' | 'append', cursor: string | null) {
    if (!requestKey) return;
    const currentRequestKey = requestKey;
    const loadingSetter = mode === 'append' ? setIsLoadingMore : setIsLoading;
    loadingSetter(true);
    setError(null);

    try {
      const response = await authFetch(buildWorkspaceUserLibraryUrl(effectiveLibraryKind, activeSource, { cursor }));
      const status = studioApiSyncStatusFromResponse(response);
      if (status === 'unauthorized') {
        const nextEntry: WorkspaceEditorAssetLibraryCacheEntry = {
          assets: mode === 'append' ? userAssets : [],
          nextCursor: null,
          hasMore: false,
          error: copy.signInToAccessLibrary,
        };
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, nextEntry);
        setUserAssets(nextEntry.assets);
        setNextCursor(null);
        setHasMore(false);
        setError(copy.signInToAccessLibrary);
        setLoadedKey(currentRequestKey);
        return;
      }
      if (status !== 'ready') {
        throw new Error(copy.unableToLoadLibrary);
      }
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) {
        throw new Error(copy.unableToLoadLibrary);
      }
      const page = normalizeWorkspaceUserLibraryPage(payload, effectiveLibraryKind);
      setUserAssets((currentAssets) => {
        const mergedAssets = mode === 'append' ? [...currentAssets, ...page.assets] : page.assets;
        const dedupedAssets = Array.from(new Map(mergedAssets.map((asset) => [asset.id, asset])).values());
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
          assets: dedupedAssets,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          error: null,
        });
        return dedupedAssets;
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setLoadedKey(currentRequestKey);
    } catch {
      const nextError = copy.unableToLoadLibrary;
      if (mode === 'replace') {
        WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.set(currentRequestKey, {
          assets: [],
          nextCursor: null,
          hasMore: false,
          error: nextError,
        });
        setUserAssets([]);
        setNextCursor(null);
        setHasMore(false);
      }
      setError(nextError);
      setLoadedKey(currentRequestKey);
    } finally {
      loadingSetter(false);
    }
  }
```

- [ ] **Step 7: Replace the load effect with cache-aware first-page loading**

Use this effect body:

```ts
  useEffect(() => {
    if (!isEnabled) {
      setUserAssets([]);
      setNextCursor(null);
      setHasMore(false);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      setLoadedKey(null);
      return;
    }

    if (!requestKey) return;
    const cached = WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE.get(requestKey);
    if (cached) {
      setUserAssets(cached.assets);
      setNextCursor(cached.nextCursor);
      setHasMore(cached.hasMore);
      setError(cached.error);
      setLoadedKey(requestKey);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    setUserAssets([]);
    setNextCursor(null);
    setHasMore(false);
    setLoadedKey(null);
    void loadPage('replace', null);
  }, [activeSource, copy.signInToAccessLibrary, copy.unableToLoadLibrary, effectiveLibraryKind, isEnabled, requestKey]);
```

Add the public load-more callback:

```ts
  const loadMore = () => {
    if (!hasMore || isLoading || isLoadingMore || !nextCursor) return;
    void loadPage('append', nextCursor);
  };
```

- [ ] **Step 8: Return pagination and filter props**

Add these fields to the returned object:

```ts
    effectiveLibraryKind,
    kindFilter,
    setKindFilter,
    canFilterKind,
    hasMore,
    isLoadingMore,
    loadMore,
    nextCursor,
```

- [ ] **Step 9: Run tests and commit**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: PASS.

Commit:

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: paginate studio library hook"
```

### Task 4: Media Kind Filter and Load More UI

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/asset-library.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/e2e/editor/editor-library.spec.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Write failing Playwright test for full library paging and kind filter**

Append this test to `tests/e2e/editor/editor-library.spec.ts`:

```ts
test('Project media import pages through the app library and filters by media kind', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const requests: string[] = [];
  const firstPage = Array.from({ length: 4 }, (_, index) => ({
    id: `library-image-${index}`,
    url: `https://cdn.maxvideoai.test/library/image-${index}.png`,
    thumbUrl: transparentPng,
    kind: 'image',
    mime: 'image/png',
    width: 1920,
    height: 1080,
    source: 'upload',
    createdAt: `2026-06-13T12:0${index}:00.000Z`,
  }));
  const secondPage = [{
    id: 'library-video-4',
    url: 'https://cdn.maxvideoai.test/library/video-4.mp4',
    thumbUrl: transparentPng,
    kind: 'video',
    mime: 'video/mp4',
    width: 1920,
    height: 1080,
    source: 'upload',
    createdAt: '2026-06-13T11:59:00.000Z',
  }];

  await page.route('**/api/media-library/assets?**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const kind = url.searchParams.get('kind');
    const cursor = url.searchParams.get('cursor');
    const assets = kind === 'video' ? secondPage : cursor ? secondPage : firstPage;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets,
        nextCursor: !kind && !cursor ? 'cursor-page-2' : null,
        hasMore: !kind && !cursor,
      }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, outputs: [] }) });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Import media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Use image-0.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Load more' }).click();
  await expect(dialog.getByRole('button', { name: 'Use video-4.mp4' })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Video' }).click();
  await expect.poll(() => Promise.resolve(requests.some((search) => search.includes('kind=video')))).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Use video-4.mp4' })).toBeVisible();

  assertNoEditorClientErrors(errors);
});
```

- [ ] **Step 2: Run the Playwright test and confirm it fails**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 PLAYWRIGHT_EDITOR_BASE_URL=http://localhost:3000/app/studio/workspace frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "Project media import pages through the app library"
```

Expected: FAIL because there is no media-kind tab and no load-more button.

- [ ] **Step 3: Add localized copy keys**

In `studio-copy.ts` under `assetLibrary`, add:

```ts
    mediaKindFilters: 'Media type filters',
    mediaKindAll: 'All media',
    mediaKindImage: 'Image',
    mediaKindVideo: 'Video',
    mediaKindAudio: 'Audio',
    loadMore: 'Load more',
    loadingMore: 'Loading more...',
```

In `frontend/messages/en.json`, add the same keys and values under `studio.assetLibrary`.

In `frontend/messages/fr.json`, add:

```json
        "mediaKindFilters": "Filtres par type de media",
        "mediaKindAll": "Tous les medias",
        "mediaKindImage": "Image",
        "mediaKindVideo": "Video",
        "mediaKindAudio": "Audio",
        "loadMore": "Charger plus",
        "loadingMore": "Chargement..."
```

In `frontend/messages/es.json`, add:

```json
        "mediaKindFilters": "Filtros por tipo de medio",
        "mediaKindAll": "Todos los medios",
        "mediaKindImage": "Imagen",
        "mediaKindVideo": "Video",
        "mediaKindAudio": "Audio",
        "loadMore": "Cargar mas",
        "loadingMore": "Cargando..."
```

- [ ] **Step 4: Add optional media kind and paging props to the browser**

In `WorkspaceAssetLibraryBrowser.tsx`, import the kind type:

```ts
  type WorkspaceLibraryKind,
```

Add a local filter type:

```ts
type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;
```

Extend `WorkspaceAssetLibraryBrowserProps`:

```ts
  mediaKindFilter?: WorkspaceLibraryKindFilter;
  onMediaKindFilterChange?: (kind: WorkspaceLibraryKindFilter) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
```

Destructure the new props in the component:

```ts
  mediaKindFilter,
  onMediaKindFilterChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
```

Add this constant before `return`:

```ts
  const mediaKindOptions: Array<{ value: WorkspaceLibraryKindFilter; label: string }> = [
    { value: 'all', label: copy.mediaKindAll },
    { value: 'image', label: copy.mediaKindImage },
    { value: 'video', label: copy.mediaKindVideo },
    { value: 'audio', label: copy.mediaKindAudio },
  ];
```

Render this block above the source filters:

```tsx
      {onMediaKindFilterChange ? (
        <div className={styles.assetBrowserSources} role="tablist" aria-label={copy.mediaKindFilters}>
          {mediaKindOptions.map((option) => {
            const active = mediaKindFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.assetBrowserSourceButton} ${active ? styles.assetBrowserSourceButtonActive : ''}`}
                onClick={() => onMediaKindFilterChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
```

Render this button after the grid:

```tsx
        {hasMore && onLoadMore ? (
          <div className={styles.assetBrowserLoadMore}>
            <button
              type="button"
              className={styles.assetBrowserLoadMoreButton}
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? copy.loadingMore : copy.loadMore}
            </button>
          </div>
        ) : null}
```

- [ ] **Step 5: Wire modal props**

In `WorkspaceProjectMediaLibraryModal.tsx`, pass these props to `WorkspaceAssetLibraryBrowser`:

```tsx
          mediaKindFilter={libraryState.kindFilter}
          onMediaKindFilterChange={libraryState.setKindFilter}
          hasMore={libraryState.hasMore}
          isLoadingMore={libraryState.isLoadingMore}
          onLoadMore={libraryState.loadMore}
```

In `WorkspaceAssetLibraryModal.tsx`, pass fixed-kind paging props:

```tsx
          hasMore={libraryState.hasMore}
          isLoadingMore={libraryState.isLoadingMore}
          onLoadMore={libraryState.loadMore}
```

- [ ] **Step 6: Style the load-more footer**

In `asset-library.module.css`, add `.assetBrowserLoadMoreButton` to the reset selector:

```css
.assetLibraryClose,
.assetLibraryUploadButton,
.assetBrowserCard,
.assetBrowserSourceButton,
.assetBrowserLoadMoreButton {
  border: 0;
  font: inherit;
  color: inherit;
}
```

Add styles:

```css
.assetBrowserLoadMore {
  display: flex;
  justify-content: center;
  padding: 4px 0 2px;
}

.assetBrowserLoadMoreButton {
  min-height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  background: var(--studio-bg-soft);
  color: var(--studio-text-strong);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.assetBrowserLoadMoreButton:hover {
  background: rgba(124, 58, 237, 0.14);
}

.assetBrowserLoadMoreButton:disabled {
  cursor: wait;
  opacity: 0.62;
}
```

- [ ] **Step 7: Add source assertions for UI ownership**

Add this architecture test:

```ts
test('studio asset library browser renders optional media kind filters and load more control', () => {
  const assetLibraryBrowserSource = fs.readFileSync(assetLibraryBrowserPath, 'utf8');
  const projectMediaModalSource = fs.readFileSync(
    join(workspaceDir, '_components/WorkspaceProjectMediaLibraryModal.tsx'),
    'utf8'
  );

  assert.match(assetLibraryBrowserSource, /mediaKindFilter\?:/);
  assert.match(assetLibraryBrowserSource, /copy\.mediaKindFilters/);
  assert.match(assetLibraryBrowserSource, /copy\.loadMore/);
  assert.match(assetLibraryBrowserSource, /copy\.loadingMore/);
  assert.match(projectMediaModalSource, /onMediaKindFilterChange=\{libraryState\.setKindFilter\}/);
});
```

- [ ] **Step 8: Run focused tests and commit**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 PLAYWRIGHT_EDITOR_BASE_URL=http://localhost:3000/app/studio/workspace frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "Project media import pages through the app library"
```

Expected: PASS.

Commit:

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/asset-library.module.css frontend/app/\(core\)/\(workspace\)/app/studio/_lib/studio-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/e2e/editor/editor-library.spec.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: add studio library media filters"
```

### Task 5: Final Verification and Performance Smoke

**Files:**
- Verify only. Modify files only if a command exposes a concrete defect in the implementation above.

- [ ] **Step 1: Run contract tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/media-library-contract.test.ts
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run editor tests**

Run:

```bash
npm run test:editor
```

Expected: PASS.

- [ ] **Step 3: Run typecheck, lint, and diff checks**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Manual browser smoke on Studio**

With the dev server running at `http://localhost:3000`, open:

```text
http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106
```

Manual checks:

- Open Viewer mode.
- Click `Import media`.
- Confirm the first page renders quickly.
- Confirm the project media import modal shows media kind tabs.
- Click `Video`, `Audio`, and `Image`; confirm each filter changes the result set without reloading the whole workspace.
- Click `Load more`; confirm new cards append and existing cards keep their size.
- Confirm no `Impossible de charger votre bibliothèque` alert appears when the API returns 200.

- [ ] **Step 5: Commit verification fixes if needed**

If Step 1 through Step 4 required fixes, commit them:

```bash
git add frontend/server/media-library/pagination.ts frontend/server/media-library/assets.ts frontend/server/media-library/job-outputs.ts frontend/app/api/media-library/assets/route.ts frontend/app/api/media-library/recent-outputs/route.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-library-assets.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/asset-library.module.css frontend/app/\(core\)/\(workspace\)/app/studio/_lib/studio-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/media-library-contract.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts tests/e2e/editor/editor-library.spec.ts
git commit -m "fix: harden studio library pagination"
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: full library access is implemented by cursor paging; fast initial load is preserved by a 60-item default page; image/video/audio filtering is implemented for project media; existing fixed-kind node pickers still work.
- Placeholder scan: no task uses an undefined implementation marker; code snippets include concrete paths, functions, commands, and expected results.
- Type consistency: server `MediaLibraryPage<T>` maps to client `WorkspaceUserLibraryPage`; `nextCursor`, `hasMore`, `loadMore`, and `isLoadingMore` names are consistent across route, hook, modal, and browser.
