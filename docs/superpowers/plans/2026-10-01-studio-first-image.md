# Studio First Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prepare, confirm and recover one real image from authenticated Studio, sharing the existing MCP billing and execution owners.

**Architecture:** Keep OAuth adapters unchanged. Add a server-derived Studio session actor and immutable quote origin/project scope, then use the same pricing, reservation and provider transaction. A gated conversation pilot stores messages and quotes in PostgreSQL; Sol may prepare an image but only the client can confirm it.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, OpenAI Responses, existing image execution and media library.

**Spec:** `docs/engineering/studio-conversation-integration.md` (first lot only; approved by “ok go”).

## Global Constraints

- Work only on `codex/studio-conversation-exploration-20261001`; preserve the local prototype and existing projects.
- Never fabricate an OAuth principal for a session. Preserve historical OAuth quotes and all remote MCP publication gates.
- Canonical pricing is the sole price owner. No charge or provider call before explicit confirmation of an exact quote.
- Authenticate before DB/model work; enforce project, account, quote origin and owned references on the server.
- No request-time DDL. Qualify migration on disposable local PostgreSQL only.
- Keep the replacement behind a pilot gate. This lot does not replace the canvas/timeline editor or qualify Audio/video.

## Review Focus

- A null OAuth client must not authorize a Studio quote.
- A late response from another project must not alter the active conversation.
- A lost confirmation response must recover the same job without a new charge.
- A changed/expired quote must ask for a fresh confirmation.
- Sol output and client payload must not introduce an unowned URL, account or executable confirmation.

### Task 1: Shared actor and immutable quote scope

**Files:** generation actor helper; `agent-api/{prepare-generation,confirm-generation,reference-assets,resolve-generation-references,quote-repository}.ts`; migration `49_studio_generation_scope.sql`; scoped PostgreSQL tests and existing MCP test fixtures.

**Interfaces:** `GenerationActor = AgentPrincipal | StudioGenerationActor`; session actors contain an authorized project ID and no OAuth client. `createQuoteRepository(codec, scope?)` defaults to OAuth; Studio binds `origin: 'studio-session'` and `projectId` once on the server. Existing public prepare/confirm functions reject session actors; internal shared functions accept validated actors.

- [x] Write tests for OAuth/session/project isolation, immutable origin, wallet-only session, replay and foreign references.
- [x] Run focused tests; expected new behavior fails before implementation.
- [x] Add migration and scoped repository; extract actor validation and share preparation/confirmation, retaining OAuth wrappers and trial restrictions.
- [x] Run scoped PostgreSQL and existing MCP preparation/confirmation/concurrency/reference tests; expected all pass.
- [x] Commit this independently qualified boundary.

### Task 2: Authenticated image conversation pilot

**Files:** `server/studio/image-conversation-*`; migration for conversation turns; thin authenticated project image-conversation routes; contract tests.

**Interfaces:** actor comes from Studio access plus owned project lookup. Turn input contains request ID, message and canonical image asset refs; turn result contains public reply and server-prepared quote. Confirmation input contains only turn/quote identity and `confirmed: true`. Recovery reuses the same owned quote/job. Session service binds the Task 1 repository and disables included trials.

- [x] Write tests for authentication before work, single-image certified capabilities, no AI confirmation tool, repeated turn/confirmation, owned references and stale requests.
- [x] Run tests; expected missing pilot contracts fail.
- [x] Implement gated session service, durable turn state, Sol image preparation, quote confirmation and canonical recovery. Persist intent before quote preparation and attach quote inside its transaction.
- [x] Run focused service/route tests and disposable PostgreSQL flows; expected no preparation charges, one confirmation charge/provider call and stable recovery.
- [x] Commit the pilot server path.

### Task 3: Reviewable client quote and validation

**Files:** separate route-local conversation pilot page, client hook, quote card and styles; engineering guide and verification record.

**Interfaces:** consumes Task 2 routes; account media comes from existing Assets/Recent/import owners. Displays exact quote, useful settings, references, expiry, explicit confirmation, progress and image output. It does not create a second commercial calculator or change the existing editor.

- [x] Write focused tests for quote state, stale response protection, confirmation payload and recovery.
- [x] Run tests; expected the new client contract fails.
- [x] Implement the pilot chat with the accepted charcoal/olive direction and app shell; keep the existing local timeline prototype available.
- [x] Run TypeScript, lint, relevant contract suites and browser desktop/mobile verification.
- [ ] Final handoff: prepare a bounded live image quote; provider execution requires its explicit approval.
- [x] Update the guide with exact gates, migration and remaining limits; perform a fresh branch review, fix material findings and commit.

Self-review: Task 1 scopes are consumed by Task 2; Task 2 public results are consumed by Task 3. Later video/audio/orchestration/editor replacement lots remain outside this plan. The user already approved execution; proceed inline without another planning gate.
