# Local verification — 5 October 2026

This records the verified local candidate and the subsequent coordinated site-release preparation. Adrien reviewed the dossier and authorized push/site delivery; the Studio task owns the final merge and production checks. The [base audit](baseline-audit.md) identifies the exact GitHub/main commit served by both public domains. The shared Desktop branch was 254 commits behind that base and was preserved. The production reference is rebuilt from `git archive e50fb575a60b15f0350e3324e045a43f87a39306` in external temporary `/tmp/maxvideoai-ads-baseline-20261005-44fc`; dependencies are linked to this worktree, not copied from Desktop.

## Isolation and reproducibility

Application builds and local servers unset `DATABASE_URL`, `VERCEL` and `VERCEL_ENV`, use a loopback Supabase URL with a dummy public key, and disable Next telemetry. No `.env.local` or production environment was imported. Any PostgreSQL verification uses disposable local fixtures. The authenticated plugin check is separately bounded to [read-only account/catalogue/recovery requests](mcp-readonly-check.md); its private identifiers and media URLs are not retained.

```sh
# Reference: archive the recorded production SHA outside the repository,
# link this worktree's installed dependencies, and build with the same isolated env.
# Run its Next production server on 3019; candidate on 3017.
# Both must use: pnpm --prefix frontend start --hostname localhost --port <port>
ADS_REVIEW_URL=http://localhost:3019 node docs/marketing/ads-readiness-20261005/qa/capture.cjs before
ADS_REVIEW_URL=http://localhost:3017 node docs/marketing/ads-readiness-20261005/qa/capture.cjs after
ADS_REVIEW_URL=http://localhost:3017 node docs/marketing/ads-readiness-20261005/qa/smoke.cjs
ADS_REVIEW_URL=http://localhost:3019 node docs/marketing/ads-readiness-20261005/qa/performance.cjs before
ADS_REVIEW_URL=http://localhost:3017 node docs/marketing/ads-readiness-20261005/qa/performance.cjs after
python3 -m http.server 3018 --bind 127.0.0.1 --directory docs/marketing
```

The reference snapshot stays outside the repository because source audits intentionally walk local files, including ignored directories. The scripts refuse nonlocal application targets. Screenshots and exact rendered copy are in `review/`, including the initial consent state and the normal Reject all display. Hidden FAQ/setup disclosure answers are opened only for text capture, then restored; screenshots preserve the original disclosure state. Image checks distinguish visible critical failures from intentional below-fold lazy scheduling and hidden navigation assets.

The first production fixture launch used `--hostname 127.0.0.1`. Next.js 15.5.25 normalizes that address to `localhost` in its middleware URL but compares rewrite origins against the launch hostname. Spanish public-path rewrites consequently reentered middleware and looped, on both unchanged reference and candidate. Live Spanish Claude returned 200. The identical build launched with `--hostname localhost` returned 200 for the canonical Spanish routes and preserved the single internal-alias→public-path redirect. Final screenshots and browser smoke use this corrected local fixture. The earlier EN loading samples remain valid same-build measurements; their recorded 127.0.0.1 origins are retained. No public routing or canonical policy was changed.

## Build, contracts and static checks

Full frontend lint, exposure guard, locale-key parity and SEO/internal-link/public-media-origin guards passed. Lint has zero errors and the four existing `no-img-element` warnings in Studio conversation media, reference card, lightbox and timeline files. A production build and its registry, Git-provenance, machine-SEO, public-rendition and home-poster prebuild gates passed in the isolated environment. The complete fast validation lane passed on the final analytics-gate application worktree (code commit `93acc947b` plus the tested consent-prop dependency correction in `71c650d04`), including current main `0d16f0248`: 6,840 tests passed, one skipped, zero failed (6,841 total). The final production build generated 932 pages and passed its sitemap postbuild. Focused checks overlap this lane and are not added as unique totals.

Landing checks exercise meaningful failure cases for signup/language/next continuity, safe editable starters, Canvas retirement, named-host proof/publication gating, current Claude setup text, route ownership and localized SEO. The landing agent ran 76 focused tests; a later 27-test check overlaps that set and is not added to it as a new unique total. Measurement behavior, transport and PostgreSQL checks are detailed in [measurement.md](measurement.md), including the defects discovered by an independent read-only review and the final corrections.

`pnpm mcp:client:check` passed: 151 tests passed, one skipped (152 total), followed by passing offline tool-selection evaluation. Real-host metrics in that evaluator remain `not-recorded-for-agent-discovery`; no offline pass is presented as a new real host generation.

## Browser, creative and loading evidence

The eight reference captures returned 200 with no horizontal overflow, visible critical-image failures, page errors or failed tested keyboard disclosures. All 24 final candidate captures on `71c650d04` (12 routes × desktop/mobile) passed the same checks, retained one main region and the exact expected canonical URL, valid JSON-LD and localized alternate links. The existing FAQ disclosure toggles and primary-action keyboard focus passed. Below-fold lazy images remain separately recorded; they are not classified as broken critical images.

The 12 routes also passed at 320px with reduced motion, without overflow, page errors or broken main hash links. Anonymous Studio entry preserved signup mode, language and the exact editable-starter destination in all three locales; each login page rendered its localized account-creation form. These were GET-only checks, with no form submission. All 12 routes appear in their three owned locale sitemaps, each returning 200. The dynamic root sitemap index returns 503 because its video dates require the deliberately absent database; no live index acceptance is claimed. See `review/after.json` and `review/smoke.json`.

All eight creative MP4s were fully decoded and passed codec/dimensions/30fps/duration/caption/faststart checks. The dossier browser opened each from `preload=none`; all eight reached readyState4 and advanced during the first Play, without a page error or mobile horizontal overflow. See [pack QA](pack/qa.json), [dossier QA](review/dossier-qa.json) and [creative provenance and limits](creative.md). Local derived MP4s are ignored by Git; source SVGs/copy/build/sidecars/posters/manifests remain versioned and can rebuild them offline.

Comparable loading samples use production builds, the same machine and browser, three cold/warm browser-cache pairs per route/device, a fresh no-consent context per pair and primed server/optimizer caches. Mobile uses CPU4,150ms latency,200000B/s download; desktop uses CPU1 and no network throttle. Individual samples and critical-request sizes are retained in [before](review/performance-before.json) and [after](review/performance-after.json). Development samples, where retained, are explicitly labelled diagnostic and are not mixed into these comparisons.

Median local LCP in milliseconds (three samples per cell):

| Route / device | Before cold | After cold | Before warm | After warm |
| --- | ---: | ---: | ---: | ---: |
| Studio / desktop | 68 | 64 | 44 | 44 |
| Studio / mobile | 820 | 816 | 236 | 232 |
| Claude / desktop | 76 | 72 | 56 | 56 |
| Claude / mobile | 944 | 860 | 240 | 236 |

CLS was zero in all 48 samples. Studio mobile cold transfer changed from 397,507 to 401,470 bytes; Claude from 440,680 to 421,733 bytes. The stable Studio readings and small desktop variation do not establish a general performance gain. No reproducible loading regression was identified for these two entries. The isolated build lacks Vercel analytics endpoints and a database-backed cookie-policy endpoint; their expected request failures are retained in the raw reports. These controlled samples do not establish real-device field p75 or INP.

## Remaining advertising and field acceptance

- Adrien reviewed the dossier and approved continuing with coordinated site delivery. The additional Studio wording removes beta presentation and obsolete negative export marketing; creative cuts retain their draft labels and paid-reuse limits.
- Clear paid reuse rights and record a fresh Claude Desktop workflow with the same brief, quoted/approved job and recovered result. The current sample, illustrations and August staging capture remain separately labelled.
- Controlled authenticated validation for new-user/password/Google/email-confirmation paths, host OAuth/reconnect/account isolation, consented and denied checkout, webhook replay and GA4 property/debug configuration. No real account creation, external authorization, payment or paid generation was performed here.
- Finish the authoritative first-payer contract across direct card capture and wallet receipts. The new receipt-history flag is narrower; it is not lifetime first-payer certification. GA4 purchase delivery remains best effort, without an outbox/retry guarantee.
- Validate real device/browser behavior and route-level field Core Web Vitals after this Git-backed release. Local LCP/CLS and long-task diagnostics cannot establish field p75 or INP. A reproducible loading regression blocks publication even if functionality passes.
- Select one ad network, its current placement requirements and an enforceable total spend limit. No campaign was created. The authorized site release follows the existing GitHub PR, required Quality CI and Git-backed deployment process; selected integration/browser/exhaustive-financial lanes remain mandatory before merging. A paid pilot requires its own channel and spend authorization.

## Final candidate record

Branch: `codex/ads-readiness-20261005`. Current-main base and both live domains at the clean candidate check: `0d16f0248552a18a3bca52270ce4469d6170b5df`. Final application snapshot: `71c650d04c1cc4491d80ea82af2b320d8de48206`, following the known-admin script gate in `93acc947b` and page-copy snapshot `0903218d5`. This includes the reviewed analytics role lifecycle fixes, public Studio launch copy, current v2 Sol/Luna explanation and all prior landing/measurement changes. The initial local code snapshot was `0ceb416f2`; final captures and loading samples were refreshed from the final application build. Main has no missing commits in this branch.

A fresh `git fetch origin main` and the unmodified `pnpm deployment:check` passed from the clean committed candidate `0903218d5`, before the final known-admin loader fix. Its [recorded output](review/production-alignment.json) reports `aligned`, current main included and the same READY deployment on both domains. That existing CLI redeployment retains validated GitHub/main provenance; it is not a new local upload. A following dossier-only commit records final verification, screenshots and measurements without changing application code. The coordinating Studio task repeats alignment before merge and verifies both domains against the merged revision afterward.

Local acceptance: complete fast lane 6,840 passed/one skipped/zero failures; production build passed; 24 rendered captures, 12 narrow pages, 3 anonymous localized entries and three locale sitemaps passed. All final rendered pages retain exact canonicals, four alternates, valid JSON-LD, one main region and tested keyboard controls; Studio copy has no beta wording. Earlier full media decode and first-Play checks remain valid for the unchanged eight local cuts. Comparable loading samples were refreshed after CPU-heavy checks completed. The review dossier retains its 12 page selectors, seven embedded reports and local source links. The limits above remain explicit, including all-flow first payer and real host/auth/payment acceptance.

Adrien reviewed the dossier and authorized site delivery. PR #389 runs required Quality CI on the latest pushed candidate; the coordinating Studio task owns the merge and production checks. No campaign creation or spend is part of this release.

An intermediate required browser run on `93acc947b` reported a Studio menu `useId` hydration mismatch while its actions passed. The same isolated Chromium test passed on current main `0d16f0248`; candidate reproduction and the latest full required CI remain release gates. No assertion or CI selection was weakened.
