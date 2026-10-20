# Homepage: final SEO and performance review — 19 October 2026

**Follow-up:** the [mobile LCP investigation](home-mobile-lcp-resolution-2026-10-19.md)
records the bounded payload correction and fresh comparable measurements. The
results below describe the earlier `e7da81030` candidate and remain unchanged.

## Scope and reference

Review requested before push/deployment. Work stays in `codex/home-visual-refresh`;
no push, PR, merge to main, or deployment was performed by this review.
**Release sign-off is withheld:** the simulated mobile Lighthouse LCP difference
below is repeatable and needs resolution, and PR465 must land before the next
integration. Passing SEO/functional checks does not waive either condition.

- Fetched main: `1ed5e5b8223741d6f78318363ea9bf082a4328df`.
- Integrated main without conflicts: `c353013e518d29fbb0076d30216f095bfad9ea3a`.
- Final application candidate: `e7da81030` (French description, deferred-section
  contract and homepage text-contrast corrections).
- Reference server: production build of an exact `git archive origin/main`,
  `http://localhost:3102`. The earlier server on 3101 is an older reference and
  was **not** used for this audit.
- Candidate preview: `http://localhost:3100/fr#compare`.
- Same installed dependencies, private environment and read-only database role
  for both builds. Node 22.23.2, pnpm 10.18.2, Next.js 15.5.25.

The previously reviewed homepage changes are documented in
[the implementation report](home-visual-refresh-2026-10-18.md). Main now includes
PR456's comparison design; the homepage preview and destination were checked
with that code integrated.

## OUTREACH evidence used

Read the existing OUTREACH repository, its AGENTS/DEMARRAGE instructions, and
relevant dated evidence. No outreach messages, submissions, account changes or
new indexing requests were made.

- `sources/2026-10-17/page-rework-priorities/README.md`: the English homepage
  increased from 636 to 696 clicks in the recorded 19 August–15 September /
  16 September–13 October comparison, while impressions decreased. Preserve
  its concise PAYG promise, useful examples and creation entry points. These are
  historical GSC figures, not a measured effect of this refresh.
- `sources/2026-10-15/desktop-core-web-vitals/README.md`: the recorded desktop
  group had LCP 3.1 seconds and 140 URLs needing improvement on 14 October.
  This is a grouped field signal, not a measurement of this individual homepage
  or proof that the July changes caused the search decline.
- `sources/2026-10-19/eeat-audit/README.md`: editorial model scores must not imply
  published controlled benchmarks. The homepage explicitly labels its scores
  editorial, explains the calculation and separate evaluation, and links the
  methodology. It introduces no speed benchmark, customer review or invented
  testing claim.
- `sources/2026-10-07/studio-outreach/README.md` and OUTREACH's product rules:
  Studio and external assistants remain distinct entry points. The homepage
  grouping does not promise free assistance or assembled timeline film export.

## Findings and corrections

1. **Resolved integration gap.** The initial preview was two commits behind main.
   Both commits are now included, including the current comparison page.
2. **Resolved French snippet defect.** `/fr` previously emitted a description
   ending `générez avec paiement à…`, because the authored text exceeded the
   existing metadata helper's limit. Replaced only the French description with
   a complete 145-character sentence:

   > Comparez Seedance, Kling, Veo, LTX, Wan et Pika. Découvrez de vrais exemples, vérifiez le prix et créez vos vidéos IA à l’usage, sans abonnement.

   The title, H1 and English/Spanish descriptions stay unchanged. The same
   description is used by the standard, Open Graph and Twitter metadata.
   No ranking or click-through improvement is claimed before publication and
   observation.
3. **Resolved obsolete performance contract.** The below-fold test still expected
   six sections. The added Studio/assistant chapter makes seven; the assertion
   now also verifies that this chapter keeps its server-rendered containment
   wrapper. The hero stays outside containment. This was a test expectation
   issue; rendering containment was already present.

4. **Resolved text-contrast issues.** Lighthouse identified the light comparison's
   secondary text at 4.22–4.44:1, inactive pricing labels around 4.04:1, and the
   attribution made too faint by inherited opacity. Darkened those labels,
   removed the attribution opacity, and kept the price explanation continuously
   visible instead of fading it on each step. The homepage footer caption also
   uses its readable secondary text color. Changes are scoped to the homepage
   stylesheet; no layout, media policy or client dependency was added.

## SEO and indexability checks

Production-build HTTP comparison covers `/`, `/fr` and `/es`:

- HTTP 200, one H1, correct HTML language and one self-canonical.
- Four reciprocal language alternatives (EN/FR/ES/x-default).
- No HTML or HTTP noindex introduced; identical robots.txt policy.
- All five complete JSON-LD documents parse and remain identical to main:
  WebApplication, FAQPage, ItemList, Organization and WebSite. Eight FAQ entries
  match the available HTML answers. This checks consistency, not rich-result
  eligibility.
- Titles, H1s, social metadata and descriptions match main except the explicit
  French description correction above.
- Same URL sets in the sitemap index and EN/FR/ES sitemaps; all three home URLs
  remain present. Sitemap dates naturally differ between builds. The root URL
  is compared with URL normalization (`https://maxvideoai.com` and its `/`
  representation identify the same root).
- `/en`, `/fr/` and `/es/` retain their 308 redirects and destinations.
- No homepage destination is removed from the SSR link set. Seven unique added
  paths respond successfully: Wan 3 generation, the three localized comparison
  links, and the three Studio entry redirects. Studio entry correctly returns
  307 to `/app/studio?lang=…`; it is an application action, not a new indexable
  marketing route.
- Comparison hub, generator, Studio presentation and direct Studio action have
  real server-rendered hrefs. No Studio application runtime is loaded by its
  homepage screenshot or links.

A bounded live GET check also confirms HTTP 200 and the same existing titles /
canonical URLs on the production homes. The French description correction is
local until release.

The raw-stream audit accounts for React Suspense's hidden replacement fragments;
it does not misclassify their temporary duplicate IDs as duplicate active DOM.
The rendered browser checks use the actual completed page.

## Browser and product checks

- EN/FR/ES, widths 320/390/768/1440: images decode, no horizontal overflow,
  no JavaScript page error; all three price scenarios retain stable action
  geometry and no false unavailable label.
- EN/FR/ES, widths 390/1242: Studio is first in Tools and absent from the top
  navigation; both discovery and app-entry actions are present.
- Anonymous direct Studio entry reaches the guest workspace; its language query
  is consumed by the existing app flow. No generation/project/payment submitted.
- Native browser review of the rebuilt French comparison: the all-model hub is
  prominent, Wan 3 generation is directly accessible, and the table is explicitly
  an example. Screenshot: `.reports/home-visual-refresh/audit-preview-final.jpg`.

## Paired browser measurements

Three runs per version/device, alternating execution order, fresh browser
contexts and disabled browser cache. Mobile: 390×844, CPU 4×, 1.6 Mbps / 150 ms;
desktop: 1440×1000, CPU 1×, 10 Mbps / 40 ms. Initial window ends six seconds after
load. Real network requests remain enabled. Application source: `e7da81030`;
all measurements below use the rebuilt final candidate, including the metadata
and contrast corrections.

| Device | Version | LCP samples (ms) | Median LCP | Initial CLS | Median transfer |
| --- | --- | --- | ---: | ---: | ---: |
| Mobile | Main `1ed5e5b82` | 952, 952, 988 | 952 ms | 0 | 406,900 B |
| Mobile | Candidate | 952, 932, 928 | 932 ms | 0 | 408,407 B |
| Desktop | Main `1ed5e5b82` | 212, 200, 196 | 200 ms | 0 | 6,014,145 B |
| Desktop | Candidate | 200, 200, 196 | 200 ms | 0 | 5,674,561 B |

These overlapping sample ranges do not establish a speed improvement. Mobile
transfer adds 1,507 B (+0.37%); desktop transfer drops by 339,584 B (5.65%). The
critical poster remains present in the initial HTML with fixed geometry. Every
mobile run makes zero video requests before playback intent; desktop loads one
hero video. No initial-loading regression is reproduced in these paired runs.

The same runs scroll the comparison and price sections and select the three price
scenarios. Candidate cumulative layout shift remains 0 after those interactions;
recorded event durations peak at 80 ms mobile / 40 ms desktop (main: 64 / 32 ms).
The interactions remain responsive in this bounded test, but these event samples
are **not field INP**. Main's small post-scroll shifts were 0.00061–0.00072 mobile
and 0.00011 desktop. Neither version has overflow or a JavaScript page exception.

Vercel analytics scripts cannot load from the local Next server, equally in both
versions. Aborted speculative RSC requests on page/context closure are retained
in the raw evidence. No resources were blocked or mocked to improve the result.

Raw final runs and summary: `.reports/home-visual-refresh/audit-performance-final/`.
The earlier preflight in `audit-performance/` remains archived separately and is
not mixed into the final series.

### Warm browser-cache reloads

Three more alternating pairs per device prime a fresh browser context with one
full visit, wait six seconds, then reload with the browser cache enabled. All
initial transfer/timing counters are reset before that reload. The same servers
stay running throughout; application/server caches are not cleared between runs.
Thus "cold" above means a cold browser cache, not a cold database/server process.

| Device | Version | Warm LCP samples | Median | Median transfer |
| --- | --- | --- | ---: | ---: |
| Mobile | Main | 248 / 268 / 256 ms | 256 ms | 75,348 B |
| Mobile | Candidate | 288 / 272 / 256 ms | 272 ms | 77,840 B |
| Desktop | Main | 72 / 84 / 64 ms | 72 ms | 75,832 B |
| Desktop | Candidate | 88 / 108 / 72 ms | 88 ms | 77,770 B |

The candidate medians are 16 ms higher in these small samples; ranges overlap.
This does not establish a warm-cache improvement. Forty-two local static
resources report zero transferred bytes in each mobile reload; desktop reports
44 for main and 43 for the candidate. The third pair also records the matching
`requestServedFromCache` events, confirming browser memory-cache reuse. The HTML
still transfers. No page exception or overflow appears. CLS is 0 except one
candidate desktop sample at 0.00033, retained after the bounded interactions.

Evidence: `audit-performance-warm/`. The initially collected two pairs were
extended with a third pair because their narrow warm LCP ranges needed a repeat;
all samples are retained, including the slower candidate samples.

## Lighthouse: automatic checks and remaining mobile finding

Lighthouse 12.6.1, Chrome for Testing 147, the repository's Chrome launch flags,
production builds and default simulated mobile/desktop settings. Each navigation
uses a fresh profile; storage reset stays enabled. No resource blocking or mocks.
Three alternating mobile pairs were retained because the first mobile pair
differed. Desktop has one pair and is only supporting evidence alongside the
repeated browser measurements above.

| Device | Version | Performance | Accessibility | SEO | LCP | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Mobile | Main | 89 / 89 / 89 | 93 | 100 | 3,545 / 3,597 / 3,594 ms | 0 |
| Mobile | Candidate | 87 / 88 / 87 | 100 | 100 | 3,751 / 3,696 / 3,752 ms | 0 |
| Desktop | Main | 100 | 96 | 100 | 767 ms | 0 |
| Desktop | Candidate | 100 | 100 | 100 | 766 ms | 0 |

The candidate's mobile simulated median LCP is **3,751 ms versus 3,594 ms**,
+157 ms (+4.4%), with non-overlapping sample ranges. This is a repeatable finding
in this method and **is not dismissed as noise**. The cold-cache CDP measurements
above do not reproduce it, so these methods are reported separately. No mobile
speed gain or unrestricted performance sign-off is claimed.

The final candidate has no failing automatic accessibility audit in these runs;
the corrected color-contrast check passes. This is not a certification of every
accessibility scenario. Best Practices is 96 for both versions because the two
Vercel analytics endpoints return 404 on the local Next server. All final reports
have no runtime error or report warning. The original four runs' saved DevTools
logs contain zero disk-cache, service-worker or prefetch-cache responses; cache
reset completed normally. Earlier diagnostic runs with a different browser or
cache-reset timeout are retained separately and excluded from this series.

Evidence: `audit-lighthouse-final/` (reports, traces, network logs, manifest and
summary). The repeat mobile run manifest records the reason for adding the
second and third pairs; no initial result was discarded.

### Actual Lighthouse mobile throttling

A second series uses the same Lighthouse mobile viewport (412×823) and default
mobile network/CPU profile with `throttlingMethod: devtools`. This applies the
slowdown in the browser rather than projecting it afterward. Three alternating
pairs, no application changes between series:

| Version | Observed LCP samples | Median | Performance | TBT samples |
| --- | --- | ---: | ---: | --- |
| Main | 1,925 / 1,967 / 1,955 ms | 1,955 ms | 98 / 98 / 98 | 43.9 / 23.8 / 27.3 ms |
| Candidate | 1,955 / 1,940 / 1,938 ms | 1,940 ms | 98 / 98 / 98 | 50.1 / 49.4 / 29.0 ms |

CLS is 0 throughout. The observed LCP ranges overlap; the simulated +157 ms is
not reproduced by this method. The first pair reported a browser-cache-reset
timeout, retained in the reports. Every navigation uses a fresh browser profile;
saved network logs show zero responses served from browser/service-worker/cache
storage. The remaining two pairs reset normally. This caveat is not suppressed.
Raw reports: `audit-lighthouse-mobile-observed/`.

### HTTP/2 transport diagnostic

A production HEAD request returned HTTP/2 and status 200. Both local production
builds were then exposed through identical, uncached, streaming HTTPS/HTTP/2
proxies bound to loopback. These forward status, body and content headers without
rewriting HTML, CSS or resources. A self-signed local certificate is accepted only
for this diagnostic; production certificate settings are untouched. Saved browser
network logs confirm `h2` and zero cache hits for both versions.

Three alternating mobile pairs use the original Lighthouse simulation:

| Version | Simulated LCP samples | Median | Performance |
| --- | --- | ---: | --- |
| Main | 2,570 / 2,562 / 2,719 ms | 2,570 ms | 93 / 97 / 96 |
| Candidate | 2,867 / 2,868 / 2,857 ms | 2,867 ms | 95 / 95 / 95 |

The simulated gap persists (+297 ms median, +11.5%); HTTP/1.1 alone does **not**
explain it. This rules out the simple transport hypothesis, rather than providing
a passing alternative benchmark. All runs have CLS 0 and no Lighthouse warning.
The first main run has TBT 219.5 ms, versus 53/64 ms in its repeats; all individual
results are retained. These local proxies do not reproduce Vercel's edge runtime
or represent a public deployment test. Evidence: `audit-lighthouse-http2/` and
`audit-http2/proxy.cjs`.

The actual slowed-browser measurements and the simulation disagree. The cause
has not been established; no speculative production-code optimization was added
to make an audit score pass. Per `docs/engineering/media-delivery.md`, the repeated
simulated regression remains a release finding. Resolve it on the integrated
candidate and retain equivalent before/after evidence before signing off. A
coordinated public preview can supply the intended hosting environment; it does
not replace Adrien's visual approval or authorize production deployment.

## Validation status

- Final production build (`e7da81030`) passes, including TypeScript, prebuild
  registry/media/poster checks and generation of 932 pages. Six existing
  Studio/billing lint warnings remain; no build or lint errors.
- SEO HTTP comparison on the final build passes for all three locales, sitemaps,
  robots, added links and redirects: `audit-seo-final/results.json`.
- Final responsive smoke: all 12 locale/width combinations pass:
  `audit-final-smoke.log`. Studio entry/menu checks additionally passed in the
  six locale/width combinations described above.
- Initial focused regression suite: 92 of 93 passed; the sole failure was the
  obsolete six-section assertion described above. Its focused recheck passed,
  followed by all 15 homepage SEO/containment checks on the correction.
- Core Web Vitals contracts: 38/38 pass. Final contrast/layout verification:
  11/11 pass, including 36 real price scenarios, zero React commits over the
  comparison animation's 66-frame sample, and route stylesheet ownership.
- Frontend lint, exposure lint and `git diff --check` pass. Raw logs are retained
  under `.reports/home-visual-refresh/`; the implementation report records the
  earlier navigation, Studio, media and broader homepage checks.

## Release coordination and limits

Adrien requested coordination with the existing task **livraison pr**. Its owner
confirmed that PR465 will ship first; this homepage is not included in that lot.
No push, homepage PR, main merge, or deployment was performed here. The local
preview remains available for Adrien's review before any homepage deployment.

PR465 changes EN/FR/ES dictionaries, comparison helpers/metadata, the MCP plugin
installation pin and engineering guides. After its verified deployment, integrate
the resulting main into the homepage branch, resolve any overlaps deliberately,
and rerun the affected checks before the release owner prepares delivery. In
particular, preserve the complete French homepage description and all homepage
navigation/copy changes during the dictionary integration. Do not substitute the
older baseline numbers above for evidence about a later integrated candidate.

Required Quality CI, the committed-candidate deployment check, and confirmation
that the delivered domains match the merged commit remain release gates owned
by the coordinated delivery task. The checks here establish local behavior on
specified source revisions; they cannot certify Google indexing or future
real-user Core Web Vitals. After release, verify the public localized HTML and
media loading again, then follow the existing GSC/CrUX field observation process.
No sitemap submission, indexing request or paid generation was made.
