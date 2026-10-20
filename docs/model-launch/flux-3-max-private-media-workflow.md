# FLUX 3 Max — private launch media workflow

Updated 2026-10-21 after the final user selection, 20 external-job adoptions,
saved model/family curations and the accepted launch-media manifest. Private
provider journals, quotes, account records and read-back evidence live under
`.local/flux-3-max/`, excluded from Git. Deployment remains a separate operation.

## Current editorial and publication state

The final selection retains 18 films: every film from 01–20 except **Last Exit
(01)** and **The Wrong Reflection (08)**. The accepted jobs are public/indexable
for gallery eligibility; the two rejected jobs stay private and non-indexable.
Film 11 is included in this final user choice, superseding the earlier review.
Preserve any observed dialogue or continuity limitations rather than treating
selection as proof of exact prompt fidelity.

The saved manual model selection `examples-flux-3-max` has 18 items, starting
with **Unavailable (19)**. The saved manual family selection `family-flux` has
31 items: its 13 earlier videos and the 18 accepted Max videos. Its existing
four opening videos remain intact. The main examples hub is unchanged, with
285 effective selections in the canonical read-back. The launch requires no
additional hub curation.

The model hero is film 19; the Prompt Lab demonstration is **After the Bell
(18)**; the homepage hero is **The Uncrowned (16)**. The original MiniMax H3
homepage video moves to the fifth slot, replacing LTX 2.5 Pro. The model's exact
English prompt tabs use films 12, 18, 09 and 10 for action, romance, science
fiction and keyframes. Each tab links only to its matching eligible example.

The launch evidence pair is deliberately separate: accepted films **05/09**
are recorded as `gallery_only`, `watchPageCandidate: false` in
`flux-3-max-video-example-pack.json`. The generator now derives two accepted Max
assets and family readiness without changing P0/P1 evidence. See
[media readiness](flux-3-max-media-readiness.md) for the evidence digest, requested
versus measured facts and the distinction between stored and effective counts.

The three dedicated Video SEO entries for **16/18/19** are saved as drafts in
Admin Video SEO. Their approval/publication is deferred until the reviewed
release is available and the real watch-page checks pass. No SEO entries are
hardcoded for the launch pair; gallery publication and Video SEO approval remain
independent.

## Durable originals and external provenance

The 20 completed videos were imported as owned library uploads and explicitly
adopted with their real Fal provider request IDs. Adoption preserves
`origin: external_fal_import`, `payment_status: external_not_billed`, the exact
submitted prompt/settings and reference provenance. The adoption audits record
no MaxVideoAI wallet charge, synthetic receipt, generation timing or generation
event side effect. Provider estimates are not reconciled invoices.

Keep requested duration/resolution separate from measured media facts. These
originals are 1280 × 704 at 24 fps with AAC audio; the measured video duration is
the requested duration plus one frame. A successful provider response, import
or metadata probe does not replace visual review. Sampled contact sheets do not
certify continuous motion, precise cuts, hand contact or the complete soundtrack.
Quoted dialogue describes the prompt unless it was separately verified by listening.

Reference PNGs for film 10 were normalized losslessly by the upload owner. Their
original/stored hashes, dimensions and decoded RGBA equality were verified
before adoption. Provider input evidence retains the original files; public reuse
uses their durable copies. Original download and schema URLs remain distinct
from prepared display derivatives.

Films 16/18/19 now have reviewed and active desktop/mobile derivatives, with
HTTP/Range evidence and preserved audio packets. The homepage has immutable
prepared posters through the existing pipeline. See
[the selected-media review](../qa/flux-3-max-selected-media-2026-10-21.md).
Earlier derivative evidence remains in the dated 2026-10-20 review. None of
these records establishes production deployment or a complete perceptual audio test.

## Keyframe teaching example and editor handoff

`frontend/config/model-keyframe-demos.json` selects the real film 10,
**The Door to Spring**, with its three durable original reference URLs in
chronological generation order: K1/K2/K3 at frame indexes 0/192/384 (0/8/16 s
at 24 fps). The EN/FR/ES content belongs to `examples.keyframeDemo` in the model
JSON. It shows the ordered input images, exact indexes, original prompt, actual
render with manual playback and return-to-editor action. Pinned visual states
do not guarantee exact cuts. Captions are editorial labels, not recipe inputs.

The server requires the exact public/indexable/live Max `ref2v` job, matching
prompt, duration, settings, source URLs and valid unique indexes. Missing or
mismatched evidence hides the section. No selection adds no job read. Temporary
provider URLs, signed URLs, data/blob URLs and placeholders cannot activate it.

For `/app?engine=flux-3-max&from=<actual-job-id>`, the public video API exposes
only the selected recipe, not the private settings snapshot. The workspace
reconstructs reference order, `keyframe_indexes`, duration, aspect, resolution,
audio, seed and reasoning, and revalidates them before use. Owned-job recall
keeps its separate behavior. Signed-in and logged-out handoff checks in EN/FR/ES
remain browser verification work; source/contract tests do not certify them.

Workspace preflight now follows the same FPS capability projection as generation:
the editor retains its 24 fps clock for keyframe positions, but does not send it
as a provider setting when the selected mode exposes no FPS control. The API
accepts an omitted FPS and still rejects unsupported explicit values.
Max's quote depends on mode, duration and resolution only, so its preflight does
not submit reference media as pricing dependencies. The generation request keeps
every original URL and frame position and retains its normal media validation.
Other models keep their persisted-reference checks and measured pricing inputs.
`workspace-preflight-fps.test.ts`, `workspace-preflight-request.test.ts` and
`model-keyframe-demo.test.ts` exercise the public recipe through restoration,
request parsing and runtime validation; no paid generation is part of these tests.

## Any future generation is a separate attempt

`frontend/scripts/run-flux-3-max-direct.ts` retains the bounded preparation path:

- `quote` validates the exact manifest, image digests, requested settings and
  provider estimate; its 24-hour quote binds a SHA-256 fingerprint.
- `prices` reads the provider pricing API and official model pages with the
  explicitly selected provider credential file. Base billing units and rendered
  resolution rates remain distinct.
- `submit` requires the approved quote and its explicit provider ceiling,
  validates current rates and reserves the scene before network writes. It
  records the exact request and persists the returned request ID before polling.
  The transport fence prevents a second queue POST after uncertain acknowledgement.
- `recover` reads status/result for the persisted request ID only; it never
  submits a replacement.
- `collect` retrieves the accepted original with a size bound and writes its
  hash/provenance sidecar. It creates no application job or receipt.

Use the authorization attached to the specific future request, including any
explicit delegation of prompt preparation. Retain accepted request IDs and
inspect actual provider history after an uncertain acknowledgement; never infer
that no request exists and resubmit. A retry is a new attempt. The current final
selection does not request another generation.

## Admin ownership and release verification

Read the existing admin inventory before editing. The runtime model collection
is `examples-flux-3-max`, and the family is `family-flux`; Standard's collection
`examples-flux-3` retains its existing identity. Admin destinations and family
candidate discovery allow preparation before launch-media readiness using the
canonical discoverability rule. Public readers keep their own readiness gates.

Saved curated destinations use the existing revision-bound preview/token/save
workflow. Preview alone is not persistence. The historical raw item endpoint
can trigger IndexNow and is not a private local-manifest operation. Do not seed
all collections, adopt an empty manual selection or bypass the admin owner with
SQL. See [the discovery runbook](../deployment/video-discovery-release.md).

The completed readiness generation is offline. Before the Git-backed release,
run the applicable registry, launch-asset, public rendition and origin checks,
then the focused page/media tests and `git diff --check`. After release, verify
actual localized model/family/watch pages, public source responses, playback,
canonical/hreflang output, SEO approval eligibility and sitemap behavior. Neither
a ready projection nor a saved SEO draft proves indexing or successful deployment.
