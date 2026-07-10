# MaxVideoAI — Full SEO Audit

**Audit date:** 10 July 2026

**Primary market:** United States

**Secondary scope:** Worldwide, with English as `x-default` and French/Spanish localization

**Mode:** Read-only audit; no production setting or application behavior was changed

## Executive summary

MaxVideoAI already has genuine search traction and a commercially distinctive proposition: an independent, pay-as-you-go layer for comparing AI video models using real outputs and visible prices. Search visibility is growing, the homepage and model/example architecture are strong, and the product converts very well **after** a user funds a wallet.

The current constraint is not a lack of pages. It is the combination of:

1. a very low US and desktop click-through rate;
2. excessive indexable comparison-page inventory relative to domain authority;
3. broken/incomplete analytics attribution;
4. weak human trust and benchmark methodology signals;
5. mobile LCP/CLS and an uncacheable marketing shell;
6. a large signup-to-wallet activation leak.

The recommended strategy is therefore **fewer indexable pages, stronger evidence, better snippets, reliable attribution, and tighter page-to-purchase journeys**.

## Directional SEO health score: 60/100

This is a prioritization score, not a Google metric.

| Category | Score | Weight | Main reason |
|---|---:|---:|---|
| Technical SEO | 14/25 | 25% | Valid crawl paths and hreflang, but index bloat, no-cache marketing pages and stale sitemap dates |
| Content quality | 15/25 | 25% | Strong model/example pages, but templated comparisons, stale claims and weak authorship |
| On-page SEO | 14/20 | 20% | Titles, metas and H1s are broadly complete; CTR and title truncation remain material |
| Structured data | 5/10 | 10% | Broad implementation, but inaccurate offers, duplicate organizations and unsuitable types |
| Performance/CWV | 5/10 | 10% | Desktop is good; mobile LCP/CLS and the application routes need work |
| Images/video | 3/5 | 5% | Real output media is a major asset, but delivery and evidence framing can improve |
| AI-search readiness | 4/5 | 5% | SSR, `llms.txt` and crawler access are strong; citability and named expertise are weak |

## Data reviewed

- Google Search Console, including performance, indexation, links, security and manual actions.
- Google Analytics 4, including the Search Console landing-page report.
- Vercel Web Analytics and Speed Insights.
- MaxVideoAI admin insights and SEO cockpit.
- Semrush project data.
- Live crawl and source-code review.
- Public review of Higgsfield, Artlist, Pollo AI and Dreamlux.

## 1. Search performance

### Three-month Search Console baseline

Period: 9 April–8 July 2026.

| Metric | Result |
|---|---:|
| Clicks | 5,526 |
| Impressions | 570,717 |
| CTR | 1.0% |
| Average position | 8.5 |

The average position is already competitive. The larger short-term opportunity is converting existing visibility into clicks.

### US market gap

| Market | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| United States | 704 | 257,482 | 0.3% | 9.7 |
| India | 513 | 20,541 | 2.5% | 7.4 |
| France | 283 | 15,005 | 1.9% | 7.4 |
| Germany | 236 | 16,034 | 1.5% | 7.4 |
| Spain | 234 | 11,617 | 2.0% | 7.6 |

The United States produces about 45% of impressions but only about 13% of clicks. Its CTR is roughly one sixth of France/Spain and one eighth of India. This supports a US-first snippet, intent and trust program.

### Device gap

| Device | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| Desktop | 3,189 | 511,703 | 0.6% | 8.5 |
| Mobile | 2,254 | 57,502 | 3.9% | 8.4 |
| Tablet | 83 | 1,512 | 5.5% | 11.2 |

Desktop owns 90% of impressions but has a 0.6% CTR. The page titles/descriptions and SERP fit should be tested primarily on US desktop queries.

### Highest-leverage pages

| Page | Clicks | Impressions | CTR | Position | Observation |
|---|---:|---:|---:|---:|---|
| `/examples/ltx` | 1,206 | 96,328 | 1.3% | 7.1 | Largest proven non-brand asset; strong engagement |
| `/examples/kling` | 199 | 60,013 | 0.3% | 7.2 | Severe snippet/intent mismatch despite page-one visibility |
| Seedance 2.0 vs Fast | 218 | 33,636 | 0.6% | 6.2 | Strong comparison demand, weak CTR |
| `/models/ltx-2-3-fast` | 39 | 19,244 | 0.2% | 7.8 | Very high upside from clearer title/intent |
| `/pricing` | 37 | 14,037 | 0.3% | 10.0 | Commercial page is barely converting impressions into clicks |
| Veo 3.1 Fast vs Lite | 28 | 13,396 | 0.2% | 7.6 | Strong BOFU opportunity |
| `/models/pika-text-to-video` | 3 | 12,135 | ~0% | 8.0 | Page-one visibility with virtually no clicks |
| `/ai-video-engines` | 16 | 11,099 | 0.1% | 9.0 | Hub needs a much more explicit promise |

A rough opportunity model using conservative position-based CTR targets suggests that `/examples/ltx` and `/examples/kling` alone could produce the largest incremental click gains. These are directional estimates, not forecasts.

### Query clusters

Strong assets:

- `ltx 2.3 prompt examples`: 126 clicks, 682 impressions, 18.5% CTR, position 2.4.
- `pay as you go ai video generator`: 13 clicks, 138 impressions, 9.4% CTR, position 2.0.
- Seedance comparisons frequently rank positions 2–4.

Underperforming demand:

- `veo 3.1`: 32 clicks, 5,694 impressions, 0.6% CTR, position 8.3.
- `ltx 2.3 prompt guide`: 34 clicks, 1,923 impressions, 1.8% CTR, position 7.4.
- `ltx 2.3 prompting guide`: 11 clicks, 1,341 impressions, 0.8% CTR, position 7.6.
- Numerous zero-click queries already have 80–160 impressions: Google Veo 3.1, Kling prompts/examples, LTX pricing/video length and Pika maximum video length.

## 2. Analytics and commercial attribution

### GA4 is not reliable enough for SEO revenue attribution

Over 90 days, the linked GA4 Search Console report shows:

- 5,434 organic Google clicks;
- 580,552 impressions;
- only 705 active users;
- 905 engaged sessions;
- 71.09% engagement rate;
- 4m34s average engagement per active user;
- only 2 key events, both attached to an empty landing-page value.

The 705 active users represent only about 13% of Search Console clicks. Consent refusals and blockers explain part of this, but the implementation has additional defects:

1. On first consent acceptance, GA initially sends `analytics_storage: denied`; the granted state is correctly applied only after reload.
2. Direct `gtag.js` and GTM both emit identical GA4 and Google Ads requests.
3. Server-side `purchase` events omit `session_id`; when no `_ga` cookie exists, an invented client ID disconnects the purchase from its acquisition session.
4. Auth events use `sign_up_completed` and `login_completed` instead of the recommended `sign_up` and `login` events.

Relevant code:

- `frontend/components/analytics/ConsentModeBootstrap.tsx`
- `frontend/components/legal/cookie-banner-client.ts`
- `frontend/components/analytics/GtmLazyLoader.tsx`
- `frontend/components/analytics/GoogleAds.tsx`
- `frontend/src/server/ga4.ts`
- `frontend/app/api/stripe/webhook/route.ts`

Until this is corrected, SEO-to-signup, SEO-to-wallet and SEO-to-revenue reporting should be treated as incomplete.

### Internal business funnel

The admin data provides the clearest commercial signal:

| Funnel stage | Users | Rate |
|---|---:|---:|
| Synced accounts | 2,432 | 100% |
| Loaded wallet | 228 | 9.4% |
| First render within 30 days of top-up | 210 | 8.6% overall / 92.1% of wallet users |

The main commercial leak is **signup → wallet top-up**, not wallet → first render.

Current 90-day momentum:

- 1,024 signups, +71.2% vs the previous period;
- $2,921 in wallet top-ups across 196 loads, +215.8%;
- $3,187 in render charges across 1,646 charges, +247.9%;
- average wallet load: $14.90;
- average render charge: $1.94;
- average renders per paying user: 9.6, median 5;
- only 4 returning users generated in both the latest 7-day windows.

SEO pages should therefore make the first financial commitment feel concrete: show the exact cost of reproducing the example, prefill the model/settings/prompt, explain refund protection, and minimize the gap between “I learned something” and “I can run this now.”

## 3. Indexation and crawl architecture

### What is healthy

- XML sitemaps are valid.
- 205 sampled sitemap URLs returned 200.
- No sampled sitemap URL was blocked by `robots.txt`.
- 45 canonical/hreflang checks passed.
- HTTPS, `www`, trailing-slash behavior and EN/FR/ES self-canonicals are broadly correct.
- `llms.txt` exists and all 49 referenced URLs returned 200.
- No manual action or security issue is reported in Search Console.
- The submitted sitemap succeeds and reports 1,264 pages plus 44 videos discovered.

### Deep indexation inventory

Search Console reports:

| Status/reason | URLs |
|---|---:|
| Indexed | 905 |
| Not indexed | 2,352 |
| Crawled, currently not indexed | 866 |
| Excluded by `noindex` | 733 |
| Blocked by `robots.txt` | 383 |
| Redirect | 156 |
| Discovered, currently not indexed | 116 |
| 404 | 72 |

The full affected-URL exports materially refine the diagnosis:

- none of the 905 indexed URLs is a CSS, JavaScript or `/_next/` resource;
- 641 indexed URLs are comparison details, or 70.8% of the entire Google index;
- 261/292 English, 174/292 French and 206/292 Spanish comparisons are indexed;
- 531/866 “crawled, currently not indexed” URLs are deployment-versioned CSS resources;
- only 329/866 are actionable HTML pages, including 183 clean comparisons and 36 `/video/job_*` pages;
- the 733 `noindex` URLs include about 479 render-job pages, 158 `?order=` variants and 74 unpublished/reversed comparisons;
- the 383 robots-blocked URLs are overwhelmingly `/app` routes, not static assets;
- two `/app?...` URLs are already indexed despite the robots block.

The CSS count is crawl-report noise, not evidence that CSS files are in Google's public index. Blocking `/_next/static` would be counterproductive because Google needs those assets to render pages.

The deeper root cause is uncontrolled HTML discovery. `scripts/indexnow-submit-changed.mjs` can submit non-published comparison combinations rather than the canonical `publishedPairs`, exposing up to 1,014 EN/FR/ES URLs over time. It also submits redirecting localized hub paths. IndexNow submissions must be constrained to canonical, indexable, 200-status sitemap URLs and protected by an automated subset test.

The 1,226-URL live sitemap contains 879 comparison URLs. Only 56 English pairs have a meaningful strategic signal in code and only 17 pairs per language have dedicated editorial overrides. The safe policy is to preserve every GSC/backlink/conversion winner, then keep a strategic editorial floor and remove low-evidence pairs from sitemaps with `noindex,follow` until they qualify.

The complete URL-family analysis, CSS explanation and keep/noindex/redirect policy are documented in `DEEP-INDEXATION-AUDIT.md`.

Other technical issues:

- approximately 479 private render-job URLs are already represented in the `noindex` report;
- 53 `/video/` URLs are indexed versus 44 intended editorial video pages;
- app URLs rely on robots blocking even though robots cannot reliably remove an already indexed URL;
- comparison URLs lack meaningful `lastmod` values;
- sitemap-index dates are older than child sitemap dates;
- `/return-policy` is indexable and linked but missing from the sitemap;
- several old localized routes use temporary 307 redirects instead of permanent 301/308 redirects.

## 4. On-page and content quality

### Strong foundations

The live English crawl found:

- no missing title, meta description or H1 among 354 pages;
- no exact title/meta duplication;
- no multiple-H1 issue;
- model pages averaging roughly 1,542 words;
- strong examples pages with real prompts, settings, media and internal links;
- `/models/veo-3-1` at roughly 2,024 words with pricing, prompts, limits, specifications and an official source.

### Main quality risks

- 292 comparison pages are indexable; most use repeated “same prompts”, “Specs & Pricing” and scorecard formulas.
- 66 comparison titles and at least 11/40 model titles are visibly clamped with an ellipsis.
- `/pricing` is also automatically truncated rather than intentionally written to fit.
- About is only about 183 words and lacks a named team, operating entity, testing credentials, methodology and customer evidence.
- Blog posts show dates but no human author/reviewer profiles.
- Benchmark scores expose neither sample size, weights, evaluator, uncertainty nor “last tested” date.
- Several docs claim features that appear unavailable or marked “coming soon”.
- The Sora 2 article contains obsolete lifecycle/access claims and should be updated or redirected.

This is an E-E-A-T and citability issue more than a word-count issue.

## 5. Structured data

Positive: JSON-LD parses correctly on representative pages, and Breadcrumb/WebSite/Organization coverage is broad.

Priority corrections:

1. Model pages emit `Product` offers that can disagree with visible prices. `/models/veo-3-1`, for example, exposes a schema price of $4.40 while visible offers are $2.08, $3.12, $4.16 and $6.24.
2. Use `SoftwareApplication`/`WebApplication + Offer` where the offer exactly matches visible content.
3. Unify two homepage `Organization` entities and reference one stable `@id`.
4. The blog publisher logo points to an OG image rather than the official square logo.
5. Remove or deprioritize `FAQPage` JSON-LD on commercial SaaS pages; FAQ rich results are largely restricted to government/health sites.
6. Remove `HowTo` JSON-LD from tools; HowTo rich results were retired. Keep the visible instructions.

## 6. Performance and Core Web Vitals

Search Console reports 156 mobile URLs needing improvement because LCP exceeds 2.5 seconds.

Vercel field data, P75 over seven days:

| Metric | Desktop | Mobile |
|---|---:|---:|
| Real Experience Score | 96 | 86 |
| FCP | 2.02s | 2.47s |
| LCP | 2.40s | 2.67s |
| INP | 72ms | 152ms |
| CLS | 0.06 | 0.18 |
| TTFB | 0.56s | 0.65s |

Mobile route scores are especially weak for `/app` (46), `/tools/angle` (37), pricing (66), localized/blog routes and the homepage/models (roughly 77–88). Example and comparison routes are generally much stronger.

Additional technical findings:

- marketing pages return `Cache-Control: private, no-cache, no-store`;
- root marketing rendering reads cookies and calls `auth.getUser()`, neutralizing expected CDN/ISR behavior;
- Lighthouse mobile homepage: performance 88 and LCP 3.84s;
- approximate HTML weight: homepage 0.8 MiB, pricing 1.06 MiB, model 0.7 MiB;
- homepage DOM contains about 1,428 elements.

The first performance project should make the public marketing shell cacheable by moving personalized navigation/auth state to a small client-side island, then reduce serialized data and simplify hero media.

## 7. Authority, backlinks and AI visibility

Search Console reports 687 external links, concentrated on:

- webcatalog.io: 247;
- reddit.com: 121;
- toolify.ai: 75;
- mossai.org: 38;
- beyond-the-ai.com: 37.

The homepage receives 617 external links; deep pages receive very few. Semrush reports:

- Authority Score: 14;
- 157 referring domains;
- 24.9k backlinks, but 87.9% of referring domains have Authority Score 0–20;
- estimated organic traffic: 2.1k, +86%;
- 863 ranking keywords, +13.9%;
- AI visibility: 14, four mentions and seven cited pages.

The backlink quantity is inflated by a small number of low-authority/directory sources. The next authority gains should come from original benchmark data, transparent methodology, expert bylines and digital PR rather than more directory links.

## 8. Competitive position

| Competitor | What it does better | MaxVideoAI opening |
|---|---|---|
| Higgsfield | Editorial velocity, proprietary creative features, social proof | Neutral cross-model tests, exact cost and no subscription |
| Artlist | Licensing clarity, authors, professional workflow trust | Independent pricing and model-choice transparency |
| Pollo AI | Huge transactional page coverage and embedded generators | Less cluttered, more credible evidence and unbiased verdicts |
| Dreamlux | Captures free/no-watermark/social trends | Much deeper model evidence and commercial transparency |

Recommended US positioning:

> **Compare AI video models before you spend. Real outputs, live pricing, no subscription.**

The defensible moat is not page volume. It is proprietary benchmark evidence: same-prompt outputs, price before render, success/refund rates, render-time distributions and transparent test methodology.

## Top five critical actions

1. Repair GA4 consent, deduplicate tagging and preserve `client_id` + `session_id` through checkout.
2. Reduce indexable comparison inventory and define a measurable publish/index threshold.
3. Fix inaccurate structured-data offers and stale/unsupported content claims.
4. Rewrite/test the snippets and first-screen promise of the top US opportunity pages.
5. Make the marketing shell cacheable and resolve mobile LCP/CLS.

The detailed execution sequence and KPIs are in `ACTION-PLAN.md`.
