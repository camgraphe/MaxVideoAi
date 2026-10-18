# Homepage mobile LCP follow-up — 19 October 2026

Follow-up to the [SEO and performance review](home-seo-performance-review-2026-10-19.md).
The previous measurements remain intact. This document tracks the requested
correction and subsequent integration of PR465; it is not a deployment receipt.

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

## Integration state

PR465 is still in the delivery owner's validation. Its integration receipt,
checks against the resulting main, and renewed browser/network measurements are
pending. Release sign-off remains withheld until these checks are complete. No
push, PR, production merge or deployment has been performed by this task.
