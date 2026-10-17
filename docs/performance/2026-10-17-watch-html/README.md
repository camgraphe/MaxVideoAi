# Public watch HTML: selected tariff read batching

Baseline: `8211b9d22ccbd198ecc94efa50a69b77ed61faac` (production source at investigation start). Candidate: the server-only tariff batch patch accompanying this record. No application database migration, production deployment or domain reassignment was performed. Only protected Preview deployments were created from published Git commits.

## Primary result: matched Vercel Preview comparison

The server patch removes a real wait before the watch reader: 37 tariff
transactions become 2 in the three measured videos, with unchanged complete
canonical quotes. The final browser comparison uses **two protected Vercel Preview
deployments**, one with the original code and one with the patch. Both run in
`iad1`, use the same configured `us-east-2` database identity, include the same
Vercel feedback toolbar, and use correct desktop/mobile User-Agents. The source
commits and deployment IDs are in `vercel-protocol.json`.

The tested route is the Seedance ecommerce watch page. Three sequential cold and
warm browser navigations per version and device give 24 audits. “Cold” is a fresh
temporary Chrome profile; routes and the rendered poster URLs were first fetched
over HTTP to prime the servers. This is not a forced function/database cold-start
test. All 24 HTML responses report `x-vercel-cache: MISS`; the gain is not an HTML
cache hit. Authentication is limited to each exact preview origin and redacted
from stored reports. No request or performance metric is suppressed.

| Device / browser cache | LCP before → after, median | Change | HTML completion before → after | Poster discovery before → after |
| --- | --- | --- | --- | --- |
| Desktop cold | 1.920 → 1.647 s | −14.2% | 1.534 → 1.211 s | 1.248 → 0.946 s |
| Desktop warm | 1.402 → 1.111 s | −20.8% | 1.336 → 1.037 s | 1.208 → 0.908 s |
| Mobile cold | 1.872 → 1.666 s | −11.0% | 1.485 → 1.364 s | 1.200 → 1.000 s |
| Mobile warm | 1.350 → 1.102 s | −18.4% | 1.265 → 1.048 s | 1.134 → 0.918 s |

The video poster remains the LCP element in every audit. Mobile CLS is zero in
all 12 audits. Candidate desktop CLS never exceeds 0.000083. Maximum candidate
TBT is 57 ms desktop cold / 6 ms warm, and 51 ms mobile cold / 38 ms warm; INP was
not measured. All six paired desktop LCP changes improve, by 147–363 ms. Five of
six mobile pairs improve; one warm mobile visit is 98 ms slower. This variation
is retained, not filtered. There is no reproducible mobile LCP/CLS regression in
this series, but three repeats on one URL do not establish a field percentile or
performance guarantee.

Vercel streams the first bytes early: the important improvement here is the
arrival of the reader/poster inside that streamed document. A small initial TTFB
alone would miss the server wait. The desktop poster is discovered about 301 ms
earlier in both cache conditions, consistent with the HTML and LCP improvement.
The unchanged full SEO catalog read remains a structural cost, and the historical
8-second production event cannot be reconstructed from expired runtime logs.
No CrUX or production p75 improvement is claimed before a normal production
release and fresh field observations.

Inspect every sample and range in `vercel-samples.csv`, `vercel-samples.json` and
`vercel-summary.json`; settings, source identity and authentication method are in
`vercel-protocol.json`. Full redacted reports/traces/DevTools logs remain in
`.reports/watch-html-lcp-20261017/browser-vercel-matched/`. Reproduce from the
repository root using the existing owner CLI authentication:

```bash
node docs/performance/2026-10-17-watch-html/measure-vercel-matched.mjs https://maxvideoai-fr1iincym-camgraphes-projects.vercel.app
```

The source-only baseline preview was created through the [Vercel deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
from the published `codex/watch-html-lcp-baseline` branch at the original commit,
with no production target or aliases. The candidate is the Git PR preview for
`a47250dd54376c60359502e63cd2fe16dcd75855`. Later commits in this PR add measurement
records/protocol corrections only; the measured application patch is unchanged.

## Current verification

- Both production-mode local builds, candidate TypeScript, ESLint (zero errors,
  six existing warnings), exposure and whitespace checks pass.
- Exact/continuous selected-reader and full current watch quote parity pass on
  real PG17, including snapshot consistency, isolated malformed rows, fresh later
  edits, inactive state and fail-closed errors.
- Both complete financial tests pass locally. The stable initial-cutover rerun
  checks all 26,818 quotes, actual reader acceptance and rollback (793 seconds).
- Real reader browser tests cover geometry, first Play, keyboard/focus, denied
  Play and continuation actions on desktop/mobile.
- Three watch pages preserve public data, prices, video/poster/preload, canonical,
  robots and schema; an unknown ID remains 404 and a legacy ID redirects 308.
  Preview schema site-origin fields are normalized only for the cross-environment
  comparison; video canonicals themselves must still equal the production URL.
- The application is not merged or deployed to production. Required Quality CI on
  the latest PR head remains the premerge gate.

The earlier diagnostics and unsuccessful/limited protocols below are retained to
show why they were insufficient on their own. An initial production-versus-preview
probe was also stopped after seven samples because only the preview injected
Vercel's feedback script/iframe. Those reference observations are in
`vercel-production-reference.csv`; they are not the primary before/after evidence.

## Diagnosis and correction

The direct watch route waits for `buildExampleWatchDetail` before emitting its reader. Its comparison owner quotes all 37 admitted models before choosing three. The original selected tariff reader opens one repeatable-read transaction per quote. On a remote pooled database this adds repeated connection/command waits even though the quotes run concurrently; Node profiling showed waiting rather than several seconds of JavaScript computation.

The candidate coalesces concurrent exact/continuous selectors into a selected read-only transaction. The state revision, current cells and ordered historical cells are read from the same snapshot. The canonical pricing kernel still computes every quote; there is no price or HTML cache across requests. Later batches read current state again. Charging and operational readers retain their original executor paths.

The separate watch SEO lookup still reads the complete editorial map and eligible video catalog to preserve eligibility, duplicate QA and related links. That work remains variable and can dominate a response after the quote improvement. This patch does not establish that the 8-second production incident was entirely caused by tariff reads: historical runtime logs were outside retention.

## Server phase probes

`server-probes.json` contains three real database probes per version, with database-enforced `default_transaction_read_only=on`. Next/React caches were bypassed outside Next so these are service diagnostics, not browser navigation measurements. Each route returned three comparison quotes.

| Video | Detail/quotes before → after | Physical SQL before → after | Tariff transactions before → after |
| --- | --- | --- | --- |
| Seedance ecommerce | 2,670 → 514 ms | 154 → 14 | 37 → 2 |
| MiniMax wildfire | 2,499 → 871 ms | 153 → 13 | 37 → 2 |
| Wan match cut | 2,336 → 506 ms | 153 → 13 | 37 → 2 |

These route-specific observations are not percentiles or matched repeated trials. Do not attribute the complete service elapsed-time difference to the patch: the earlier SEO lookup also varied. Two batches occur because not every model reaches the selected reader in the same microtask.

## Browser comparison protocol

Two production Next 15.5.25 builds run on the same host, baseline on `127.0.0.1:3127`, candidate on `:3128`. Both use the same real database with read-only startup enforced and the same original media. Workers and image optimizer caches are primed; “cold” means a fresh temporary Chrome profile, not a cold server/database. The second full document navigation reuses that profile for the warm sample. Storage reset is disabled in Lighthouse because the first navigation already has a fresh profile. Setup/pilot audits are excluded from the comparison and retained separately.

Lighthouse 12.6.1, headless Chrome 155, Node 22.23.2, actual DevTools throttling: 150 ms request latency, 1,600 kbps download, 750 kbps upload, 4× CPU slowdown. The initial desktop viewport is 1440×900/DPR 1, but mistakenly retains Lighthouse’s default Android/Mobile User-Agent. It is therefore a desktop viewport check, not a validated desktop-device comparison. Mobile is 390×844/DPR 1 with mobile emulation and the expected mobile User-Agent. The reproduction script is corrected to set `emulatedUserAgent: true`; the original recorded JSON settings remain unchanged. The installed Chrome launch defaults are retained using `scripts/performance/lighthouse-chrome-settings.cjs`, including the repository's RenderDocument correction. All performance audits run; no metrics, requests or failures are filtered from valid samples.

The page is `/video/seedance-2-0-fast-ecommerce-product-ad-example-storyboard-to-video-452f05f2`. Each device has three cold and three warm navigations per version. Version order alternates baseline/candidate, candidate/baseline, baseline/candidate. Samples run sequentially. The local exhaustive tariff tests are paused during the measurement; other host activity and the remote database/network remain uncontrolled. This is a comparative local check, not a production p75 estimate, statistical guarantee or CrUX observation.

Individual numeric samples and LCP element/phase evidence are retained with this record. Full Lighthouse reports, Chrome traces and DevTools logs remain in the task worktree under `.reports/watch-html-lcp-20261017/browser/`; setup audits are under `browser-protocol-pilot/`.

## Functional and pricing safeguards

- Real PG17 tests compare exact and continuous selected-reader results, ordered history, unrelated/malformed selected rows, inactive tariffs without history, no writes/maintenance locks, isolated returned objects, one consistent snapshot across an admin edit, and fresh state in later batches.
- The actual watch quote provider produces complete snapshots identical to the original canonical public provider. It observes later price/revision edits and fails closed when state is unavailable. Temporarily removing the watch injection makes its SQL count assertion fail (8 commands instead of 4); restoring the injection passes.
- Baseline/candidate HTML checks on Seedance, MiniMax and Wan match status, title, H1, canonical, robots, JSON-LD, displayed quotes, poster attributes and frame style. An unknown route returns the same 404.
- Real browser reader tests cover desktop/mobile geometry, first Play, pointer/keyboard focus, Escape restoration, failed Play and continuation actions. No reader, media, CSS, route eligibility or client bundle source was changed.

## Initial browser results

Medians of three samples per cell; individual values, ranges and settings are in
`browser-samples.csv`, `browser-samples.json` and `browser-summary.json`.
`browser-evidence.json` retains LCP elements, phases, document requests and CPU
benchmark values. Every audit identified the existing video poster as LCP, with
high priority, initial-document discovery and no lazy loading. No audit reported a
runtime error or warning.

| Profile | TTFB before → after | LCP before → after | LCP median change |
| --- | --- | --- | --- |
| Desktop viewport / mobile UA, cold | 4.77 → 2.59 s | 5.53 → 3.35 s | −39.4% |
| Desktop viewport / mobile UA, warm | 5.03 → 2.54 s | 5.18 → 2.82 s | −45.6% |
| Mobile cold browser | 5.15 → 5.50 s | 5.91 → 6.27 s | +6.1% |
| Mobile warm browser | 4.94 → 2.59 s | 5.12 → 2.76 s | −46.0% |

The initial mobile cold result was inconclusive for regression: paired LCP changes
are −362 ms, +1,720 ms and −2,100 ms, while the independent medians move the other
way. Candidate values span 3.37–7.63 s. Do not hide that result or claim mobile cold
improvement from this initial set. Mobile CLS is zero throughout. Desktop viewport maximum
CLS is 0.001529 in both versions; candidate TBT stays below 39 ms cold and 16 ms
warm (baseline below 40 ms cold and 19 ms warm).

Before observing further results, the follow-up is fixed at six additional pairs
of mobile cold navigations, alternating version order. Both servers retain the
same built code and receive identical external diagnostic instrumentation of
`pg.Client.query`, pool acquisition and request finish using AsyncLocalStorage.
It logs query categories/counts/durations, never SQL parameters, credentials or
private results. Both workers are primed after restart. This follow-up attributes
waiting time and adds evidence; it does not replace the initial samples.

## Mobile cold follow-up and release gate

The six additional instrumented pairs are in `mobile-followup.json`. They **do not
validate the mobile cold response time**: median LCP is 5.82 s baseline and 7.98 s
candidate; median TTFB is 5.07 s and 7.22 s. CLS remains zero. This unfavourable
comparison is retained. It blocked release at that stage and motivated the
matched Vercel comparison reported first in this document.

The phase evidence separates two effects. Baseline requests execute 154 SQL
commands and 37 tariff transactions; candidate requests execute 14 and 2.
Median elapsed time from the first tariff BEGIN to response finish falls from
2,806 to 542 ms. But median elapsed time **before** that first BEGIN rises from
2,140 to 6,622 ms in these requests, dominated by the existing editorial/video
reads and connection acquisition, before the modified quote reader runs.
This explains where the unfavourable samples spend their time; it does not
prove that all application-level interactions or regressions are excluded.

A separate read-only SQL diagnostic repeated the actual 96-video SELECT three
times. It returns 476,726 serialized bytes (about 154 KB prompts, 198 KB settings).
`EXPLAIN (ANALYZE, BUFFERS)` reports 5.55–5.66 ms execution, while the actual client
SELECT takes 2.23–3.41 s. See `seo-query-diagnostics.json`. The delay therefore
includes substantial work outside the measured executor, such as result transfer,
serialization, connection and client scheduling; an index change is unsupported.

The baseline Vercel deployment reports function region `iad1`, and the configured
Neon hostname identifies `us-east-2`. Local probes run from the European workstation.
The regional difference limits any translation of local seconds into production
seconds. Both the cost of remote round trips and the inconsistent full-catalog
transfer must be checked on Vercel. No production performance gain is claimed here.

Reproduce the local browser protocol, after starting the two production builds:

```bash
WATCH_HTML_PERF_OUT=.reports/watch-html-reproduction node docs/performance/2026-10-17-watch-html/measure-browser.mjs
```

## Validation status at first PR publication

- Baseline and candidate production builds succeed; candidate TypeScript check succeeds.
- ESLint: zero errors, six existing warnings. Public exposure guard and diff whitespace check pass.
- New PG17 batch integration tests: 4/4 pass, including the real watch provider.
- Focused existing pricing/temporal/read-batch/watch tests: 18/18 pass.
- Reader browser plus new batch tests: 7/7 pass; final batch test rerun: 4/4 pass.
- Fast suite: 7,652 pass, one skip, four source-scan failures caused by the temporary baseline build directory under `frontend/`. Moving both builds under ignored `.next/` removes the contamination; all 33 tests in the three affected files pass on rerun. No guard or assertion was weakened.
- HTML parity checks pass for three videos, an unknown 404, and a legacy ID → canonical 308 redirect. Video source/poster/preload and image preload attributes match.
- Independent review found no source-code correctness defect. It flagged the missing complete watch snapshot test (added and reviewed) and the desktop User-Agent omission (disclosed above and corrected for the Vercel protocol).
- Exhaustive financial cutover validation is still running at first publication. Required Quality CI remains a premerge gate.

The final review detected the desktop User-Agent omission above. All initial desktop numbers must be interpreted as viewport checks; a Vercel comparison with explicit device-appropriate User-Agents is required before claiming a desktop gain. The first exhaustive initial-cutover run also failed its code-revision binding after the agent committed during execution. The stable-commit rerun passes, including all 26,818 checkpoints, actual reader activation and rollback; the other complete cutover test also passed. These are disposable PG17 fixtures; no production cutover was run. No financial assertion is bypassed.
