# Home pricing streaming experiment — 2026-10-12

The current homepage waits for canonical hero and Wan 3 demonstration quotes before returning its poster markup. This isolated candidate starts the same quote reads but streams their content after the initial hero. Quote-only boundaries preserve the original player, poster bytes, geometry, item IDs and playback lifecycle. The guided demonstration stays inert while its exact server quotes are pending.

Reference: production source `71f816ed5cdddc13ca2faf8ffbcc4b1bdbf2147e` (#428). Candidate branch: `codex/home-price-lcp-probe`. Neither version was deployed by this experiment.

## Matched Chrome measurements

Both are local **production builds of Next 15.5.25**, using the existing canonical quote reads without artificial delays. Chrome private window, cache disabled, CPU unthrottled, DPR 2, Slow 4G (180,000 B/s download; 562.5 ms configured latency). DevTools was detached so the entire 1,256 × 584 CSS-pixel poster remained visible. The poster and every CSS file are byte-identical between builds. Consent remained unanswered. Native traces contain at least 45 seconds after navigation; every included trace's last LCP candidate is the initial poster and no later candidate occurs after the first 30 seconds.

| Version | n | LCP median | LCP range | Document response median |
| --- | ---: | ---: | ---: | ---: |
| Reference | 3 | 3,249.756 ms | 3,042.862–3,389.582 ms | 1,771.408 ms |
| Candidate | 3 | 2,218.418 ms | 2,018.163–2,226.727 ms | 586.659 ms |

Median LCP improves by **1,031.338 ms (31.74%)**. Poster decode/display after loading remains small (median 20.7 → 26.4 ms). No qualifying layout-shift event occurs during the first 30 seconds of these traces.

The sample order was reference 1, an excluded candidate diagnostic, reference 2, candidate 1, reference 3, candidate 2, candidate 3. This is a small local experiment, not a randomized field trial. The excluded diagnostic had a shorter 23-second capture and overlapped a separate HTTP probe. All valid observations are retained, including the slower candidate loads.

## What this establishes

The dependency tests fail on the reference when canonical price reads are held. On the candidate, the actual homepage streams the poster, four films and three SEO scripts in EN/FR/ES while both price reads are still held. When released, the quote markup and guided demonstration match canonical rendering. An unexpected price failure still rejects its boundary and the bounded diagnostics, without holding poster data or inventing a numeric price.

Five reference-price amounts, their qualifying “from” labels and scenarios match the reference's production HTTP payload exactly. Native Chrome selection verified all five amounts: MiniMax $0.33, Seedance $1.35, Wan Prime $0.45, Kling $1.10, LTX $0.94. These are qualified starting prices, not the cost of the displayed clip. Wan's three exact demonstration scenarios remain 5s/720p $0.65, 15s/720p $1.95, 15s/1080p $3.90.

The local server's price reads took roughly 0.8–2.4 seconds in the inspected samples; cached slots and score reads were available in milliseconds. This is a real server-render dependency, and removing it reproducibly improved local uncached LCP. Local database/network latency must not be projected onto Vercel or CrUX. The test does **not** establish that these reads caused the recent field deterioration: a CDN HTML hit can avoid this server work altogether. A same-platform preview and cache-hit/cache-miss comparison remain necessary before a production recommendation.

## Cost and validation

The candidate sends more HTML/RSC. Native document transfer increases from 69,678 bytes to about 82,768 bytes (+18.8%); decoded document content increases from 309,641 to 339,889 bytes (+9.8%). This cost should be reduced or explicitly assessed under Vercel cache hits before shipping. The experiment is retained as a targeted candidate, not a release approval.

- Both production builds completed, including type checks and all 932 static pages.
- 54 focused tests passed: streaming/data failures, exact prices, poster delivery, playback and demonstration loading.
- Frontend lint: zero errors; five existing warnings in unrelated admin/studio readers.
- Public exposure check and `git diff --check` passed.
- The temporary `distDir` config hook and generated TypeScript config edits were restored. Only experiment-owned servers, browser windows and compilation caches were stopped/cleaned.

## Reproduce and inspect

Evidence directory on the investigating machine:
`/Users/adrienmillot/.codex/artifacts/cwv-price-lcp-experiment-2026-10-12/`

`analyze.py` reads saved native Chrome exports only. `trace-analysis.json` retains every observation and source SHA-256. `builds.json` records both build IDs and exact CSS hashes. `price-parity.json` checks all five hero quotes and three demonstration scenarios from the real HTTP RSC payloads. `streaming/` contains the controlled EN/FR/ES shell/reveal proof. Private build/server logs remain outside Git.

The compact `measurements.json` beside this document records all included samples. Raw traces and local database credentials are intentionally excluded from Git. Build the reference and candidate in separate clean checkouts with identical environment and lockfile, then record native Chrome Performance traces under the settings above. Do not compare a development server with a production build. Do not inject benchmark-only latency or suppress playback.
