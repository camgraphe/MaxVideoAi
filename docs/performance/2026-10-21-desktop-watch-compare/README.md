# Watch and Spanish comparison loading

Investigation date: 2026-10-21. Production source at the start:
`1f35e4963ac1f02818d3ea68d5aec9110aca1336`. No production deployment or domain
reassignment is part of this change.

## Field observations and limits

Vercel production events for `maxvideoai.com`, 2026-10-20 00:00 UTC through
2026-10-21 09:00 UTC, show desktop watch LCP p75 8.628 s (61 observations)
and Spanish comparison-detail LCP p75 6.472 s (40 observations). Their TTFB
p75 values are 3.778 s (61) and 4.661 s (41), respectively. The watch field LCP
attribution points to the video reader; controlled browser traces identify its
poster. Comparison field attribution is text. Percentiles
are queried independently and must not be subtracted to infer a paired phase
duration. These small, changing traffic cohorts do not establish causality.

The 40 Spanish comparison LCP observations are spread across 40 distinct
paths, with no INP records in that cohort. This is insufficient to classify
the traffic as automated or infer a stable route regression. Recent server
logs also measure a different boundary from field TTFB: a query limited to the
latest 100 Spanish comparison records within 2026-10-20 11:00 UTC through
2026-10-21 09:00 UTC returns data loads of 135–566 ms (median 284 ms). This
window precedes the investigation probes. These records do not explain a
multi-second historical navigation by themselves. Those logs exclude HTML
rendering, connection setup and transfer and are not a complete traffic census.

Four fresh-profile production Lighthouse reference runs reproduced neither
field spike: watch desktop/mobile LCP 1.498/1.333 s and comparison desktop/mobile
2.012/1.253 s, with CLS 0 throughout. They are one-shot diagnostics, not the
before/after experiment or a field percentile. No metrics or traffic are filtered
to improve reported scores.

## Confirmed costs and implementation

The initial watch data owner reads 108 persisted editorial entries (149,612
serialized row bytes) and hydrates 100 videos (519,362 bytes) before displaying
one video. A read-only local probe against the current database confirms that
the selected-video read needs one row (3,611 bytes); its separate approved
source-image lookup is unchanged. The numbers describe serialized PostgreSQL
rows in this diagnostic, not bytes transferred to the browser.

The initial reader and metadata now request only that selected video. Rollout
membership, complete active duplicate-name QA, public/deleted-source eligibility,
canonical metadata and current quotes remain on the critical path. Related
examples reuse the full catalogue and ranking owner in a server Suspense
boundary after the reader; an optional catalogue failure cannot replace an
already visible reader. There is no cross-request content cache.

Comparisons already share effective policy across both pricing sides, but six
ordinary scenarios still opened six tariff transactions. The contextual scope
now reuses the existing selected tariff batch reader: one policy SELECT plus
one read-only repeatable-read transaction replaces 25 pricing commands with 5
in this case. Every canonical quote is still computed; later batches reread
current tariff state. No price, billing formula, catalogue admission or historical
amount is changed.

The deployed intermediate build also revealed an order-dependent stylesheet
problem. Tailwind 3's plugin closure retains the last explicit `@config` across
roots processed by the same PostCSS instance. An editorial sheet could therefore
enable typography when `app/globals.css` subsequently relied on default config
discovery. The intermediate shared CSS contained 88 additional typography rules,
12,309 decoded bytes (239,730 versus 227,421), with no other rule changes.
An explicit `@config "../tailwind.config.ts"` in globals isolates it from that
state. The new regression test fails without this selection and checks both
editorial owners followed by globals using the same real processor. Native
editorial styles remain unchanged.

The final Git Preview serves `6105ccaf1f53ac12.css`: its downloaded contents are
byte-identical to the 227,421-byte baseline global CSS, SHA-256
`0329f3f507614aa3821892f39151891a66ad045f621dbe83805b5ed8d46f1861`.
See `css-verification.json`. This confirms the deployed correction as well as
the source-level regression test; it does not assign a fixed LCP benefit to the
12,309 decoded bytes removed from the intermediate build.
The four production reference runs also use the clean `6105ccaf1f53ac12.css`.
This fix makes that output consistent across build order; the intermediate
stylesheet finding does not explain the earlier production field spikes.

## Matched browser protocol

Baseline is the protected Preview for `dffd394c2e52820ad3ccc4828bd606fe92bf0e44`,
deployment `dpl_HEGEgudNvcpHJ49egJsqji5FDFZU`. Its Git tree
`e209c7ec619baffb0b56ed38bceb94afbc96f610` is identical to production source
`1f35e4963ac1f02818d3ea68d5aec9110aca1336`.
Final candidate is `a966f2883eb557e09a45e344830932bd203df944`, deployment
`dpl_6pGo4YRteTSP6y6Z1Kr74Tn2Ss5r`. Both are Git-built Previews in the same
Vercel project, with the feedback toolbar retained. Deployment metadata lists
`iad1`; the comparison runtime-log records examined report `cdg1` for both
versions. The same hosting configuration is retained.

The reproducible `measure-matched.mjs` uses the repository's Chrome renderer
flags, three alternating pairs per page and device, fresh Chrome profiles,
1440×900 desktop and 390×844 mobile with matching User-Agents, and identical
DevTools throttling (150 ms, 1,600 Kbps down, 750 Kbps up, CPU ×4). Cold means
browser cache only; functions and database are not forced cold. Functional
visits prime the routes and visible posters before the performance series.
Authentication is attached only to the exact preview origins, kept in memory
and redacted from saved reports. LCP, FCP, CLS and TBT are measured; INP is not.

Comparison metadata uses the deployment origin in Preview on both versions;
watch metadata uses the public production origin. Functional parity normalizes
only each exact preview origin before comparing canonical/hreflang, JSON-LD,
prices, reader content, related links, source URLs and geometry. This preserves
the existing environment policy; a Preview origin is not evidence of a
production canonical regression. Native comparison playback is exercised with
keyboard activation of the focused video; watch playback uses its Play button.
The consent banner is dismissed through its Reject button after the initial
content capture so it does not cover mobile playback targets. Performance runs
retain the initial banner.

All 16 functional visits passed (four routes × two devices × two versions),
including actual video playback, the comparison dialog closing with Escape,
zero browser exceptions and zero media requests before interaction. Eight
normalized content/SEO pairs match exactly, with unchanged reader geometry.
See `verify-readers.mjs` and `functional-summary.json`.

## Intermediate investigation retained

The initial series contains 48 valid Lighthouse runs, with no runtime errors or
measurement warnings and CLS 0 throughout. An isolated landscape/mobile
candidate run reached 2.724 s: its initial stylesheet request started at 1.984 s
and poster discovery at 2.019 s, while the poster was a WebP cache HIT. This is
late HTML/resource discovery rather than an image cache miss; it does not by
itself distinguish server processing from transfer or parsing delay.
It is retained in the data. Two additional alternating pairs on both versions
of that page/device check whether this delay repeats. Their repetition numbers remain distinct
in the raw CSV; the intermediate summary pools the original and additional
repeats into exploratory n=5 medians, not a separate confirmatory experiment.

The intermediate candidate is `d71c8f2cf1429be53c9508b7d84738708eba45ed`,
deployment `dpl_G2u1HEBSmPCdb8vecjfvdEhtDoTu`. Two additional pairs on both
devices of the second comparison also checked higher medians with mixed paired
differences. All 60 runs are retained in `intermediate/`. They led to the CSS
discovery above and are not substituted for verification of the final build.
The landscape mobile outlier did not repeat in its additional candidate runs
(1.569 and 1.602 s). Before that run's stylesheet discovery, the main-frame trace
contains only 17.6 ms of tasks in total, with a 13.4 ms maximum task; it does not
show a long main-thread task explaining the delay.

## Final verification

The final table contains 48 accepted runs: four pages × two devices × two
versions × three repeats. Values are median initial-navigation LCP in seconds,
baseline → candidate, with identical measurement settings. Full values, paired
changes and ranges are in `samples.csv` and `metrics-summary.json`.

| Page | Desktop LCP | Mobile LCP |
| --- | ---: | ---: |
| Seedance storyboard watch | 1.723 → 1.519 | 1.818 → 1.486 |
| Wan match-cut landscape watch | 1.827 → 1.581 | 1.842 → 1.669 |
| ES Kling 3 Pro / Veo 3.1 | 1.406 → 1.530 | 1.515 → 1.581 |
| ES Kling 2.5 Turbo / LTX 2.3 Fast | 1.451 → 1.429 | 1.575 → 1.525 |

Both watch routes improve on every paired repeat, on both devices. The final
comparison series has mixed paired changes: it does not demonstrate a stable
browser LCP gain. Its mobile median changes are +66 ms and −50 ms. With three
repeats, pauses and the slow cases below, this is neither proof of a mobile
regression nor a general guarantee of its absence. No reproducible deterioration
was identified on the tested mobile flows. All 48 accepted runs have CLS 0,
no Lighthouse runtime error and no run warning. All watch posters are WebP
cache HITs; both versions have the same global CSS bytes. This is controlled
Preview evidence, not a production or CrUX percentile.

Server logs were joined to each **initial document's exact request identifier**,
not to the later request generated by Lighthouse's BFCache test. Across six
initial requests per comparison/version, median pricing duration (the slower of
the two concurrent sides) decreases from 309 to 219 ms and from 305 to 201 ms.
Total instrumented data duration decreases from 312 to 271 ms and from 307 to
251 ms. The unchanged benchmark read then becomes the longest data phase on
these candidates. These descriptive figures support the reduced pricing work,
but do not explain the full browser loading delay. See `server-phases.json`.

The change is ready for review as a reduction of confirmed critical-path costs.
It does not establish that the multi-second production spikes are solved or
that CrUX will pass after deployment.

One baseline navigation failed the rendered-comparison guard before the original
harness saved its trace. Its canonical had matched, but the comparison body was
absent; the cause remains undetermined. It contributes no fabricated metric.
The retry, at the same planned position/profile, passed and its 4.742 s LCP is
retained. `excluded-attempts.json` records this exclusion and the limitation.
A second post-measurement check, on candidate comparison 2 desktop, found an
incomplete DOM. This time the original LHR and trace were saved: HTTP 200,
LCP 1.641 s on the expected “Kling 2.5 Turbo” heading, CLS 0, no warning or
runtime error. Lighthouse 12.6.1's `BFCacheFailures` gatherer navigates away
and back after measuring initial load and waits only 100 ms after returning.
The page can therefore still be reloading during our subsequent DOM guard.
The script now checks the original measured document URL, records its LCP node
without filtering by element type, then awaits
the returned DOM before checking its canonical and content. This wait occurs
after the LHR is complete and cannot shorten or recompute initial LCP. All
measurements retain the same Lighthouse options and BFCache audit. The failed
check's original 1.641 s measurement is preserved separately in
`excluded-attempts.json`; it is not substituted into the planned matched table.
The initial baseline guard failure is consistent with this race, but its missing
trace prevents a definitive attribution. The resumed series retains every
previously accepted observation, including all slow samples.

The pause to repair test compilation separated comparison repeats by about
12 minutes. Two later comparison navigations are slow on different versions:
baseline mobile 4.742 s and candidate desktop 4.845 s. Matching the browser's
Vercel request ID to runtime logs gives comparison data phases of 504 ms and
388 ms, respectively. The remaining delay precedes discovery of the initial CSS;
these phases cannot account for the whole navigation. The pause may have changed
function warmth, but cold startup is not established: queries of the function
start-type/duration metric returned `payment_required` for Observability Plus.
See `slow-navigation-summary.json` for the exact browser/log boundaries.
No subscription or hosting configuration was changed. These observations limit
a causal reading of the small browser experiment and show that intermittent
loading delay remains on both versions.

## Validation and reproducibility

The runtime measured above is unchanged by `a81240e84`, which only adapts five
browser-test CSS compilers to their deliberately injected production config
(absolute content paths and fixture classes). Adding the real file-level
`@config` had overridden those test-specific inputs or required an absent source
path. No layout assertion or scenario was removed. All 19 affected browser,
rendering and real stylesheet-order tests pass locally after the adaptation.
Independent review found no remaining issue in these changes.

Earlier focused validation passed 40 pricing/watch cases, 34 watch PostgreSQL
and route cases, 32 related/batch/architecture cases and three real-reader browser
cases. The source builds successfully locally and through the final Git Preview;
ESLint reports six existing warnings and no error, with exposure and whitespace
checks passing. The previous pre-CSS candidate passed the complete Quality CI.
The latest code candidate's Quality CI is tracked in [PR #490](https://github.com/camgraphe/MaxVideoAi/pull/490); a passing older
run is not a substitute for the required latest-candidate gate before merging.

Run from the repository root with installed frozen dependencies, Chrome and an
owner-authenticated Vercel CLI. These commands are read-only against the previews;
the functional script performs real public-media playback. Set the exact origins
from `protocol.json`; no production alias is used for the matched experiment.

```sh
CWV_VERIFY_OUT=.reports/desktop-cwv/functional-reproduction node docs/performance/2026-10-21-desktop-watch-compare/verify-readers.mjs "$BASELINE_PREVIEW" "$CANDIDATE_PREVIEW"
CWV_PERF_OUT=.reports/desktop-cwv/reproduction/watch CWV_PERF_ROUTE=/video/seedance-2-0-fast-ecommerce-product-ad-example-storyboard-to-video-452f05f2 node docs/performance/2026-10-21-desktop-watch-compare/measure-matched.mjs "$BASELINE_PREVIEW" "$CANDIDATE_PREVIEW"
```

Repeat the performance command in distinct output directories for each route in
`samples.csv`. Do not run builds or local browser suites concurrently with the
measurements. The script preserves completed samples when resumed and refuses
to mix origins, paths or device profiles. Rejected rendered-page samples retain
their trace and a separate failure record. Compact results and protocol are
versioned here; full Lighthouse traces, network logs and functional screenshots
remain local under `.reports/desktop-cwv/`.
