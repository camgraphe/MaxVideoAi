# MaxVideoAI Benchmark Lab Design

**Date:** 2026-07-11
**Status:** Approved by user for written specification
**Branch:** `codex/seo-benchmark-lab`
**Base:** `origin/main` at `8b9d529d2dde5285e693fdc60531c73495b5daff`

## Objective

Publish one central, indexable Benchmark Lab that makes MaxVideoAI model scores and observed production performance understandable, useful, and honest.

The page must help a visitor answer four questions:

1. What do MaxVideoAI's model scores measure?
2. Which values are editorial judgments, provider specifications, or observed production metrics?
3. How much evidence supports each published value?
4. What are the limitations of the current evidence?

The lab is a public evidence surface for people first. Search engines, answer engines, journalists, and other sites can also use its explicit definitions, dates, sources, and internal links. The feature must not fabricate historical test records or present a manually calibrated score as a reproducible scientific benchmark.

Transparency must strengthen the product rather than make every page sound apologetic. Model pages and comparison scorecards use positive, accurate source labels and link to one concise methodology page.

## Evidence Baseline

The July 11 data-quality review confirmed the following starting state.

### Editorial scores and specifications

- `data/benchmarks/engine-scores.v1.json` contains 31 unique model score rows.
- Every row has the core quality fields used by current scorecards, and no score is outside the 0–10 range.
- Four score rows have no `last_updated` value: Sora 2 Pro, LTX 2 Fast, Wan 2.5, and Kling 2.5 Turbo.
- The score file describes its method as `manual-v1-internet-calibrated-with-platform-pricing`.
- It contains no canonical prompt pack, model-version record, run count, retry count, failure count, evaluator identity, or run-level evidence.
- `data/benchmarks/engine-key-specs.v1.json` contains 38 specification rows with source links.

The existing scores are therefore usable as editorial scorecards, but not as documented benchmark runs. A score row's `last_updated` value means only that the score was last edited on that date. It must not be relabeled as a tested date.

### Observed production data

The read-only review of the production database found:

- 1,304 generation-metric events during the preceding 30 days;
- 679 distinct job IDs and 49 distinct users in those events;
- 572 terminal jobs across 26 engines after excluding the configured administrator account;
- 469 completed and 103 failed terminal jobs in that filtered cohort;
- job-lifecycle duration available for all 469 completed jobs;
- detailed `completed` generation-metric events for only 213 of the 469 completed jobs, or 45.4% coverage;
- data fresh through 2026-07-11.

The product code automatically refunds eligible failed paid generations. The page states that behavior directly. Refund automation is not a benchmark KPI in this V1, so the lab does not publish a separate automation percentage or add refund-provenance caveats.

The public latency calculation must therefore use the canonical job lifecycle (`app_jobs.updated_at - app_jobs.created_at`) rather than the partial generation-event stream. The detailed event table remains useful for diagnostics, but it is not complete enough to be the public latency source in this version.

Eight completed jobs had an end-to-end duration above one hour and three were above six hours. Median and P90 are intentionally preferred over mean and maximum because they are more resistant to that long tail. Valid positive durations are not silently trimmed; the limitations section explains that manual updates, provider queues, or delayed polling can extend a job lifecycle.

### Current publishable latency cohort

Using the internal eligibility threshold of at least 30 completed jobs and 5 distinct non-admin users in 30 days, three engines currently qualify for latency publication:

| Engine | Completed jobs | Distinct users | Completed-job P50 | Completed-job P90 |
| --- | ---: | ---: | ---: | ---: |
| Kling 3 Pro | 104 | 28 | 230.8s | 451.6s |
| Veo 3.1 Lite | 79 | 5 | 228.4s | 407.7s |
| Kling O3 Pro | 46 | 11 | 337.9s | 685.9s |

This table documents the design evidence only. Its values must not be copied into public source code. The public page calculates a fresh rolling snapshot through a server-only query.

Seedance 2.0 has only 24 completed jobs in this snapshot, so its latency values remain internal until the threshold is met.

## Approaches Considered

### 1. Hybrid evidence lab — selected

Publish all existing scorecards with the positive `MaxVideoAI editorial score` label, publish sourced specifications, and add fresh observed production metrics only when cohort and metric-specific thresholds are met.

This approach gives the page useful data at launch while preserving the distinction between subjective quality evaluation and measured platform performance. It also creates a contract for future documented benchmark runs without pretending those runs already exist.

### 2. Methodology-only page

This would be safe but too weak. A page called Benchmark Lab that contains definitions but no model data would not materially improve user decision-making or demonstrate MaxVideoAI's first-party evidence.

### 3. Publish every available aggregate immediately

This would produce more populated tables, but low-volume or administrator-heavy cohorts would be misleading. It would also expose inconsistent latency definitions because the detailed event stream has only 45.4% completed-job coverage.

## Public Routes and Localization

Add one localized route with these public URLs:

- `/benchmarks`
- `/fr/benchmarks`
- `/es/benchmarks`

The English copy uses American English. Spanish uses neutral Latin American Spanish. French remains fully localized. The same `benchmarks` path segment is retained in all three locales for clarity and stable linking.

All three pages are indexable, self-canonical, included in their locale sitemap, and connected through reciprocal hreflang plus `x-default` to English.

## Information Architecture

The page is a Server Component and contains the following sections in this order.

### 1. Hero and evidence legend

The hero explains that MaxVideoAI compares model quality, product specifications, and observed platform performance. A compact legend defines three source classes:

- **Editorial score:** a MaxVideoAI judgment on a 0–10 scale;
- **Provider or product specification:** a capability verified from a cited provider source and the current MaxVideoAI route;
- **Observed on MaxVideoAI:** an anonymized rolling aggregate calculated from production jobs.

The hero must not use `independent scientific benchmark`, `laboratory verified`, or similar wording.

### 2. Current model scorecards

Render the 31 existing score rows in a usable model table. Each row includes:

- model name linked to its canonical model page when available;
- current overall editorial score;
- prompt adherence, visual quality, motion realism, temporal consistency, human fidelity, text legibility, sequencing, and controllability;
- audio/lip-sync only where the model supports it;
- score last-updated date when available;
- evidence status.

The visible source label for current rows is `MaxVideoAI editorial score`. Dates appear where they are recorded. When a row has no update date, the table simply omits the date and never backfills today's date.

The current overall score retains the production formula already used by the model and comparison hubs: the unweighted arithmetic mean of prompt adherence (`fidelity`), motion realism (`motion`), and temporal consistency (`consistency`), rounded to one decimal. Visual quality, anatomy, text rendering, audio/lip-sync, sequencing, controllability, speed/stability, and pricing are visible supporting criteria but are not silently folded into that overall value.

Observed latency and reliability never change the editorial quality overall. Pricing never changes the editorial quality overall.

### 3. Sourced model specifications

Expose the current model capabilities that support comparison decisions, including maximum duration, resolution, input modes, reference support, audio support, lip sync, and applicable release information.

Each specification remains tied to the source URLs in `engine-key-specs.v1.json` and to the capability actually exposed through MaxVideoAI. Provider support that is not exposed by the current MaxVideoAI route must not be presented as available in the product.

The V1 lab is limited to public video-model scorecards. Image-only models and specification rows without a video benchmark score are not added merely to inflate the table. Applicable specifications render in a dedicated responsive semantic table with a source link per model. This keeps provider/product facts visibly separate from editorial scores and observed production data.

### 4. Observed production performance

Render a rolling 30-day table generated on the server. For each eligible model, show:

- observation window and `as of` timestamp;
- completed-job median render time;
- completed-job P90 render time.

The page does not render user IDs, job IDs, prompts, uploaded media, provider payloads, error messages, or per-user segments.

Eligibility and metric rules are:

- completed states are `completed`, `success`, `succeeded`, and `finished` after lowercase normalization;
- latency is published only with at least 30 completed jobs and 5 distinct non-admin users;
- latency includes completed jobs with non-null timestamps and `updated_at > created_at`;
- median is `PERCENTILE_CONT(0.5)` and P90 is `PERCENTILE_CONT(0.9)` over end-to-end job duration;
- the exact completed-job count and distinct-user count are used only for eligibility and are not returned to the public page.

The operational table contains only models that meet the publication threshold. A short neutral line below it says that additional models appear as their rolling sample matures. Models outside the operational cohort still retain their complete editorial scorecards and specifications; the page does not attach a negative warning cell to every one of them.

A compact product-protection note says: `Failed paid generations are automatically refunded.` It is not presented as a scored benchmark criterion or a percentage.

### 5. Methodology and weighting

Publish the exact definitions of every score criterion, the current overall formula, the evaluation scale, and the separation between quality, price, and operational performance.

Add a versioned methodology source under `data/benchmarks/`. It contains:

- methodology version and effective date;
- criterion IDs, localized labels, definitions, and scoring anchors;
- the current overall formula;
- a standard future prompt pack;
- required run metadata;
- operational metric definitions and thresholds;
- known limitations;
- a dated methodology changelog.

The standard future prompt pack covers at least:

1. human hands interacting with an object;
2. two-character blocking and identity consistency;
3. fast subject and camera motion;
4. product, logo, and on-screen text legibility;
5. cinematic lighting and material detail;
6. constrained camera or reference-image control;
7. dialogue and lip synchronization for audio-capable models;
8. multi-shot sequencing and continuity where supported.

This lot authors and publishes the full text of the eight canonical prompts in the methodology source. The page labels them as the protocol for new documented runs. It must not imply that every historical score used this prompt pack.

A future score can be labeled `Documented benchmark run` only when its evidence record includes:

- evaluation date;
- exact public model/version identifier;
- evaluator and reviewer;
- applicable prompts or prompt-pack version;
- sample size;
- resolution, aspect ratio, duration, mode, and relevant controls;
- retry and failure counts;
- scoring notes or stored aggregate evidence.

### 6. Limitations and update history

The visible limitations section states that:

- generative outputs vary between runs;
- some models do not support every criterion;
- provider capacity and queues change over time;
- production traffic is not a controlled experiment;
- rolling performance may reflect incidents, routing changes, and user-selected settings;
- MaxVideoAI sells access to the compared models and therefore discloses its commercial interest.

The methodology changelog records changes to prompts, criteria, formulas, thresholds, or data sources. Score-row edits retain their existing row-level update date.

### 7. Next actions

End with links to the model catalog, video comparison hub, pricing, and workspace. The page helps a visitor choose a model; it does not become a second generation interface.

## Data Boundaries and Server Architecture

Create a server-only benchmark metrics module that owns the public aggregate query and returns a small plain-data contract. Route components must never issue SQL or receive raw rows containing user or job identifiers.

The server module:

- reads `app_jobs` as the source of terminal outcomes and end-to-end duration;
- excludes `ADMIN_EXCLUDED_USER_IDS` before grouping;
- groups by canonical engine ID;
- maps engine IDs to public model slugs through the existing catalog rather than duplicating model names;
- returns only display-safe aggregates;
- handles a missing database or query failure by returning an unavailable state, not zero-valued performance;
- defines the rolling window in PostgreSQL from `NOW() - 30 days` using stored timezone-aware timestamps;
- reports data freshness from the latest included terminal-job update rather than pretending the cache-generation time is a new observation;
- uses a six-hour revalidation interval so the marketing route remains cacheable;
- does not call schema-creation helpers from the public read path.

The public result type is equivalent to:

```ts
type PublicBenchmarkPerformance = {
  engineId: string;
  modelSlug: string | null;
  windowDays: 30;
  asOf: string;
  medianDurationMs: number | null;
  p90DurationMs: number | null;
};
```

The route receives only eligible rows. It receives no job count, failure count, success rate, or distinct-user count.

## Integration With Existing Pages

Add one unobtrusive localized `How we benchmark` link to:

- every comparison scorecard section;
- every public video-model detail surface represented in the score dataset;
- the model or comparison hub near its score explanation when the hub exposes an overall score.

The links point to the visitor's locale-specific Benchmark Lab. Existing score values, model availability, legacy-model access, comparison publication, pricing, and generation behavior remain unchanged.

Legacy models remain eligible for editorial display when they are still accessible on MaxVideoAI. `Legacy` describes product generation or positioning and does not reduce their editorial score visibility.

## SEO and Structured Data

Use localized metadata targeting benchmark-methodology and AI video model comparison intent without claiming independent laboratory certification.

The page emits:

- `WebPage` structured data;
- `BreadcrumbList` structured data;
- visible dates that match the methodology and observed snapshot;
- crawlable semantic tables and headings;
- localized canonical and hreflang URLs.

Do not emit `Dataset` structured data in this lot because the V1 does not publish a downloadable dataset. Dataset markup can be considered later with a versioned download, durable license, and distribution URL.

The new route is discovered by the existing localized sitemap system. Tests must confirm that all three exact locale URLs are present once and that no admin or API route becomes discoverable.

## Failure and Empty States

- If the database is unavailable, render editorial scores, sourced specifications, and methodology normally. The observed section says that the current production snapshot is temporarily unavailable.
- If no model meets the operational threshold, render the threshold explanation and scorecards rather than an empty table.
- If an engine cannot map to a public model slug, omit it from the public table and retain it only in server diagnostics.
- If a model score has no update date, omit the date instead of inventing one.
- If a metric is ineligible, render its reason; never substitute zero.
- If a specification source is absent, do not invent one or present the spec as provider-verified.

## Testing Strategy

Implementation uses focused contract tests before production changes. Automated coverage must verify:

1. the methodology data has a version, effective date, criteria, overall formula, prompt pack, required run fields, limitations, and changelog;
2. criterion IDs align with the score fields consumed by current model and comparison surfaces;
3. the current overall formula remains the unweighted mean of fidelity, motion, and consistency;
4. all 31 current scores remain in range and unique;
5. missing historical dates are omitted rather than being backfilled or repeated as negative warnings;
6. current scores use the positive `MaxVideoAI editorial score` label and are not mislabeled as documented runs;
7. administrator users are excluded before aggregation;
8. duplicate event rows cannot duplicate canonical jobs because public outcomes use `app_jobs` grain;
9. median and P90 formulas match this specification;
10. latency publication requires 30 completed jobs and 5 distinct users;
11. completed-job and distinct-user counts remain internal eligibility inputs;
12. success rate, failure count, and sample size do not enter the public result contract;
13. invalid or missing durations are excluded without changing eligibility counts;
14. database failure returns an unavailable snapshot rather than zeros;
15. the route stays a thin Server Component and route-local sections own rendering;
16. English, French, and Latin American Spanish contain equivalent definitions and caveats;
17. canonical, hreflang, sitemap, and structured-data output are correct in all three locales;
18. model and comparison score surfaces link to the localized lab;
19. no user ID, job ID, prompt, media URL, provider payload, or error detail enters the public data contract;
20. refund copy states directly that failed paid generations are automatically refunded and exposes no unsupported automation percentage;
21. existing model, comparison, sitemap, localization, pricing, and architecture tests remain green.

Manual browser checks cover:

- all three localized Benchmark Lab routes on desktop and mobile;
- semantic table overflow and keyboard navigation;
- a model with publishable latency;
- a model with insufficient operational evidence;
- the database-unavailable state;
- links from representative model and comparison scorecards;
- canonical, hreflang, JSON-LD, and sitemap output.

## Acceptance Criteria

- The page contains real model data at launch; it is not a methodology-only shell.
- All existing editorial scores are clearly identified as editorial evidence.
- No historical score is presented as a documented run without the required metadata.
- Model and comparison pages do not repeat defensive caveats; they use concise positive source labels and link to the central methodology.
- Eligible production latency is fresh, anonymized, deduplicated at job grain, and accompanied by its rolling window.
- Job count, user count, failure count, and success rate remain internal and are not displayed.
- Failed paid generations are described directly as automatically refunded, without an automation-rate KPI or admin caveat.
- Editorial quality, product specifications, pricing, and observed performance remain visibly separate.
- The page remains useful when the database is unavailable.
- Every visible claim has a source class, definition, date, or limitation.
- All three localized routes are indexable and internally linked from relevant score surfaces.
- Existing public URLs, model access, comparison access, score values, pricing, billing, and generation behavior remain unchanged.

## Rollout and Observation

Deploy the page and internal links as one lot. On release, record the count of eligible engines and inspect the generated snapshot for unexpected mappings or impossible durations before search-engine submission.

After deployment:

- verify sitemap discovery and request indexing for the English page first;
- inspect French and Spanish hreflang parity;
- monitor Benchmark Lab impressions, clicks, cited queries, and referral links;
- review operational cohort eligibility monthly;
- log every methodology or formula change in the public changelog;
- do not silently rewrite historical score dates.

The first documented prompt-pack evaluation is a later evidence-collection operation because it creates paid generations and requires explicit execution approval. Complete future runs can add a `Documented benchmark run` badge model by model.

## Non-Goals

- No paid benchmark generation in this lot.
- No invented prompts, run counts, model versions, evaluators, retries, failures, or tested dates for historical scores.
- No automatic rewriting of editorial quality scores from production traffic.
- No public user-level, job-level, prompt-level, or media-level data.
- No public admin dashboard or raw database endpoint.
- No provider incident timeline or retrospective removal of bad production days.
- No per-model benchmark SEO routes.
- No downloadable dataset or `Dataset` schema in this version.
- No automatic benchmark-score editor in admin.
- No change to model availability, including accessible legacy models.
- No change to pricing, wallet, refunds, provider routing, generation, comparison indexation, or Studio behavior.
