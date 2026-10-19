# Creator Tools Implementation Plan

> **For agentic workers:** Use test-driven implementation for business boundaries,
> independent domain work where files do not overlap, then a whole-branch review.

**Goal:** Deliver five usable tools across app, library, Studio and MCP with
localized visual marketing and verifiable availability.

**Architecture:** Extend existing Toolbox contracts and canonical generation
services. Subtitle documents and rendering are separate owners; surfaces are
adapters of shared operations, with current ownership and exact-price checks.

**Tech Stack:** Next.js, TypeScript, Zod, PostgreSQL 17, existing Fal/provider
clients, FFmpeg/Remotion and existing test/browser runners.

**Spec:** `docs/superpowers/specs/2026-10-19-creator-tools-design.md`

## Global constraints

- All changes in isolated `codex/five-creator-tools`; preserve Desktop work.
- No paid provider trial until its exact quote is approved.
- No fabricated quality, prices, model publication or executable capabilities.
- Existing pricing, identity, auth, source-media and Studio export gates remain
  owned by their documented modules. New session origin is explicit.
- Source assets remain unchanged; settings/quotes cannot silently change.
- EN/FR/ES, keyboard, reduced motion, fixed media geometry and lazy loading.

## Review focus

- Cross-account/project/client quote and document access must be rejected.
- Ambiguous submission and refresh must not duplicate paid attempts.
- Audio/video duration mismatch must be actionable before provider submission.
- Subtitle markup, overlap, Unicode and source trims must survive safe export.
- Unqualified engines/pages must not be advertised as available.

## Task 1 — Session-safe shared generation adapter

Files: `server/agent-api/generation-actor.ts`, `quote-repository.ts`,
`prepare-generation.ts`, new `server/tools/creator-generation-service.ts`, a
bounded Neon migration and `tests/toolbox-generation-scope*.test.ts`.

Interface: `ToolboxGenerationActor = {authMethod:'toolbox-session',userId,
clientId:null}`. `createCreatorGenerationService(actor,{enabled,...dependencies})`
returns canonical `prepare`, `confirm`, `status` methods; it accepts owned assets
only, binds reference fingerprints and reuses existing generation jobs.

- [x] Reject cross-origin access and trial funding in failing unit/PG tests.
- [x] Add explicit quote scope and migration without changing old rows.
- [x] Implement adapter using canonical preparation/confirmation dependencies.
- [x] Verify focused tests plus existing MCP/Studio quote/confirmation contracts.

## Task 2 — Subtitle document, exports and rendering

Files: new `src/lib/subtitles/*`, `src/server/subtitles/*`, subtitle tests,
document migration and worker/API adapters under their existing conventions.

Interfaces: versioned `SubtitleDocument`; strict validation; word→segment builder;
SRT/VTT serializer; source→sequence projector; renderer receives immutable
document snapshot and owned source. Persistence uses optimistic revision.

- [x] Write/run failures for timings, Unicode/markup, trims and revisions.
- [x] Build document model, normalization, safe serializers and style geometry.
- [x] Integrate transcription, durable document storage and recoverable clip burn.
- [x] Test media output and document reuse without retranscription.

## Task 3 — Creative operation profiles and input preparation

Files: new `src/lib/toolbox/creator-tools.ts`, `src/server/tools/creator-*`,
focused profile/ownership/segment tests; reuse catalogue and pricing owners.

Interfaces: four stable tool IDs, strict role-based owned input settings, explicit
segment/audio policy, canonical generation request or specialized tool profile.
Preparation returns exact frozen engine/scenario; no fallback or duration repair.

- [x] Pin invalid source/mode/duration combinations with failing tests.
- [x] Implement measured-source preparation, profiles and shared execution.
- [x] Verify price/reference identity and output lineage/recovery.
- [x] Record real qualification gaps without publishing them as successes.

## Task 4 — Workspaces and visual marketing

Files: `src/components/tools/creator/*`, thin tool app/public routes, localized
copy, routing/sitemap/hub adapters and focused DOM/metadata tests.

Interfaces: common source/settings/preview/result workspace slots; server-shared
availability projection; operation API preparation/confirmation/status results.

- [x] Build responsive source→settings→result surfaces and truthful examples.
- [x] Integrate quote confirmation, pending recovery, errors and saved results.
- [x] Add EN/FR/ES route metadata, visual journeys, FAQ and contextual links.
- [x] Check renders and interactions with screenshots at mobile/desktop widths.

## Task 5 — Studio, Library, MCP and measurement

Files: existing library/Studio contextual owners, MCP descriptors/server/schema,
shared operation APIs, privacy-safe analytics and client contract tests.

Interfaces: canonical asset references, same prepared operation ID and exact
quote, one-attempt confirmation, status/document recovery and explicit Studio
add/replace commands with current revisions.

- [x] Wire eligible contextual entry and result reuse without auto-spending.
- [x] Register gated operation discovery/prepare/confirm/status and document tools.
- [x] Verify ownership, one-attempt semantics and full structured result fallback.
- [x] Update guides and record discovery byte budgets and real-host limitations.

## Task 6 — Integrated validation and delivery

- [ ] Lint/exposure/type checks and all focused business/media/PG tests.
- [ ] Build plus authenticated fixture browser, locale/SEO and accessibility checks.
- [ ] Review full diff independently; repair material findings and retest.
- [ ] Record each tool's actual app/Studio/MCP/provider availability and evidence.
- [ ] Commit coherent changes, open/attach reviewable PR(s), run required Quality CI.
- [ ] Publication only after executable paths and required evidence are ready.

## Progress

- 2026-10-19: isolated worktree, current main, offline dependency installation,
  three independent inventories and 19 passing baseline Toolbox tests.
- Shared session/OAuth operation scope, versioned subtitles, real subtitle video
  rendering, canonical creative operations, LatentSync/Kling specialist adapters,
  localized marketing/workspaces, source selection, recovery, Library and MCP
  adapters are implemented. Studio mix transcription and global sequence caption
  attachment are undergoing final integration and media checks.
- Focused unit, disposable PostgreSQL, real FFmpeg/Remotion and browser fixture
  checks have passed during implementation. Integrated checks and independent
  review are in progress; no real-provider or real-host evidence is claimed.
- All public creator release flags remain closed. No paid canary, public launch,
  production mutation or deployment has been performed.
