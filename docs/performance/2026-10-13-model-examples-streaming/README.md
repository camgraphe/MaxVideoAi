# Model and examples loading — 2026-10-13

Follow-up to the [homepage release](../2026-10-12-home-pricing-streaming/follow-up.md).
Production PR #431 was merged as `3cf8aae2f4ab0260c8c74a423fc2ccb0d3103b11` and
verified on both production domains before this experiment. That commit is the
baseline for the changes below.

## Dependency and scope

The examples route awaited the canonical batch of current card prices before
emitting its existing gallery. It now prepares the gallery immediately and streams
only server-rendered price labels into the same cards. The four opening cards,
24-card SSR batch, selected sources and single high-priority poster remain intact.
Captions reserve room for localized price wrapping; no historical amount is used
while current quotes are pending or unavailable. The reader still fetches its own
fresh detail price.

Model pages joined gallery/spec reads with the current price projection, then
awaited decision scenarios and their public offer. Video decision pages now emit
their existing hero before those pricing dependencies. Complete exact details,
including price cards, specs, visible offer and native JSON-LD, reveal together.
This avoids individually expanding price grids. A neutral viewport-height pending
block keeps the footer outside the initial viewport.

Image and legacy model pages retain their awaited render. Their variable image
price grids and legacy hero prices need a separate design before streaming can be
extended without changing geometry. No improvement is claimed for those pages.

The direct `#specs` check caught a real intermediate regression: the late section
was present but the browser stayed at the top. A route-local, invisible anchor
restorer watches only the model page and its existing section IDs. It stops after
one restoration, user interaction or navigation; an explicit pending link tolerates
the router's fallback scroll. It does not change history. Final browser checks
passed for a new arrival at `#specs` (target top 139.82 px), `#decision-pricing`
(100.01 px), and a hero link clicked before `#prompting` existed (139.98 px after
reveal). Reloading an already-scrolled document still preserves browser scroll
restoration rather than forcing the hash a second time.

## Measurement protocol

Native Chrome Performance exports use the same private window, Slow 4G preset,
unthrottled CPU, screenshots enabled and browser cache disabled. Both servers are
production Next builds on `localhost`, using the same local environment and live
read-only pricing data. Application/image caches are warmed before the repeated
captures; there is no local Vercel CDN. Do not extrapolate the local TTFB reduction
to an edge HIT or to the traffic distribution.

The baseline build was compiled from `d5dc2bfc9`, whose Git tree is identical to
merged `3cf8aae2f` (`68a8d15e1647e3c8abf0d00fa6e255d0ecc29396`). Separate build
directories and localhost ports keep the candidate isolated. Temporary build
configuration is excluded from the patch. Each recording continues past 30 seconds;
the analysis uses the last LCP candidate and qualifying layout shifts in the first
30 seconds. Main-thread long tasks are diagnostic and are not an INP measurement.

## Final desktop results

Three complete recordings per version and route, with all final-candidate source
hashes checked against the compiled files. The diagnostic candidate trace from
before the anchor fix is excluded. Model baseline run 1 preceded the final rebuild;
later model runs and the gallery runs alternate versions. One gallery baseline
export was lost when DevTools closed; it was repeated after verifying the same
network, CPU and cache settings.

| Route | Baseline LCP median (range) | Candidate LCP median (range) | Median reduction | TTFB median before → after |
| --- | --- | --- | --- | --- |
| `/models/veo-3-1` | 8.795 s (7.247–9.720) | 4.281 s (3.220–4.459) | 51.3% | 5.428 → 1.419 s |
| `/examples` | 4.190 s (4.181–4.190) | 2.948 s (2.786–3.063) | 29.6% | 2.752 → 1.516 s |

The LCP element is the same image URL, decoded byte count and rectangle in every
before/after pair. Its geometry is 1256 × 518 px at (227, 418) on the model and
655 × 368 px at (227, 349) on examples. Candidate CLS is zero in all six recordings.
Baseline model CLS is zero; one baseline gallery run has two caption shifts with
a combined CLS of 0.001189, and its other two runs are zero.

The wait before the first response is the dominant change. Gallery poster transfer
time stays essentially identical (median 1.408 → 1.408 s); model poster transfer
varies (3.325 → 2.901 s) but its 4.008 s median TTFB reduction accounts for most of
the 4.515 s LCP gain. Median post-download rendering is only about 19–27 ms. These
observations and the held-dependency tests identify a code-level pricing gate;
they do not attribute the historical CrUX change to a specific release or traffic.

[`measurements.json`](measurements.json) retains every included value, LCP phase
breakdown, recording time, exact network settings and raw trace SHA-256. Independent
medians of LCP phases need not sum to the median LCP. This local Slow 4G result still
leaves substantial image-transfer time and does not establish production field
threshold compliance.

## Validation

The controlled React streaming tests hold each real price dependency and assert
early poster output, exact eventual values, native schema parity, quote counts,
localized output and unavailable/rejection behavior. Image fixtures include 18
distinct price contexts. PostgreSQL tests preserve actual policy freshness and
query-count contracts. This evidence establishes scheduling and correctness;
browser measurements are required separately to establish a loading gain.

The final source passed 163 focused tests, full frontend lint (five existing
warnings), and a production Next build. The pricing-policy PostgreSQL 17 suite
passed all 14 cases. The isolated measurement build uses a custom output folder;
its sitemap was generated successfully with that folder explicitly supplied to
the unchanged sitemap configuration. No measurement configuration ships in the PR.

The gallery reader opened the selected video with its fresh current price, played
the original successfully, advanced to the next video with the correct new price,
and closed. Gallery pagination returned the next batch and then the opening batch.

After the final build, all seven HTML comparisons preserved canonical, hreflang
and every native JSON-LD payload: the Veo model in EN/FR/ES, the examples hub in
EN/FR/ES and the Veo examples family. Model script order changes with streaming;
the payload multiset and count remain identical. At 390 × 844, all four opening
poster rectangles matched the baseline in each language. See
[`functional-checks.json`](functional-checks.json) and
[`source-files.json`](source-files.json) for checks and compiled source hashes.

Raw traces, full HTML, DOM snapshots and logs remain outside Git under
`~/.codex/artifacts/cwv-model-examples-lcp-2026-10-13/`. No CrUX improvement or
attribution of the historical field trend follows from these local measurements.
