# Creator, web tools and Milo parity — 12 November 2026

This audit compares source at `17bd771e64c2fa1186acdcb69245bb0c45b82ce3` with the local alignment candidate. Connected-host observations are the dated records in [live-inventory.json](live-inventory.json) and the root audit. No provider render, production gate change, remote migration, Review resource activation or deployment was performed here. Source implementation, runtime gates, host discovery and successful execution are separate evidence.

## Readiness matrix

| Capability | Existing web source | Classic MCP observation | Milo before this candidate | Local candidate / remaining prerequisite |
| --- | --- | --- | --- | --- |
| Subtitles transcription | Scribe v2; owned audio/video; paid canonical transcription quote and durable operation | Discovery/status/document read/edit/SRT/VTT visible; new preparation absent | No typed transcription action | Native creator preparation, exact-price approval card and project-scoped operation recovery. Existing schema, explicit pricing policy, worker/provider/storage readiness and creator gate still required. |
| Subtitle corrections and sidecars | Versioned account documents; optimistic/idempotent text/timing/style updates; SRT/VTT without retranscription | Existing read/edit/text-export tools visible | Existing documents could be attached to timeline; no typed document correction | Native document read/edit; completed exact revision exposes editing, SRT and VTT links. Corrections never purchase a new transcription. |
| Subtitle captioned MP4 | Separate revision-bound preparation; current source includes burn-in in transcription pricing | Preparation/confirmation absent in Classic; present in Review metadata | No native pending operation/card | Native explicit approval also covers returned zero-price preparations. The patch retains existing billing policy; transcription is paid. A changed billing decision must change the canonical owner, not an assistant price guess. |
| Subtitles from saved sequence | Measured owned saved audio mix, revision/hash and source checks; mix preparation currently included | Requires creator execution plus timeline editing; independent of Studio MP4 export | Web sequence entry / existing caption attachment | Native saved-sequence preparation with server-owned project ID. Timeline editing is independently required; no Studio MP4 authority is granted. |
| Lip Sync | Wan photo/video profiles, exact selected voice, 480p default; 720p/1080p selectable; 2–15 s MP3/WAV; audio preserved; review fidelity | Profiles listed with `deploymentGateOpen=false`; preparation/confirmation absent | Generic image/video creation was not the Lip Sync product | Native typed creator request reuses canonical profile, quote, finalization and refund owners. LatentSync remains a separate gate; no new qualification inferred. |
| Product Photo Editor | GPT Image 2.5 Flare or Nano Banana 2, source/style roles, generative appearance preservation | Profiles listed but closed | Generic image editing had different product policy and lifecycle | Native creator operation and quote card. Pixel-lock and mask profiles stay unavailable. |
| Product Video Editor | Wan source edit; explicit continuous whole-second 2–15 s segment and preserve/mute policy | Profile listed but closed | Generic v2v was not the creator product | Native creator operation; canonical source/audio/output checks retained. |
| Motion Transfer | Wan reference guidance; specialized Kling V3 Motion Control separately gated | Both profiles listed but closed | No typed creator operation | Native operation. Wan guidance still does not guarantee exact movement transfer. Kling retains separate activation and orientation limits. |
| Studio timeline | Owned saved sequences, frame-aware revisioned edits and exact refs | Timeline tools absent; source publication default remains closed | Already implemented behind native editing access | Existing direct adapters remain intact. No publication flag or independent export gate changed. |
| Studio MP4 export | Canonical snapshot/quote, explicit confirmation, durable worker and artifact recovery | Export tools absent; Review metadata includes them | Already implemented behind native export access | Existing direct adapters remain intact. Native creator work does not activate export. |
| Angle | Real image workbench and `runAngleTool` | No direct adapter | No typed operation | Read-only web entry discovered. Direct paid adaptation still needs a bound exact quote, owned input normalization, OAuth/project scope and one-attempt recovery; the URL runner has no accepted-quote contract. |
| Storyboard | Real image-board workbench, template/source billing and optional first-frame job; own generator handoff | No direct adapter | No typed board operation | Read-only entry. A generic image prompt is not the board/template/lineage pipeline. Shared server preparation must preserve those owners and the additional first-frame attempt separately. |
| Upscale image/video | Real workbench, quote preview, accepted amount recheck and existing job/provider handling | No direct adapter | No typed operation | Read-only entry. Preserve existing execution/recovery while adding immutable exact source/profile quote and OAuth/project binding before direct assistant execution. |
| Background Removal | Real video-only workbench and accepted amount recheck | No direct adapter | No typed operation | Read-only entry. Same binding prerequisite; never advertise image removal support from this video tool. |
| Restore Video / Denoise / Fix Blur / Smooth Motion | Runtime-released Standard/Pro profiles under explicit owner-approved pilot records; durable request-ID reservation/reconciliation | No direct adapter | No typed operation | Web discovery includes only profiles passing the current release helper and labels pilot evidence. Unknown/unreleased profiles are omitted. Existing durability does not supply missing OAuth/project-bound quote authority. |

Character Builder is deliberately excluded from the generic web-only projection. Its dedicated direct/native authoring work is owned by the Character integration, so a web-only entry must not contradict that implementation.

## Gates and stale discovery

All five public creator identities have `publicReleased=true` in `src/lib/toolbox/creator-availability.ts`. That does not establish authenticated execution. The web gate is `FEATURES.workflows.toolsSection && CREATOR_TOOLS_ENABLED=1`. MCP new operation tools additionally require paid generation, reference uploads and `MCP_CREATOR_TOOLS_ENABLED=1`. LatentSync and Kling specialist gates remain independent.

Classic MCP's five non-spending recovery/document descriptors and closed profile results match the closed effective execution state. They do not prove which individual environment input is closed. The connected plugin's smaller inventory is a separate host-discovery difference; refreshing a catalogue cannot open a server gate. Review advertises the full family but the root live lookup returned `INTERNAL_ERROR`; its resources were intentionally paused and remain untouched.

The source bug was narrower: the synthetic Scribe profile omitted `deploymentGateOpen`, unlike every other profile. The new shared discovery owner reports the same effective boolean for Scribe and preserves every existing profile. It additionally reports web gate facts separately from current assistant-surface execution and returns trusted same-instance `webTools` links with explicit `mcpExecution:false` and `providerReadiness:not-checked`.

`webHandoff` says navigation starts no operation and transfers no media. The existing same-browser library handoff already supports Angle, Upscale, Background Removal, finishing and creator destinations: it is account-bound, single-use, expires after ten minutes and asks for destination confirmation. Storyboard has its own library input and Storyboard→generator handoff; it is not a generic media-token destination. A remote host cannot invent or reuse the browser token.

## Native Milo ownership and continuity

`src/lib/studio/conversation-creator-contract.ts` owns strict model actions, the saved quote, exact confirmation tuple and outgoing operation schema. `src/server/studio/conversation-creator.ts` supplies a Studio-session adapter over existing creator/subtitle services. Caller account/project arguments and URLs are rejected. Sources must be attached or exact ready project outputs, then the canonical owner rechecks account ownership and source bytes before spending.

Preparation callbacks execute in the canonical preparation transaction. The operation and completed Studio action receipt commit together; a rejected receipt rolls both back. A lost acknowledgment before the final draft can replay the saved model response and action receipt without another operation or model call. `creatorQuote` is a separate ready-turn result, like export/analysis, with `quote_id=null`; it is not a generic image draft. The existing confirmation endpoint requires the saved turn, tool/operation IDs and displayed amount/currency. No model-callable confirmation function exists.

The canonical account destination is built as `/account/connections` on the trusted request origin. The source account-host allowlist remains unchanged, and no production host is substituted for another instance. Native product-photo PostgreSQL coverage exercises the actual request-origin path through canonical pricing, preparation, submission and recovery.

`ConversationCreatorOperation.client.tsx` and `useConversationCreatorOperations` own clicked exact-price approval, schema/identity-checked acknowledgments, an account/project/turn/operation-scoped attempted flag and GET-only reload/status recovery. Polling is serialized, follows server cadence and stops on terminal state, `retry:null` or `needsAttention`. Included zero-price rendering still requires a click. Completed documents expose exact-revision editing/SRT/VTT links. Private originals use native/manual playback with `preload="none"`; read-only refresh renews access without another confirmation.

The existing schemas/migrations 69–75, canonical commercial rules, provider credentials, storage and compatible media worker remain prerequisites. Subtitles additionally need the durable launcher/task-definition allowlist, compatible Chromium/FFmpeg worker and its existing Fal/storage permissions. None of these operational inputs was changed or remotely qualified here. There is no request-time schema bootstrap or new creator migration.

## Validation evidence

- `tests/creator-mcp-discovery.test.ts`: real discovery/profile code; effective Scribe gate, independent web gate, same-instance links, active-pilot labeling, closed finishing filtering and preservation of all five creator tools.
- `tests/creator-mcp.test.ts`: strict approval/scope, recovery descriptors after execution closes, independent saved-mix/export gates, lossless compact structured fallback and corrected current included-processing descriptions. The final global instruction maximum is 1,998 bytes across 1,024 combinations; the root MCP check records the final combined flags.
- Creator descriptor source literals measure 552/750/602/448/256/489/484/598/273 UTF-8 bytes respectively for list/prepare/confirm/status/document-read/document-edit/export-prepare/mix-prepare/text-export; all remain below 2,000. Global operating guidance was not expanded; workflow rules stay in their owning descriptors.
- `tests/studio-creator-contract.test.ts`, `studio-creator-operations.test.ts` and `studio-toolbox-discovery.test.ts`: strict no-caller-scope inputs, current-surface discovery, terminal quote card, exact approval, no model confirmation, canonical routing and read-only recovery/document delivery.
- `tests/studio-creator-operations-postgres.test.ts`: real Studio journal and canonical subtitle operations; injected lost ACK after preparation commit, same-operation replay, included render approval, paid transcription approval, rejected amount/operation/account/project, reload and execution-shutdown recovery. Provider/worker boundaries are offline doubles; exactly one wallet charge/dispatch for the paid fixture.
- `tests/studio-creator-photo-postgres.test.ts`: real native product-photo preparation with actual request origin, canonical creator pricing/quote/operation, no supplier call at preparation, one paid submission/charge across confirmation/reload/retry and cross-project rejection. Provider and media inspection are offline doubles.
- Existing creator/subtitle PostgreSQL suites now prove rejected preparation checkpoints roll back. The focused six-file neighboring PostgreSQL run passed 11 tests; the final native photo/subtitle run passed both tests. Existing budget regressions and native contract tests passed 9 tests after removing duplicate permanent instructions without raising a limit.
- Scoped ESLint, full frontend `tsc --noEmit --incremental false`, exposure lint and `git diff --check` passed at the corresponding integration checkpoint. Root owns final aggregate editor/browser/MCP validation and refreshed policy fingerprint after all shared metadata changes.

These checks do not certify a real-host selection rate, deployed worker, provider quality, invoice, production spending journey, plugin refresh or live availability.

## Subtitle pricing follow-up — 12 November 2026

The subtitle-only candidate now uses `creator-subtitles:provider-plus-200:v1`
(200% markup, exact supplier cost × 3 before standard rounding). The four other
creator products retain their 120% policy. This changes new paid standalone and
saved-sequence transcription quotes; corrections/SRT/VTT/mix preparation/MP4
remain included. Accepted historical operations and exact refunds are preserved;
stale unaccepted old-policy quotes must be re-prepared even at equal cents.
Current examples and the financial regression are recorded in the
[creator ownership guide](../../engineering/creator-tools.md#subtitles). No remote
pricing write, migration or execution activation was performed.
