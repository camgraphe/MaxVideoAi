# Studio architecture

## Source continuity correction — 22 October 2026 candidate

Full-source `assemble` clips may omit or pass null for `startFrame` and
`durationFrames`. The existing revisioned command owner derives consecutive
visual positions and floors the remaining measured source duration to whole
sequence frames; images retain the five-second default and audio layers from
zero. Explicit excerpt frames retain their existing meaning. Qualification,
atomic receipts, ownership, manual revisions and track locks remain authoritative.
For an original plus a separately delivered continuation, assemble both once;
when the original is already on the timeline, append only the continuation.
Generation completion alone does not establish an assembled sequence or MP4.

For continuation-only extension modes, preparation freezes a deterministic
assembly plan before quoting: sequence/revision, original identity, original
URL/type/MIME hash, measured duration and known size facts. Legacy approximate
durations do not masquerade as measured facts; qualification can refine them.
The mode capability
`extensionOutput: continuation` currently certifies Wan 3 only, based on the
reviewed original and separate five-second production continuation. Other modes
retain explicit assembly. A whole original at the correct sequence boundary is
kept once; trimmed, displaced or ambiguous edits decline automatic planning.
The director sets `assembleExtension: false` for an explicit continuation-only
request or a request to leave the timeline alone; that choice persists in the draft.

After an explicitly confirmed generation completes, the conversation hook calls
the same-origin extension POST with only the turn request ID. The server derives
the accepted quote and ready output from the account/project, then applies the
canonical idempotent command. Original validation repeats under source/project
locks after any qualification retry. A changed original or project revision
blocks assembly. A completed job may precede its output projection: only the
explicit retryable not-ready state retries, with five bounded delays totaling
56 seconds. Other failures expose a manual retry or ask for a fresh source/edit
review. Reopening the conversation resumes a pending plan; GET remains read-only.
No extra assistant call, generation or charge is made, and MP4 export stays gated.

Studio pricing accepts the same exact ready project-output references as video
preparation. Read-only pricing aliases resolve through current project and media
ownership checks without promoting outputs or writing library copies. Attached
library assets still require attachment. The aliases are pricing-local and never
become saved generation references. Confirmation continues through the canonical
owned-asset generation boundary. Quote cards distinguish new text generation,
source-guided regeneration and extension; director guidance must not substitute
text-only creation for a failed source edit without agreement.

Local qualification covers the one-request quote/confirmation/completion flow,
five-second original/continuation assembly, fractional source boundaries,
source replacement during qualification, manual revision conflicts, receipt
replay, delayed output readiness, account isolation and project-output pricing
without library writes. Production deployment and live assistant qualification
are separate from these deterministic checks.

The isolated 2026-10-06 task-budget candidate is documented in [Studio task budgets](studio-task-budgets.md); this link does not establish production activation.

Reviewed 2026-10-05. Studio has one public conversational interface. The private React Flow Canvas, its templates and local-only project management were retired at the owner's request. Its personal saved projects are deleted without migration; current chats and MCP montages remain supported.

## Public presentation and current availability

Studio presents its assistant as **Milo**. The composer’s Standard / Max controls
open the existing assistance review dialog: Standard maps to `gpt-6-luna` and Max
to `gpt-6.1-sol`. The information button opens settings and credits; technical
model names remain available in pricing details. These are presentation names,
not new model identities, task profiles, defaults or financial policy versions.
Opening a mode does not select it, enable purchased usage or buy credits. Those
actions retain their explicit confirmations and revision checks. Welcome starters
only fill an editable draft; reference selection and media-side tools keep their
existing behavior.

The owner approved removing Studio's beta presentation on 2026-10-05. Marketing and navigation present Studio's creative conversation, image/video/audio creation, references, timeline editing and individual original-media access. Keep Sol/Luna assistance and media-generation quotes distinct, with their existing explicit spending confirmations. The production check at 2026-10-05T13:18:40Z confirmed assistance enabled under `studio-credits-2026-10-05-v2`: included monthly Sol credits precede purchased cumulative packs from the wallet; Luna has no monthly quota and retains request limits and sponsored availability. Marketing uses these current terms without hardcoded tariffs. The legacy one-time allowance uses introductory wording only when historical policy renders that interface; its frozen contracts remain unchanged. See [Studio assistance economics](studio-assistance-economics.md).

A coordinated read-only production check at 2026-10-05T13:08:15Z confirmed conversation, actions, media and editing enabled, and `STUDIO_CONVERSATION_EXPORTS_ENABLED=false`. The public page does not promise an assembled sequence MP4. Unavailable-feature guidance belongs to the context where the user requests that feature. Individual results expose their owned original through `ConversationMedia.client.tsx` and remain in the media library.

Removing a presentation label does not change feature flags, access gates, grant types or immutable assistance-policy versions containing `beta` or `preview`. Historical dated guides and captures retain the status they actually recorded. A hidden export flag is not evidence about whether renderer secrets are configured; masked environment reads cannot establish that fact.

## Public example entry — 2026-10-16

`/app/studio?example=<public-example-id>` starts an editable example brief.
`frontend/server/studio-example-entry.ts` validates the bounded identifier and
reuses the public watch eligibility and sanitized detail projection, including
legacy public rows with `indexable=NULL`; catalog curation still requires explicit
`indexable=true`. The
root entry skips the recent-project redirect, `StudioStart` carries the identifier
to the new owned conversation, and that route revalidates the public example.
Only the public request facts cross into the client; raw job snapshots, owners,
historical charges and comparison prices do not. The conversation consumes the
query after draft initialization so refreshing a sent conversation does not
reinsert the example request.

Guests see the selected example and its editable brief rather than unrelated
demonstration media. Login destinations retain the example identifier; existing
one-use draft continuation preserves edits within its shared 100,000-character serialized
payload bound, independently of the send limit. Requests above the existing
4,000-character Studio limit remain visible in full, with submission disabled and
an instruction to shorten them. Oversized guest drafts are never silently sliced
into the continuation store. Entry does not send a message, import private media,
generate, export or approve spending. `tests/studio-example-entry.test.ts`, guest
DOM tests and composer tests cover these boundaries.

## Ownership map

| Owner | Responsibility |
| --- | --- |
| Studio `page.tsx`, `_components`, `_hooks`, `_lib` | Direct chat entry, owned summary picker, stable creation identity, editable marketing briefs and access UI |
| `conversation/[projectId]` | Chat journal, media shelf/library, assistance credits, quote review/confirmation, connected timeline and export UI |
| Studio `_shared/_lib/timeline` | Frame math, timing, trim/move/insert, audio layering/linking, source metadata, track constraints and normalization |
| Studio `_shared/_lib/workspace-timeline-*` | Manifest/export request/session contracts and track/selection rules |
| Studio `_shared/_components/viewer` and `_hooks/useWorkspaceTimelinePlayback` | Shared media playback, decoder failure handling and timeline playback state |
| Studio `_shared/_controllers/useExportController` | Browser export estimate/confirmation/poll/recovery |
| Studio `_shared/_lib/models/workspace-model-certification` | Explicit supported conversation generation modes; model publication alone does not certify a mode |
| Studio `_shared/_state` and `_lib/workspace-types` | Persisted project/sequence/media facts consumed by canonical commands, montage and export |
| `frontend/src/server/studio` | Account ownership, journal, generation/assistance orchestration, revisioned timeline commands and stored preview grants |
| `frontend/src/server/agent-api/studio-timeline` | OAuth MCP adapter over the same owned revisioned timeline commands |
| `frontend/src/server/timeline-exports` and `frontend/src/remotion/timeline-export` | Quote, request, billing/idempotency, private-media grants, renderer/worker and completed artifact delivery |

Stored graph/media fact types remain part of canonical montage/export data contracts; they have no React Flow dependency or Canvas rendering surface. Preserve their semantics rather than renaming a wire format for aesthetics. The export wire source `maxvideoai-editor` is a format identity, not a second UI.

## Product and data flow

A Project belongs to one account and contains one or more Sequences plus reference/media facts. A Sequence owns its fps, aspect ratio, resolution, tracks, clips and export settings. Account library media and job outputs retain their own ownership/original/preview contracts; a project stores references rather than acquiring ownership of those originals.

Studio entry opens the recent supported project or idempotently creates a fresh connected project. The project popup requests bounded name/date summaries only. A marketing starter produces an editable brief; the user chooses when to send it. No brief, navigation or media selection invokes a paid generation.

The chat builds intent through the common agent/generation services. Owned media and measured reference facts are resolved before pricing or submission. Every generation requires a current exact quote and explicit confirmation. Request/response journal and assistance usage recovery are durable so lost replies can resume without repeating paid dispatch.

For an open simple image/video model choice, `pricing_compare` reads compatible
current prices in one action before selection. It shares the MCP comparison
owner and preserves certification, attached owned references and explicit
settings; normally three different price options, fewer when fewer qualify.
This read creates no quote and does not increase the Response allowance. A
selected/named model follows exact details and preparation. Alternative requests
may reprice original `baselineSettings` for verified savings; the quote card
invites model, resolution, duration and budget comparisons. Historical options
remain bounded receipt facts, never current prices or purchase authorization.

Media selection continuity (reviewed 2026-10-16) belongs to
`useConversationMediaShelf`. Sending a message keeps its visible selection.
Session storage is scoped to account and project and stores only asset identities,
kinds and labels. Restore once after owned history loads, falling back to the
latest turn only when no local selection exists. An explicit empty selection stays
empty; polling must not reattach removed media. Server ownership and measured-source
validation still run on every request. The connected browser tests cover sending,
reloading, following up and explicitly removing a reference.

Film estimates support t2v, i2v and ref2v, including several images when the live
mode supports their roles. A failed film comparison permits at most one changed
comparison within the original response allowance. Freeze the approved film total
before checkpointing. The full action fingerprint includes the prompt; a shortened
prompt is a real correction. An identical failed action is skipped in fresh and
replayed responses. Recover only recorded responses after a historical failure;
never buy a new response just to reconstruct its missing terminal reply.

`tasks/previous-work.ts` projects up to 12 receipts within 12,000 characters.
Current-task receipts take priority; other messages contribute only failed reads
from the same owned project within seven days. Prompts and media URLs are excluded.
The immutable action hash supplies exact attempt identity without copying a prompt.
Only a proven single-clip capability rejection can suppress a repeated read, with
unchanged action, reviewed source fingerprint and complete catalog capability
fingerprint (including input limits). Tariff outages and legacy incomplete evidence
are revalidated. The separate duration cache never applies to film plans: failure
of one film component is not proof that every cut is impossible. Paid follow-up
responses remain recoverable in replay-only mode even after a comparison receipt.

Server-authored comparison/preparation replies follow the client's conversation
language, including short confirmations using recent authored history. Requested
voice-over/dialogue language does not change Studio's reply language. Failure
copy distinguishes a proven incompatibility from an unverified price and never
asks a client to interpret raw comparison tool errors. Preparation validation
receipts carry canonical mode capabilities to support their single correction.
Instructions cannot promise pixel-identical subject preservation or deterministic
interpolation from a generative model; source-derived timing and requested integer
output timing remain separate mode contracts.

Preparation recovery is bounded inside the existing four Responses and assistance-call allowance (reviewed 2026-10-05). Discovery publishes canonical base setting names, including `durationSec`, `resolution`, `aspectRatio`, `fps` and an `audio` boolean only when that mode has a toggle. Always-generated or unavailable sound does not grant an audio toggle. Null discovery defaults preserve the generation adapters' existing default ownership.

When required model/source facts are known, prepare by Response 3; optional `project_remember` writes are no longer offered from that response. A required third discovery read remains available, so a workflow can still use three reads and prepare on Response 4. An explicit `studio_preparation_input` rejection before draft/quote creation can use one remaining Response to correct only the same preparation tool. A second rejection stops with the saved error and a follow-up continuation. Wallet, lease, ownership, catalog, provider and post-mutation errors do not acquire this correction marker. Older recorded correction paths may include additional reads or saved mutations: recover their immutable responses and receipts. Once the new correction allowance is exhausted, subsequent checkpoints are replay-only and run before token counting or financial reservation; unresolved supplier usage remains terminal. Recovery never purchases a fifth response, repeats completed mutations or confirms a generation. A rejection on Response 4 still requires a user follow-up, including historical requests that already exhausted all four checkpoints.

The visible timeline edits canonical sequence state with revision and ownership checks. It reuses pure frame-aware operations for clipping, source bounds and linked audio. Library selection does not automatically insert every new generation into the timeline. Preview media uses transient stored grants; signed URLs and private originals must not leak into journal/tool projections or saved command payloads.

`useConversationTimeline` owns periodic preview refresh. Its polling waits for all current-project reads to settle, including a forced replacement for a refused grant that still appears valid to the browser clock. Explicit refreshes, revisioned edits and lifecycle invalidations retain their epoch ordering. Pending grant replacements belong to the project path and survive superseded or failed reads until the winning successful canonical response replaces those grants. A late journal response must not lose that renewal intent; the obsolete response still cannot reset canonical revisions. Replacement sources and decoder retry keys commit atomically in the hook; completing an obsolete or failed request never retries the refused source. Grant retention and retry keys never cross project boundaries. Read counts belong to each project path and are released in `finally`, so failed or obsolete reads cannot release another project's polling gate. `tests/studio-conversation-timeline-refresh-dom.test.ts` exercises the real hook with deferred responses; the connected montage browser test deliberately delivers the initial journal while renewal is pending, tests both response orders with the old URL persistently refused, and retains separate preview/new-grant diagnostic flags without exposing signed URLs.

The 2026-10-06 branch candidate adds bounded atomic assembly (up to 12 insertions)
and source-in frames to the same edit owner. Explicit Sol media analysis is a
separate quoted, confirmed and worker-owned credit consumer. It never runs from
generation completion or polling. See [Studio media analysis](studio-media-analysis.md)
for qualified profiles, shared-credit recovery and activation prerequisites.

Exports use the canonical worker contract and backend pricing/idempotency. The browser estimates, confirms, polls and recovers; it does not manufacture completed MP4s. Completed exports and reusable library media remain account artifacts even if a project is later deleted.

MP4 activation and worker provenance are documented in
[Studio MP4 exports](../deployment/studio-timeline-exports.md). Completed chat
cards offer an explicit download through the same owned stable media route as
playback. `download=1` requests an attachment named by the saved export; the
storage signer sanitizes that filename. Ordinary GET/HEAD preview grants and
Range delivery retain their existing behavior. Polling, quota and idempotency
reads use migrated tables without schema bootstrap; reservation and worker
initialization retain their existing ownership. The dated availability checks
above remain historical evidence, not an assertion about a later activation.

## Retired entry points

Old `/app/studio/projects` URLs redirect to Studio; an allowlisted marketing starter remains a draft brief. Old `/app/studio/workspace` redirects to Studio. An old workspace URL for a supported connected project redirects to that project's conversation; a retired/missing private project returns to Studio.

Private-editor project/sequence POST, PUT and PATCH handlers are authenticated 410 responses with `STUDIO_CANVAS_RETIRED` and the Studio entry URL. There is no old server upsert path to reset `deleted_at` or reinsert a retired ID. Existing read/delete and canonical revisioned workspace command infrastructure remain where current export/MCP consumers need them. New project creation uses `/api/studio/conversation-projects`.

The old browser-storage media handoff helper and consumer had no live production producer and were removed together. Current reference/media selection is the conversational library/shelf flow. Do not recreate a dormant storage protocol in place of that owned flow.

## Private project cleanup

`frontend/scripts/retire-private-studio-canvas.ts` is an explicit operational command. Preview runs inside a read-only transaction and writes a bounded manifest of exact account/IDs and stored-row fingerprints. Apply runs on one dedicated client in a READ COMMITTED transaction with explicit table locks and fresh post-lock snapshots with short timeouts and requires explicit `--apply`.

Only exact inventoried `legacy` projects and their owned private sequences may be deleted. Sequence fingerprints are included in the manifest; all other project/sequence references and timeline export JSON associations block deletion. A connected, foreign, missing/partly missing, changed or referenced candidate aborts the entire operation. Parent/reference table locks fence stale writes during the short transaction. All-already-deleted targets are a bounded no-op. The helper does not bootstrap schema, drop tables, delete shared assets, modify financial evidence or touch storage. Disable old mutation routes before applying the live cleanup.

Do not infer permission from missing chat turns alone: current empty chats and MCP montages are valid connected projects. A legacy project can also have conversation state in older deployments; any such reference blocks physical deletion.

## Changes and validation

Extend pure facts/contracts before adding controls. Keep Next.js pages as access/data/redirect orchestrators and keep server-only data/keys out of client modules. Use shared app appearance and navigation conventions. Avoid broad persistence or billing rewrites in a UI cleanup.

Meaningful shared editing/render/export/media tests remain under `tests/maxvideoai-editor-*` for continuity, with explicit test fixtures rather than retired production templates. `tests/studio-canvas-retirement.test.ts` guards the single interface, old redirects, disabled stale writes and absence of React Flow. Canonical conversation/MCP and export integration/browser suites verify supported behavior; removed Canvas-only specs are not valid public release gates.

Run `npm run test:editor`, `npm run qa:editor`, exposure/diff checks and a full route build. For interaction changes run `npm run test:editor:e2e`. Use the normal clean branch → GitHub PR → current-main Quality CI → Git-backed Vercel release path and verify both live domains against the merged SHA. Report source/bundle measurements separately from actual browser/Core Web Vitals measurements.


## Guest demonstration

File drops are prevented and use the same contextual import sign-in gate as the composer. The authenticated entry validates the staged same-tab draft before creating its owned conversation. Missing, expired or consumed tokens return to the usual recent conversation (or normal starter/first-project entry); they never force a new project for an existing account.

Exact reference-image prompts and selected asset paths are recorded in [Studio guest media provenance](studio-guest-media-prompts.md).

The exact `/app/studio` entry admits visitors when workspace visitor access is
enabled. Private conversation/workspace URLs and every Studio data or mutation API
retain the central authentication and ownership policy. Marketing entry sends
visitors to the demonstration, preserving allowlisted starters and languages; when
visitor access is disabled it retains account entry.

`StudioGuestDemo.client.tsx` composes the existing conversational styles and message
composer with a public, authored example. Its product/character images and the
existing instrumental are references, not account-owned assets or claimed app-model
outputs. Visitors may enlarge images, listen manually and browse the example.
Sending a message, importing personal media or editing the proposed montage opens
contextual account entry. Availability follows the real conversation flags. The two
seven-second slots describe a proposed 14-second edit, not generated source durations
or completed video. The demonstration includes no numeric quote or export promise.

The route-local `studio-guest-demo.ts` owns EN/FR/ES copy and public media selection.
The two reference images were created with built-in ImageGen on 2026-10-05: a generic
opaque matte sage-green insulated bottle on a neutral catalog background, and a
fictional adult woman in a white shirt/beige overshirt in a park. Their versioned
900px WebP copies total 68,944 bytes before responsive Next Image delivery. Original
PNGs remain in the generation archive. Music reuses the 24-second Electro-funk
excerpt described in `app-starter-media.md`. Audio uses `preload="none"`, manual
controls and hidden-tab pause; media presentation never requests a private preview.

Explicit same-tab account entry stages only the editable message, using the shared
guest continuation's one-use token and 30-minute lifetime. URLs contain a token,
not the brief or reference URLs. A valid continuation skips the recent-project
redirect and opens a new owned conversation. The conversation consumes the text
once and leaves sending/generation manual. Demo media never enter the account
library, saved conversation or paid generation inputs. Invalid/expired/missing
continuations keep the normal editable starter behavior.

`studio-guest-demo` tests cover the public-route boundary, text-only continuation,
reference inspection and contextual account gates without account API requests.
Browser smoke covers manual audio first-play, mobile overflow and account-entry
URL preservation; this is functional evidence, not a Core Web Vitals improvement.

## Conversation project names

`conversation-project-title.ts` supplies a bounded local title from the first
meaningful user brief, in its original language. Greetings and generic follow-ups
do not consume the naming opportunity. `claimImageTurn` saves that fallback in the
same transaction as a new turn. The existing `project_remember` action optionally
supplies `projectTitle` alongside useful brief/decisions; naming must not add a model
call or a memory-only action. The server may refine the automatic fallback once.

`conversation-project-naming.ts` owns metadata writes under the owned connected
project lock. Command receipts mark automatic naming phases and manual overrides.
A manual name always wins, including an explicitly chosen **Untitled project**.
Names never increment project/sequence revisions or change generation quotes,
media, assistance, or timeline state. `PATCH /api/studio/conversation-projects`
requires authenticated same-origin access, bounded input and an idempotency key.
The project picker exposes an inline pencil, save/cancel and keyboard focus; lost
acknowledgements retry one identity and closed views ignore late responses.

Older untitled conversations use a read-only projection of the first ten retained
messages (240 characters each), for at most 100 owned projects. Reads never backfill
storage, fetch workspace JSON or expose those source messages to the browser. The
next substantive turn can persist a title; manually named projects are excluded.

## Revisioned subtitles (2026-10-19)

`src/lib/subtitles` owns strict timed documents, plain-text serialization, speed-one
trim projection and the shared browser/Remotion overlay. Documents and revisions
belong to the account in migration70; a timeline item persists only
`subtitle: {documentId, revision}`. The reversible `subtitles` timeline command
checks account ownership and exact source reference inside the existing revisioned
command transaction. Editing a document does not silently update a pinned clip.
Moves, trims and splits retain its reference and derive captions from the current
source interval. Preview/export read the pinned owned revision, and export intent
includes its exact contents. `subtitleDocument` is a transient read/render projection
and is stripped from saved workspace JSON.

The inspector lists source-matching documents on explicit interaction. Existing
source captions are independent of the final audio mix: replacing speech with an
audio track does not make an earlier transcript describe that new sound. Standalone
transcription and MP4 burn run through `src/server/subtitles` durable operations,
not the Studio export flag or free allowance. The same wallet ledger is used;
source bytes are remeasured before confirmation and canonical identity is locked
before reservation. Unknown provider acceptance is never submitted again: the
operation exposes attention state, then the reconciler refunds it exactly once
after one hour while preserving the audit record. Polling a known request never
purchases another transcription. Migrations70/73, renderer runtime and explicit
commercial policy must be available before enabling execution.


Saved sequence transcription uses `prepareStudioSubtitles` and a durable
`mix-transcribe` operation. It snapshots the exact project revision, owned source
identities and audio manifest hash before quoting. Confirmation locks and verifies
the current project/media and pricing policy, checks account restrictions and
shared MCP spending limits, then reserves one wallet charge for the displayed
mix preparation and transcription line items. Mix preparation deliberately uses
`timeline-export-paid-policy` with zero free exports; it is not supplier audio cost.

The worker renders a WAV through the existing timeline composition's audio-only
branch, preserving trims, timeline positions, gains, mutes and linked-audio rules.
It never fetches still images or publishes an intermediate MP4. A private owned
audio asset records `{sequenceId, revision, audioManifestHash}` and remains the
subtitle document's real source. Unsupported transitions fail before quoting;
speed remains one. The standalone mix path does not enable the Studio MP4 gate.

`sequence-subtitles` attaches a pinned document at sequence level. Preview and
canonical export use its global clock; source clip captions remain a separate
attachment. Audio edit changes invalidate the mix document and block export until
it is removed or regenerated. Names, captions and visual transforms do not affect
the audio hash. The Studio picker opens the tool with exact saved revision and
requires an explicit quote confirmation.

Subtitle operations share the canonical quote ledger for accepted spending and
refunds. Their public quotes expire after five minutes and every commercial
snapshot is revalidated under policy locks before charging. A provider POST with
unknown acceptance is never retried: status reports `needsAttention`, and durable
reconciliation refunds once after one hour while retaining its audit. Temporary
provider audio is cleaned after terminal state; owned sequence source audio remains
available with the document. Apply migrations 70/72/73 explicitly before release.


### Modify and Extend capability parity (23 October 2026 candidate)

Studio's visual capability details project canonical per-mode settings, duration
policy, reference capacities and extension output semantics. The shared attachment
transport ceiling is 66; it does not replace individual model/role or combined
reference limits. Image-generation selection retains its existing limit. Do not
reintroduce a blanket eight-reference clamp for Modify/Extend. Their request paths
retain owned attachment identity and canonical validation/quote approval.

Recognizable-person notes for Seedance come from `video-workflow-capabilities.ts`
and render on the quote card in its locale. They remain informational, including
on Extend, and must not disable the paid confirmation control. Model-discovery
notes let Studio mention the restriction before preparing a quote. Modify owner
preferences carry their single-trial scope in mode details; Extend has no inherited
quality ranking.

## Mobile conversation space — 2026-10-25

Authenticated conversation routes use the route-local `studio-mobile.module.css`
shell below 768px. The existing app-menu trigger shares the Studio heading;
its full menu retains navigation, connections, preferences and wallet access.
The surrounding header actions and bottom navigation are hidden only within
that shell. Desktop and guest entry retain their existing layouts.

`useStudioMobileLayout` owns the mobile breakpoint subscription and visual viewport
height/offset for the iPhone keyboard, with listener/style cleanup on exit. It
does not reflow the shell during pinch zoom. The composer remains 16px on mobile
and bounds its height against the visible viewport.

`ConversationMobilePanel` presents the existing reference shelf and film timeline
in native modal sheets on mobile, with Escape and trigger-focus restoration.
The same dialog becomes a nonmodal presentation wrapper with `display: contents`
on desktop. Its subtree remains mounted across breakpoints so a retained insertion
cannot replay after rotation or resizing. The film stays mounted
while its sheet is closed, but `ConversationTimeline.visible` stops playback and
closes the monitor. Reference IDs, attachment session storage, preview grants,
timeline persistence, generation confirmation and assistance policy stay with
their existing owners. The references trigger counts attachments to the next
message, not all historic shelf media.

Mobile completed task receipts can expand from their summary; consumed credits
remain in that summary. Tasks with errors, reserved credits or recovery actions
retain the full presentation. Milo's compact mode trigger opens the existing
settings/credits dialog without changing the selected model.
