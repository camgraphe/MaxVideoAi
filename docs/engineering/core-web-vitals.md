# Core Web Vitals: trustworthy site-wide measurements

Owner: public performance. Baseline: 2026-09-26. See [dated Google evidence](../performance/2026-09-26/README.md). Operational route-level evidence belongs in local ignored `.reports/` artifacts.

## What each source answers

| Source | Use | Do not infer |
|---|---|---|
| CrUX daily / History API | Google's eligible Chrome field population, p75 and distributions, explicit 28-day window | Today's deployment performance; a URL value from an origin fallback |
| Search Console | Indexed URL groups and validation status | 145 individually measured slow pages; the start date of a recent regression from first detection |
| Vercel Speed Insights | Prioritize routes with counts, device, country, time range, deployment and element attribution | Identical population to CrUX; reliable route p75 from a handful of events |
| Microsoft Clarity | Performance widget and recordings to investigate the selected page/session cohort | CrUX population or attribution; an independent slow page load from every matching recording or repeated URL row |
| Lighthouse | Reproducible load diagnosis and traces | Field INP, full-session CLS, or passing Google CWV from a score of 100 |
| Normal Chrome journey | Consent, first Play, scroll, SPA transitions and actual interaction diagnosis | Population p75 from a few manual visits |

A CrUX origin includes eligible traffic across the origin. Marketing URLs in Search Console do not establish that later app activity contributes nothing. Google's current [SPA guidance](https://web.dev/articles/vitals-spa-faq) describes CrUX URL aggregation by the URL at document load; do not apply that attribution rule automatically to another collector. Keep marketing, public tools and workspace separate in diagnosis, record the initial document URL and current route, and compare direct arrival with navigation. Preserve later work and the user journey instead of changing navigation or filtering metrics to improve their labels.

## Collection commands

The [shared matrix](../../scripts/performance/site-matrix.json) contains 33 verified public URLs: home, model detail, comparison detail, gallery index, model gallery, pricing, documentation, MCP, public tools, blog and integration detail, in EN/FR/ES. This is a representative matrix, not an exhaustive crawl. Workspace journeys are listed separately; they require authentication and are not mixed into marketing summaries. Add high-traffic or anomalous URLs as evidence identifies them.

```bash
pnpm cwv:crux --plan
pnpm cwv:crux
pnpm cwv:crux --history
pnpm cwv:crux --history --family=comparisons
```

API commands require a locally configured `CRUX_API_KEY` authorized for Chrome UX Report API. Never commit a key or paste it into an issue. No key is bundled or extracted from a browser. The 26 September baseline was retrieved from Google's CrUX Vis UI and is already available independently of API access.

The exporter writes dated, ignored `.reports/crux/<timestamp>/` artifacts:
- `records.json`: Google records, query dimensions, actual key, retrieval timestamp, explicit status.
- `coverage.csv`: `ok`, `no-data`, `error`, or `scope-mismatch` for each requested URL/device.
- `metrics.csv`: one row per metric and period, with dates, units and p75; missing values stay empty.

An origin is queried independently. URL requests never fall back silently. A permission/quota/network error is not insufficient traffic. Raw success responses retain histograms, fractions and normalization details. Independent p75s cannot be averaged into an origin p75 or added to reconstruct LCP. Overlapping history windows are not independent weekly cohorts. A missing INP value is not a fast page. Inspect histograms/counts and confidence before interpreting small movements.

## Repeatable field exports from Vercel

The authenticated Vercel CLI exposes Speed Insights without adding a collector or drain. Inspect
`vercel metrics schema vercel.speed_insights --scope camgraphes-projects --json` first when capabilities change.

```bash
pnpm cwv:vercel --since=2026-09-19T20:00:00Z --until=2026-09-26T20:00:00Z --plan
pnpm cwv:vercel --since=2026-09-19T20:00:00Z --until=2026-09-26T20:00:00Z --deployment=dpl_REPLACE_WITH_VERIFIED_ID
```

Choose elapsed ISO windows for the before/after capture and the verified deployment ID. Omit deployment only for a clearly labeled mixed-deployment baseline. The exporter scopes production to `maxvideoai.com`, stores the original JSON and query metadata in a new ignored `.reports/vercel-cwv/` directory, and joins each metric's p75 with its own count by route/device. Missing values remain null. A CLI error leaves the capture marked incomplete and exits nonzero. Capture directories cannot be reused.

Vercel may align requested dates to its buckets. Read each file's **actual** query window and `windowAdjusted`, plus `possiblyTruncated` when the group limit is reached. Never average bucket or route percentiles. These exports contain operational traffic data; keep them out of this public repository. Additional diagnostic queries can group INP by `attributionTarget` and `attributionEventName`; a blank target is unavailable attribution, not proof of a harmless event. Keep route attribution distinct from the DOM surface reached later in the visit.

### Route attribution verified on 27 September 2026

The inspected Next integration is `@vercel/speed-insights` **1.2.0**, mounted by `frontend/components/analytics/AnalyticsScripts.tsx` without custom metric filtering. It updates the collector script's `data-route` as the client route changes. The collector captured from `https://maxvideoai.com/_vercel/speed-insights/script.js` at **2026-09-26 23:09 UTC** embeds `scriptVersion: "0.1.3"`.

| Inspected artifact | SHA-256 |
|---|---|
| Installed SDK `dist/next/index.mjs` | `d87c482fef823e8c8c3d354299111732fd3e4ee2b27e274dc8cdc0d3279b98fe` |
| Served collector script, 12,567 bytes | `c703720710415599d2f0b3f31fbfda63e34d6d19e730bada78b9b92197564f5b` |

Exact originals, response headers and a source-only probe are retained locally under `.reports/cwv-2026-09-27-deep/docs-sdk/`. The collector's Last-Modified header is 25 September. This capture does **not** establish the collector bytes used for the 19–21 September anomalies. SDK version, deployed application SHA and remotely served collector version are separate evidence; recheck them when investigating another period.

In that collector, the common metric callback saves the **current URL and script route at callback time**. The transport flush sends these saved labels. Neither the initial document URL, the event's route nor the route at network-send time can be inferred solely from the exported `route` field. `history.pushState` and `popstate` flush queued reports; they do not reset the metric observers.

- **INP:** the selected interaction spans the document lifecycle and, with the inspected defaults, is reported on hidden/pagehide. An earlier workspace interaction can therefore be reported under `/` if the user navigates there before the callback. A synthetic observer probe confirmed this bookkeeping behavior; it did not reproduce a real user slowdown. An app target under `/` is evidence to reconstruct the journey, not proof of homepage work or entry-route attribution.
- **LCP:** candidates retain their document-relative clock, and the inspected observer finalizes on click, keydown or first hide/pagehide. Ordinary in-page link clicks are not an established cause of destination content becoming a late LCP. A passive history transition without prior input needs a real browser trace before attributing a late candidate to that mechanism. Distinguish same-document traversal from full navigation and BFCache restoration.

The exporter preserves provider route labels and raw responses. It cannot recover missing event-route or initial-URL context from aggregated p75/count rows, and must not relabel or discard them based on a guessed journey.

### Clarity page and session context

Clarity offers both page and session filters; Entry URL and Visited URL express different selection rules. A matching recording can contain several pages. Record the exact widget/tab, time window, browser/device, filter type and available per-metric count before treating a URL row as a comparable page cohort. A session count is not automatically the number of LCP or INP samples. Repeated values across URLs do not establish independent observations or a shared cause. See [Clarity filters](https://learn.microsoft.com/en-us/clarity/filters/clarity-filters).

The Performance widget documents LCP, INP and CLS as p75; opening its related recordings filters toward values above the displayed metric. Those recordings help diagnose the slow tail, not estimate an unfiltered population. Correlate the selected page, navigation and event before assigning a cause. Missing attribution/counts stay unknown; Clarity figures are not substitutes for CrUX's Chrome population and collection window. See [Clarity performance metrics](https://learn.microsoft.com/en-us/clarity/insights/performance-widget).

## Representative lab protocol

```bash
CWV_DEVICE=mobile CWV_FAMILY=comparisons pnpm --dir frontend lighthouse:site
CWV_DEVICE=desktop CWV_FAMILY=docs pnpm --dir frontend lighthouse:site
CWV_DEVICE=mobile CWV_LOCALE=fr pnpm --dir frontend lighthouse:site
```

No family/locale filter runs all 33 URLs, three runs each. Desktop must be run separately. `CWV_BASE_URL` can select an explicit local/preview origin. Record the target deployment ID and commit independently of the checkout SHA: a CI push can still hit an older production deployment. Archive `frontend/.lighthouseci` before another collection. Reports include fetch time, requested/final URL, Lighthouse/browser versions and emulation settings.

These commands start with a fresh profile, therefore they cover the no-stored-consent load cohort. They do not cover the consented return visit or INP. Complete the protocol in normal Chrome with:
1. Fresh visit, banner present, no analytics consent.
2. Returning visit with analytics/ads consent, same route/device and geography.
3. First Play and media selection; consent click; menu/language switch; gallery filter or modal; tool input.
4. Marketing → login → app and direct app entry using the same account, retaining entry/current-route attribution.

Capture LCP element/resource, TTFB, resource discovery delay, transfer duration, render delay, INP interaction/long task, CLS sources, cache state, device, country, deployment and sample count. Keep scripts after consent and late work inside the observation period. Compare the same scenario before/after with at least three lab runs; report the spread. Do not merge lab and field values.

### Correlating a metric with its journey

For a local diagnostic trace, record the following separately; existing aggregate exports do not supply all these fields:

| Context | Record |
|---|---|
| Document | Initial URL/route, `performance.timeOrigin`, navigation entry `type` and `activationStart`, browser/version and deployment |
| Transitions | Current URL/route and collector `data-route` with timestamps; full navigation, client transition or history traversal; `pageshow.persisted` for BFCache |
| Visibility/input | Initial visibility, first hide, subsequent restores, and first click/keydown relative to the document clock |
| Metric | Raw LCP candidate or selected interaction timestamp, metric callback time when observable, outbound report time, reported route and controlled element/event-target label |

Compare a fresh direct desktop load kept visible and untouched for at least 30 seconds, a normal link-click arrival, and a separately prepared passive Back/Forward arrival. Check the time origin and navigation events instead of assuming that a changed URL means a new document or metric clock. For INP, compare an interaction on the starting route with the report after a client transition and hide. Preserve intermediate candidates, final values and slow visits; separate a source-only collector probe from a real browser reproduction.

Publish only public paths or controlled route templates, not query strings, fragments, signed URLs, private resource paths, account/session identifiers or DOM text. Use a local run label to join diagnostic events; keep any sensitive raw recording context out of the repository. If callback time or event-route context is unavailable, mark it unknown and retain the competing explanations.

## Integrity guardrails

`pnpm cwv:check` checks actual loader consent decisions, crawler media eligibility, middleware routing parity, and CrUX export semantics. The existing Lighthouse workflow runs it before collection.

Performance tooling must receive the same resources and route as a normal Chrome browser with matching consent/device settings. Do not suppress third parties, media, galleries, banners, hydration or later interactions by Lighthouse user-agent, headless browser, audit query flag or environment-specific production branch. Preserve legitimate consent, reduced-motion/data-saving/mobile rules and crawler media behavior.

The routing dependency's bot list includes performance browsers. Its audit/headless entries are excluded from bot routing so those browsers exercise the visitor route. Regression tests compare middleware response targets, not just HTTP status 200.

Do not overwrite metrics, drop inconvenient slow samples or report early values as final values. Existing Vercel collection remains unchanged. No new telemetry destination or field collector is added by this patch.

### Google Analytics startup scheduling

`ConsentModeBootstrap` keeps the consented inline `gtag` command queue available
after hydration, but mounts the remote GA4 script only after document load and an
idle callback. Browsers without `requestIdleCallback` use a cancellable timer
after load. The pending load listener, idle callback or timer is cancelled on
consent withdrawal, excluded-route entry or unmount; the callback also checks
current browser consent and the current URL before mounting. Waiting outside
`next/script` delays its App Router preload too and keeps cancellation under the
application's control. The installed Next loader's own deferred callback has no
equivalent cleanup.

Page views and product events keep their existing queue and transport contracts.
`AnalyticsScripts` keeps Clarity behind analytics consent and additionally gates
Google Ads configuration on advertising consent. An analytics-only choice retains
GA4 and Clarity without configuring the advertising destination. Granting both
categories keeps the existing tag, conversion settings and destination deduplication.
The script gates validate a stored record against the current public cookie-policy
version before mounting. GA4 and GTM startup also validate the persisted analytics
flag against that version and the consent cookie before scheduling remote code.
Unconfigured or explicitly disabled destinations do not initiate a policy request.
GA4 replays the current Google consent when its inline command queue becomes ready,
so waiting for validation does not lose a new acceptance. The banner and loaders
share only their in-flight version request; later reads can observe a changed policy.
Expired choices broadcast denial
and display the banner. A failed version read retains the banner's existing
`2025-10-26` fallback; it does not authorize arbitrary stored versions.
Already downloaded third-party code cannot be removed by withdrawing consent;
consent updates and conversion dispatch checks remain responsible for that state.
Audit browsers use the same scheduling as ordinary Chrome. Moving startup later
does not remove Google's script-evaluation work or guarantee that its eventual
execution cannot overlap input. A visit that ends before the remote script loads
can lose queued events, and very early checkout attribution still depends on
GA's existing readiness timeout. Measure consented returning visits and early
interactions, including late script work, before claiming an INP improvement.
`tests/cwv-audit-parity.test.ts` covers consent, routing and stale-callback
cancellation, including the timer fallback; real browser evidence is separate
from provider event receipt and production field measurements. See
[Next script scheduling](https://nextjs.org/learn/seo/third-party-scripts) and
[Google's command queue](https://developers.google.com/tag-platform/gtagjs/configure).

## Public-page server phases

`loadComparePageData` owns the comparison's independent data and gallery reads. It starts them together; the qualified benchmark, exact prices and complete gallery results still resolve before rendering. Keep prelaunch gallery exclusions in this owner. Its concurrency test holds all read boundaries open to prove that none waits for unrelated data.

Comparison policy sharing (2026-10-09) belongs to one `buildCompareRouteData`
invocation. Its lazy contextual reader retains the first successful complete
policy across both engines and keeps every quote's tariff transaction separate.
The PG17 contract measures Veo 3.1/Fast's six 4-second audio scenarios at
720p/1080p/4K: 30 to 25 pricing commands, with policy SELECTs 6 to 1 and all six
tariff transactions retained. EN/FR/ES complete contexts, snapshots and route
pricing outputs match for healthy, partial, empty-policy and unavailable cases.
Veo/Lite has five quoted points, not six. These counts describe pricing commands
only. A shared transient policy failure affects the concurrent group together;
later work may retry, while a new render has a fresh scope. See the pricing guide
for failure-group and freshness ownership.

The controlled owner capture used Node 22.23.2, PostgreSQL 17.6 and an Apple M3
Max on Darwin 25.6.0, with the same warm pool/fixtures and instrumentation disabled
for both variants. Three ABBA blocks retained six samples per variant, without
imposed latency: baseline median 1.331 ms (1.274–1.388), candidate 1.188 ms
(1.105–1.354). The ranges overlap; these local data-owner timings are not HTTP,
TTFB, rendering, LCP or field performance. Capture through
`CWV_COMPARE_POLICY_BENCHMARK=1` and `CWV_COMPARE_POLICY_EVIDENCE_PATH` when running
the focused PostgreSQL contract. A real-owner esbuild ESM graph adds only the
light policy-loader helper (226 to 227 parsed inputs; 1,457,464 to 1,458,587
emitted bytes), with no new model admission/coverage modules. That diagnostic
is separate from Next production output and cold-process latency. Production
build, browser route evidence and all selected Quality CI lanes remain release
gates; the local SQL reduction does not establish a Core Web Vitals improvement.

Production comparison loads emit one bounded `[cwv:server]` JSON record through existing runtime logs. It contains locale, deployed Git SHA, total **data-loading** duration and the start/duration/status of seven fixed phases: benchmark, scores, key specs, two price reads and two galleries. This is not TTFB, HTML render time or browser LCP. Phases overlap and must not be summed. A resolved fallback still has phase status `ok`; status describes promise completion, not data availability. Pending phases can remain in an error record when a sibling rejects first.

The diagnostic contains no query text, model/job/account IDs, URL or exception content. It preserves rejections and cannot fail a page if logging fails. It is disabled outside production and during a declared production build; `CWV_SERVER_TIMING=0` disables it operationally. No cache, database schema, pricing algorithm, media selection or consent rule is changed by the concurrent loading correction.

The homepage's `prepareHomePageData` uses the same logger with route `home` and five
concurrent phases: `examples`, `hero-slots`, `scores`, `hero-pricing` and
`demo-pricing`. Current hero reference prices and the below-fold exact demo quotes
start with the gallery reads. The route awaits slots, scores and both price reads
before rendering the hero and demonstrations; only discovery awaits the examples
promise beneath its own Suspense boundary. The four authored films remain outside
that boundary. All five reads start once, and the timing record waits for their
eventual settlement even when an earlier read fails. Immediate observers preserve
consumer rejections without supplying successful fallbacks. The complete
`loadHomePageData` API still awaits every result. Price unavailability and
localization stay unchanged; no unused generation count is read. Slot reads
require the explicitly initialized schema and do not bootstrap billing during
page loading. See `read-route-schema-bootstrap.md` for read and mutation ownership
and `media-delivery.md` for controlled delivery evidence and costs. Root-layout
theme reads and rendering are outside these loader timings.

The shared gallery reader reserves the desktop dialog's viewport-bounded height
from its loading state through details, navigation and retry. Previously its
centered loading box grew after the detail request, moving the whole dialog after
the 500 ms input exclusion window. Content scrolls inside the stable frame; the
standalone watch route retains automatic height and document scrolling. Mobile's
existing full-height reader is preserved. Real-browser geometry coverage belongs
in `tests/example-reader-layout-browser.test.ts`; performance evidence must include
the asynchronous opening journey, not only the initial gallery load.

Active model details use the route-local `loadModelPageInputs` to start four
independent inputs together: `scores`, `engine-settings`, `key-specs` and
`model-gallery`. The route retains gallery selection, exact-model filtering,
public revalidation, managed-empty behavior and legacy alias ordering in its
callback. The optional pricing callback starts `model-pricing` as soon as the same
request's `engine-settings` resolves, using the existing canonical price owners
while the other inputs continue. The route awaits every input and price projection
before composing its hero, gallery and specs. Archive and prelaunch branches
never invoke this loader. Its `model` data timing now includes `model-pricing`;
older aggregate records without that phase are not directly comparable. Layout
and rendering remain excluded. The public result retains the first original
rejection promptly, while model-only diagnostic completion waits for every
started sibling to settle, including later errors. Starting independent readers
together can increase work on a failed request because siblings are not cancelled.
These timings do not isolate database connection wait or establish browser LCP
gains. No new cross-request cache is introduced.

The root layout separately emits `root-layout` / `theme-tokens` for the existing
`getThemeTokensSettingCached()` await, **after** `resolveLocale()`. This bounded
diagnostic uses the same production/build/kill-switch rules and excludes locale
resolution, module initialization, style construction and HTML rendering. It does
not change the theme cache, returned tokens or rejection. A timing record alone
establishes no performance gain and cannot be subtracted from a browser TTFB to
attribute the rest of the delay. Keep the root record separate from the model,
home and comparison loaders; these operations can overlap.

When a trace contains an HTTP 103 response, distinguish the interim response from
the final HTML response before assigning the image's discovery delay to frontend
work. Retain final response-header timing and CDN cache status. Lighthouse's
reported TTFB can refer to the interim response; the remaining wait is not proof
of late image discovery or database latency by itself.

## Acceptance for a real improvement

First prove the implicated phase/interaction improved on the unchanged user journey. Then segment fresh production RUM by deployment and adequate route/device samples. Finally confirm CrUX's explicit window and Search Console group status. Keep the prior baseline; do not reset a failed validation as proof of recovery. A new 28-day window does not excuse an unresolved present-day RUM regression.

## Marketing navigation rendering

`MarketingDesktopNav` keeps its complete server-rendered link tree, but skips unchanged renders when its parent updates mobile or account state. Keep its open/close callbacks stable; desktop selection, pathname and translation changes must still invalidate it. `tests/marketing-navigation-rendering.test.ts` exercises these boundaries through the real navigation components and translation provider. It does not replace real-browser interaction timing, localized navigation or field INP validation.

`MarketingMotion` reads initial section geometry from IntersectionObserver entries, not a synchronous layout loop over deferred content. Initial viewport content and sections above an anchor arrival stay still; eligible sections animate only after crossing the 8% threshold. Keep reduced-motion and route cleanup effective. Browser layout and total CWV still need measurement; avoiding explicit geometry reads alone does not quantify an LCP gain.

Model hero autoplay must cancel pending LCP-wait, delay and idle callbacks when the player or document becomes hidden, then recheck eligibility before mounting. A rejected playback promise must retain a working manual control and ignore stale/aborted attempts. `tests/model-hero-media-lifecycle.test.ts` covers the real component and shared playback owner; verify actual browser loading and first Play as well, without inferring transferred bytes from a mocked media element.

The connected video workspace memoizes its active setup from all authored inputs. Unchanged parent renders must not reserialize that setup. Changed inputs still validate and persist synchronously before route unmount; account isolation, rejected-record recovery and storage fallbacks remain authoritative. `tests/workspace-active-draft-performance-dom.test.ts` checks serialization work through the real hydration path. Synthetic large drafts are stress fixtures, not field INP samples.

The ready view also stabilizes the separate model-review setup and memoizes its
signature. `tests/workspace-model-review-performance-dom.test.ts` exercises the
real ready view and hook: unchanged renders avoid encoding, while each of the ten
authored input fields still invalidates the signature. Keep this coverage distinct
from draft hydration; testing one consumer does not cover the other.

## From a slow metric to a correction

Use existing field tooling before adding another collector. CrUX identifies the outcome; route-level RUM prioritizes affected journeys; a browser or server trace identifies the work to change. If the existing tooling lacks the necessary interaction or server-phase attribution, add only that missing context and document its collection cost and coverage.

For server-heavy routes, time the awaited phases within the same request and retain cache/deployment context. Finding an awaited database query in code is not proof that it dominates real requests. For poor INP, capture the action and its input, processing and presentation delays during a complete visit, including interactions during loading. For LCP, inspect the actual element and distinguish server latency, resource discovery, transfer and rendering.

Keep one evidence record per correction: affected journey, before trace, hypothesis, change, after trace, deployed SHA, field result and sample count. Compare device, geography, consent and cache conditions; report sparse cohorts as inconclusive. Early post-deployment RUM can guide the next correction without waiting for a fully renewed CrUX window, but elapsed time alone does not establish adequate samples or causality.

Use controlled route/component labels for any added attribution. Avoid user content, free-form DOM text, signed URLs and account identifiers. Preserve slow visits, document any metric-independent sampling, and do not count intermediate metric updates as separate visits. Keep consent behavior and the visible user journey intact.
