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
record; they are closed by default. Never turn on public discovery to make a
test pass.

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

The browser invalidates unaccepted quotes on source/settings edits. Confirmation
requires the current web pricing-policy header. HTTP authenticates, checks origin,
checks account restrictions and bounds streamed JSON before executing a paid
action. Ownership is rechecked server-side; browser settings are never authority.

## Results and audio

An accepted provider job is not a finished tool result. Status passes through
generation, finalization and measured-output validation. Finalization has a
versioned lease so a stale worker cannot settle another worker's result.
Preserved audio is explicitly composed from the selected source; muted output is
explicit. AAC re-encoding is disclosed. No hidden loop, stretch, truncation or
`-shortest` repairs a duration mismatch.

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
The explicit policy feeds the canonical pricing kernel, including its existing
margin and customer rounding. Burn-in is quoted separately using the existing
paid timeline-render policy with zero free exports. The initial transcription
quote shows an export estimate; only a later exact export quote can authorize
that render.

Rendering uses the same subtitle overlay as preview, pins the saved document
revision, verifies the original fingerprint, preserves source timing and audio,
and publishes a distinct video asset. Standalone burn-in requires a video source.
An audio-only transcript can always be exported as SRT/VTT.

Workers run in the existing media-worker ECS image with the explicit
`SUBTITLE_OPERATION_TARGET_ID` target. Launcher configuration is checked before
reservation. The image must contain this worker release, Chromium and FFmpeg;
shipping only the web deployment is insufficient. The existing Fal cron performs
bounded reconciliation and dispatch; it does not run a long renderer in an HTTP
request. Generic Fal polling, webhook completion and provisional expiry exclude
the specialized subtitle jobs.

Provider submission is a single transport attempt. An ambiguous acknowledgment
is never resubmitted automatically. Subtitle acceptance left unknown for one hour
is refunded once by reconciliation; the audit is retained. The status exposes
attention-required and stops automatic client polling. Known request IDs are
observed without another purchase. Lease tokens fence worker completion and
refund transactions.

## Studio and saved documents

Creator result actions offer a connected Studio film picker with explicit add
or replace commands. Replacement preserves the selected clip timing, requires
enough source media and uses the existing revision/ownership/locked-track owner.
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
quote exposes mix preparation and transcription as separate line items in one
total; preparation uses the existing standard paid-render policy, with no Studio
free quota. The mix source records sequence revision and audio-manifest hash.
Changing the underlying audio invalidates that binding. Studio MP4 export
availability remains an independent gate.

## Verification and publication evidence

Behavioral tests exercise real source validation, segmented FFmpeg output,
PostgreSQL reservations/refunds/revisions, worker leases, subtitle rendering,
MCP transport and responsive interfaces. Provider transport doubles demonstrate
our state machine, not supplier quality or live availability.

The public illustrations are explicitly schematic. They are not before/after
provider samples. No paid provider call, invoice reconciliation or host-selection
claim follows from an offline test. Before publication, retain the exact approved
canary quotes, input/output identities, measured duration/audio results and
human fidelity review for each profile. Record actual MCP host/version separately
from descriptor tests.

Run focused `creator-*`, `subtitles-*` and relevant existing Toolbox/Studio tests,
`pnpm mcp:client:check`, frontend lint, exposure lint and `git diff --check`.
The new runtime, migration and pricing owners select all required Quality CI lanes.
Use the normal GitHub delivery and domain-alignment procedure; never deploy the
shared Desktop checkout.
