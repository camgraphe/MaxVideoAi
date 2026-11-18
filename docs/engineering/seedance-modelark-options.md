# Seedance ModelArk creative options

The [17 November 4K candidate](seedance-25-4k.md) extends standard 2.5 direct and
Draft-final resolution through the shared web/Studio/MCP capabilities, with
independent ×2 tariff activation. Its evidence and release limits are recorded there.

Reviewed 2026-10-14 against the [ModelArk task API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

`frontend/lib/seedance-modelark-options.ts` extends the authored current
Seedance configurations. It owns creative field definitions and media type
budgets, including primary source slots. Workspace input discovery and MCP
setting projection consume these fields; provider validation remains in
`byteplus-modelark-payload.ts`. Current 2.x seed and camera-fixed settings are
unsupported. Seedance 1.5 publication stays unchanged.

The 15 November Flash qualification confirms all five workflows, first/last
frames, audio generation, audio-only references, MP4/MOV and Auto. The provider
now documents Flash as part of the 2.5 series for these options; its independent
10/5/5 reference limits and 480p/720p output limits still apply. See the
[dated evidence](../model-launch/seedance-2-5-flash-qualification-20261115.json).
No Flash Draft/final, seed or fixed-camera control is exposed.

`EngineInputField.minDurationSecByMode` supports a stricter minimum for the same
reference slot in Modify. Use `resolveMediaFieldMinDuration` for selection,
excerpt preparation, web execution and canonical MCP/Studio validation and
discovery. Flash videos require at least 2s, or 4s in Modify; audio requires 2s.
The qualified-options tests cover rejecting a three-second supplementary Modify
video while allowing it as a Create reference. This avoids a provider rejection
after a reference was presented as eligible.

Auto duration is an explicitly disclosed fixed-price product: 15s for 2.0,
30s for 2.5, even if the provider creates a shorter video. The UI preserves
the Auto choice through hydration and stores the positive maximum quote
duration; the provider receives -1. Trusted source timing wins for 2.5 Edit.
`seedance-option-pricing.ts` normalizes every quote and billing path. Adaptive
generation resolves the highest current exact six-format customer quote
inside tariff locks, so editable tariffs and missing cells cannot underprice
an accepted task. Inherited framing requires trusted stored or probed source
dimensions within the existing reviewed format classes. Arbitrary inherited
ratios remain closed until continuous scaling and supplier pricing are proven.
Exact published provider rasters also map to their reviewed classes, even
where raster rounding exceeds nominal 1%. Their pure owner is
`seedance-output-dimensions.ts`, shared with supplier accounting; historical
retail dimensions remain independent. Web preflight admits at most 50 inputs
and 128 KiB, then applies each model's stricter media budgets and ownership.

ModelArk Edit 2.5 supports 1080p with the existing account/key. The retained LAS
transport keeps its independent access and narrower contract. Input references
include supplementary images/audio in Edit and Extend, supplementary video in
Edit, and audio-only Omni references for 2.5. First/last-frame roles remain
exclusive with Omni references.

MOV and returned last frames flow through immutable job snapshots. Original
video bytes stay separate from full compatible playback and short incidental
previews. The JPEG is a separate owned output with source-video provenance;
see the [media guide](media-delivery.md). Draft/Final inherit these choices
and immutable source facts; see the [lifecycle guide](2026-10-01-seedance-draft-lifecycle.md).
Checkpointed originals carry `outputPreparationState=active` through web
history/status and persisted workspace renders. Polling continues until the
required artifacts and projections complete. Exhaustion exposes manual review
and stops automatic work/polling while preserving the original download.
Projection failures share the artifact attempt and first-failure time bounds.

## Initializing independent multimodal workflow tariffs

Normal prices and existing T2V stage prices are preserved. New multimodal
stage selectors use frozen copies of matching current normal fixed prices or
input-video price components. There is no runtime fallback to a normal cell.
The reviewed full scope is 1,620 cells plus any current exact input-duration
exceptions. The preparer verifies complete supplier-floor domains. A failed
or stale initialization rolls back its entire transaction.

The explicit maintenance CLI is
`frontend/scripts/initialize-seedance-multimodal-workflow-tariffs.ts`.
It accepts `preview` or `apply`, an explicit private `--environment` file,
existing admin `--actor`, exact published `--candidate` SHA and `--review`
file. Apply also requires `--pr` and passing Quality CI for that exact SHA.
The read-only preview binds the selected database, actor, candidate, policy,
source revision, scope and fingerprint. Apply reproduces it under tariff and
policy locks, checks the admin role under lock, preserves every existing
price and records an immutable pricing event. Clean Git source and verified
Neon TLS are mandatory; neither build nor deployment invokes the writer.
Normal GitHub/Vercel source-alignment checks remain separate mandatory release
gates. If completion is uncertain, inspect the immutable event before retrying.

No supplier generation or wallet operation is part of this initialization.
