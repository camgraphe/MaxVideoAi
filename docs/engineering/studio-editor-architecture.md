# Studio architecture

The isolated 2026-10-06 task-budget candidate is documented in [Studio task budgets](studio-task-budgets.md); this link does not establish production activation.

Reviewed 2026-10-05. Studio has one public conversational interface. The private React Flow Canvas, its templates and local-only project management were retired at the owner's request. Its personal saved projects are deleted without migration; current chats and MCP montages remain supported.

## Public presentation and current availability

The owner approved removing Studio's beta presentation on 2026-10-05. Marketing and navigation present Studio's creative conversation, image/video/audio creation, references, timeline editing and individual original-media access. Keep Sol/Luna assistance and media-generation quotes distinct, with their existing explicit spending confirmations. The production check at 2026-10-05T13:18:40Z confirmed assistance enabled under `studio-credits-2026-10-05-v2`: included monthly Sol credits precede purchased cumulative packs from the wallet; Luna has no monthly quota and retains request limits and sponsored availability. Marketing uses these current terms without hardcoded tariffs. The legacy one-time allowance uses introductory wording only when historical policy renders that interface; its frozen contracts remain unchanged. See [Studio assistance economics](studio-assistance-economics.md).

A coordinated read-only production check at 2026-10-05T13:08:15Z confirmed conversation, actions, media and editing enabled, and `STUDIO_CONVERSATION_EXPORTS_ENABLED=false`. The public page does not promise an assembled sequence MP4. Unavailable-feature guidance belongs to the context where the user requests that feature. Individual results expose their owned original through `ConversationMedia.client.tsx` and remain in the media library.

Removing a presentation label does not change feature flags, access gates, grant types or immutable assistance-policy versions containing `beta` or `preview`. Historical dated guides and captures retain the status they actually recorded. A hidden export flag is not evidence about whether renderer secrets are configured; masked environment reads cannot establish that fact.

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

Preparation recovery is bounded inside the existing four Responses and assistance-call allowance (reviewed 2026-10-05). Discovery publishes canonical base setting names, including `durationSec`, `resolution`, `aspectRatio`, `fps` and an `audio` boolean only when that mode has a toggle. Always-generated or unavailable sound does not grant an audio toggle. Null discovery defaults preserve the generation adapters' existing default ownership.

When required model/source facts are known, prepare by Response 3; optional `project_remember` writes are no longer offered from that response. A required third discovery read remains available, so a workflow can still use three reads and prepare on Response 4. An explicit `studio_preparation_input` rejection before draft/quote creation can use one remaining Response to correct only the same preparation tool. A second rejection stops with the saved error and a follow-up continuation. Wallet, lease, ownership, catalog, provider and post-mutation errors do not acquire this correction marker. Older recorded correction paths may include additional reads or saved mutations: recover their immutable responses and receipts. Once the new correction allowance is exhausted, subsequent checkpoints are replay-only and run before token counting or financial reservation; unresolved supplier usage remains terminal. Recovery never purchases a fifth response, repeats completed mutations or confirms a generation. A rejection on Response 4 still requires a user follow-up, including historical requests that already exhausted all four checkpoints.

The visible timeline edits canonical sequence state with revision and ownership checks. It reuses pure frame-aware operations for clipping, source bounds and linked audio. Library selection does not automatically insert every new generation into the timeline. Preview media uses transient stored grants; signed URLs and private originals must not leak into journal/tool projections or saved command payloads.

The 2026-10-06 branch candidate adds bounded atomic assembly (up to 12 insertions)
and source-in frames to the same edit owner. Explicit Sol media analysis is a
separate quoted, confirmed and worker-owned credit consumer. It never runs from
generation completion or polling. See [Studio media analysis](studio-media-analysis.md)
for qualified profiles, shared-credit recovery and activation prerequisites.

Exports use the canonical worker contract and backend pricing/idempotency. The browser estimates, confirms, polls and recovers; it does not manufacture completed MP4s. Completed exports and reusable library media remain account artifacts even if a project is later deleted.

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
