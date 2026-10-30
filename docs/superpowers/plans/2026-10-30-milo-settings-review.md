# Milo Settings Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let users explicitly review and apply an existing Milo proposal with changed generation settings locally.

**Architecture:** Add a typed application context and guarded review transition to the preview reducer. The video adapter supplies a conservative compatibility projection; the existing expanded prompt view presents the diff and explicit confirmation. Keep full context in memory; persist only an additive versioned digest/settings/request proof in the existing local cache.

**Tech Stack:** Existing React, TypeScript, CSS modules, node:test and Playwright Chromium/WebKit fixtures.

**Spec:** `docs/superpowers/specs/2026-10-30-milo-settings-review-design.md`

## Global Constraints

- Preserve the 53 px proposal bar and ordinary View prompt / Use prompt flow.
- No paid calls, production interactions or settings mutation from review/application.
- Hard compatibility, manual edits and unknown restored baselines fail closed.
- Confirmation binds exact proposal, revision and context, and any context change invalidates it.
- Preserve recovery, loading, pending, account, New chat and Undo guards.
- Synthetic fixtures only; keep user case artifacts outside Git.

## Review Focus

- Modern completed cache proof binds hard-input digest and server request across reload; missing/invalid historical proof stays unavailable while ordinary valid restore still works.
- A hard context changed and then reverted: the old proposal cannot regain review compatibility.
- A setting changes while review is open: old confirmation cannot apply until explicitly reviewed again.
- A new reply, pending request or account switch must invalidate a review token.
- Narrow mobile widths and many changed settings must retain readable text and the 53 px bar.

### Task 1: Review state and compatibility

**Files:** `frontend/src/lib/prompt-assistance/application-review.ts`, `preview-state.ts`; `tests/prompt-assistance-settings-review.test.ts`.
**Interfaces:** Typed `ProposalApplicationContext`, setting diffs, `canReviewProposal` and `canApplyReviewedProposal`; reducer `review` and `appliedReviewed` actions.

- [x] Write tests for explicit review, setting diffs, exact-context races, hard changes/reverts, pending, restore, Undo and New chat; run RED.
- [x] Implement the narrow transition, preserving ordinary canApply behavior; run GREEN.

### Task 2: Adapter, hook and expanded view

**Files:** video `WorkspaceComposerSurface.tsx`, shared `Composer.tsx`, `usePromptAssistancePreview.ts`, `PromptAssistanceComposer.client.tsx`, `PromptAssistancePanel.client.tsx`, copy/CSS and focused browser test.
**Interfaces:** Optional `reviewKey` on assistance context; hook publishes setting diff, review validity and explicit begin/apply callbacks. Video adapter derives full conservative nonsettings context; Composer adds asset/companion/mode identity.

- [x] Add a failing browser flow using real hook/Composer and synthetic reply: setting change → Review & use → diff/edit → explicit apply, no extra POST; include stale-open race and hard gates; run RED.
- [x] Implement UI/hook wiring and accessible localized copy; run GREEN in Chromium/WebKit mobile and desktop.
- [x] Run existing preview/panel/live/session/context/input/layout suites, lint and TypeScript. Inspect screenshots and exact bar height.
- [x] Update engineering contract docs; commit and deliver exact SHA for independent review by the parent.


## Verification record

- Final focused run: **72 passed, 0 failed** across the new settings-review reducer/browser tests and existing preview, panel, live, session, context, input/layout, recovery/auth and context-audit suites.
- TypeScript `tsc --noEmit -p frontend/tsconfig.json`, focused ESLint and `git diff --check`: pass.
- RED → GREEN observed for the missing review action, exact-context/Undo races, durable proof revocation with delayed digests, original-settings/server-fingerprint binding, duration aliases and authored guide behavior.
- Synthetic real Composer/hooks/CSS fixture; intercepted API; Chromium/WebKit at 320/390/1440; French/Spanish narrow actions; no provider calls or production interactions.
- Parent coordinates independent review and integration; this branch is not deployed.


### Follow-up: acknowledged durable revocation

- [x] Reproduce conditional QuotaExceededError on compatible:false writes in the real browser, with and without a pending request.
- [x] Return an actual write acknowledgement, then use bounded proof-free/minimal-identity fallbacks; preserve pending message/analysis identities before any discard.
- [x] Expose complete-storage-refusal accurately and keep local review fail closed across mounted workflow returns; retain epoch fencing and Check reply.
- [x] Cover silent dropped writes, minimal identity fallback, refusal of removal, pending recovery/reload, and pending analysis ownership.
- Validation: **58/58 dependent tests pass**, TypeScript, focused ESLint and diff whitespace pass. No provider/production calls.
