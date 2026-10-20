# Public price dependency follow-up — 2026-10-12

This follows the controlled [homepage experiment](README.md). That experiment
proved a local uncached-render dependency: the initial homepage poster waited for
canonical prices. Its 3.25 → 2.22 second median LCP is not a field improvement or
an attribution of the full CrUX trend. The archived CrUX window ending October 3
cannot measure October 9–11 releases.

## Candidate changes

- Homepage: stream quote-only regions and the canonical demonstration after the
  critical poster. Reduce repeated RSC props to quote display fields and remove
  complete engine/workspace data from the pending demonstration. Retain the
  walkthrough geometry when current quotes are unavailable.
- PAYG: eliminate image/audio/tool price reads that the page never consumes.
  Canonical quote count falls from 153 to 114 (39 fewer, 25.5%). This count is a
  deterministic current-catalog test result, not a measured LCP or SQL reduction.
  Every localized page-data field compares equal with the full-hub control, for
  exact prices and unavailable results. Video pricing still precedes the PAYG
  render; this patch does not claim otherwise.

## Other public routes inspected

| Route family | Existing blocking dependency | Finding / next verification |
| --- | --- | --- |
| Home `/`, `/fr`, `/es` | Hero and demo quotes joined the critical reads | Corrected; prior comparable native Chrome experiment; final payload and rendering validation recorded below. |
| PAYG | Full pricing hub and showcase joined before rendering | 39 unused quote calls removed; remaining visible video quotes retained. |
| Pricing `/pricing`, `/fr/tarifs`, `/es/precios` | Full canonical hub before title, featured cards and matrix | Every price surface is consumed. Streaming requires stable unavailable/loading geometry and a new comparable browser measurement; not modified by this patch. |
| Individual models | `loadModelPageInputs` joins pricing and gallery; `MarketingModelPageLayout` then awaits decision scenarios and structured public offer | Same possible poster dependency, plus a second pricing stage. Preserve visible-price/JSON-LD parity, media selection, archived/prelaunch and 404 behavior before splitting. |
| Comparisons | `loadComparePageData` joins both price sides, benchmark/specs and both galleries | Reads already overlap, but still gate the initial page. Existing scoped policy and six-scenario contracts are retained; no browser gain claimed. |
| Examples (hub/families) | Gallery selection precedes `buildCurrentExamplesGalleryData` | Current card/reader prices can gate the first prioritized gallery poster. Keep one 24-card SSR gallery and its single prioritized cover when testing a split. |
| Models catalog | Specs, scores, localized content, then all current price ranges | Serial scheduling and full quote inventory deserve a separate controlled trace; no measured regression established here. |

The investigation above establishes source dependencies, not their current field
frequency or a confirmed LCP cause on every route. Cached HTML can avoid those
server reads. Do not compare an edge HIT with an uncached SSR request as though
both represent the same workload, or sum overlapping server phases.

## Evidence and release status

The final candidate was checked after midnight on October 13. Two native Chrome
Performance captures (Slow 4G, browser cache disabled, CPU unthrottled) report
poster LCP **2,054 / 2,052 ms**, document headers **626 / 618 ms**, and **72,757 B**
of document transfer in both runs. The original experiment measured 69,678 B for
the blocking baseline and 82,768 B for the prototype: the final streaming overhead
is **4.4%**, down from 18.8%. Decoded HTML is 320,246 B versus 309,641 B baseline.
All production CSS hashes are identical. Both captures run more than 43 seconds
after navigation, with no qualifying main-frame layout-shift events in 30 seconds.

These are verification captures, not a new paired experiment: the visible poster
was 1,256 × 577 CSS pixels versus 1,256 × 584 in the original experiment (same
x=227, y=359). Do not recalculate a matched percentage LCP gain from these two
runs. Chrome's two console errors concern the Vercel Insights scripts, which
return 404 on local Next servers; no hydration error was observed.

The production build passed, including TypeScript, lint (five existing warnings)
and 932 generated pages. The 114 focused tests passed, including all permanent
PAYG contracts, exact/unavailable projection parity, home streaming/playback,
pending→unavailable demo geometry, and the source guards. Exposure lint and
`git diff --check` passed. The first general validation was interrupted after
source guards encountered measurement build copies and Studio guards refused the
local measurement environment files. Those are test-setup failures, not passing
full validation; final CI remains required before merge.

Raw native traces, full HTTP bodies, build and test logs remain outside Git under
`~/.codex/artifacts/cwv-price-lcp-experiment-2026-10-12/`. The compact metrics are
in [follow-up-measurements.json](follow-up-measurements.json). No production
deployment had been performed at the time of these candidate measurements.

## Production delivery — October 13

PR [#431](https://github.com/camgraphe/MaxVideoAi/pull/431) was squash-merged as
`3cf8aae2f4ab0260c8c74a423fc2ccb0d3103b11` after all required Quality CI lanes passed.
The automatic Git deployment `dpl_HFNtfbHdVM3mLDrmAM3CwJcHFNni` reached READY.
A fresh `pnpm deployment:check` from that clean commit confirmed both
`maxvideoai.com` and `api.maxvideoai.com` on that same source and deployment.
Production home/PAYG browser smoke checks confirmed rendered content, current
prices, canonical links and native JSON-LD; no console errors or deployment
runtime error groups were observed in the short initial verification window.
The post-READY [Lighthouse run](https://github.com/camgraphe/MaxVideoAi/actions/runs/38317671830)
was dispatched separately. This release check does not establish a CrUX change.
