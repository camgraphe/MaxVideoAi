# Homepage revalidation after PR465 — 19 October 2026

This report follows the [LCP correction](home-mobile-lcp-resolution-2026-10-19.md).
It records completed local integration and validation, not publication of the
homepage. The earlier reproducible simulated LCP regression does not return.

## Source and integration

The delivery owner confirmed PR465 on both `maxvideoai.com` and
`api.maxvideoai.com`: main `af20823d2bd91cf576d11b3ff8567c5d1b86111e`, Git
deployment `dpl_7dKVu7QPjiMdpFQYoB3np8QB13U9`, required Quality CI `39177133489`.
A fresh fetch matched that exact main. This chat did not publish either version.

- Approved homepage source: `ba39e1140766aa8a00f50484191502b2012e0124`.
- Local integration/application build: `1195c1de5256aa67a1196bafaeaaefd0d156be31`.
- Test-only follow-up: `63bb72e60`; application sources and built output unchanged.
- Reference: a fresh `git archive` of the exact delivered main, in ignored
  `.reports/home-visual-refresh/post465-main`, served on port 3102.
- Candidate: isolated `codex/home-visual-refresh` worktree, served on port 3100.

The only conflict was two appended sections in `media-delivery.md`; both were
retained. Verification confirmed all 52 homepage-only files and 129 main-only
files matched their source versions. The other shared files are `page-architecture.md`
and the three dictionaries. All changed dictionary keys from both branches are
preserved, with no overlap. The approved Studio/navigation/comparison/pricing
presentation remains intact. No shared Desktop checkout changes were made.

Both builds use identical dependency manifests, installed dependencies and private
environment, with database `default_transaction_read_only=on`. Runtime versions:
Node 22.23.2, pnpm 10.18.2, Next.js 15.5.25. No paid generation, upload or database
write was performed. Existing evidence directories are preserved; this pass uses
only new `post465-*` paths in `.reports/home-visual-refresh`.

## Build, contracts and browser rendering

- Both production builds pass, including 932 generated pages, type checking,
  model registry, machine-readable SEO, public-rendition and critical-poster gates.
- 173 targeted tests pass. The first pass exposed an omitted
  `HomeConversationSection` export in the controlled component fixture of
  `home-data-loading.test.ts`. Only that fixture was updated; all timing,
  concurrency, error and data-preservation assertions remain. Its 12 cases pass,
  followed by the full 173-test pass. The original failing log is retained.
- 14 browser contract tests pass, including 36 price locale/width/scenario cases,
  asynchronous composer quote geometry, navigation before/after hydration and
  score animation (66 frames, zero React commits during animation).
- Full-page smoke: EN/FR/ES at 320, 390, 768 and 1440 px; 12 cases pass with no
  horizontal overflow or JavaScript page error, correct Wan 3 / Seedance 2.5
  comparison, all-model and generation destinations, and stable quote buttons.
- Studio: six locale/width cases at 390/1242 px pass. Studio is first in Tools,
  absent as a separate desktop entry, and both discovery and direct app links
  remain. The French direct-entry click reaches `/app/studio`.
- Manual inspection of the rebuilt French preview, light device captures and
  price surface confirms the approved composition and control alignment.
- Frontend lint passes with six existing Studio/billing warnings; exposure lint
  and `git diff --check` pass. Build/tool informational warnings remain in logs.

## SEO comparison

Production-build HTTP comparison covers `/`, `/fr`, `/es` on both versions:

- HTTP 200, one H1, correct language, self-canonical and four hreflang links.
- The same five JSON-LD documents and eight FAQ answers present in HTML.
- No HTML or HTTP `noindex`; standard/Open Graph/Twitter metadata preserved,
  except the already-approved complete French description.
- Robots content, sitemap URL sets/home inclusion and localized redirects match.
- All seven added internal destinations return 200 or the intended Studio 307.
- No duplicate visible IDs, broken local anchors or Studio runtime loaded by
  the homepage. Principal comparison and Studio links are server rendered.

Evidence: `post465-seo/results.json` and saved HTML for all six page responses.
Earlier OUTREACH review remains documented in the
[original audit](home-seo-performance-review-2026-10-19.md#outreach-evidence-used).
No GSC submission, indexing request or outreach message was sent.

## Comparable performance

All performance runs in this pass measure English `/`; the SEO and rendering coverage above must not
be mistaken for performance measurements of `/fr` or `/es`.

The delivery owner suspended local builds, tests and browsers for this window.
Browser cache cold/warm are measured separately on the same production servers.
Local laboratory LCP, CLS and event durations do not establish field CWV, INP or
ranking gains. Raw logs, traces, settings and screenshots remain under the new
`post465-cold`, `post465-warm`, `post465-http1` and `post465-http2` directories.

### Direct Chrome

Chrome 147, three alternating pairs per device/cache condition: 24 measured visits,
plus warm-cache priming visits. Mobile: 390 × 844, CPU 4×, 1.6 Mbps/150 ms.
Desktop: 1440 × 1000, CPU 1×, 10 Mbps/40 ms. Six seconds of observation precede
comparison disclosure, price-step and creation-section interactions. No resource
mocking or blocking. Browser-cache cold does not mean a cold server/database.

| Direct LCP | Main runs (ms) | Candidate runs (ms) | Main / candidate median |
| --- | --- | --- | --- |
| Mobile cold | 996 / 960 / 952 | 928 / 924 / 924 | 960 / 924 ms |
| Desktop cold | 196 / 196 / 200 | 204 / 200 / 188 | 196 / 200 ms |
| Mobile warm | 224 / 228 / 260 | 244 / 232 / 232 | 228 / 232 ms |
| Desktop warm | 72 / 72 / 68 | 68 / 68 / 64 | 72 / 68 ms |

No reproducible LCP regression appears. The small positive median differences
fall within overlapping ranges. Candidate CLS is zero in 11 of 12 visits, both
initially and after interactions. One warm desktop visit records 0.000392;
this isolated small shift remains in the evidence. Main initial CLS is zero;
post-interaction maxima are 0.000649 mobile and 0.000109 desktop. No page errors
or horizontal overflow occur. Candidate event durations reach 48 ms mobile and
40 ms desktop; these are bounded event observations, not field INP.

Cold initial median transferred bytes, main/candidate: 406,960/407,672 mobile,
6,014,232/5,672,910 desktop. Zero initial mobile video requests, one on desktop.
Warm reloads reuse 42 same-origin zero-transfer resources on mobile and 44/43 on
desktop, with zero new video transfer. Warm transfer stays around 75–76 KB.

### Lighthouse

Lighthouse 12.6.1 and the same Chrome 147 executable run three alternating mobile
pairs for each transport. HTTP/2 uses the identical local streaming proxies on
3440/3442, with no response rewriting or caching; local test certificates are
accepted only for that diagnostic. HTTP/1.1 uses the production servers directly.
The configured repository Chrome flags retain RenderDocument.

| Mobile simulated LCP | Main runs (ms) | Candidate runs (ms) | Median delta |
| --- | --- | --- | --- |
| HTTP/2 | 2559.3 / 2557.4 / 2556.3 | 2556.7 / 2558.1 / 2557.9 | +0.5 ms |
| HTTP/1.1 | 3544.8 / 3593.5 / 3594.2 | 3596.3 / 3603.4 / 3598.3 | +4.7 ms |

HTTP/2 ranges overlap. HTTP/1.1 retains a small positive difference (about 0.13%
of the baseline median), with the same performance scores. The first baseline
run is retained, not discarded. These results do not reproduce the earlier
+297 ms / +157 ms differences; no material performance regression is observed.
They are not evidence of a production field CWV improvement.

- Candidate performance: 97/97/97 in HTTP/2 and 89/89/89 in HTTP/1.1.
- Candidate accessibility and SEO: 100 in all six runs; baseline accessibility
  remains 93 and SEO 100. CLS is zero in every run of both versions.
- No runtime error or Lighthouse warning. All 12 DevTools logs contain zero
  actual cache hits; document protocols are verified as `h2` or `http/1.1`.
- Best Practices remains 96 on both versions because the two local Vercel
  analytics scripts return 404. Those requests were not blocked or mocked.
- The reference/candidate raw traces, DevTools logs, reports, flags and
  `cache-document-check.json` remain in both transport directories.

The delivery owner confirmed the separate public SEO (`39179789653`) and
Lighthouse (`39179791900`) audits for main465 passed. Those public audits cover
the delivered main, not this still-local homepage candidate.

## Delivery ownership

Adrien's preview approval remains valid. This chat owns only local integration
and revalidation. **Livraison PR** exclusively owns push, PR, required CI,
production merge and deployment. No further publication action was taken here.
The complete performance window has ended and the CPU was returned to the
delivery owner. Final handoff includes the clean local head, this report, the raw
evidence and the post-commit `post465-deployment-check-final.log`. Required CI
and publication of the final combined candidate remain the delivery owner's gates.
