# Homepage visual refresh — preview evidence, 2026-10-18

Scope: homepage presentation only. Studio and MCP remain separate products/routes;
`HomeConversationSection` groups their discovery on the home page. No deployment,
redirect, model registry, auth, billing policy or database visibility change.
Baseline: `a04a56fea` (current main when the isolated worktree was created).
Both local production builds use the same lockfile, Next.js 15.5.25, public
configuration and a database connection enforcing read-only transactions.

## Price presentation

The shared quote component's two accessibility-hidden sizing labels were visible
outside `.app-experience`. The `invisible` utility now hides those labels in every
host; the marketing demo stacks the quote variants and reserves stable settings
widths. Real unavailable/loading states are preserved. The guided timer starts
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
`app-desktop-light-rae.webp` (1086 × 947) and `app-mobile-light-rae.webp` (366 × 972).
Studio uses the existing reviewed `studio-conversation-preview.webp`, loaded
lazily with fixed dimensions and no Studio runtime import.

## Comparable loading evidence

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

## SEO and functional checks

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
