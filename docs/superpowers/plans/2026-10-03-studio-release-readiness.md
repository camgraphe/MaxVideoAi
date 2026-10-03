# Studio Release Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for coordinated integration and superpowers:dispatching-parallel-agents for the independent appearance, economics and MCP/public-page owners. Steps use checkbox syntax.

**Goal:** Deliver a coherent chat-first Studio, bounded assistant economics, auditable behavior and accurate MCP/marketing surfaces, ready for final pre-production review.

**Architecture:** Preserve the existing domain services and generation confirmation. Add a thin Studio entry and project dialog, share app appearance, and keep provider-cost accounting separate from customer wallet charges. Do not duplicate timeline or media execution.

**Tech Stack:** Next.js, React, TypeScript, CSS modules, PostgreSQL, Node tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-studio-release-readiness-design.md`, plus the linked economics and learning strategy specifications.

## Global Constraints

- No production deployment, live paid provider calls or production database writes.
- All Create assistant work remains deferred.
- Preserve current English-first artistic chat and owned-media/quote/approval contracts.
- App follows OS unless explicitly overridden; public pages remain light.
- No automatic paid continuation or silent assistant-model switch.
- Source and commercial policy versions remain auditable; unknown costs are never zero.

## Review Focus

- A delayed response from a prior account or closed dialog cannot navigate or leak projects: Task 2 DOM tests.
- An uncertain first-project POST retries one stable identity and a GET never creates projects: Task 2 route/creation tests.
- Explicit appearance survives public navigation, blocked storage and OS changes: Task 1 behavior tests.
- Media insertion and chat mentions keep distinct effects and preserve measured-duration/ownership checks: Task 3 tests and browser gestures.
- Parallel assistant calls, unknown outcomes and selection changes cannot overspend or silently change a running request: Task 4 PostgreSQL tests and final independent review.

### Task 1: Shared appearance (delegated owner)

**Files:** `frontend/src/hooks/useThemePreference.ts`, `frontend/lib/theme-bootstrap.ts`, shared app-menu components/styles, `studio/_hooks/useStudioThemeMode.ts` and theme tests.

**Interfaces:** Existing `useThemePreference()` snapshot and `useStudioThemeMode()` caller shape remain; shared menu owns appearance.

- [x] Pin OS/default, explicit and legacy preference precedence, public navigation and storage failure in tests; observe expected failures.
- [x] Implement coherent preference and compact accessible sun/moon controls.
- [x] Run theme and relevant architecture checks, then integrate only this owner's files.

### Task 2: Direct conversation and project dialog

**Files:** new Studio `page.tsx`, entry and project-dialog components/hooks; new summary read owner; GET in `api/studio/conversation-projects/route.ts`; app navigation and marketing-entry handoff; existing conversation orchestrator; entry/route/DOM tests.

**Interfaces:** `listStudioConversationProjects(userId, executor?)` returns bounded summaries `{id,name,updatedAt,persistenceMode}` without workspace JSON. `useStudioProjectCreation(accountKey,onCreated)` owns one stable pending attempt, cancellation and retry. `ConversationProjects` renders current project and lazily reads summaries.

- [x] Write behavior tests for direct entry/auth gating, summary isolation, stable retry, dialog focus/search and stale responses. Run and observe missing behavior.
- [x] Add read-only server summary projection and gated GET; root resumes recent connected project or renders chat opening state.
- [x] Add idempotent client creation and accessible project dialog; wire root navigation and remove header theme duplicate.
- [x] Preserve starter/media/local Canvas routing. Run focused tests and TypeScript checks; commit this bounded slice.

### Task 3: Media and timeline clarity

**Files:** conversation media shelf/card, timeline component/styles, focused insertion helper and behavior tests.

**Interfaces:** optional `onInsert(item: ImageLibraryAsset)` action wires existing `timelineInsertion`; previews may contribute only validated measured facts, never canonical identity replacement.

- [x] Pin explicit insertion versus mention, failed/missing facts and selection feedback in tests.
- [x] Add compact labeled media-to-timeline action, preserve artwork arrangement, clarify timeline empty state and preview controls.
- [x] Run timeline/media tests and real browser interactions in both themes and mobile; commit.

### Task 4: Assistant economics and reviewability

**Files:** delegated canonical pricing, Studio server/contract/API/migration owners; root assistant status/budget UI; admin read projection and route.

**Interfaces:** GET/POST `/api/studio/assistance` publishes enabled state, model/mode, dated tariff, included and sponsored allowances, authorized/spent/reserved paid budget, revisions and continuation/block reasons. All paid actions are explicit and optimistic-revision checked.

- [x] Delegate durable reservations/settlement with focused RED/GREEN concurrency, account isolation and recovery tests.
- [x] Wire a discreet usage control, explicit budget dialog and Luna continuation with visible limit disclosure and contextual reminders; no fabricated live pricing.
- [x] Add restricted read-only review projections for available Studio conversation/cost records and truthful external MCP coverage; test authorization, redaction and unavailable data.
- [x] Run disposable PostgreSQL and DOM integration checks. Document exact policy, migration, activation and reconciliation prerequisites.

### Task 5: MCP/public-page audit and complete verification

**Files:** delegated MCP discovery/guidance, public localized Studio route and update/audit report; integration docs and validation artifacts.

**Interfaces:** Public CTA `/api/studio/marketing-entry` targets `/app/studio`; explicit allowlisted starters retain their canonical handoff. Marketing never imports execution or billing state.

- [x] Run focused MCP offline discovery/mode/identity/policy tests, repair proven gaps, and record real-host limitations.
- [x] Ship accurate EN/FR/ES public copy/metadata and real current UI capture; run localization/SEO contracts.
- [x] Run focused and required broad checks, inspect rendered mobile/desktop/light/dark flows and production build.
- [x] Dispatch a fresh final reviewer, fix important findings with reproductions, then report exact readiness and remaining production prerequisites without deployment.

## Completed candidate

Implementation and final review are complete on `codex/studio-creative-workspace`.
Production build and six localized public browser cases passed at `2e55deb63`.
The full validation plan passed: 6,070 tests passed, zero failed, two explicit skips
across 1,037 standard and four isolated integration files. Commercial activation
and live-provider qualification remain gated as specified. See
[the release handoff](../../operations/studio-release-candidate-2026-10-04.md).
