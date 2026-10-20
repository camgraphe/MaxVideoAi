# Homepage mobile LCP follow-up — 19 October 2026

Follow-up to the [SEO and performance review](home-seo-performance-review-2026-10-19.md).
The previous measurements remain intact. This document tracks the requested
correction and subsequent integration of PR465; it is not a deployment receipt.

**Post-PR465 validation is complete locally:** see the
[integration and revalidation report](home-post465-revalidation-2026-10-19.md)
for exact main `af20823d2`, fresh builds, SEO/render checks and paired performance
results. The earlier measurements below remain evidence against main `1ed5e5b82`.

## Causal diagnosis

Replayed the saved Lighthouse 12.6.1 trace and DevTools log through its installed
Lantern FCP/LCP computed metrics. The critical graph waits for the complete HTML
document before the dependent stylesheets. In mobile HTTP/2 pair 3, the original
candidate transfers 75,307 document bytes versus main's 72,740. The simulated
document finishes at 1,207 ms versus 1,069 ms. Its dependent CSS completes later;
there is no corresponding long CPU task explaining the FCP difference.

The installed TCP simulator advances downloads in congestion-window/RTT steps.
An explicitly counterfactual replay, changing only a copied log's document
transfer size by -1,000 bytes, changes simulated FCP from 1,657 to 1,357 ms and
LCP from 2,857 to 2,557 ms. Original traces, logs and reported measurements were
not changed. This isolates sensitivity to payload size; it is **not a measured
improvement** and does not replace a fresh production-build comparison.

Local diagnostic artifacts:

- `.reports/home-visual-refresh/explain-lantern.mjs`
- `.reports/home-visual-refresh/lantern-explanation/`
- `.reports/home-visual-refresh/lantern-transfer-sensitivity.mjs` and `.log`

## Bounded correction

Application commit `fcc904f57` projects only the engine fields needed by the
homepage's inert text-to-video price demonstration. It no longer serializes
the full input schema, other modes' UI capabilities, supplier metadata or catalog
pricing. The full entry remains on the server for exact price calculation; the
current public pricing reader keeps its ownership. Shared workspace components,
controls, selected settings, translations and visible content remain unchanged.

The focused regression test fails on the previous implementation, then passes
with exact control parity, an unchanged shared catalog and a bounded serialization
budget. The existing price tests retain exact EN/FR/ES quotes. The real browser
surface passes all 36 locale/width/scenario combinations; streaming and critical
poster/deferred-section contracts pass as well.

## Measured correction against main 1ed5e5b82

Full production build passed (932 pages, type checking and the existing prebuild
registry/SEO/media/poster gates). Six pre-existing Studio/billing lint warnings
remain. The production candidate is `fcc904f57`; reference remains the exact
`1ed5e5b82` archive. Same services, environment, Chrome 147 and Lighthouse 12.6.1
as the original audit; three pairs alternate baseline/candidate order per series.
No media, styles, JavaScript or analytics requests were blocked.

| Mobile simulated LCP | Main runs (ms) | Corrected runs (ms) | Median delta |
| --- | --- | --- | --- |
| HTTP/2 streaming proxy | 2569.2 / 2557.1 / 2554.0 | 2561.1 / 2556.5 / 2557.2 | +0.1 ms |
| Direct local HTTP/1.1 | 3592.6 / 3593.1 / 3596.5 | 3595.4 / 3594.1 / 3593.8 | +1.0 ms |

The prior reproducible +297 ms / +157 ms differences are absent after the bounded
payload correction. Both series now overlap baseline variability. This establishes
resolution of that **local simulated regression**, not a field CWV or ranking gain.

- Candidate performance scores: 97/97/97 in HTTP/2; 89/89/89 in HTTP/1.1.
- Candidate accessibility and SEO scores: 100 on every run; CLS 0 throughout.
- Best Practices remains 96 on both versions with the same local analytics 404.
- The first HTTP/2 baseline emitted a browser-cache reset timeout. Its fresh
  profile's DevTools log contains zero actual cache hits, like every other run.
  Its higher TBT and warning remain in the series; no run was removed. All other
  runs have no Lighthouse warning and none has a runtime error.
- HTML body falls from 326,695 to 319,686 bytes (same English route). Measured
  corrected HTTP/2 document transfers are 73,520 / 73,526 / 73,484 bytes, below
  the original candidate's 75,307-byte diagnostic trace. These are distinct from
  whole-body compression estimates and do not assert that every RTT threshold
  is eliminated for every network setting.

Raw evidence is retained in `.reports/home-visual-refresh/audit-price-projection-http2/`
and `audit-price-projection-http1/`, including flags, manifests, full reports,
traces, DevTools logs and `cache-document-check.json`. Build and focused test logs
share the `audit-price-projection-` prefix.

The renewed HTML audit against main passes all three locales: 200, one H1,
self-canonical, four hreflang alternatives, unchanged five JSON-LD documents and
matching visible FAQs. The intended French description correction is preserved.
Robots, sitemap URL sets and localized redirects match; all seven added link
destinations respond successfully or use the expected Studio redirect. Evidence:
`.reports/home-visual-refresh/audit-price-projection-seo/results.json`.

## Direct Chrome measurements after correction

Fresh Chrome 147 measurements use actual CDP network/CPU throttling and browser
PerformanceObserver entries. There is no Lantern simulation in these numbers.
Three alternating pairs per device and cache condition give 24 measured visits,
plus the priming visits for warm cache. Mobile: 390 × 844, CPU 4×, 1.6 Mbps,
150 ms latency. Desktop: 1440 × 1000, CPU 1×, 10 Mbps, 40 ms latency. Each visit
observes six seconds after load, then exercises comparison disclosure, the three
price steps and the creation section. No requests are mocked or blocked.

| Direct LCP | Main runs (ms) | Corrected runs (ms) | Main / corrected median |
| --- | --- | --- | --- |
| Mobile cold | 992 / 956 / 972 | 920 / 916 / 920 | 972 / 920 ms |
| Desktop cold | 196 / 196 / 200 | 192 / 196 / 188 | 196 / 192 ms |
| Mobile warm | 240 / 228 / 236 | 224 / 220 / 232 | 236 / 224 ms |
| Desktop warm | 76 / 68 / 72 | 76 / 64 / 68 | 72 / 68 ms |

No measured regression appears. These local laboratory results do not establish
production field CWV gains. Candidate CLS is zero initially and after the tested
interactions on every run. Main's initial CLS is also zero, with very small
post-interaction shifts up to 0.00065. No JavaScript page errors or horizontal
overflow occur. Maximum recorded candidate interaction event duration is 48 ms
on mobile and 32 ms on desktop; these bounded interactions are **not field INP**.

Cold initial median transferred bytes: main/candidate 406,900/406,634 on mobile,
6,014,147/5,672,888 on desktop. Mobile sends zero media requests initially; desktop
sends one. Warm reloads reuse 42 same-origin resources on mobile and 44/43 on
desktop, with zero transfer for these cached resources. Warm document/background
transfer remains approximately 75–76 KB; no new video transfer occurs on reload.

Raw observations, screenshots, exact source/settings manifests and summaries:
`.reports/home-visual-refresh/audit-price-projection-cold/` and
`audit-price-projection-warm/`. Reproduction scripts are
`measure-price-projection-cold.cjs`, `measure-price-projection-warm.cjs` and
`summarize-projection.py` in the same reports parent directory.

## Integration state

The delivery owner supplied the PR465 receipt for main `af20823d2`, confirmed on
both public domains. That exact main is integrated locally and the renewed checks
are recorded in the post-PR465 report above. No push, PR, production merge or
deployment has been performed by this task; remote delivery remains with its owner.

On 19 October, Adrien approved the current homepage preview and explicitly asked
to send it to the existing **livraison pr** task, conditional on passing checks.
The visual-approval condition is therefore satisfied; another approval of the
same preview is not required. The local post-PR465 integration/checks are complete;
publication must still follow the normal isolated-branch → PR → required Quality
CI → main → Vercel Git deployment path. The measurements here
are against `1ed5e5b82`, not evidence of a completed post-PR465 validation.

Handoff source: `codex/home-visual-refresh` in
`/Users/adrienmillot/.codex/worktrees/home-visual-refresh/MaxVideoAi V2`.
Application correction: `fcc904f57`; the later commits only record QA evidence.
Preview: `http://localhost:3100/fr#compare`; main reference: port 3102.
The delivery owner coordinates the integration/checks and publication so the
homepage is not pushed or merged concurrently by both tasks.

The thread heartbeat `revalider-accueil-apr-s-pr465` waited for the exact delivery
receipt before this chat's assigned local revalidation. Pause it after the final
clean-head/evidence receipt is transmitted, so it cannot duplicate the delivery
owner's remaining publication work.
