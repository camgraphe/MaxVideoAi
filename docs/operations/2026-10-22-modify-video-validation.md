# Modify Video validation — 22 October 2026

Candidate: PR #500, not a production activation. The shared UI is checked against
all 13 configured `v2v` entries. Live MCP discovery exposes nine public Modify
entries; that is a different scope from the admin Luma pilot and legacy catalog.

## Common workflow

The real Composer presents the required source before optional references, accepts
file/library entry, waits for completed upload before pricing and invalidates the
old quote when the source changes or disappears. Model schemas retain their own
image/video/audio references and advanced controls. Existing unified Kling and
Wan behaviors remain covered; filtering their entire composer to a single schema
mode broke valid references and was discarded before this candidate.

The original iPhone MOV imports through the production private import helper,
returning the same canonical asset on re-import (no duplicate library item).
The local browser demonstration also verifies all original bytes over multipart
transport. No transcoding, trimming or HEVC/HDR compatibility claim follows.

An observed defect in the current deployed upload probe records encoded landscape
geometry for a portrait MOV. The candidate reads display-matrix rotation and
legacy rotate tags before persisting dimensions. The actual original now probes
as 2160×3840, 5.558s, with audio, without modifying its bytes. This benefits every
source-inheriting workflow. Existing production metadata has not been repaired;
its old quotes must not be presented as proof that this fix is deployed.

## Model-specific verification scope

| Configured models | Preserved contract / review focus |
| --- | --- |
| Luma Ray 3.2 | Verified source up to 18s; no Modify duration override. Optional guide/keyframes, strength and preservation controls retained. New retail classes are a candidate, not activated. |
| Luma Ray 2 / Flash | Legacy source-driven edit behavior and existing unit tariff; no invented source ceiling or new generation preset. |
| Gemini Omni Flash 1.1 | Owned video and source-inherited timing/pricing; existing previous-interaction workflow preserved. |
| Kling Omni Standard / Pro | Source video plus optional images/subjects; unified composer preserved. Provider edit payload omits an independent generation duration. Live catalog still describes a requested-duration setting: retain this as a parity follow-up pending real-render qualification. |
| Happy Horse 1.0 | Existing source timing and model-specific reference behavior retained. Configured-code validation does not establish current public MCP availability. |
| Seedance 2.0 / Fast / Mini | Their own resolutions and bounded video/image/audio references remain visible; source and additional reference duration are priced separately from requested output where applicable. |
| Seedance 2.5 | ModelArk Edit inherits source timing/framing; its transport-specific options and pricing remain distinct from LAS and native Draft/final. |
| Wan 3 / Prime | One source plus optional image/audio references, independent output duration, combined source/output ceiling and input-video pricing preserved. |

Focused behavioral suites: 214 passing checks across shared Modify UI, quote
lifecycle, workflow projection, provider payloads and model-specific pricing.
The Luma-specific source/payload/pricing/registry suite passes separately. Rotation
has both metadata unit tests and a real rotated MOV/bundled-ffprobe regression.
These are automated integration contracts, not thirteen successful paid renders.

The complete fast lane ran 8,451 checks: 8,449 passed, one skipped and one failed
because its tariff-domain count still expected the old Luma duration set. The
count was updated for the 36 additional ordinary cases (12 new durations × three
resolutions), with an explicit assertion for the complete 5–18s domain. Its
focused rerun and related import/rotation checks passed (40/40); the entire fast
lane has not been rerun locally after that correction. The final Luma timing and
phone-orientation rerun passed (37/37). TypeScript, exposure checks and the full
967-page build pass; lint reports zero errors and six existing warnings. Required
CI on the committed candidate remains the release gate.

## Live qualification

Five Luma direct renders completed. The original 5.558333s MOV produces 5.56s;
an 8.4s looped technical fixture produces 8.4s; a 17.52s fixture produces 17.32s.
That last 0.20s difference prevents a frame-exact preservation claim. Console
usage totals $4.32. Identity fidelity improved materially with a guide image and
explicit face/pose/trajectory controls in the requested film-noir prop scene.

Three exact MaxVideoAI quotes were prepared on the imported original: Kling Omni
Standard 1080p $0.99, Seedance 2.5 720p $2.41, Wan 3 720p $1.51. They are quotes,
not completed renders; paid confirmation is pending. Seedance's returned source
geometry exposed the deployed rotation defect above. Quote IDs, private media and
provider responses remain outside Git.

## Remaining release boundaries

- Review/activate the additional Luma retail classes through the existing tariff
  workflow; never infer an invoice rule from the observed qualification charges.
- Validate current production import → quote → debit → provider → durable output
  after the candidate and corrected media facts are available.
- Complete the paid model comparisons and inspect identity, timing, orientation,
  audio and output integrity, not just successful job status.
- Shared excerpt selection, automatic codec/HDR preparation, customer quotas and
  physical storage cleanup remain separate unimplemented work.
- Preserve all public URLs, IDs, reuse recipes and SEO routing. No deployment or
  marketing migration is performed by this validation.
