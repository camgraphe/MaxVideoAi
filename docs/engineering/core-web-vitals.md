# Core Web Vitals: trustworthy site-wide measurements

Owner: public performance. Baseline: 2026-09-26. See [dated Google evidence](../performance/2026-09-26/README.md). Operational route-level evidence belongs in local ignored `.reports/` artifacts.

## What each source answers

| Source | Use | Do not infer |
|---|---|---|
| CrUX daily / History API | Google's eligible Chrome field population, p75 and distributions, explicit 28-day window | Today's deployment performance; a URL value from an origin fallback |
| Search Console | Indexed URL groups and validation status | 145 individually measured slow pages; the start date of a recent regression from first detection |
| Vercel Speed Insights | Prioritize routes with counts, device, country, time range, deployment and element attribution | Identical population to CrUX; reliable route p75 from a handful of events |
| Lighthouse | Reproducible load diagnosis and traces | Field INP, full-session CLS, or passing Google CWV from a score of 100 |
| Normal Chrome journey | Consent, first Play, scroll, SPA transitions and actual interaction diagnosis | Population p75 from a few manual visits |

A CrUX origin includes eligible traffic across the origin. Marketing URLs in Search Console do not establish that later app activity contributes nothing. Keep marketing, public tools and workspace separate in RUM. For SPA diagnosis record the entry URL and the current route, and compare a direct page load with the same page reached through navigation. Do not change navigation to hide later events from the entry page's metrics.

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

## Integrity guardrails

`pnpm cwv:check` checks actual loader consent decisions, crawler media eligibility, middleware routing parity, and CrUX export semantics. The existing Lighthouse workflow runs it before collection.

Performance tooling must receive the same resources and route as a normal Chrome browser with matching consent/device settings. Do not suppress third parties, media, galleries, banners, hydration or later interactions by Lighthouse user-agent, headless browser, audit query flag or environment-specific production branch. Preserve legitimate consent, reduced-motion/data-saving/mobile rules and crawler media behavior.

The routing dependency's bot list includes performance browsers. Its audit/headless entries are excluded from bot routing so those browsers exercise the visitor route. Regression tests compare middleware response targets, not just HTTP status 200.

Do not overwrite metrics, drop inconvenient slow samples or report early values as final values. Existing Vercel collection remains unchanged. No new telemetry destination or field collector is added by this patch.

## Comparison server phases

`loadComparePageData` owns the comparison's independent data and gallery reads. It starts them together; the qualified benchmark, exact prices and complete gallery results still resolve before rendering. Keep prelaunch gallery exclusions in this owner. Its concurrency test holds all read boundaries open to prove that none waits for unrelated data.

Production comparison loads emit one bounded `[cwv:server]` JSON record through existing runtime logs. It contains locale, deployed Git SHA, total **data-loading** duration and the start/duration/status of seven fixed phases: benchmark, scores, key specs, two price reads and two galleries. This is not TTFB, HTML render time or browser LCP. Phases overlap and must not be summed. A resolved fallback still has phase status `ok`; status describes promise completion, not data availability. Pending phases can remain in an error record when a sibling rejects first.

The diagnostic contains no query text, model/job/account IDs, URL or exception content. It preserves rejections and cannot fail a page if logging fails. It is disabled outside production and during a declared production build; `CWV_SERVER_TIMING=0` disables it operationally. No cache, database schema, pricing algorithm, media selection or consent rule is changed by the concurrent loading correction.

## Acceptance for a real improvement

First prove the implicated phase/interaction improved on the unchanged user journey. Then segment fresh production RUM by deployment and adequate route/device samples. Finally confirm CrUX's explicit window and Search Console group status. Keep the prior baseline; do not reset a failed validation as proof of recovery. A new 28-day window does not excuse an unresolved present-day RUM regression.

## From a slow metric to a correction

Use existing field tooling before adding another collector. CrUX identifies the outcome; route-level RUM prioritizes affected journeys; a browser or server trace identifies the work to change. If the existing tooling lacks the necessary interaction or server-phase attribution, add only that missing context and document its collection cost and coverage.

For server-heavy routes, time the awaited phases within the same request and retain cache/deployment context. Finding an awaited database query in code is not proof that it dominates real requests. For poor INP, capture the action and its input, processing and presentation delays during a complete visit, including interactions during loading. For LCP, inspect the actual element and distinguish server latency, resource discovery, transfer and rendering.

Keep one evidence record per correction: affected journey, before trace, hypothesis, change, after trace, deployed SHA, field result and sample count. Compare device, geography, consent and cache conditions; report sparse cohorts as inconclusive. Early post-deployment RUM can guide the next correction without waiting for a fully renewed CrUX window, but elapsed time alone does not establish adequate samples or causality.

Use controlled route/component labels for any added attribution. Avoid user content, free-form DOM text, signed URLs and account identifiers. Preserve slow visits, document any metric-independent sampling, and do not count intermediate metric updates as separate visits. Keep consent behavior and the visible user journey intact.
