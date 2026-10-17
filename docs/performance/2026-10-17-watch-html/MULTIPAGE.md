# Expanded public watch performance verification

90 additional Lighthouse audits cover three more public watch pages: 72 predeclared desktop/mobile cold/warm browser audits, plus 18 targeted desktop audits. Together with the earlier 24 Seedance audits, four watch pages have been checked. The cohorts remain separate; no pooled field percentile is inferred.

The existing application patch is unchanged. Baseline source is `8211b9d22ccbd198ecc94efa50a69b77ed61faac`; candidate source is `a47250dd54376c60359502e63cd2fe16dcd75855`. Both immutable protected Vercel Previews run in `iad1`, with the same configured database identity in `us-east-2` and the same feedback toolbar. No production deployment or domain reassignment was performed.

## Pages and primary series

- [MiniMax H3 — wildfire rescue](https://maxvideoai.com/video/minimax-h3-wildfire-lookout-rescue) — Different family: MiniMax H3, multi-shot narrative with native audio; already included in server/HTML parity diagnostics.
- [Wan 3 Prime — match cut transitions](https://maxvideoai.com/video/wan-3-prime-ai-match-cut-transitions) — Different family: Wan 3 Prime, transition example; already included in server/HTML parity diagnostics.
- [Kling 3 Pro — city flythrough](https://maxvideoai.com/video/kling-3-pro-futuristic-city-drone-flythrough-example-b3ce25fd) — Different family: Kling 3 Pro examples hero, selected from the existing SEO watchlist before observing performance.

Each primary cell below is the median of three visits per version. Cold means a fresh temporary Chrome profile; warm means a second full document navigation in that profile. This does not force a cold Vercel function or database. Version order alternates baseline/candidate, candidate/baseline, baseline/candidate; audits run sequentially.

Actual DevTools throttling is 150 ms request latency, 1,600 kbps download, 750 kbps upload and 4× CPU slowdown for both devices. Desktop is 1440×900; mobile is 390×844; DPR is 1. Chrome 155 and Lighthouse 12.6.1 use the correct network User-Agent for each device. The summarizer checks the complete Lighthouse configuration against the original protocol on all 90 audits.

| Page | Device / browser cache | LCP before → after | Change | HTML completion before → after |
| --- | --- | --- | --- | --- |
| MiniMax H3 — wildfire rescue | desktop / cold | 2.051 → 1.780 s | -13.2% | 1.597 → 1.361 s |
| MiniMax H3 — wildfire rescue | desktop / warm | 1.388 → 1.166 s | -16.0% | 1.317 → 1.051 s |
| MiniMax H3 — wildfire rescue | mobile / cold | 2.081 → 1.758 s | -15.5% | 1.760 → 1.308 s |
| MiniMax H3 — wildfire rescue | mobile / warm | 1.374 → 1.085 s | -21.0% | 1.321 → 1.035 s |
| Wan 3 Prime — match cut transitions | desktop / cold | 1.957 → 1.669 s | -14.7% | 1.608 → 1.426 s |
| Wan 3 Prime — match cut transitions | desktop / warm | 1.305 → 1.056 s | -19.1% | 1.331 → 1.006 s |
| Wan 3 Prime — match cut transitions | mobile / cold | 2.064 → 1.679 s | -18.6% | 1.715 → 1.400 s |
| Wan 3 Prime — match cut transitions | mobile / warm | 1.369 → 1.066 s | -22.1% | 1.334 → 1.019 s |
| Kling 3 Pro — city flythrough | desktop / cold † | 2.067 → 1.723 s | -16.7% | 1.602 → 1.226 s |
| Kling 3 Pro — city flythrough | desktop / warm | 1.401 → 1.092 s | -22.0% | 1.319 → 0.982 s |
| Kling 3 Pro — city flythrough | mobile / cold | 2.040 → 1.712 s | -16.1% | 1.629 → 1.072 s |
| Kling 3 Pro — city flythrough | mobile / warm | 1.386 → 1.122 s | -19.0% | 1.276 → 1.030 s |

All twelve primary medians improve. All 18 mobile pairs improve, and mobile CLS is zero in all 36 added mobile audits. The only slower primary pair is the first cold desktop MiniMax visit (+2,871 ms). Every audit still identifies the existing video poster as LCP. All 90 HTML responses are cache `MISS`; HTML caching does not explain the gain.

† The first cold Kling baseline poster request is a WebP cache `MISS`, while its candidate is `HIT`. The initial HTTP priming used Node’s default image Accept header, so it did not establish that Chrome’s negotiated WebP variant was warm. Its unusually large first-pair LCP gain is therefore confounded. The following warm baseline browser visit reuses that cached image response (its preserved header still says `MISS`, but `fromDiskCache` is true). All original observations and their cache evidence remain in the data. The separate three-pair control below confirms the desktop cold result with verified matching warm WebP caches.

## Targeted controls

The follow-ups were declared in `multipage-protocol.json` before collection. They use the same sources, browser configuration and fresh desktop profiles. The real Chrome image Accept header was obtained from `Network.requestWillBeSentExtraInfo`; the exact posters were then fetched and verified `image/webp` / `HIT` on both previews. All 18 follow-up poster responses are `HIT`.

| Control | Pairs | Median LCP before → after | Change | Paired outcomes |
| --- | --- | --- | --- | --- |
| MiniMax H3 — wildfire rescue | 6 | 2.064 → 1.751 s | -15.1% | 6/6 improve |
| Kling 3 Pro — city flythrough | 3 | 2.100 → 1.721 s | -18.0% | 3/3 improve |

The MiniMax candidate maximum in its six extra visits is 1.879 s. The original 4.776 s peak is not reproduced in that control. Its trace places the extra wait before poster discovery: HTML completion is 4.461 s candidate vs 1.568 s baseline, while poster transfer durations are similar (659 vs 652 ms). The corresponding runtime log measures only 78.2 ms for root-layout theme tokens; it does not identify the remaining uninstrumented watch wait. No specific database phase or cold-worker cause is inferred from that log.

The first Kling baseline LCP is 3.859 s vs 1.669 s candidate, but poster fetch alone takes 2.512 s vs 0.717 s. The comparable HTML completion is 1.604 s vs 1.226 s. The entire 2.19 s first-pair LCP difference cannot be credited to SQL batching. The three-pair image-cache control independently gives an 18.0% median LCP gain.

## Functional and metric safeguards

- Every recorded before/after pair retains identical complete displayed quotes, video/poster/preload attributes, canonical and frame width/height (within 0.01 px).
- HTTP HTML checks on all three pages preserve title, H1, robots and complete JSON-LD after normalizing only environment-specific preview site origins. Video canonicals remain the exact production URLs. Each page returns 200; the legacy ID redirect still matches at 308.
- Twelve live browser Play checks cover each page, device and version. They play real media (206 responses), advance currentTime with no media error, retain frame geometry within 1 px and show no horizontal overflow or page exception. These are functional, unthrottled visits; their individual elapsed times remain diagnostic rather than a startup-latency comparison.
- No Lighthouse runtime errors or warnings occur. Mobile CLS is 0 throughout; candidate desktop CLS never exceeds 0.000145. Maximum candidate TBT is below 60 ms on both device profiles. INP was not measured.
- Existing pricing, PG17, reader and exhaustive financial validation remains attached to the unchanged application patch. Quality CI passed on PR head `34f9cdb480f3dbc954d1b82bdc2db71b047ae7d8` before this evidence-only extension; required CI and current-main inclusion remain premerge gates for the final head.

## Conclusion and limits

The desktop gain is reproduced on three additional pages and survives both targeted controls. Mobile LCP improves in every added paired visit, with stable CLS and working playback. No reproducible mobile LCP/CLS regression is observed in this experiment.

This is comparative laboratory evidence on four URLs, not production p75 or CrUX. The full editorial/video catalog read remains a variable server cost, and the isolated MiniMax HTML peak is retained. Fresh browser profiles do not test every cold-function condition, traffic geography, concurrency level or device. Field improvement can only be assessed after a normal release and fresh observations.

## Inspect and reproduce

- `multipage-protocol.json`: predeclared pages, source identity, profiles, follow-up triggers/order and the priming limitation.
- `multipage-samples.csv` / `.json`: all 90 samples, separated by `collection`, with poster cache state, LCP element, actual network User-Agent and frame geometry.
- `multipage-summary.json`: medians/ranges and all 45 paired deltas; no valid metric was removed.
- `multipage-outlier-diagnostic.json`: both unusual initial pairs and the targeted controls.
- `multipage-html-parity.json`, `multipage-poster-priming.json`, `multipage-playback.json`: HTTP, cache and live reader evidence.
- Full redacted Lighthouse reports, traces and DevTools logs remain under `.reports/watch-html-lcp-20261017/browser-vercel-{minimax,wan,kling}/` and the two follow-up directories. Authentication stays in memory, is scoped to the exact preview origins and is redacted from stored artifacts.

From the repository root with existing owner CLI access, prime the Chrome image variant using `node docs/performance/2026-10-17-watch-html/prime-vercel-multipage.cjs`. For each route in the protocol, run `measure-vercel-matched.mjs` with the baseline origin as its argument, `WATCH_HTML_PERF_ROUTE` set to that canonical route, and `WATCH_HTML_PERF_OUT` set to a separate raw output directory. The default series is three cold/warm repeats on both devices.

Use `measure-desktop-followup.mjs` with `WATCH_HTML_FOLLOWUP_PAIRS=6` for MiniMax or `=3` for Kling, the corresponding route, and a separate explicit output directory. `smoke-vercel-multipage.mjs` reproduces the twelve live Play checks. `summarize-vercel-multipage.cjs` validates the declared 90-audit collection and builds the committed tables from the raw files; `WATCH_HTML_MULTIPAGE_INPUT` selects the raw input root.
