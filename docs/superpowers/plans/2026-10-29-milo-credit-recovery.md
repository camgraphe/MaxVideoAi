# Milo Credit Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task in the current isolated PR.

**Goal:** Preserve customer intent and offer an explicit, safe Lite transition when assistance credits cannot fund a message.

**Architecture:** Shared browser-safe assistance decisions and inline notice. Composer persists server-authored failure details alongside its existing request context; Studio continues owned paused tasks through its revisioned approval endpoint. Existing credits and authentication remain authoritative.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL, node:test and Playwright fixtures.

**Spec:** `docs/superpowers/specs/2026-10-29-milo-credit-recovery-design.md` (approved conversational design).

## Global Constraints

- No chat without authentication; no automatic purchase, send retry or model switch.
- Never bypass unsettled usage or reset a task's recorded spending.
- Preserve account/project scope and unsent edits during async choices.
- Keep current PR and existing tariffs; no production operations.

## Review Focus

- Double-click and stale selection must never send twice (composer browser test).
- Low positive credits may still fail the server reservation (PostgreSQL + browser test).
- Authentication failures must not become recovery/purchase prompts (hook/browser test).
- Task continuation must retain completed work and forbid unverified usage (task PostgreSQL test).
- An account change during a tier mutation must discard its continuation (hook/browser test).

### Task 1: Composer access and funding recovery

Files: shared assistance decisions/notice; `useStudioAssistance`, composer transport/reducer/controller/feedback, prompt server result, focused browser/PostgreSQL tests.

- [x] Add failing tests for auth, insufficient reservation, restoration without overwriting newer edits, explicit one-click Lite and no automatic resend.
- [x] Preserve validated server failure reasons and pre-dispatch safety; restore rejected input and expose the relevant notice/actions.
- [x] Keep fresh choice status available for the immediate send and guard owner/unmount/double-click races.
- [x] Run focused tests and type/lint checks.

### Task 2: Studio parity

Files: Studio composer, task selection/resume contract, task service/checkpoint, task card/hook, PostgreSQL/browser tests.

- [x] Test new-task funding pause and explicit Lite continuation with unchanged spending/call bounds; retain historical snapshots.
- [x] Mark new task snapshots as requiring explicit choice; add revisioned `continue_lite` approval and account selection.
- [x] Reuse the notice for unsent/known-rejected Studio messages and paused task funding. Purchases leave messages ready for explicit send.
- [x] Run task, assistance, Studio QA/editor and browser lanes appropriate to the change.

### Task 3: Review and delivery

- [x] Inspect diff, update engineering notes, verify public exposure and clean diff.
- [x] Commit and push the current branch to PR #555; report any validation limitations.

## Execution ledger

- Task 1: rejected input/authentication tests observed red, then green. Browser and PostgreSQL qualification covers editable restoration, paid-level selection at zero credits, explicit free send, duplicate clicks, owner changes, bound selection and recovery after reload.
- Task 2: a new task completed via silent fallback before the fix (red); it now pauses, resumes through one revisioned Lite approval and retains completed tool work (green). Original task model/profile remain immutable; the new segment records Lite.
- Ruling: use `profile_json.explicitLiteChoice` on new snapshots, rather than rewrite historical tasks or add a migration. Historical fallback/reconciliation tests explicitly construct pre-change snapshots in disposable databases.
- Ruling: separate send eligibility from reference editing. A funding/auth/service problem must not disable editing references on an already loaded authenticated Studio workspace.
- Final review: independent reviewer found three important cases: cross-tab model race, rejected recovery after reload, and unavailable Lite on task cards. Added regression coverage and fixed all three; reviewer verified the fixes with no remaining important findings.
- Ruling: retain English notice copy, following the user's explicit English UI preference.
- Validation setup: connected browser fixtures deliberately reject environment files. Use isolated Git snapshots without `.env*`, with disposable PostgreSQL and injected provider responses; keep the live review environment unchanged.

- Qualification: 47 focused checks passed; clean Studio QA 1,453 passed / 1 optional skip; 0 type errors, 0 lint errors / 7 existing warnings. Full browser run 89/91, with both failures subsequently corrected and replayed green (plus mobile chat). Full browser lane not rerun as a single green command.
