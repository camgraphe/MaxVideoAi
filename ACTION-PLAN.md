# MaxVideoAI — SEO Action Plan

**North-star objective:** Grow qualified US organic acquisition while increasing the percentage of organic visitors who reach wallet top-up and first render.

## Measurement framework

Track weekly:

| KPI | Current baseline | 90-day direction |
|---|---:|---:|
| US GSC CTR | 0.3% | At least 0.6% without losing position |
| Desktop GSC CTR | 0.6% | At least 1.0% |
| Global GSC CTR | 1.0% | 1.3–1.5% |
| Actionable HTML crawled, not indexed | 329 URLs | Down after qualified pruning; report CSS separately |
| Indexed comparison details | 641/876 | Preserve winners, shrink weak inventory in controlled batches |
| CSS in “crawled, not indexed” | 531 URLs / 85 file paths | Monitor as deployment noise; do not block Next assets |
| Mobile P75 LCP | 2.67s Vercel / >2.5s GSC cluster | <2.5s |
| Mobile P75 CLS | 0.18 | <0.10 |
| Signup → wallet | 9.4% | Improve through pricing/activation experiments |
| Wallet → first render | 92.1% | Maintain above 90% |
| Returning render users, weekly | 4 | Establish cohort target after tracking repair |
| Attributable organic key events | 2, currently unreliable | Reliable event and revenue attribution |

## Days 0–7 — stop data loss and index dilution

### P0.1 Repair analytics ownership and attribution

**Impact:** Critical

**Primary files:** analytics bootstrap, GTM loader, GA4 server sender, Stripe webhook

- Choose one client-side owner: GTM or direct `gtag.js`.
- On the same page as consent acceptance, issue and verify the granted consent update.
- Persist GA4 `client_id`, `session_id`, consent state and timestamp into checkout metadata.
- Send these identifiers with Measurement Protocol purchase events.
- Emit recommended `sign_up`, `login` and `purchase` events, while retaining custom diagnostic events if useful.
- Add funnel events: `view_model`, `view_example`, `select_model`, `generate_intent`, `begin_checkout`, `wallet_top_up`, `first_render_completed`.
- Validate in GA4 DebugView and compare the event ledger against admin transactions.

**Done when:** first-session consent produces the correct granted state without reload; one page view is sent; purchases retain their source/session/landing page.

### P0.2 Stop URL discovery and IndexNow leaks

**Impact:** Critical

**Implementation status — 11 July 2026:** the comparison/hub submission leak is fixed locally. IndexNow now derives comparison URLs from the same `publishedPairs` publication set as the sitemap, emits the canonical FR/ES hubs, and no longer silently truncates the sorted list at 200 URLs. A contract test enforces exact parity between the IndexNow comparison set and the sitemap source of truth. Deployment and post-deployment observation remain required.

- Make `scripts/indexnow-submit-changed.mjs` consume the official `publishedPairs`/sitemap URL builder instead of generating every model combination.
- Submit only canonical, indexable, 200-status URLs.
- Replace redirecting `/fr/ai-video-engines` and `/es/ai-video-engines` submissions with the canonical localized hubs.
- Add a contract test enforcing `IndexNow URLs ⊆ sitemap canonical URLs`.
- Remove the arbitrary alphabetical 200-URL truncation so prioritization is explicit and deterministic.
- Stop exposing public links to `/video/job_*`, application state URLs and sort/filter variants.

**Done when:** a dry run contains no redirect, `noindex`, private job, parameter variant or non-sitemap URL.

Current verified dry run: 1,072 URLs, including 876 localized published comparison URLs, with zero query-string, `/app`, `/video/job_*`, redirecting localized hub or non-sitemap model URL. The broader cleanup of private-job discovery and already indexed application URLs remains under P0.4.

### P0.3 Contain the programmatic comparison surface

**Impact:** Critical

- Use the complete GSC inventory: 641 comparison details are already indexed and 183 additional clean comparisons are crawled but not indexed.
- Score every pair on impressions, clicks, rank, backlinks, conversions, paired media, unique verdict and source quality.
- Preserve every proven winner regardless of whether it belongs to the code-defined strategic set.
- Use 56 strategic English pairs and 17 genuinely enriched FR/ES pairs as a conservative floor, then add proven GSC/backlink/conversion winners.
- Remove weak pairs from sitemaps and apply `noindex,follow` until they qualify.
- Deploy changes in batches of 50–100 URLs and measure for 28 days; do not bulk-deindex all candidates at once.
- Only localize a comparison after English proof or local query evidence.

**Index eligibility gate:** unique verdict + real paired outputs + documented test setup + demand/strategic justification + accurate visible prices.

### P0.4 Remove private and parameter URLs from the index

**Implementation status — 11 July 2026:** `/app` is now crawlable for general search crawlers in the local robots policy so Google can read the existing page-level `noindex` metadata and middleware `X-Robots-Tag` on every query variant. Named AI crawlers remain blocked from the workspace, as do API, admin and other sensitive routes. Approved related-video links now point directly to their editorial canonical slug instead of creating a crawlable `job_*` redirect URL.

- Audit the 53 indexed `/video/` URLs against the 44 intended editorial video pages.
- Keep public editorial videos stable; protect user render jobs with auth/signed URLs and stop linking them publicly.
- Remove the two indexed `/app?...` URLs. Use `401/403`, `404/410`, or a crawlable `noindex` response according to the route; do not rely on `robots.txt` alone.
- Consolidate `/es/galeria?engine=hailuo` toward the canonical gallery unless it has distinct search demand.
- Remove internal links to `?order=`, filters and tracking variants; redirect purely promotional parameters when safe.

Still pending: deploy the robots change, request temporary removal of the two already indexed `/app?...` URLs in GSC, audit public gallery/share links before changing their product behavior, and reconcile the 53 indexed video URLs with the 44 editorial sitemap entries.

### P0.5 Correct trust-breaking facts and schema

- Make every schema price equal to a visible purchasable offer or remove the offer.
- Replace physical-product properties with `SoftwareApplication`/`WebApplication` semantics where appropriate.
- Unify the homepage organization identity and logo.
- Remove commercial FAQ/retired HowTo JSON-LD while keeping visible content.
- Update or redirect the obsolete Sora article.
- Audit unsupported claims in Docs, especially shared wallets, review workflows and trust controls.
- Correct the ranking inconsistency on “Best AI Video Engines for Ads”.

### P0.6 Launch the first snippet experiments

Test intentional, non-truncated titles and descriptions on:

1. `/examples/kling`
2. `/examples/ltx`
3. Seedance 2.0 vs Fast
4. `/pricing`
5. `/models/ltx-2-3-fast`
6. `/models/veo-3-1`
7. Veo Fast vs Lite
8. `/models/pika-text-to-video`

Suggested title directions:

- `Kling AI Examples: Prompts, Settings, Costs & Videos`
- `LTX 2.3 Prompt Examples: Videos, Settings & Real Costs`
- `Seedance 2.0 vs Fast: Quality, Speed & Price Test`
- `AI Video Pricing: Compare Veo, Kling, LTX & More`
- `Veo 3.1 Pricing, Examples & Settings — Tested`

Descriptions should lead with the US differentiator: same-prompt output, exact price, test date and no subscription. Measure each change for at least 14–28 days and annotate GSC.

### P0.7 Begin the mobile/CWV fix

- Separate public marketing rendering from server-side auth/cookie reads.
- Make public pages CDN-cacheable.
- Identify the LCP element on homepage, models, pricing and blog templates.
- Preload only the real hero asset; provide correct responsive media dimensions.
- Reduce serialized catalog/comparison payloads and non-critical hydration.
- Audit font loading and remove render-blocking/unneeded CSS.
- Set explicit layout dimensions to bring CLS below 0.10.
- Set a suitable Next Image cache TTL, provide accurate `sizes`, and reduce offscreen SSR galleries. Do not block `/_next/static` or `/_next/image` in robots.

### P0.8 Clean obvious index errors

**Implementation status — 11 July 2026:** the legacy `/models/google-veo-3` redirect now points directly to `/models/veo-3-1`, the `startupfa.me` tracking-source exception no longer escapes noindex treatment, and Next Image has a conservative seven-day minimum optimized-image cache TTL while mutable marketing assets still use stable filenames.

- Resolve the 72 reported 404s or return intentional 410s where appropriate.
- Replace long-term localized 307 redirects with 301/308.
- Add `/return-policy` to the sitemap if it is intentionally indexable.
- Synchronize sitemap-index and child `lastmod` values.
- Fix the `/models/google-veo-3` → `/models/veo-3` → `/models/veo-3-1` redirect chain. **Implemented locally.**
- Remove the special indexable `utm_source=startupfa.me` behavior. **Implemented locally.**
- Decide whether `/v/{id}` should redirect to a stable public video or disappear from all discovery paths.

## Days 8–30 — turn evidence into an SEO moat

### P1.1 Publish the MaxVideoAI Benchmark Lab

Create a methodology hub with:

- tested date and model version;
- sample size and prompts;
- resolution, aspect ratio, duration and settings;
- number of retries/failures;
- median/P90 render time;
- success and automatic-refund rate;
- evaluator and weighting method;
- limitations and update changelog.

Expose aggregated admin data, never user-level data. Link the methodology from every model and comparison scorecard.

### P1.2 Strengthen human trust

- Expand About with the legal operating entity, location, named team/testers and mission.
- Add author and reviewer profiles to the blog and benchmark pages.
- Publish editorial, corrections and benchmark-update policies.
- Make commercial-use/licensing and input/output data treatment easy to find.
- Add two to four real case studies with cost, iteration count and accepted output.

### P1.3 Build page-to-wallet conversion paths

On high-traffic examples/comparisons:

- add “Run this exact prompt” with model/settings prefilled;
- display the exact expected wallet charge before signup;
- explain failed-render refund behavior next to the CTA;
- offer a guided first-render flow rather than a generic workspace landing;
- measure `generate_intent → sign_up → top_up → first_render`.

The objective is to improve the 9.4% signup-to-wallet stage while preserving the 92.1% wallet-to-render stage.

### P1.4 Consolidate overlapping LTX/Seedance/Veo intent

- Map each significant query cluster to one primary page.
- Merge or reposition pages that compete for “prompt guide”, “examples”, “pricing” or “vs” intent.
- Add canonical/redirect logic only after verifying query-level page ownership in GSC.
- Link strong examples pages to the relevant model, pricing and comparison pages using descriptive anchors.

### P1.5 Publish only four competitor pages

Start with:

- MaxVideoAI vs Higgsfield
- MaxVideoAI vs Pollo AI
- MaxVideoAI vs Artlist
- MaxVideoAI vs Runway or Dreamlux, selected by demand

Each must use current US prices, supported models, licensing, same-prompt output tests and use-case verdicts. Avoid another programmatic matrix.

### P1.6 Repair internal SEO operations

The admin SEO cockpit currently reports no cached GSC snapshot and therefore generates zero actions.

- Repair or schedule the GSC cache refresh.
- Store the selected time window and previous-period snapshot.
- Add index-eligibility and CTR-opportunity scoring.
- Keep automated recommendations draft-only until a human approves changes.

## Days 31–90 — compound authority and qualified demand

### P2.1 Ship a US content program from proven demand

Prioritize clusters already appearing in GSC:

- Veo 3.1 pricing, quality modes, Lite/Fast differences and examples;
- Kling prompt examples, model versions and image-to-video workflows;
- LTX 2.3 pricing, video length and image-to-video prompting;
- Seedance 2.0 vs Fast and 1.5/2.0 comparisons;
- Pika maximum video length and plan limitations;
- use cases: ecommerce ads, UGC ads, product launches, storyboards and short films.

Every page should contain a direct answer, primary source, real output, test date, exact cost and next action.

### P2.2 Earn deep links with original data

- Publish a monthly AI Video Model Benchmark report.
- Offer a downloadable/embeddable table with source attribution.
- Pitch findings to creator-economy, video-production and AI publications.
- Target links to Benchmark Lab, model studies and comparison research—not only the homepage.
- Reduce dependence on directories and sitewide low-authority links.

### P2.3 Introduce an index-quality operating rule

Review monthly:

- pages with no impressions after 60–90 days;
- pages with impressions but zero clicks;
- pages with no unique media/evidence;
- comparison pages whose model versions are obsolete;
- pages cannibalizing the same query cluster.

Refresh, merge or `noindex` them. Do not let the sitemap grow automatically with every possible model pair.

### P2.4 Expand internationally only after English proof

- Keep English as `x-default`; localized pages remain self-canonical.
- Prioritize Spanish and French clusters where CTR and engagement already outperform the US.
- Localize examples, query framing and pricing context—not just interface copy.
- Add new languages only when search demand and support capacity justify them.

## Recommended first implementation batch

The safest high-impact batch is:

1. analytics consent/tag deduplication and session-aware purchases;
2. comparison index-eligibility rules and sitemap filtering;
3. accurate software-offer schema;
4. five top-page snippet rewrites;
5. cacheable marketing layout and homepage/model/pricing mobile LCP work;
6. Benchmark Lab methodology page and per-page test metadata.

This sequence fixes measurement first, then controls crawl quality, then improves the pages with the greatest demonstrated demand.
