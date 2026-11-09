# Media Library integration — delivery and data contracts

Audit date: 2026-11-09. Branch `codex/media-library-prototype`, source `5135e4e2b7ad04261d26b3f7669eb2ec8aded1db`.
Scope: read-only source audit plus offline tests; no browser/Chrome, live database, storage, provider, install, generation or Git mutation.
Source references below are repository-relative with one-based line numbers. **Fact** = current source/test evidence; **inference** = expected consequence requiring runtime regression coverage; **measurement** = explicitly qualified observation.

## Findings that affect integration

1. **Fact — public identity is lost or misread by some clients.** The assets GET returns internal `id` and canonical public `assetId`/`ref` separately (`frontend/app/api/media-library/assets/route.ts:62`). Internal identities can be `url:<owner>:<kind>:<url>` or `output:<output-id>` (`frontend/server/media-library-records.ts:311`); public IDs match `ma_[a-f0-9]{32}`. Do not change existing DELETE calls to public IDs: that server currently resolves internal `media_assets.id`.
2. **Fact — Creator chooser blocks valid ordinary library rows.** `CreatorSourcePicker.client.tsx:108` validates `asset.id` against the public-ID pattern, although `selectCreatorSource` correctly prefers `asset.assetId` and can also use an explicit job-output identity (`frontend/src/components/tools/creator/creator-source-selection.ts:14`). Its primitive tests pass; they do not mount the chooser with the real API shape.
3. **Fact — page mapping drops canonical fields and timing.** `MediaLibraryAsset` and `AssetBrowserAsset` omit `assetId`, `ref`, and `mediaFacts` from their types; `useLibraryPageData.ts:111` explicitly rebuilds saved rows without those fields or `durationSec`. The Studio action also derives an asset reference from `asset.id` (`frontend/components/library/MediaDestinationActions.client.tsx:76`). **Inference:** uploaded saved rows cannot reliably continue through all canonical-ref tools until this adapter boundary is corrected.
4. **Fact — grants are 300 seconds, without library renewal ownership.** `frontend/server/media-library/read-access.ts:7` signs recognized storage only for `source === 'upload'`; the response carries separate original/thumbnail/preview/playback access fields. There is no expiry timestamp in `MediaReadAccess`, timer, bounded signing refresh or media-error refresh in the library readers. Reader Retry resets local state and reuses the same URL (`MediaActionPanel.client.tsx:57`). **Inference:** new reads/seeks/downloads after expiry can fail; an already-open response may continue. This audit did not simulate a real storage expiry.
5. **Fact — deletion invalidation is local.** `useLibraryAssetMutations.ts:149` invokes only its currently bound saved/recent mutators. Video workspace deletion filters its local array and active references (`useWorkspaceAssetLibrary.ts:205`); image preview deletion refreshes its exact-origin lookup (`useImagePreviewActions.ts:117`). No common owner invalidates every filter/page/picker. **Inference:** another cached source/search/page or mounted picker can show the removed row again; no current test reproduces that cross-reader sequence.
6. **Fact — current DELETE is not a reversible Trash contract.** It soft-deletes the canonical row, physically removes matching unneeded legacy `user_assets` rows, and releases completed MCP final/thumbnail cleanup entries (`frontend/server/media-library/asset-deletion.ts:17`). Subsequent cleanup can remove bytes; PostgreSQL contracts explicitly reject restoring a row after its object was deleted (`tests/mcp-reference-upload-postgres.test.ts:1133`). Do not wire prototype Undo/Restore to this DELETE.
7. **Fact — image inspection chooses the original.** `MediaActionPanel.client.tsx:54` renders the original access URL for images. The current page starts with `selectedId = null` (`AssetLibraryBrowser.tsx:163`), so this occurs on opening the inspector, not on initial page mount. **Unverified historical claim:** a 13 MB early original transfer is not a measurement from this audit. A persistent/auto-selected prototype inspector would change when that original is mounted.

## Existing read and pagination owners

- No `useUserAssets` hook exists in this HEAD. Actual owners are `useLibraryPageData`, `useImageLibraryData`, `usePaginatedMediaLibraryAssets`, and the local-state video workspace `useWorkspaceAssetLibrary`.
- `frontend/lib/media-library-client.ts:35` owns canonical URL construction, key `[url, ownerId]`, and `ownedAuthFetch`. The selecting owner is checked after session lookup; the explicit bearer is dispatched with cookies omitted. The page subtree is account keyed (`LibraryPageClient.tsx:34`). Preserve both checks; a key alone does not prevent a refreshed session authenticating as another account.
- Library saved/review pages request 30 items; keys include kind/source/search/cursor and the review job filter. Page sources are gated by active view, so calling both bound mutators does not establish a refresh of previously visited inactive scopes (`library-page-helpers.ts:230`). Search is capped at 200 characters. Load more uses the returned cursor, not a client offset.
- Library page uses `keepPreviousData: true`, 60s/30s request deduping, `revalidateOnFocus: false`, `shouldRetryOnError: false`, and `revalidateFirstPage: false` (`useLibraryPageData.ts:57`). These intervals are not grant TTL/renewal policies. Image/contextual Infinite hooks use their own config and can retain native focus behavior; do not assume every consumer has the page's focus policy.
- Image generation shares the first saved-page key and fetcher (`useImageLibraryData.ts:18`); Characters remain a separate specialized reader. Angle/Character Builder/Upscale reuse the bounded image hook. Creator/audio/Studio and video workspace still contain manual fetch/local-list paths. Their UI can converge without replacing SWR.
- `GET /api/media-library/assets` authenticates first; returns `private, no-store`; passes `{ ensureSchema: false }` to exact-origin and general listing; fails explicitly on listing/signing failure (`route.ts:19`). Do not introduce DDL, remote media probing or repair writes into this read.
- Exact `originUrl` lookup is bounded canonical-first then legacy fallback (`asset-listing.ts:26`); use it for exact saved-state checks, not a full-library download.
- General listing merges canonical rows and legacy `user_assets`; optional `includeOutputs` is a server capability, not enabled by the current assets GET (`asset-listing.ts:185`). Canonical wins per `(kind, metadata.originUrl || url)`, with source/name compatibility. Sorting is `(created_at DESC, id DESC)`, cursor comparison uses the same pair, and the server requests `limit + 1`; limits clamp to 1–100 (`pagination.ts:25`).
- Filters precede the logical-rank winner; search matches the logical group while retaining its canonical winner. Keep equal-timestamp order, copies/origin deduplication, account/type/source filters and name recovery when adapting the prototype. A global All-types scope, sort options, counts and collections are not existing API parameters.
- `recent-outputs` reads owned ready outputs of nonhidden application jobs, overlays saved-state via live saved rows and returns `ref: {type:'job-output', jobId, outputId, kind}` (`recent-outputs/route.ts:84`, `job-outputs.ts:180`). Deleting a saved copy does not remove its generation from Activity/recent outputs. Hiding history is a distinct job mutation; decide explicit Trash semantics before changing either.
- Legacy `/api/user-assets` is compatibility transport: its GET still uses schema-initializing helper defaults and omits grant/canonical-ref projection (`frontend/app/api/user-assets/route.ts:19`). New integration should use the canonical assets transport; do not broaden the legacy path.

## Delivery, originals and playback

- Durable `url`, `thumbUrl`, `previewUrl`, `playbackVideoUrl` remain separate from ephemeral `accessUrl`, `thumbnailAccessUrl`, `previewAccessUrl`, `playbackAccessUrl`. Server signing is exact-owner storage validation and fails closed; external provider originals pass through (`owned-media-read-access.ts:5`). Canonical tool identity and persisted originals must never become signed display grants.
- `LibraryImageThumbnail.client.tsx:7` uses stored thumbnail grant/URL directly in lazy async `<img>`, never public Next Image optimization; absent/failed image thumbnails fall back to the exact original access URL. Thus missing image thumbs can still load large originals. Video poster callers pass only the poster as the image original, so failure never feeds video bytes into an image.
- Page cards mount no video or audio initially. Modal collection cards mount short video preview only on hover/focus, muted/looped/inline, reduced-motion gated, with `preload="none"`; blur/leave unmount it (`AssetLibraryBrowser.tsx:392`). It has no visibility observer or data-saver gate. `preload="none"` does not prevent playback bytes once `autoPlay` is mounted.
- Reference selection grids render images/posters/placeholders, with no AV reader; selection retains the original asset. Audio collection modal cards do mount native `<audio preload="none">` for every listed row. The inspector mounts audio `preload="none"`; video remains a poster/button until explicit Play, then mounts the original or distinct playback URL with `autoPlay`/`preload="none"` (`MediaActionPanel.client.tsx:36`).
- Asset change keys remount inspector content and closing removes it. There is no explicit `pause`, `removeAttribute('src')`, `load()` or AbortController for these native AV elements. Actual transfer cancellation/decoder release is unmeasured; preserve explicit cleanup ownership when the virtualized prototype viewer is integrated.
- `/api/download` authenticates, streams the exact submitted original including its signed query, applies bounded safe HTTPS transport, and cancels upstream on disconnect. It does not mint a fresh grant (`docs/engineering/media-delivery.md:55`, `frontend/server/media-download.ts:7`). Original-download fidelity must remain separate from display optimization.
- Gallery handoff maps the selected member's original, including its own image index; it does not use the poster (`gallery-media-assets.ts:5`). For `source:'gallery'`, `resolveMediaContinuationOriginal` rechecks the owned exact job output by URL/kind/ready state and preserves the selected original (`frontend/lib/video-continuation.ts:37`). Never synthesize an output index or fall back to the group's first member.
- `stageMediaHandoff` stores the whole asset, account/destination/random token and timestamp in sessionStorage, bounded to 32 KB and 10 minutes; consumption is single-use and scope checked (`frontend/lib/media-handoff.ts:24`). `useMediaHandoff` hides retired scopes during render and handles StrictMode replay. **Inference:** a staged upload object can carry its 5-minute grants into a still-valid 10-minute handoff; resolve access again at destination, retain canonical identity only in persistent handoffs.
- Import lifecycle is stronger than deletion/save: `useLibraryAssetMutations` aborts replacement/import/account/unmount work, rechecks owner/session after decoding and session lookup, and ignores late completion. Preserve it for queued imports; cancellation cannot undo a server-accepted upload. Delete/save handlers currently use ambient `authFetch` and have no equivalent owner/operation guard around the mutation and subsequent cache work.

## Integration architecture to preserve

1. Keep route/page orchestration and the account-keyed boundary. Put the compact grid/viewer/picker under shared library UI; retain route-local controllers for URL/view and destination-specific field acceptance. An adapter should carry internal row key, canonical public `assetId`/`ref`, exact job/output provenance, kind, measured facts, canonical sources and transient access independently. Preserve `durationSec` without relabeling requested duration as probe evidence.
2. Extend existing shared SWR key/fetch/page owners incrementally. Share a media query contract across library, image/contextual pickers and eventually manual readers. Do not add TanStack Query/Zustand/a second server-data cache. Explicitly design All-types pagination rather than merging three truncated first pages and claiming global order/search.
3. Give saved mutations one owner-scoped fanout contract: update/remove the exact asset from every cached filter/page, saved-state lookup and recent-output projection; prevent late pre-delete responses from reinserting it; retire active selection/viewer/references deliberately; revalidate affected scopes on success and handle rollback/error. SWR Infinite aggregate entries need their own bound mutators or `unstable_serialize` keys: generic filtered `mutate` alone does not refresh those aggregates. Manual lists must join this owner or subscribe to explicit scoped invalidation.
4. Give private read access one owner-scoped, single-flight renewal owner. Existing bounded exact-origin GET can renew a saved row; a focused canonical-ref access endpoint would be a new server contract. Return expiry, refresh near expiry/on a bounded media-access failure, fence owner/ref changes and stop when hidden/unmounted. Replace only transient access and avoid resetting an actively playing reader unnecessarily. Signing failure remains an unavailable state.
5. Preserve poster geometry and delayed AV mounting; mount a display-sized image for ordinary inspection and load the original only on explicit exact inspection/download if the new product flow adopts that policy. This requires real derivative availability, owned grants and a measured comparison; do not replace selected/downloaded originals with thumbnails. Keep public/signed namespaces out of optimizer shortcuts.

## New backend contracts required by prototype features

- **Trash/restore:** no customer list-trash/restore/purge API or guaranteed retention window exists. A real Trash needs owned visibility state/listing, retention/cleanup holds, atomic idempotent restore with storage-fence validation, an explicit permanent-deletion policy and propagation into search/pickers/public readers. Current `deleted_at` alone provides none of those guarantees. Re-saving can clear `deleted_at` through `ensureReusableAsset` (`assets.ts:279`), subject to existing fences; that is not a customer restore guarantee.
- **Collections/favorites:** no library collection/membership/favorite schema or API found. Prototype arrays/sets are session-only. Add owned metadata/membership tables and Neon migrations, validated CRUD/list/filter contracts, stable references and uniqueness/foreign-owner checks. Do not reuse public example playlists or unrelated Studio collections without a reviewed ownership contract.
- **Bulk operations:** no library bulk mutation endpoint found. A server bulk contract must bound item count, validate ownership per exact item, define atomic versus partial results/idempotency and concurrency, and feed the same invalidation owner. A local loop over current DELETE would still have irreversible cleanup semantics and partial failures.
- **Counts/sorting/All types:** define server scope and cursor shape first. Current `hasMore` is not a total count; current source filters are not a collection system. Preserve read-only migrated-table GETs and keep initialization in explicit migration/mutation owners.

## Existing verification and actual result

**Measurement:** the following offline command completed with **64 passed, 0 failed, 0 skipped** in about 3.13 seconds. Tests use controlled network/auth/storage boundaries or source contracts/JSDOM; no live DB/provider/browser was used. This is correctness evidence, not transfer/latency/Core Web Vitals evidence.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/library-private-read-access.test.ts tests/library-private-read-dom.test.ts \
  tests/library-owner-cache.test.ts tests/library-stored-thumbnail-dom.test.ts \
  tests/library-performance-contract.test.ts tests/media-library-contract.test.ts \
  tests/creator-source-selection.test.ts tests/media-handoff-lifecycle-dom.test.ts \
  tests/workspace-library-page-architecture.test.ts \
  tests/image-media-library-convergence-contract.test.ts tests/asset-library-modal-architecture.test.ts
```

Reusable adjacent tests (not executed in this audit):

| Tests | Actual boundary |
| --- | --- |
| `library-import-account`, `owned-auth-fetch`, `secondary-media-readers`, `workspace-assets` | Import/read owner changes, stale responses, bounded contextual pages, stored thumbnails and unchanged selection originals. |
| `library-private-read-access`, `owned-media-read-access` | Real temporary signatures with storage/network doubles; exact-owner denial, canonical preservation and signing failure. No expiry recovery scenario. |
| `media-library-pagination-postgres`, `audio-library-duration-postgres` | Real SQL: equal timestamps/cursors, type/source/search/account isolation, canonical/legacy dedupe/name recovery, measured duration projection. |
| `library-read-routes-postgres` | Actual recent-output and character-reference GETs through read-only PG17, no request DDL, hidden/foreign filters and missing-schema failure. It does not execute the canonical assets GET. |
| `mcp-reference-upload-postgres`, `mcp-reference-upload-migration` | Transactional delete/projection release, object fences, cleanup races, restore after deletion rejection and valid reupload/restore. |
| `download-route-security`, `media-handoff-lifecycle-dom`, `creator-context-handoff-dom` | Signed-original streaming/cancellation, account/token destination scope, exact owned tool continuation without paid preparation. |

Focused additional offline command:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/library-import-account.test.ts tests/owned-auth-fetch.test.ts \
  tests/secondary-media-readers.test.ts tests/workspace-assets.test.ts \
  tests/owned-media-read-access.test.ts tests/download-route-security.test.ts \
  tests/creator-context-handoff-dom.test.ts tests/mcp-reference-upload-migration.test.ts
```

Deferred disposable PG17 command (writes fixtures only; intentionally not run under this audit's no-DB-write scope):

```sh
node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/media-library-pagination-postgres.test.ts tests/library-read-routes-postgres.test.ts \
  tests/audio-library-duration-postgres.test.ts tests/mcp-reference-upload-postgres.test.ts
```

Minimal meaningful new regressions before integration:

1. Mount the actual Creator picker with `{id:'url:...', assetId:'ma_...', ref, kind, url}` from the route; choose and confirm it; verify exact public ref/original. Exercise the page adapter → tool/Studio handoff too. The current selection helper test bypasses the broken button gate and adapter.
2. Mount two real SWR consumers with saved all/upload/search and multiple pages; delete through one, switch all visited scopes, return from another route and resolve an older pending list response. Assert the row never reappears, recent saved-state updates, unrelated owners/items remain intact and rejected deletion restores truthful UI. Include a manual picker until migrated.
3. Use controlled time and a signing fixture: expire private thumbnail/original, start playback/download, return a single renewed grant, reject a foreign owner/changed selection, and ensure one bounded retry with no canonical rewrite or retry storm. Cover the 10-minute handoff after a 5-minute grant has expired.
4. Exercise grid/viewer/picker mounts and navigation with real media lifecycle stubs: zero AV readers before intent, one selected reader, zero neighbor preload, pause/source release on close/change, stale load/error suppression, original selection and exact download. Add real browser network qualification later; DOM absence alone does not measure bytes.
5. If Trash/collections/bulk ship, add disposable PG17 lifecycle tests for foreign-owner denial, retries/partial results, membership retention, cleanup holds and restore/purge races before UI claims persistence or recoverability. Extend canonical assets GET execution coverage to verify real SQL account isolation and no-DDL behavior rather than only source text.

## Performance evidence still required

No current browser request counts, byte sizes, seek behavior, decode memory, thumbnail hit rate, TTFB/LCP/INP/CLS or mobile comparison was measured. Preserve original evidence separately from these source conclusions. Later compare the same committed baseline/candidate, account/data snapshot, viewport/DPR, network/cache warmth and cold/warm runtime; include first library load, paged scroll, image inspection, explicit AV Play/seek, expired access recovery, closing/changing reader and post-delete navigation. Do not infer speed from virtualization, fewer DOM nodes, `preload="none"`, or passing contract tests.
