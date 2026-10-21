# FLUX 3 Max media readiness

Updated 2026-10-21 after the final user selection, external adoption and saved
admin curations. The independent `flux-3-max` wave is now backed by two accepted
text-to-video examples in `flux-3-max-video-example-pack.json`: film 05,
**The Sleeping Guardian**, and film 09, **Someone Answers**. Both remain
`gallery_only`, with `watchPageCandidate: false`. They establish launch media
readiness; they are not the final model hero or Prompt Lab demonstration.

## Final selection and saved destinations

The user retained 18 of the 20 films, excluding only **Last Exit (01)** and
**The Wrong Reflection (08)**. The accepted jobs are public/indexable for gallery
eligibility; 01 and 08 remain private and non-indexable. Final roles are:

- Model hero: **Unavailable (19)**, first in the saved model selection.
- Prompt Lab demonstration: **After the Bell (18)**.
- Homepage hero: **The Uncrowned (16)**.
- Keyframe teaching example: **The Door to Spring (10)**.

Admin Playlists saved `examples-flux-3-max` as a manual selection of the 18
accepted jobs. The family selection `family-flux` contains its 13 existing
videos plus those 18 jobs, preserving the existing four opening videos. The
main examples hub was deliberately left unchanged; its canonical read-back
retained all 285 selected videos. No hub save is required for this launch pair.

The evidence captured before readiness generation distinguishes 31 stored
family selections from 13 effective public family videos: the public asset gate
still excluded Max at that point. Generating readiness admits Max through the
existing family policy; verify the effective public projection again after the
new code is loaded. A stored selection is not by itself proof of a deployed
page or its current card count.

## Evidence and authored source

The private repeatable-read evidence is
`.local/flux-3-max/selection-2026-10-21/readiness-film-05-09-evidence.json`, captured
at `2026-10-20T23:27:58.913Z`, with SHA-256
`709fa1627944e8e7a51d8476fb9f5d09806862e7e6876947ffcce7683723c288`.
It records the actual completed jobs, ready outputs, saved library records,
provider provenance, original prompts, measured media facts and canonical
curation snapshots. Playlist identities are corroborated by the same folder's
`admin-after-curation.json`; `admin-after-curation-canonical.json` preserves the
hub and earlier family membership evidence. Private account metadata remains
outside the tracked source manifest.

The authored pair uses the real output IDs as `assetId`, actual job IDs as
`videoId` and `jobId`, and the durable uploaded media IDs as `libraryAssetId`.
Both entries use `modelId` / `engineId: flux-3-max`, `familyId: flux`, `mode: t2v`,
`sourceKind: text` and an empty source list. Their exact original and poster URLs
are on `media.maxvideoai.com`, without temporary credentials or query strings.
The recorded acceptance time is the final user-selection timestamp, distinct
from generation, import and curation timestamps.

| Film | Requested duration | Measured duration | Measured dimensions |
| --- | ---: | ---: | --- |
| 05 — The Sleeping Guardian | 18 s | 18.041667 s | 1280 × 704 |
| 09 — Someone Answers | 16 s | 16.041667 s | 1280 × 704 |

The shared family and model playlist IDs were read from the persisted records,
and each job appears in both saved selections. External Fal adoption retains
`external_fal_import` provenance and `external_not_billed` payment status; this
manifest does not represent a MaxVideoAI generation charge.

## Projection checks and remaining release work

`pnpm model:launch-assets:generate` authored the two derived projections through
the canonical generator, and `pnpm model:launch-assets:check` confirms coherence.
Max has `acceptedAssetCount: 2`. The P0/P1 source files are byte-identical to the
pre-generation snapshot, and all non-Max assets, waves and readiness model
records are structurally unchanged. The local preservation report is
`selection-2026-10-21/readiness-preservation-qa.json` under the private media folder.
The engine catalog also consumes family readiness: its canonical generator
updated only `familyExamplesPage` on the three FLUX entries to include Max.
All other catalog fields and entries are unchanged, and `model:registry:check`
passes after that dependent projection was regenerated.

The previously failing public family contract passes after generation, together
with Max family continuity, source validation, admin destination/candidate and
Video SEO separation checks. This is offline validation, not a deployment or a
browser playback certification.

The three Video SEO entries for 16, 18 and 19 were saved through the dedicated
admin editor as **drafts**. Their approval and publication are deferred until the
reviewed release is available and its watch pages pass the real admin and public
checks. Films 05/09 are not enrolled in that watch-page work. Readiness alone
neither approves SEO nor proves Google indexing.

Public display derivatives have their own measured review, HTTP/Range and
activation record in [the selected-media review](../qa/flux-3-max-selected-media-2026-10-21.md).
The keyframe example retains its exact-job/reference contract. Deployment,
localized playback, canonical/sitemap checks and editor handoff verification
remain separate release gates.
