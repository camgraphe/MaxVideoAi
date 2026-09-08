# Complete Audio access through MCP

Resume the archived Audio assignment in the principal task. Source handoff is preserved at `e274b0871:docs/engineering/audio-handoff-2026-09-08.md`; its code is unfinished scaffolding, not a qualified feature. Audio UI, canonical ×3 pricing and current five creative intents are already integrated. Studio owns timeline/canvas placement and its own montage tools; coordinate shared MCP registration and media contracts with that branch.

## Product requirement and constraints

- Assistants can discover supported Audio uses, prepare an exact quote, confirm one explicitly approved attempt, follow the job and present/listen/download its actual result. Support voice over, instrumental music, song, SFX and ambience through the current qualified Standard routes; keep useful existing video-soundtrack packs compatible.
- Use the existing Audio validation, provider execution, media handling, canonical billing and receipts. No duplicate audio provider pipeline, quote formula, wallet ledger or global state library. No unqualified High quality/provider activation.
- Discovery and preparation do not charge or invoke a generation provider. Confirmation consumes an exact owned quote once. OAuth account/client/scopes, restrictions, spending limits, catalog/policy changes and media ownership are revalidated. A failed/refunded attempt does not authorize another attempt.
- Share `mcp_generation_quotes` so accepted/claimed Audio spending is included with video/image. Keep current video/image/trial exports and interpretation compatible; an Audio row cannot break their readers or be confirmed by the wrong surface. Do not weaken trial funding validation.
- Use canonical owned references (`ToolAssetRef`/existing reference resolution), exact original URLs and measured facts. Never accept arbitrary client media URLs or fabricate an OAuth principal for a UI request. Keep reference resolution read-only.
- Reserve wallet debit, initial Audio job and quote claim in one transaction. Serialize confirmation, retain the durable job identity and never resubmit on replay/client disconnect. The shared Audio executor runs at most once for that reservation. Keep failures/refunds idempotent and based on the stored charge.
- Preserve the current synchronous Audio runtime. Do not claim recovery after a process crash or invent a durable worker/queue. A retained claimed job is recoverable as a status, not an authorization to run the provider again; describe uncertain/manual-review states honestly.
- Preserve exact request/price freshness. No provider/media network operation under a long database transaction: reuse prepared factual evidence, revalidate stored ownership/source identity and current commercial policy under the transaction, reject drift before debit.
- Keep provider keys, private URLs, traces and credentials out of user copy/logs. Public result presentation is completed-output-only and retains existing signed-download and ownership rules.
- No deployment, paid call, real upload or production mutation for implementation/verification. Behavioral transport fixtures and explicitly disposable local PostgreSQL are allowed. Source worktrees may have been removed by archival; read preserved Git objects.

### Task 1: Shared Audio reservation and MCP quote contracts

Owners: `frontend/src/server/audio/prepare-audio.ts`, `audio-generate-jobs.ts`, `generate-audio.ts`, new focused `audio-run-reservation.ts`; `frontend/src/server/agent-api/quote-repository.ts`; new Audio request/quote helpers under `agent-api/`. Keep server/client boundaries and existing architecture contracts explicit.

- [ ] Inspect source checkpoint `e274b0871` and current owners before selectively reusing the extraction. Existing web generation must retain behavior. Finish `createInitialAudioJobInExecutor` and trusted reserved-execution context without exposing it to browser/MCP payloads.
- [ ] Keep one SQL repository/claim lifecycle with surface-specific strict normalize/hash/funding codecs or an equally explicit discriminated owner. Preserve old API exports. Unknown/wrong-surface rows are rejected safely; mixed quote activity/top-up/recovery readers stay usable. Audio is wallet-funded, never a trial reinterpretation.
- [ ] Define a versioned canonical Audio request based on current pack settings and owned typed references, excluding auth tokens, UI quote fields and raw provider endpoints. Normalize/hash deterministically and preserve specialized voice/output settings and requested/source-driven durations.
- [ ] Share a capability projection from the real Audio config/validation/providers. Model availability is truthful; intended but unavailable routes remain unavailable with reasons. Do not author a duplicate catalogue or silently broaden model publication.
- [ ] Cover existing web Audio execution/billing, video/image/trial repository compatibility, mixed/wrong-surface rows, strict inputs and reservation rollback with focused tests. Qualify the seams before dependent MCP services; commit and report interfaces.

### Task 2: Prepare and confirm the exact Audio attempt

Owners: focused `agent-api` Audio prepare/confirm services, current Audio reservation/execution owner, existing spending/restriction/reference helpers. Reuse schema/migration ownership; no new payment table.

- [ ] Preparation validates the chosen request, resolves owned references, obtains real factual duration and current canonical price, records an owned expiring quote and returns summary, exact cents/currency, expiry, balance/funding requirement and explicit confirmation requirement. It does not reserve/debit or submit.
- [ ] Confirmation requires quote ID and `confirmed: true`, the correct authenticated OAuth principal/client and existing paid-generation capability. Lock and revalidate quote/limits/restrictions/identity/catalog/policy, atomically reserve job/debit/claim, then execute through the shared Audio owner outside the transaction.
- [ ] A duplicate or concurrent confirmation returns the same stored job without another charge/provider attempt. Replays after success, failure, refund or client disconnect cannot reactivate the quote. Reject expiry, wrong owner/client/surface, changed price, reference removal, insufficient wallet and cumulative daily limits without side effects.
- [ ] Reuse or adapt the existing top-up handoff for Audio quotes; it must invalidate the old quote and instruct fresh preparation/approval after funding. Keep activity entries labelled by the actual tool/surface rather than video assumptions.
- [ ] Meaningful tests use the real service with injected provider execution and disposable PostgreSQL for simultaneous confirmations, cumulative video+Audio limits, rollback and exact-once failure/refund. No real generation. Preserve server-owned price/policy even with stale client settings.

### Task 3: MCP registration and actual Audio result presentation

Owners: `mcp/server.ts`, `tool-input-schemas.ts`, `http-handler.ts`, tool handlers/instructions, existing generation status/recent/download policy and result App. Preserve Studio's parallel montage additions when composing these shared files.

- [ ] Register `list_audio_capabilities`, `prepare_audio_generation`, `confirm_audio_generation` with existing OAuth/scopes/gates and accurate annotations. Add instruction/tool-selection coverage for each intent, exact-price approval, no automatic retry and real result recovery. Discovery must not imply every candidate provider is enabled.
- [ ] Extend current status/recent/download owners to admit owned Audio jobs with the correct result kind, mime, exact original, measured duration and destination. Preserve video/image/legacy handling and private signed-URL policies; do not classify audio as image/video to bypass an allowlist.
- [ ] Add Audio to `present_generation` through a new immutable generation-result App version while retaining cached prior templates/read compatibility. Render an actual manual audio player with readable title/state, download/reuse/open actions and accessible mobile layout; never autoplay or present fabricated media during pending/failed states.
- [ ] Verify the actual MCP registration/dispatch paths with test transports and auth/gates, all Audio intents, pending/failure/completed results, wrong-owner and signed-download handling. Verify result App browser fixtures desktop/mobile, light/dark and keyboard. No paid call or production publication.
- [ ] Update relevant engineering/MCP documentation and catalogue coverage contracts. Root reviews the composed diff and runs the final combined suite/build; delivery reports distinguish implementation readiness from live provider/production qualification and synchronous-runtime limits.
