# Homepage visual refresh — preview evidence, 2026-10-18

Scope: homepage presentation and public marketing navigation. Studio and MCP remain separate products/routes;
`HomeConversationSection` groups their discovery on the home page. No deployment,
redirect, model registry, auth, billing policy or database visibility change.
Baseline: `a04a56fea` (current main when the isolated worktree was created).
Both local production builds use the same lockfile, Next.js 15.5.25, public
configuration and a database connection enforcing read-only transactions.

## Price presentation

The shared quote component's two accessibility-hidden sizing labels were visible
outside `.app-experience`. The `invisible` utility now hides those labels in every
host; the marketing demo stacks the quote variants and reserves stable settings
widths. Real unavailable/loading states are preserved. The revised demo has one outer frame, a single aligned settings/Generate toolbar when space allows, and a full-width action on narrow screens. Redundant visible settings below the frame are retained only for screen readers. The guided timer starts
only after the deferred real Composer mounts. Its placeholder reserves geometry.

`home-price-demo-browser.test.ts` covers 4 widths × 3 locales × 3 exact quote
scenarios with the real Composer and marketing styles: no visible sizing labels,
no overflow and identical button geometry between steps. The existing shared
composer browser suite and delayed-chunk test also pass.

## Selected media

| Model | Requested watch ID | Source duration | Source bytes | Desktop bytes | Mobile bytes |
| --- | --- | --- | ---: | ---: | ---: |
| MiniMax H3 | `cce1c417-d693-49ab-96de-09794e8df9b4` | 15.10 s | 6,652,877 | 5,247,170 | 4,248,087 |
| Seedance 2.5 | `29f50b9a-1513-487b-99ec-1aff2af86e5e` | 15.07 s | 10,471,007 | 3,018,766 | 2,385,463 |
| Wan 3 | `job_ff871126-fd52-430d-af68-aa75b2c3bd0a` | 22.04 s | 37,929,876 | 12,138,033 | 9,783,519 |

Kling 3 Pro and LTX 2.5 Pro are unchanged. The authored registrations are
`minimax-h3-home`, `seedance-2-5-home` and `wan-3-home`. All six derivatives were
prepared by the existing CLI, reviewed against source contact sheets, published
to new immutable keys, checked over HTTP including Range, and activated using
the existing manifest/projection writer. Cadence, full duration and AAC packet
payload identity passed the preparation gates. First Play on all five selections
passed in Chromium at mobile and desktop sizes; all three replacements selected
the expected device rendition. Physical iOS/Safari was not tested.

The first poster is extracted at 3.2 s, cropped to the existing display geometry.
The MiniMax source's recorded and measured ratio is 26:15; that source is not
stretched. Desktop poster: 11,712 bytes. Mobile poster: 6,750 bytes (768 × 432).
`media:home-posters:prepare` generated the immutable display URLs. Old published
posters and old video registrations remain available for cached pages.

The light workspace captures show the requested `ad885eda-5557-4b5f-8422-60142c3eb00e.mp4`
inside the real app. Captures exclude the account wallet and unrelated recent
outputs. Source visibility is unchanged. New display files are
`app-desktop-light-wide.webp` (1344 × 840, 16:10) and `app-mobile-light-framed.webp` (378 × 794, approximately 19:9). The source interfaces are recaptured and cropped, never stretched. The phone crop excludes the wallet and retains the bottom navigation.
Studio uses the existing reviewed `studio-conversation-preview.webp`, loaded
lazily with fixed dimensions and no Studio runtime import.

## Initial-preview comparable loading evidence

Three alternating cold-browser-cache runs per version and viewport. Mobile:
390 × 844, 4× CPU throttle, 1.6 Mbit/s, 150 ms latency. Desktop: 1440 × 1000,
1× CPU, 10 Mbit/s, 40 ms latency. Measurements continue for 6 seconds after load.
Same machine and server configuration; live read latency and remote caches vary.
These are local lab observations, not field Core Web Vitals or a ranking claim.

| Device | Version | LCP samples (ms) | Maximum CLS | Median transferred bytes |
| --- | --- | --- | ---: | ---: |
| Mobile | Baseline | 1028, 988, 964 | 0 | 407,035 |
| Mobile | Candidate | 932, 940, 924 | 0 | 412,876 |
| Desktop | Baseline | 200, 200, 200 | 0.0000051 | 6,014,293 |
| Desktop | Candidate | 196, 196, 200 | 0 | 5,685,757 |

Mobile made zero media requests before Play and requested only the mobile
critical poster in every run. The extra conversation markup adds about 5.8 KB
to the measured mobile transfer; desktop playback transfer is lower. No LCP/CLS
regression was reproduced. No JavaScript runtime errors were captured. Vercel's
analytics/speed-insights script requests abort on localhost in both versions.
INP and production CDN/field measurements remain outside this local check.
Final logo contrast corrections do not change geometry or playback policy.

## Initial-preview SEO and functional checks

- EN `/`, FR `/fr`, ES `/es`: HTTP 200; canonical, title, H1, robots header/meta,
  hreflang and complete JSON-LD outputs compare equal to baseline.
- `/en`, `/fr/`, `/es/`: redirect status and destination compare equal to baseline.
- Sitemap/robots owners are unchanged; SEO, internal-link, machine-content,
  public-media-origin and model-registry prebuild gates pass.
- Studio and MCP links remain server-rendered and localized, with one conversation
  group and one assistant strip per home. No index-blocking preview setting was
  added to application code. This does not inspect the site's GSC property.
- 91 focused assertions/tests passed across home/media/price architecture,
  playback, reduced motion, responsive image priority, localization and pricing.
- Browser smoke: EN/FR/ES × 320/390/768/1440 px, comparison selection, all three
  pricing scenarios, image loading and no horizontal overflow; no page errors.
- Production build, TypeScript, exposure lint and diff checks pass. ESLint has
  six pre-existing warnings in Studio and billing; none in the changed code.

Full local logs, unmodified captures, raw network/paint samples and browser
harnesses are retained in `.reports/home-visual-refresh/` in the review worktree.
The preview must be approved before following the normal PR/Quality CI/production
release process. No production merge or application deployment occurred.

## Review revision: devices, comparison and price demo

The first homepage preview was rejected visually. The newer comparison design
was confirmed through “Prioriser les pages à retravailler”: PR #456,
`codex/comparison-scorecard-preview` at `7f3ca0e07`, local preview port 8770.
The public page still showed the older dark scorecard during this review.

The home now uses the new light table composition, blue/amber horizontal bars,
row descriptions, aligned model columns and the corresponding mobile layout.
Only the homepage excerpt changes; the comparison route and PR remain untouched.
Scores keep their canonical source and overall calculation. The displayed count
excludes price/value, matching the new comparison's ten quality/control criteria.
The disclosure explains that the models were scored separately. Animation stays
visibility-triggered, respects reduced motion and causes zero React commits over
66 measured frames. Missing and out-of-range scores render no bar.

The recaptured device screens use fixed, natural aspect ratios. Both captures
remain lazy responsive WebP images. New source sizes: 70,564 B desktop and
34,034 B mobile; no new video fetch, library or client runtime was introduced.
The price frame reserves the deferred Composer's narrow/wide height. Desktop
controls and Generate share a centerline; narrow layouts use a full-width action.
The quote and controls remain stable across all three exact scenarios.

The final review clarified discovery: the left column now has an explicit,
server-rendered “Compare all models” link to the localized comparison hub and
“Create with Wan 3” to `/app?engine=wan-3`. The table is labeled as an example,
showing Wan 3 against Seedance 2.5. Its detail link uses the canonical published
pair with the existing order query to retain Wan 3 on the left. No model
publication policy or comparison routes were changed.

The old rotating tab selector has been removed. `HomeComparisonPreview` renders
on the server; only the existing score-bar animation stays client-side. The
architecture contract covers this boundary and the canonical route helper.
The mobile/desktop checks below cover the final production build.


## Final revision validation

- Production build succeeds for all 932 generated pages, including the existing
  SEO, registry, public-rendition and immutable-poster prebuild gates.
- TypeScript and exposure lint pass. ESLint reports no errors and the same six
  unrelated Studio/billing warnings.
- Final comparison/SEO/architecture/motion selection: 23 tests pass. Price browser,
  loading and motion checks also passed after the device/price layout revision.
- Production browser smoke: EN/FR/ES at 320, 390, 768 and 1440 px. Both discovery
  actions are present; the example opens the published Seedance 2.5 / Wan 3 route
  with Wan 3 first. All three pricing scenarios retain stable action geometry.
  Images decode, no horizontal overflow and no JavaScript errors.
- The comparison hub, canonical example URL and `/app?engine=wan-3` return 200.
- Final production SSR comparison against the baseline: canonical, title, H1,
  hreflang, robots and complete JSON-LD unchanged in all three locales. Redirect
  status/destinations are unchanged. Studio/MCP remains a homepage grouping only.
- Production captures: `revision-compare-en-1242.png`,
  `revision-compare-fr-1440.png`, `revision-compare-fr-390.png`, and the corresponding
  `revision-creation-*` / `revision-pricing-*` captures in the ignored QA directory.
  `clarity-in-app.jpg` records the final French section in the user's preview.

Final loading samples use the same three alternating cold-cache runs and device
profiles described above, after the server-rendered comparison discovery revision.
Raw data: `.reports/home-visual-refresh/performance-clarity/runs.json`.

| Device | Version | LCP samples (ms) | Maximum CLS | Median transferred bytes |
| --- | --- | --- | ---: | ---: |
| Mobile | Baseline | 1012, 956, 972 | 0 | 407,103 |
| Mobile | Final candidate | 932, 924, 936 | 0 | 408,028 |
| Desktop | Baseline | 200, 200, 200 | 0 | 6,014,325 |
| Desktop | Final candidate | 200, 196, 196 | 0 | 5,674,278 |

No reproducible LCP/CLS regression or JavaScript errors. All mobile runs make
zero video requests before playback intent. Final mobile transfer is 925 bytes
above baseline; desktop transfer is lower. These remain local measurements, not
field INP, a GSC audit or evidence of production CDN behavior.


## Studio navigation and direct app access

Studio moves from a standalone marketing header link to the first Tools entry,
with a full-width row, description and separator. Mobile Tools uses the same
first entry, followed by specialized tools and the all-tools link. Assistants/MCP
remains separate. The workspace navigation itself is unchanged. Studio's public
page remains linked in the server-rendered desktop menu in every locale.

The homepage retains “Explore Studio” for the public presentation and adds
“Open Studio” alongside it. The new link uses the existing marketing-entry route
with the locale and no starter preset, preserving the Studio access policy and
existing login/guest flow. Prefetch is disabled. No generation, project creation
or new Studio client runtime is introduced by the homepage link.

Validation: production build and TypeScript pass; lint has the six existing
Studio/billing warnings and no errors. The 34 navigation, Studio marketing and
entry tests pass. The 13 menu browser/rendering/message checks pass after updating
the deliberate top-level icon count from seven to six. The native mobile menu
retains 64 SSR elements, 6,310 bytes, no decorative SVG before enhancement, and
identical icon geometry after hydration. Existing keyboard, native opening,
focus restoration, no-JavaScript and message-payload contracts remain covered.

Production UI checks pass for EN/FR/ES at 390 and 1242 px: Studio is the first
Tools entry, no top-level Studio remains, the public presentation link and app
entry link are both visible, and there is no horizontal overflow or page error.
An anonymous click reaches `/app/studio` and renders the French Studio guest
workspace; the existing flow consumes the language query parameter. The original
smoke harness expected that query to remain and was corrected; the independent
entry check confirmed the actual page and visible French content.
Final homepage metadata/robots/hreflang/JSON-LD/redirect comparisons remain equal
to baseline. Native-browser evidence: `studio-menu-in-app.jpg`; responsive
captures: `studio-actions-390.png`, `studio-actions-1242.png`,
`studio-menu-mobile.png` and `studio-menu-desktop.png`.
