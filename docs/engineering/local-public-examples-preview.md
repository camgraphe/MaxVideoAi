# Isolated public examples for local marketing review

The redesign preview can use an ignored, local snapshot of the anonymous public examples API. It needs no database connection, production credential, authentication cookie or media download. The existing public CDN serves playback and images normally. The importer only sends GET requests to `https://maxvideoai.com/api/examples`; it never calls the video detail API (whose normal route initializes schema).

## Refresh

From the repository root:

```sh
pnpm --prefix frontend exec tsx --tsconfig tsconfig.scripts.json scripts/snapshot-public-examples.ts
```

The script captures the hub and all public model-family feeds, projects only card fields and writes `frontend/.local-review/public-examples.json` atomically. Media URLs must be stable public CDN URLs or known local static assets. No private owner, credentials or settings are imported. Restart the preview after refreshing to clear the in-process snapshot cache.

## Start this isolated review

Run with **no DATABASE_URL**:

```sh
MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=redesign-local-anon-key \
pnpm --prefix frontend dev --port 3008 --hostname localhost
```

This source requires `NODE_ENV=development`, the explicit flag, no database URL and no Vercel runtime. It is disabled in production builds, production servers and hosted previews. No production data access configuration is changed. The root `.gitignore` excludes the snapshot. Do not copy production environment files into this review to activate it.

## Ownership

- `scripts/snapshot-public-examples.ts`: bounded anonymous capture, public-media validation, deduplication, atomic output.
- `server/local-public-examples-data.ts`: explicit activation predicate, card projection, filtering/order/pagination.
- `server/local-public-examples.ts`: server-only local file reader, runtime guard and cache.
- `server/videos.ts`: the existing family/hub page functions choose the snapshot only when enabled.
- `app/api/examples/route.ts`: existing card projection and locale links remain in use; local snapshot responses use `no-store`.
- `server/video-seo.ts`: captured IDs can open a local watch page without touching editorial tables. These local watch pages are not selected/indexable SEO pages. Production selection and metadata behavior retain their normal path.

## Fidelity and limits

2026-09-14 capture: 297 unique public examples; hub 169, Veo 31, Kling 53, Seedance 49. Family feeds overlap: counts must not be summed as unique videos.

Public API pagination reports `hasMore=false` at a full first hub batch even when later offsets contain more records. The importer therefore probes the next offset after a full batch and deduplicates IDs. The hub's date-sorted feed omitted six IDs present in its playlist feed; these are preserved at the end of the local date ordering, not assigned fabricated dates. Ordering is suitable for visual review, not a chronology audit.

Original video, preview and poster URLs, prompts, duration, aspect and audio flags are retained. Exact USD labels are converted to cents; missing/unsupported currency labels remain unknown. Creation dates, private references and input settings are absent from public cards and are not invented. Date-less watch details omit the date rather than throwing. Watch explanatory copy still uses the existing derived signals; it is not a replacement for a full settings snapshot.

This enables gallery layout, filters, pagination, public prompts and playback review. It does not connect generation, authentication, billing, admin operations, private assets or every other database-backed marketing section. Full end-to-end app testing needs an isolated database/environment.

## Checks

29 focused tests cover local gating, data projection, family isolation, ordering/pagination, missing dates, existing gallery and watch architecture. Browser review verifies the Veo gallery and its watch page; API checks verify non-overlapping pages, true totals and family separation. Run TypeScript, focused lint and `git diff --check` when changing the adapter.

### Model detail review

The same local guard now covers `getPublicVideosByIds` and model `examples-<slug>` playlist reads. Model review selects captured cards by exact `engineIconId`, not family membership; it does not claim to reproduce production playlist ordering. Missing models retain their regular empty/fallback state. The pure selector in `local-public-examples-data.ts` is tested for sibling isolation and missing media. No production reader behavior or published asset is changed.
