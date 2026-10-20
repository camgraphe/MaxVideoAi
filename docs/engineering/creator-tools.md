# Creator tools

Reviewed 2026-10-19. This guide covers Subtitles, Lip Sync, Product Photo Editor,
Product Video Editor and Motion Transfer. It complements the existing
[Toolbox guide](toolbox-integration.md); it does not change the older tools' runners.

## Ownership

| Concern | Owner |
| --- | --- |
| Product identities and media eligibility | `src/lib/toolbox/catalogue.ts` |
| Public discovery | `src/lib/toolbox/creator-availability.ts` |
| Role-aware image/video requests | `src/lib/toolbox/creator-tools.ts` |
| Operation preparation, measured sources, segments and final outputs | `src/server/tools/creator-*.ts` |
| Transcript, timing, revisions and presentation | `src/lib/subtitles/` |
| Transcription, rendering and durable subtitle jobs | `src/server/subtitles/` |
| Authenticated HTTP adapters | `app/api/tools/creator/`, `app/api/tools/subtitles/` |
| Shared app workbenches | `src/components/tools/creator/` |
| Localized public pages | `src/components/tools/creator-marketing/` |
| MCP descriptors and account adapter | `src/server/mcp/tools/creator-tools.ts`, `src/server/agent-api/creator-tools.ts` |

Paths in this table are relative to `frontend/`. Provider endpoints belong in
server profiles. An operation profile is not a new authored model identity.
Do not add a fake model-registry entry to route a specialized tool.

## Activation and recovery

`CREATOR_TOOLS_ENABLED=1` opens authenticated preparation and confirmation.
`MCP_CREATOR_TOOLS_ENABLED=1` additionally opens the MCP tools, which also require
the independent paid-generation and reference-upload capabilities. Specialized
profiles retain their own gates. Public marketing routes, navigation, sitemap,
Tools cards and library continuation actions use the explicit public release
record. The five canonical tools are released in the candidate authorized on
2026-10-20; this does not enable specialist profiles or remove the runtime gate.
Never turn on public discovery merely to make a test pass.

Execution and recovery are different operations. Account-owned status,
document editing and caption downloads remain readable after execution closes.
The app supports explicit operation/document recovery links. MCP discovery,
status and document access also remain available when purchase gates close.
Creator status renews original source read access and restores the selected
settings/segments without another preparation or supplier request. A stopped provider
or a refund does not authorize a new attempt.

Migrations are explicit deployment ownership, never request-time bootstrap:

- 69: immutable `toolbox-session` generation-quote scope.
- 70: subtitle documents and immutable revisions.
- 71: creator operation snapshots and versioned finalization leases.
- 72: explicit `toolbox-subtitles` transcription pricing policy.
- 73: durable subtitle operations and scoped wallet jobs.
- Specialized tool pricing migrations are applied with their corresponding
  gated profile; they never overwrite a configured commercial override.

Missing explicit pricing policy fails preparation instead of inheriting a generic
database rule. Applying migrations alone does not activate a tool.

## Sources and exact quotes

Inputs contain exact owned asset IDs or exact job/output IDs returned by the media
owner, with explicit roles. A URL, gallery-card index or thumbnail is not identity.
Source selection is account-keyed. Library kind filtering occurs before pagination.
Library handoffs are single-use, account-bound and require destination confirmation.

Preparation resolves ownership, downloads through the existing bounded media
transport, and measures actual duration, dimensions, cadence and audio presence.
An explicit segment creates a distinct owned derivative. Never ceil a source
duration to silently trim, repeat or stretch content. Canonical transport defaults
do not override the provider's measured input pricing.

Canonical image/video generation reuses the existing prepare/confirm services,
wallet reservations and provider jobs. Tool sessions have a separate immutable
quote origin; OAuth client scope and Studio project scope remain separate.
The operation is inserted in the quote transaction. Confirmation locks both
records, rechecks the saved request/profile and original source identity, and
claims one charge and one submission. An ordinary generation quote cannot be
confirmed as a creator operation.

`server/pricing/quote-creator.ts` owns the server-selected commercial product
`creator-tools:provider-plus-120:v1` for these five tools. Canonical image/video
profiles reuse the shared trusted-media pricing normalization and provider facts,
then the canonical calculator applies 120% markup with no model retail margin,
flat fee or reference-image retail floor layered on top. Specialized Scribe,
LatentSync and Kling profiles feed their existing list-reference costs into the
same owner; existing explicit profile configuration and release gates still apply.
Provider input-video seconds, reference-image costs, vendor routing and standard
rounding remain authoritative. No ordinary image/video/MCP quote, model tariff
cell, wallet FX, tax or Stripe settlement rule changes. The immutable creator
snapshot carries the tool policy and exact provider basis; confirmation recomputes
it and rejects stale prepared prices. Accepted history is never repriced.

The browser invalidates unaccepted quotes on source/settings edits. Confirmation
requires the current web pricing-policy header. HTTP authenticates, checks origin,
checks account restrictions and bounds streamed JSON before executing a paid
action. Ownership is rechecked server-side; browser settings are never authority.

## Results and audio

An accepted provider job is not a finished tool result. Status passes through
generation, finalization and measured-output validation. Finalization has a
versioned lease so a stale worker cannot settle another worker's result.
Preserved audio is explicitly composed from the selected source; muted output is
explicit. AAC re-encoding is disclosed. No hidden loop, stretch or `-shortest`
repairs a duration mismatch. Selected source audio is never truncated.

Lip Sync defaults to Wan 3: `lip-photo-wan-v1` uses image/audio references and
`lip-video-wan-v1` uses a selected source video plus audio reference. The default
resolution is 480p, with 720p and 1080p available. Audio is measured MP3/WAV,
2–15 seconds and at most 15 MB. The video passage must cover the same selected
audio duration; explicit cuts can account for at most one video frame of rounding.
The interface shows selected audio, requested whole-second generation and final
duration before quotation. Wan generates `ceil(audioSeconds)`; only the extra
generated video tail may be trimmed before muxing the complete selected audio.
The immutable timing policy is validated against the profile, request and sources
at preparation, confirmation and finalization. Short or unexpected-duration
provider output fails instead of repeating, stretching or cutting the source.
Audio references guide the performance; matching duration alone does not certify
word-level articulation. Human review remains necessary for the public example.
Accepted legacy LTX operations retain their strict historical finalizer; stale
unaccepted LTX preparations cannot start a new attempt. The specialist LatentSync
profile remains separately gated.

Final outputs create distinct owned media assets with source and operation
lineage. Original provider outputs remain identifiable. Permanent finalization
failure settles the tool failure and exact wallet refund transactionally and
idempotently, while preserving the supplier job and cost evidence.

Stored `originalUrl` remains distinct from transient `readUrl` and
`thumbnailReadUrl`. Presentation renews private read access after ownership
resolution. Signing downtime does not turn a completed operation into a new
generation or refund. Private images and signed posters never enter the public
image optimizer.

## Subtitles

A document is normalized text with timed words, editable segments, style,
source fingerprint and a monotonically increasing revision. The source contains
an exact media reference, not a signed URL. A corrected segment loses word-level
alignment; unchanged aligned words may retain active-word presentation.
Text/timing/style edits, SRT and VTT export do not call the transcription provider.
Optimistic revision checks and request receipts make edits conflict-aware and
idempotent.

Scribe v2 uses its documented endpoint with an explicit language when supplied
and optional keyterms. The recorded list reference is USD 0.008/minute with a 30%
keyterms surcharge, checked 2026-10-19; this is not an account invoice claim.
The creator policy feeds the canonical pricing kernel with a 120% markup
(provider cost × 2.20), preserving standard fractional-cent and customer rounding.
MP4 burn-in, including later text/style revisions, and sequence mix preparation
are included in the transcription price. Internal processing costs are absorbed;
a zero additional customer charge does not assert zero infrastructure cost.
The initial transcription quote exposes export as included. A later zero-price
export preparation still pins the exact document revision, validates owned source
identity, and requires confirmation before dispatching its durable worker.
Included exports have platform-funded jobs and create neither wallet receipts nor
purchase-ledger entries. Their failure creates no financial refund. Already accepted
paid exports retain their original charge and refund behavior; stale unaccepted
paid export quotes must be prepared again. General Studio timeline export pricing
is unchanged.

Rendering uses the same subtitle overlay as preview, pins the saved document
revision, verifies the original fingerprint, preserves source timing and audio,
and publishes a distinct video asset. Standalone burn-in requires a video source.
An audio-only transcript can always be exported as SRT/VTT.

Transcription WAVs normalize the container origin while retaining delayed audio
and internal timestamp gaps as silence. Duration facts keep those presentation
offsets. For MOV/MP4, a separate metadata read caps edit-list spans by the media
track lengths, matching modern FFprobe and avoiding inflated durations in 4.0.2;
it does not disable edit lists during audio extraction or change source bytes.

The three presentation presets keep stable stored identities: `active-word`
(Pop), `clean` (Cinema) and `high-contrast` (Contrast). `presets.ts` and
`SubtitleStylePicker.client.tsx` share their localized choices; the actual
`SubtitleOverlay` owns preview and export. New documents default to Pop at 7%;
saved documents retain their recorded style. Edited text still falls back to
full-line captions instead of inventing word alignment.

Media duration uses presented audio/video stream ends when available, with a
container-duration fallback for unknown tracks. The renderer bounds its final
AAC mux to the saved source duration and keeps the strict output check; encoder
padding must not lengthen the result. The 44.1kHz regression and actual demo
cover a source ending between video frames.

The Subtitle marketing demonstration uses three real locally rendered MP4s of
one Wan 3 dialogue scene, with exact hashed assets and provenance under
`public/assets/tools/subtitle-demo`. Its local Whisper transcript is not Scribe
provider qualification. Playback is manual (`preload="none"`), uses the shared
public-video controls, and restores time/play state when changing styles. The
selected exported file is also the download. Final CTA links are shown in the
design view; route admission, navigation, sitemap and JSON-LD still retain their
release ownership. The presentation does not contain a coming-soon CTA.

Photo, Video and Motion presentation examples each show distinct recorded inputs
and provider results under `public/assets/tools/creator-results`, with responsive
image derivatives and manual original-video playback. Lip Sync uses a separate
portrait and an English female recording (10.370612 seconds), followed by the
user-reviewed Wan 3 result. The shared local finalizer trims the generated tail
and preserves the entire selected recording: measured video 10.4 seconds, audio
10.37 seconds. Source voice and result cannot play over one another. A local
signal-envelope check and matching transcripts establish retained dialogue timing;
they are not a general perceptual synchronization score. Exact generation attempts,
rejections, refunded format failure and user review are recorded in
`docs/engineering/evidence/creator-*-2026-10-19.json`. These real examples do not
activate public discovery or replace end-to-end release qualification.

Workers run in the existing media-worker ECS image with the explicit
`SUBTITLE_OPERATION_TARGET_ID` target. Launcher configuration is checked before
reservation. The image must contain this worker release, Chromium and FFmpeg;
shipping only the web deployment is insufficient. The existing Fal cron performs
bounded reconciliation and dispatch; it does not run a long renderer in an HTTP
request. Generic Fal polling, webhook completion and provisional expiry exclude
the specialized subtitle jobs.

The production worker also requires `FAL_KEY` through its existing execution
role's SSM access. Its storage identity writes only export and thumbnail prefixes:
set `VIDEO_RENDER_STORAGE_PREFIX=timeline-exports` in the worker definition to
map subtitle WAV, sequence-mix and MP4 uploads into the existing owned export
namespace. Do not set that override on the web runtime or broaden source-write
permissions. Pin the image by digest, retain its published source SHA, and update
the launcher's exact task-definition ARN allowlist for each new revision.
Health tasks must use an explicit nonexistent target, never claim arbitrary queued
work. Keep a compatible worker for accepted subtitle operations during rollback;
the previous timeline-only worker cannot resume them.

Provider submission is a single transport attempt. An ambiguous acknowledgment
is never resubmitted automatically. Subtitle acceptance left unknown for one hour
is refunded once by reconciliation; the audit is retained. The status exposes
attention-required and stops automatic client polling. Known request IDs are
observed without another purchase. Lease tokens fence worker completion and
refund transactions.

## Studio and saved documents

Final creator files preserve their own immutable asset identity and carry their
generation job as provenance. The existing Media reader therefore classifies
them as saved creations of the measured image/video kind; prepared reference
segments do not acquire that provenance. Do not attach the provider's
`sourceOutputId` to a finalized derivative. Result links open the saved Media
view with the matching `kind`; subtitle MP4 exports open Videos. The complete
app menu uses the same released-tool record as the catalogue and contextual
actions, with EN/FR/ES labels. The five interfaces inherit the shared app theme
and its persisted Menu → Appearance preference.

Creator result actions offer a connected Studio film picker with explicit add
or replace commands. Replacement preserves the selected clip timing, requires
enough source media and uses the existing revision/ownership/locked-track owner.
Clip identity, position, duration, track, transforms, audio mix and transitions
remain unchanged. Source-bound captions detach; historical montage provenance
remains immutable. Replacing back restores media/timing, while restoring detached
captions requires their original document revision explicitly.
It never starts paid generation. Product Video comparison uses manual synchronized
readers, with the selected source offset and refreshed private URLs.

The transcript library is `/app/library/subtitles`, with an account-filtered
cursor list and exact-revision edit/download links. Source removal does not erase
saved text. Studio uses the conversational shelf/timeline and reversible commands;
the retired canvas is not revived.

Clip-attached captions pin a document revision and project through trim, move and
split in source time. Current playback rate is exactly 1; unsupported speeds must
be rejected instead of pretending to have remapped them. Preview and export share
the projection and overlay. The source fingerprint is revalidated at attachment
and export.

Full-sequence transcription has a separate saved-revision mix operation. Its
quote exposes transcription and included mix preparation as separate line items;
only transcription contributes to the total. It does not consume Studio free quota. The mix source records sequence revision and audio-manifest hash.
Changing the underlying audio invalidates that binding. Studio MP4 export
availability remains an independent gate.

## Product presentation and workspace journeys

`CreatorWorkbench.client.tsx` owns the five creator-specific layouts and reuses
`HeaderBar`/`AppSidebar`; older `ToolWorkbench` readers keep their presentation.
DOM and responsive reading order are source, preview, then settings. Three visible
stages describe the current task, without implying that an unpaid step succeeded.
`creator-experience-copy.ts` owns task-specific roles, first-action instructions,
missing-input reasons and artistic inspiration labels in EN/FR/ES.

Creative intent precedes technical controls. Optional reference images and
advanced model/resolution fields use native disclosures. Source changes keep the
existing exact-reference/quote invalidation behavior. Completed operations select
the actual result; inspiration art disappears as soon as owned source media is
available. Source previews never convert private originals into public images.

`CreatorSegmentPreview.client.tsx` keeps the reference playable inside the passage
selector, independently of the main preview. Native video
and audio controls use exact owned read URLs with `preload="none"`. Playhead marks
update the existing segment draft and invalidate its quote; playback alone never
does. Passage playback seeks to the selected start, pauses at the end and stops
when its bounds or source change. Removing or collapsing the selector releases
its player. Numeric fields remain available for precise edits.

Subtitle editing groups transcript, save status, SRT/VTT downloads and the
included MP4 export. Source replacement and revision conflict behavior
remain with their existing controller. Native details, buttons and fields retain
keyboard focus, reduced-motion support and explicit disabled reasons.

Marketing uses a large artwork-led opening, concise input/action/result summary,
editable presentation examples, a Media/Studio continuation section, limitations
and FAQ. `CreatorMarketingLayout` loads the existing local Geist font. The public
release gate still owns availability, service schema and executable CTAs. Art
presence alone never opens a page, publishes a model or qualifies a provider.

## Verification and publication evidence

Behavioral tests exercise real source validation, segmented FFmpeg output,
PostgreSQL reservations/refunds/revisions, worker leases, subtitle rendering,
MCP transport and responsive interfaces. Provider transport doubles demonstrate
our state machine, not supplier quality or live availability.

The public visuals and app inspiration states use authored Image Gen artwork
under `public/assets/tools/creator-art/`, with per-asset provenance and responsive
640/960/1536 WebP variants. `CreatorArtwork` owns their fixed 3:2 geometry. Only
the first visible artwork is eager; later demonstrations are lazy. These images
are labelled presentation art, never before/after provider samples. They are not
selectable owned inputs and never replace an operation output. No paid provider call, invoice reconciliation or host-selection
claim follows from an offline test. Before publication, retain the exact approved
canary quotes, input/output identities, measured duration/audio results and
human fidelity review for each profile. Record actual MCP host/version separately
from descriptor tests.

Run focused `creator-*`, `subtitles-*` and relevant existing Toolbox/Studio tests,
`pnpm mcp:client:check`, frontend lint, exposure lint and `git diff --check`.
The new runtime, migration and pricing owners select all required Quality CI lanes.
Use the normal GitHub delivery and domain-alignment procedure; never deploy the
shared Desktop checkout.
