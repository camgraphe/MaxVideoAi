# Marketing media copy qualification — 2026-10-23

## Scope and delivery state

Corrections to the marketing-copy audit on `codex/marketing-media`, after merging
`origin/main` at `9a7c606e2e444b662c2556e4e9e0848c01d8924e` (local merge
`87ab2a988`). The pre-fix comparison uses `5dc112af09f5b6f47aaabe78b0215a900cda3150`.
No deployment, merge into main, production schema change, feature activation or
public-gallery publication was performed. No push was made, avoiding an automatic
preview deployment. The existing draft PR has not received this local correction yet.

## Corrections

- Authored media protection uses the existing managed-media URL normalization on
  both sides. Configured global/regional S3 aliases cannot bypass the protection
  of a CDN source's prepared renditions. Unrelated buckets remain distinct.
  Originals, public routes and rendition manifests are not rewritten.
- Catalog membership/count/order uses a narrow typed projection keyed by the
  existing video identity. Full media hydration remains limited to the selected
  page, in the same SQL snapshot. Publication records are deserialized once.
  Gallery and direct-playlist summaries omit the full recreation recipe; the
  single-video app handoff and SEO detail retain their dedicated projections.
- Copies and the rendition CLI share bounded HTTP readiness verification.
  Copies require HEAD size/type and exact prefix/suffix bytes delivered through
  206 GETs with valid Content-Range and lengths. The CLI retains its allowed-URL
  and MP4-prefix policy. Failed verification cannot make a publication ready.

Regression tests were observed failing before their fixes: equivalent S3 source
accepted; complete recipe present in gallery/direct-playlist summaries; HEAD
success accepted despite failed GET delivery. They pass after correction.

## Real copy

One existing admin-owned Kling Omni Standard result from the iPhone qualification
was read with its actual settings in a read-only database transaction. Its metadata
was cloned into disposable local PostgreSQL 17. Only that local clone was made
public for exercising the publication readers. The actual storage copy used the
production copy implementation, its signing/transport and immutable storage writer.

Seven files, **30,430,549 bytes total**, were copied into one newly allocated test
namespace: output, poster, short preview, three keyframes and the phone reference.
The output is 3,469,035 bytes; the phone reference accounts for 26,852,432 bytes.
Every copied file passed HEAD/Range validation and a full GET SHA-256 comparison.
No new generation was submitted or charged. The test objects are retained for
review; they have no publication or placement in the production database.

After deleting the personal source and output rows **in the disposable database**,
the independent publication retained its ID, dimensions and playlist order.
Workspace snapshot hydration preserved the exact prompt, core and advanced values,
with references pointing to the independent copies. Historical settings were not
silently rewritten; normal current-capability and fresh-price validation still
applies before a future generation.

## Browser delivery

The real public `ExampleReaderContent`, player, controls, standalone container and
scoped CSS were server-rendered and hydrated in a local harness. The copied and
original media were fetched from their real remote URLs. Posters used the watch
route's shared optimization policy; the existing deployed image optimizer served
those requests without a deployment. Both original and copy keyframe images also
passed optimization.

**16 successful passes:** Chromium at 390×844 and 1440×1000, three source and three
copy runs per viewport in an alternating sequence; WebKit, one source and one copy
run per viewport. Checks covered:

- no original/reference video request before user Play;
- first decoded frame and advancing playback;
- seeking through the actual timeline control;
- 720×1280 output, approximately 6.042 seconds, using the expected original/copy URL;
- identical canonical, app reuse and Studio handoff links and prompt text;
- no failed image response or JavaScript page error.

Chromium used cold browser caches, 40 ms / 1.6 Mbps network emulation on mobile and
20 ms / 10 Mbps on desktop. Medians of three runs:

| Reader metric | Source mobile | Copy mobile | Source desktop | Copy desktop |
| --- | ---: | ---: | ---: | ---: |
| LCP | 456 ms | 452 ms | 120 ms | 128 ms |
| First frame after Play, including click | 1,707 ms | 1,713 ms | 600 ms | 594 ms |
| CLS | 0 | 0 | 0.000151 | 0.000042 |
| Initial transferred bytes | 371,402 | 372,524 | 370,290 | 371,412 |
| Video requests before Play | 0 | 0 | 0 | 0 |

The small initial payload difference is consistent with the longer copied media
URLs in the document. These observations show no material regression in the tested
reader; they do not demonstrate an improvement in production Core Web Vitals.
WebKit checks were functional; its transfer totals were not instrumented.

**Limits:** these are desktop browser engines with mobile viewport/touch emulation,
not physical iPhone/Android tests. The harness contains the actual reader and media
delivery, not the full Next route/site chrome or live pricing. It cannot establish
production page TTFB, field INP, CrUX or Google Search Console outcomes. A deployed
rollout must retain its own domain, full-page and field-performance checks.

## SQL measurements

Same disposable PG17 fixture and machine: 20,000 public videos, 1,000 independent
copies, 4 KiB settings per video, identical 20,000 count and 24 selected IDs.
The real catalog membership query's median fell from **256.87 to 84.70 ms** in the
paired run. These are local synthetic measurements, not production latency.

For 24 selected copied videos, the database JSON projection fell from **114,415 to
14,239 bytes**. Full recreation remains available through the direct detail query.
These are database-to-server bytes, not a claimed 87% reduction of browser payload.

## Validation and evidence

- TypeScript: passed.
- ESLint: no errors; six existing warnings in unrelated files.
- Exposure guard and model registry check: passed.
- Fast validation suite: 8,503 passed, one skipped, zero failed.
- Targeted marketing/catalog/access integration: 52 passed.
- Additional curation, deletion, playback, canonical/sitemap and reuse coverage:
  69 passed. Final direct-playlist/reuse correction: 16 passed.
- Shared HTTP/rendition tests: 27 passed, including oversized/stalled range bodies.
- Local application production build: passed, including its prebuild gates.
- No claim of a new remote Quality CI result: the corrections remain local.

Local evidence is retained under `output/marketing-media/qualification-2026-10-23/`:
`pilot.json`, `browser.json`, the browser screenshots, `catalog-performance.json`,
`projection-performance.log`, and validation logs. Capture and pilot scripts and
the source snapshot are local-only because they reference the owner's real media.
They must not be added to a public repository. Initial harness errors (module
resolution, Next image config, UTF-8 and missing reader container) were corrected
before the successful measurement series; they were not product regressions.

The default-off rollout and rollback constraints in
[`marketing-media.md`](../engineering/marketing-media.md) still apply. In particular,
do not disable the independent-publication projection after removing personal
sources without preserving or restoring the published data.
