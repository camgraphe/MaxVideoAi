# Marketing media release prerequisites — 2026-10-23

## Scope

This record qualifies migration 78 on real Neon branches for candidate
`523b885c1ca763b034d58663b5b26fafe53b854a` / PR #500.
**No Vercel public-reader pilot is established by this record.**
The earlier real-copy/local-browser evidence remains in
[marketing-copy-readiness-2026-10-23.md](marketing-copy-readiness-2026-10-23.md).

No production mutation, feature-flag activation, storage copy, customer media
change, public placement change, generation or charge was performed by this
qualification. Existing local untracked work was preserved.

## Exact database targets

All targets use project `shy-flower-71253790`, database `neondb`.

| Purpose | Branch | Result |
| --- | --- | --- |
| Production, read-only | `br-late-term-aeo22xpz` | Marketing table absent at inspection; no writes |
| PR preview | `br-dark-fire-aehleuxb`, `preview/codex/marketing-media` | Exact migration applied after isolated qualification |
| Isolated qualification | `br-blue-cherry-aepnf349`, `qualification/pr500-marketing-media-20261023` | Exact migration applied twice; guard checks passed |

The qualification child was created from the PR preview at parent LSN
`2/60BCA1B8`, 2026-10-23 14:49:45 UTC. It runs PostgreSQL
`17.11 (11592b3)`, has a 0.25 CU compute with a five-minute suspend setting,
and expires **2026-10-30 15:00 UTC**. It is not a deployment database.

The preview and production initially both lacked `public.marketing_media`;
all four placement tables existed. A production smoke job created at
2026-10-23 14:38:35.168 UTC was absent from the preview branch. That check
exposed a preview database-binding concern. Preview configuration correction
and deployed binding verification are handled separately by the release owner;
no browser isolation claim follows from this SQL check alone.

## Migration and data preservation

Qualified file: `neon/migrations/78_marketing_media.sql`.

SHA-256: `7ea0f0e22d6da3ab60ac3cd44012adf72b027eac81000d0e1d885e35bf67e46a`.

The exact file succeeded twice on the isolated branch. It then succeeded once
on the preview branch in one transaction, with `search_path=public`,
a two-second lock timeout, a 30-second statement timeout, and transaction
advisory lock `maxvideoai:marketing-media:migration-78`.

Both branches finished with:

- `public.marketing_media` present and empty.
- Three table indexes, including the primary and unique constraints.
- No foreign keys from the independent publication table to personal data.
- One placement-guard function and four enabled INSERT/UPDATE guards on
  `playlist_items`, `homepage_sections`, `playlist_curations` and
  `video_seo_pages`.

Counts and order-independent hashes of every complete row matched before and
after on all eight inspected tables, on both branches:

| Table | Rows |
| --- | ---: |
| app_jobs | 9,767 |
| job_outputs | 7,786 |
| media_assets | 6,745 |
| user_assets | 10,856 |
| playlist_items | 808 |
| homepage_sections | 4 |
| playlist_curations | 21 |
| video_seo_pages | 108 |

The native Neon schema-diff endpoint returned HTTP 413 (schema too large).
A bounded catalog comparison instead checked public relation, column,
constraint, index, function, trigger and view definitions: 2,728 original
objects, 2,762 candidate objects, exactly 34 marketing additions, **zero
removed or modified existing definitions**. Those additions are the table,
19 columns, six constraints, three indexes, function and four triggers.

## Placement and reuse checks

On the isolated Neon branch, temporary tables copied the actual five table
definitions with their defaults and constraints. They used the installed
public guard function and synthetic IDs only, then disappeared at commit.
No existing publication or placement row was updated.

- Twenty stale INSERT/UPDATE attempts for deleting/deleted tombstones returned
  the expected `23514` error across playlist membership, homepage selection,
  curation order/opening slots and editorial publication.
- Twelve unpromoted, ready, and never-ready-cleanup placements were accepted.
- Editorial records for retired identities could still be inserted or updated
  as disabled.

A fresh focused run on disposable local PostgreSQL 17 passed **19 tests,
zero failures, zero skips**:

```bash
node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-concurrency=1 tests/marketing-media-postgres.test.ts tests/marketing-media-management.test.ts tests/marketing-media-public-read.test.ts tests/marketing-media-access.test.ts tests/marketing-media-snapshot.test.ts
```

This covers permission, copy retry/concurrency, source-change rejection,
independence after personal-source removal, exact prompts/settings/nested
references, authored-rendition protection, placement-protected deletion,
tombstones, and exact ready-manifest reference access.

The reuse test retains the existing video ID and playlist membership, full
recreation snapshot in the single-video handoff, dimensions after source
removal, and comparison `from=<same ID>&remix=1&mode=t2v` semantics. Catalog
summaries remain slim. These are application-contract checks, not a deployed
browser assertion.

## Remaining rollout gates

1. The release owner corrected `DATABASE_URL` only for the
   `codex/marketing-media` preview branch. Git preview
   `dpl_CDqtbLSQbFMrCeM59eC2Y35vhFyP` is READY on candidate `523b885c1c`;
   authenticated wallet/history reads agree with the preview branch and
   exclude the production Studio smoke job. Production configuration is unchanged.
2. The release owner added branch-scoped `MARKETING_MEDIA_ENABLED=1` after
   schema qualification. It needs the next Git preview build before the pilot;
   the deployment above began before that flag was added.
3. Exercise one authorized admin-owned copy through the real deployed admin
   path, with source/references retained. Verify public HEAD/GET/Range and
   bytes, permission/error handling and ready-manifest access.
4. Qualify the full public route at mobile and desktop widths: optimized
   poster, no original-video request before Play, first frame, seeking,
   canonical/hreflang/JSON-LD, gallery/watch/Studio links, exact app reuse
   settings and comparison handoff, plus comparable source/copy loading
   evidence. Reuse inspection must not submit a generation.
5. Follow the normal Git/Quality CI/current-main production release policy.
   Apply the same migration explicitly to production before the production
   flag. Verify both production domains against the merged source and
   repeat the bounded pilot checks before broader use.

The schema is additive; do not drop it or purge copy objects as rollback.
Keep personal originals during the pilot so a flag rollback remains possible.
Once a publication outlives its personal source, preserve the projection or
restore that source before disabling the flag.

Local operational evidence, without customer rows or credentials, is retained
under `output/marketing-media/release-qualification-2026-10-23/`:
`neon-qualification.json`, `guard-checks.sql`,
`schema-fingerprint.sql` and `row-fingerprint.sql`.

## Deployed preview pilot — 15:28 UTC

The Git preview for `1cff8c84f3e79fbbae7a8cfc9917ecc84e9dd2fc`
(`dpl_CzRwTgM9tomZbNdcjczXSKVQiUHP`) includes the branch-only database
binding and marketing flag. Its authenticated admin endpoint returned an empty
marketing collection before the pilot, and a production-only Studio job remained
absent. One existing public admin-owned video was copied through the deployed
admin endpoint; no private customer material was published.

- Public identity: `job_external_fal_a956d2dd0c93fc85775b7d6669fc97af3d18d367`.
- Ready copy: `1323abd0-505e-4b9a-b9a9-6028c760b85a`.
- Three files, 6,641,833 total bytes, complete byte/SHA-256 equality with sources.
- Original, poster and preview return HEAD 200, beginning/end Range 206 and
  immutable caching. The optimized poster returns an 11,178-byte JPEG.
- Source job/output/media snapshots and both existing curations are unchanged.
- The complete recipe remains Flux 3 Max, text-to-video, 18 seconds, 720p,
  requested 16:9, audio enabled, 24 fps, seed 2116949648, reasoning `high`,
  iteration 1, full 1,243-character prompt, null negative prompt and no references.
  The measured video geometry is 1280×704 (20:11), unchanged by copying.
- Public API, both filtered example galleries, canonical and watch/app/Studio
  links retain their identities; private provider import data stays excluded.

Actual Chrome checks used desktop 1440×900 and mobile 390×844 viewports.
Before Play the reader remained at `readyState=0`, time zero and `preload=none`.
Both played to the measured 18.041667-second end with 1280×704 decoded frames,
`readyState=4` and no video error. The native seek control remained functional;
the mobile document had no horizontal overflow. Screenshots and the deployment
request evidence are retained outside Git by the release operator. These are
responsive browser and HTTP checks, not physical-device or field Core Web Vitals
certification. Production remains unchanged at this checkpoint.

The real authenticated “Use prompt in app” action on the branch preview also
restored the complete prompt, Flux 3 Max, Generate Video, 18 seconds, 720p,
16:9, audio On and one output. Opening Options confirmed seed `2116949648`
and reasoning `high`. No generation was submitted. The saved reuse screenshot
records these controls alongside the preview wallet and generation form.

