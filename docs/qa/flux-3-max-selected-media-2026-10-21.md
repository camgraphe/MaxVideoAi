# FLUX 3 Max selected launch media — 21 October 2026

The approved final selection uses film 16, **The Uncrowned**, for the first
homepage hero; film 18, **After the Bell**, for the prompting demonstration;
and film 19, **Unavailable**, for the model hero. These are the exact uploaded
originals from the externally generated launch lot, matched by SHA-256 to their
completed Camgraph import receipts. This preparation does not generate media,
charge the wallet or alter database publication/playlist membership.

## Rendition review

The existing `media:public-renditions prepare` command resumed its checkpoints
and completed both profiles for the three explicit source IDs. The interrupted
mobile preparation for film 19 was resumed; the accepted siblings were reused.

| Source | Original bytes | Desktop bytes / saving | Mobile bytes / saving |
| --- | ---: | ---: | ---: |
| `flux-3-max-uncrowned` | 8,462,784 | 3,972,246 / 53.1% | 3,107,038 / 63.3% |
| `flux-3-max-after-the-bell` | 7,313,333 | 3,446,491 / 52.9% | 2,686,472 / 63.3% |
| `flux-3-max-unavailable` | 5,587,443 | 3,041,269 / 45.6% | 2,338,359 / 58.1% |

All six outputs retain the original 1280 × 704 dimensions, 24 fps cadence,
complete frame timestamps and AAC packet payload/timing. Decode and faststart
checks pass. The first two sources contain 433 frames (18.041667 seconds); the
third contains 385 frames (16.041667 seconds). The requested 18/16-second values
remain separate from measured duration and the one extra video frame.

Original, desktop and mobile samples were inspected side by side at frame
indexes 0/144/288/431 for films 16 and 18 and 0/128/256/383 for film 19.
Composition, faces, lighting, visible detail and endings are preserved at those
positions. This is sampled derivative fidelity, not an exhaustive perceptual
motion or lip-sync assessment. AAC packets are copied unchanged; no new
subjective soundtrack assessment is claimed.

Private checkpoints, comparison contact sheets and command logs live under
`.local/flux-3-max/renditions/` and `.local/flux-3-max/review/`. Authored identity
lives in `frontend/config/public-video-sources.json`; only the canonical CLI may
write measured state and the browser projection.

## Homepage selection and poster

The order is FLUX 3 Max, Seedance 2.5, Wan 3, Kling 3 Pro, MiniMax H3. The existing
MiniMax H3 flight scene moves from first to fifth with its exact original,
poster, localized copy and canonical price scenario. Seedance, Wan and Kling
retain their existing content. Pricing still comes from the existing current
quote owner; no stored historical charge or numeric fallback is introduced.

The first poster uses the real film 16 frame with the existing display geometry.
Its desktop source is 28,668 bytes and its 768 × 432 mobile source is 12,562
bytes. `media:home-posters:prepare` created immutable SHA-256 display copies.
The former MiniMax sources remain available unchanged: 11,712 desktop bytes and
6,750 mobile bytes. The new critical poster therefore adds 16,956/5,812 source
bytes; this is a byte comparison, not a claim of faster loading or field CWV.

The first mobile poster remains server-rendered, and the existing lazy/manual
mobile playback, fixed geometry, exact original actions and shared rendition
selection remain unchanged. This document does not establish a deployed page
or production field performance.

## Activation and checks

Canonical publication, `check --http`, and explicit activation completed for all
three sources. The manifest records six active derivatives with `video/mp4`,
exact total byte lengths and successful Range bytes 0–31 checks at
2026-10-20 23:06 UTC (21 October in Europe/Madrid). There are no pending,
failed or omitted profiles for these sources. The generated browser projection
contains their active URLs; it was written by the activation owner.

- `media:public-renditions:check`: all five selected home heroes ready.
- `media:home-posters:check`: both immutable display copies byte-identical.
- 82 home selection, streaming, poster, playback, rendition and coverage tests
  pass in `final-home-renditions-green.tap`.
- Four current-price display tests pass in `home-selected-price-green.tap`.
  MiniMax's current quote and scenario follow it to fifth; an unavailable FLUX
  quote remains unavailable instead of inheriting the previous first price.
- Parsed EN/FR/ES messages match HEAD outside the five recommendations. The
  middle three recommendations are identical; the fifth is the previous first
  MiniMax object, with only its selected flag removed.
- `git diff --check` passes.

The initial first-video desktop transfer object changes from 5,247,170 bytes
(MiniMax) to 3,972,246 bytes (FLUX), a difference of −1,274,924 bytes; the manual
mobile object changes from 4,248,087 to 3,107,038 bytes, a difference of
−1,141,049 bytes. These compare object sizes, not request timing, viewport
visibility or whole-page loading. Full metadata is in the private
`review/final-selected-media-readiness.json` evidence file.

Production-build browser validation remains separate. The final build owner
should compare the same reference/candidate route, browser and CPU/network
conditions in alternating cold/warm mobile and desktop runs. Check LCP/CLS,
the single responsive first-poster request, zero initial mobile video requests,
first Play, all five selections and the selected derivative URL. Development
server timing and this byte report do not substitute for that comparison.
