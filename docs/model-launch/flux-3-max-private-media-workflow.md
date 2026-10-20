# FLUX 3 Max — private launch media workflow

Updated 2026-10-21 after generation, owned imports, explicit external adoption
and visibility review. Deployment and playlist curation remain separate actions.
Private attempt evidence lives under `.local/flux-3-max/`, excluded from Git.

## Keyframe teaching example and editor handoff

The model page now has an optional teaching section: ordered input images with
their exact frame indexes and seconds, chronological position chips, the actual
render with manual playback, the original prompt, and a return-to-editor action.
Its EN/FR/ES copy belongs to `examples.keyframeDemo` in the localized model JSON.
The limitation text distinguishes pinned visual states from cuts or guaranteed
editing. Display timestamps are rounded to three decimals; frame indexes remain
exact and the editor handoff uses those integers at 24 fps.

`frontend/config/model-keyframe-demos.json` selects the real public film 10,
“The Door to Spring”, with its three durable original reference URLs in generation
order and descriptive EN/FR/ES captions. The source images are K1/K2/K3 at indexes
0/192/384. This is an explicit public display/reuse selection, not an alternate
source of generation settings. No trial job, placeholder or other Flux variant
is registered. Captions are editorial labels outside the generation recipe.

The server reads that exact job with the existing public/indexable/live-output
reader and requires a Max `ref2v` snapshot, full matching prompt, matching duration,
valid settings, original reference URLs matching the selected list, valid unique
indexes, durable HTTPS result/poster and reference URLs. Missing or mismatched
data hides the entire section. No selection means no extra job read. Fal-hosted,
signed, data/blob and placeholder URLs cannot activate the section. Verify public
HTTP/image content and persistence separately before approving the manifest;
syntactic URL validation alone does not prove these facts.

For `/app?engine=flux-3-max&from=<actual-job-id>`, the existing public video API
adds only the selected recipe. It does not expose the private settings snapshot.
The workspace reconstructs reference attachments in their original order,
`keyframe_indexes`, duration, aspect, resolution, audio, seed and reasoning. This
works for a visitor who does not own the original job; owned-job recall retains
its existing behavior. The recipe is revalidated in the workspace before use.

The prompts, reference images and quoted video attempts were approved and the
actual assets have been generated, imported, adopted and reviewed for public
selection. The remaining launch checks include saved curations, browser playback
and signed-in/logged-out editor handoff in EN/FR/ES. These implementation and
operational records do not certify a completed browser check.

The user's approval of each prompt, including reference-image prompts, is a
prerequisite to generation. Approval of prompts does not replace approval of the
exact quoted attempt. Preserve accepted provider request IDs before polling;
never resubmit after an uncertain acknowledgement. Any retry is a new attempt.

## Generate before publishing the model

All eleven approved films completed through direct Fal generation, one attempt
each and zero resubmissions, followed by owned Camgraph library imports through
MCP and explicit external-provider adoption. The eleven films total 172 requested seconds at 720p, 16:9, audio enabled and high reasoning. One film
uses K1/K2/K3 at frame indexes 0/192/384; the other ten are text-to-video. The
user approved one attempt per film with a total provider estimate of USD 7.31
and a hard operational ceiling of USD 8. The normal USD 29.24 estimate is **not
approved**. Retail pricing remains normal Fal LIST × 1.30 and is unrelated to
these direct provider purchases; no MaxVideoAI wallet charge is created.

The private approved manifest, provenance, image digests, exact quote and user
approval are stored in `.local/flux-3-max/`. Do not place private account IDs,
credentials or signed URLs in this tracked document. Do not publish Max merely
to create launch media, or send a Max request under the `flux-3` identity.

`frontend/scripts/run-flux-3-max-direct.ts` has separate operations:

- `quote --manifest PATH --output PATH`: offline strict validation, SHA256 checks
  of all input images, exact settings and total provider estimate. The quote
  expires in 24 hours and is bound to a SHA256 fingerprint.
- `prices --credentials-env ABSOLUTE_ENV_FILE --output PATH`: authenticated GET
  of Fal's pricing API plus GET of the three official model pages. Reads only
  the Fal key from the explicitly selected file; it does not load DB/Auth/storage
  credentials. API base billing units and published resolution rates are kept
  distinct; the base unit alone is not a final rendered-video price.
- `submit --quote PATH --id film-NN --state-dir PATH --approve-quote SHA256
  --max-provider-usd 8 --price-evidence PATH --credentials-env ABSOLUTE_ENV_FILE`:
  validates current prices before uploading any references or enqueueing. Any
  price increase, missing evidence, changed reference, expired quote or reused
  scene attempt stops. The journal reserves a scene exclusively before network
  writes, records the exact request before submit and fsyncs the returned
  requestId before any status read. The official Fal SDK's queue retry config
  overrides its global retry option, so an explicit transport fence prohibits
  another queue POST, including after ambiguous HTTP failures.
- `recover --id film-NN --state-dir PATH --credentials-env ABSOLUTE_ENV_FILE`:
  GET status/result for the persisted requestId only. It never submits. A lost
  acknowledgement requires inspection of Fal's actual request history; never
  infer that no request exists and automatically resubmit.
- `collect --id film-NN --state-dir PATH --credentials-env ABSOLUTE_ENV_FILE
  --output PATH.mp4`: recovers the accepted result, downloads the original Fal
  video with a size bound and writes SHA256 plus a provenance sidecar. It creates
  no synthetic application job or receipt. Probe the downloaded bytes and review
  playback separately; provider-reported metadata is not a measurement.

Run at most two accepted generations concurrently. A failed or uncertain attempt
is still an attempt; neither retry nor another creative variant is authorized.
The tool cannot impose a server-side dollar cap on Fal; it enforces the reviewed
rates, one request per scene and the approved packet before each submission.
The USD 7.31 amount remains a provider estimate, not a verified invoice. The
billing API returned 403 and the billing browser session was disconnected; actual
provider billing was not reconciled.

Current official sources (checked 2026-10-20):
[pricing API](https://fal.ai/docs/platform-apis/v1/models/pricing),
[text endpoint](https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video),
[image endpoint](https://fal.ai/models/blackforestlabs/flux-3-max/image-to-video),
[keyframes endpoint](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video).
The pages list USD 0.0425/s at 720p and USD 0.0725/s at 1080p for October15–November7;
normal rates are USD 0.17/s and USD 0.29/s. No timezone is specified, so the runner
stops relying on that promotion before November7 begins anywhere.

The alternative staging investigation is closed. The repository has a genuine
canary mechanism, but it requires a clean committed candidate, host-bound MCP,
account/client allowlists and separately controlled tariff activation. It was
not provisioned or used for these media. No deployment or auth bypass was made.

## Keep accepted media durable and attributable

For each accepted generation, preserve the original job ID, provider request
ID, `engineId: flux-3-max`, exact mode/settings/prompt, source image IDs and
keyframe positions. Record requested and measured duration/resolution
separately. Inspect the final MP4 with ffprobe and a multi-frame review for
opening readability, identity, motion, anatomy/geometry, unwanted text and the
final beat. A successful provider response alone is not editorial acceptance.

The completed MCP library imports persisted the eleven videos and the three
reference images as owned uploads. They reused durable library assets; import
alone did not create a generation or receipt. The subsequent explicit external
Fal adoption owner created eleven completed jobs with `origin: external_fal_import`
and `payment_status: external_not_billed`, retaining the real provider request,
exact submitted prompt/settings and reference provenance. The post-adoption audit
confirmed no wallet, receipt, generation timing or generation event side effects.
No synthetic paid generation or provider timing was recorded.

Requested duration and measured media facts remain separate. The originals are
1280 × 704 at 24 fps, with measured duration equal to the requested duration plus
one frame and an AAC audio stream. Reference PNGs were normalized losslessly by
the existing MCP upload owner; original hashes, stored hashes, dimensions and
exact decoded RGBA equality were verified before adoption. Provider input
provenance retains the original files; public reuse uses the durable copies.

Editorial review retained films 01/02/03/04/05/06/07/09/10 for public display and
kept 08 and 11 private. Film 08 did not achieve the intended mirror mechanism;
film 11 reversed the two dialogue lines. Film 06's ambivalent ending is an
editorial qualification, not a technical failure. Film 07's instrumental/audio
character was not perceptually certified. Frame inspection and local speech
transcription do not certify the whole soundtrack or lip synchronization.

The initial nine retained jobs were made public and indexable; films 08/11 remain
private. On 2026-10-21, the user rejected film 01 for visual inconsistencies. Its
withdrawal is handled separately by the visibility owner; no replacement attempt
is approved. The current editorial selection is eight films (02/03/04/05/06/07/09/10).
The preview hero pin is provisionally film 05, “The Sleeping Guardian”; the Prompt Lab demonstration
is film 09, and the teaching example is film 10. Prompt tabs use the exact English
prompts of films 01/03/09/10 and associate each only with its own eligible gallery
item. The action tab still contains the original film 01 prompt while a replacement
is prepared; it must not be relinked to film 05 or presented as an accepted result.
A missing gallery selection never borrows another film's replay link.

Six source films (01/03/05/07/09/10) have prepared, reviewed and HTTP/Range-verified
immutable desktop/mobile display derivatives. Their complete timelines and audio
packets are preserved; original downloads and generation provenance remain tied
to the originals. See [the rendition review](../qa/flux-3-max-media-renditions-2026-10-20.md).
This preparation does not establish deployment or perceptual audio approval.

The dedicated `flux-3-max` wave is authored in `model-launch-waves.ts`; historical
P0/P1 waves and Standard assets retain their identities. At this checkpoint,
`flux-3-max-video-example-pack.json` remains absent and generated readiness remains
false. Final curation and launch acceptance are stopped after the user rejected
film 01; the previous save attempt was already rolled back: the model collection exists, but the first canonical curation save rolled
back at its deadline. The source manifest will be accepted only after the model,
family and examples-hub curations are saved and read back. A valid preview or
collection ID is not membership evidence.

## Playlists and publication remain separate

Read `GET /api/admin/playlists` before any mutation. Max's model destination is
`examples-flux-3-max`; the family destination remains `family-flux`. Keep
`examples-flux-3` unchanged. Use the existing admin **Create missing model
collections** maintenance action only when the registry is released and the
new collection is actually absent.

The older `POST /api/admin/playlists/{playlistId}/items` accepts
`{ "videoId": "…" }` and triggers IndexNow; it is not a private local manifest
operation. Curated destinations instead require the existing revision-bound
curation preview (`POST …/curation`) followed by its token-bound save
(`PUT …/curation`). Inspect the destination's effective preview and preserve
existing selections; do not seed all collections or adopt an empty Manual
selection. Follow `docs/deployment/video-discovery-release.md`.

Ordinary gallery publication uses the current admin moderation flow after
acceptance. The nine retained jobs have passed that authorized visibility change.
Video SEO/watch-page enrollment remains a separate admin decision; this batch did
not enroll watch pages. Future media remains private and non-indexable until its
own publication approval.

Useful non-spending repository checks after authoring the final manifest:

```sh
pnpm model:registry:check
pnpm model:launch-assets:check
node scripts/public-media-origin-guard.mjs
git diff --check
```

These checks do not prove that provider generation, storage, playback or an
external MCP host has been exercised.

The latest user review keeps final hero choice, marketing curation and launch
readiness pending a viewing selection. Additional prompts and a fresh quote are
separate work; the preview pin is not final editorial approval.
