# Seedance ModelArk creative options

Reviewed 2026-10-14 against the [ModelArk task API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

`frontend/lib/seedance-modelark-options.ts` extends the four authored current
Seedance configurations. It owns creative field definitions and media type
budgets, including primary source slots. Workspace input discovery and MCP
setting projection consume these fields; provider validation remains in
`byteplus-modelark-payload.ts`. Current 2.x seed and camera-fixed settings are
unsupported. Seedance 1.5 publication stays unchanged.

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
