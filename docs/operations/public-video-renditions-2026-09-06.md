# Public video rendition review — 6 September 2026

## Scope

Extend the existing public-demo-v1 catalogue to the exact sources observed on `/models/minimax-h3`, `/examples/kling`, and `/models/seedance-2-5`. The reference code is main `77076a03204ac4819a257b8bd2afef639975cdf7`. Selection uses the public media inventory and recent page exposure; page views are not video plays or transferred bytes.

No route, page layout, metadata, original URL, profile setting, playback component or loading policy changes belong to this lot. The authored source list, measured manifest and generated projection extend the existing model/family hero readers. Comparison, watch and preview-card readers are outside this rollout.

## Full-file measurements

| Source | Original | Desktop | Desktop saving | Mobile | Mobile saving |
|---|---:|---:|---:|---:|---:|
| kling-family-featured | 18,618,789 B | 7,070,171 B | 62.03% | 2,129,316 B | 88.56% |
| minimax-h3-model-demo | 36,677,883 B | 14,615,963 B | 60.15% | 5,624,570 B | 84.66% |
| seedance-2-5-model-demo | 12,402,108 B | 3,788,369 B | 69.45% | 2,982,698 B | 75.95% |

These are complete-file sizes, not initial page transfers or measured Core Web Vitals gains. All six profiles exceed the existing 15% savings gate. Seedance remains 854×480 in both profiles; the pipeline does not upscale.

## Content acceptance

- All three original/desktop/mobile contact sheets were inspected at 10%, 50% and 90% duration. Composition, faces, dark gradients, smoke, snow and moving particles remain representative at the inspected display scale. Mobile is a smaller display rendition, not an archival-quality replacement.
- All six candidates and their paired originals completed Chrome playback without media errors. Browser frame callbacks confirmed presentation; their callback counts are not a decoded-frame equality or dropped-frame metric.
- Every candidate preserves the complete original video frame count and timestamp digest, and the exact AAC packet payload, channel/sample-rate metadata, start and duration. Audio is accepted based on byte-identical AAC payload and timing, without audio re-encoding. This is not a new subjective listening assessment.
- Every file decoded successfully and passed the existing format, aspect-ratio, duration, timing, savings and MP4 faststart gates. No profile exception or omitted candidate was needed.
- Physical iPhone playback was not tested; the existing lack of access remains documented. Browser playback and measured content acceptance do not certify field Core Web Vitals.

## Release validation

Publication, current HTTP/Range readiness, activation, preview integration and page-performance checks are recorded as they complete. Content acceptance alone does not authorize merging past GitHub review protection.

Local diagnostic artifacts are under `output/audits/public-video-priority-renditions-20260906/`: measured-savings.json, prepared checkpoints, three contact sheets, browser-review.json, and SEO snapshots. They remain outside application bundles. No credential is copied into the worktree or audit directory.

## Continuation

The wider media inventory, initial mobile loading and ambitious visual/product/SEO audit remain open. For later selected assets, use explicit asset IDs throughout the same pipeline and confirm the actual owning reader uses the generated rendition projection. Retain original media and the earlier projection for rollback.
