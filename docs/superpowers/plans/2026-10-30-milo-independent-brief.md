# Milo independent creative briefs implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prevent unrelated new briefs from silently inheriting old editor or proposal subjects.

**Architecture:** Change only the shared composer provider intent policy. Retain separate editor, proposal and conversation inputs; do not introduce a classifier or change the browser lifecycle.

**Tech Stack:** TypeScript, OpenAI Responses request builder, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-30-milo-independent-brief-design.md`.

## Global constraints

- No additional provider calls for the clarification refinement; no production mutations, push, merge or deploy.
- Synthetic public fixtures only; private user content stays outside Git.
- Preserve settings authority, active proposal revisions, natural continuation and New chat keeping the editor intact.
- Implement in the isolated `codex/milo-independent-brief` worktree based on `b46c6db2525f9ea53234f28add4aee9cb968558c`.

## Review focus

- A new creative request must remain independent even with an active proposal.
- An ambiguous starting request with existing editor text must ask reuse-versus-new with `text: null`, then honor the answer without asking repeatedly.
- Explicit editor revisions must still work with an unrelated active proposal.
- A natural same-idea continuation must not require ritual revision wording.
- Contract tests cannot establish semantic provider-output quality; report this limit.

## Task 1: Correct and verify provider intent precedence

**Files:** Modify `frontend/src/server/prompt-assistance/provider.ts`, `tests/prompt-assistance-conversation-contract.test.ts`, and `docs/engineering/prompt-assistance.md`; add synthetic cases under `tests/fixtures/prompt-assistance-intent-cases.ts`.

**Interfaces:** Consume `promptResponseParams(row, context, history)` and the existing request schema; preserve their signatures and provider input fields. Export synthetic intent cases for the contract tests and separately coordinated output evaluation.

- [x] Add synthetic independent/ambiguous/revision/continuation cases and tests of the real provider request boundary. Check intent policy, removal of unconditional editor reuse, exact separated editor/proposal/message/history and current settings.
- [x] Run the conversation contract test. Expected: the new intent-policy test fails because the current policy unconditionally reuses editor text.
- [x] Replace that default with latest-intent precedence, independent-brief isolation, a focused clarification for consequential ambiguity and preserved revision/continuation precedence. Document the boundary and verification limit.
- [x] Run conversation/context/preview tests and the existing workflow session browser regression. Expected: zero failures; existing restoration and New chat behavior preserved.
- [x] Run TypeScript, frontend lint, exposure guard and `git diff --check`. Expected: no new errors; report any existing warnings.
- [x] Review the diff against the spec and commit the isolated change. Root coordinates independent review and corrective provider evaluation before incorporation into PR #571.

## Task 2: Require reuse-or-new clarification for an ambiguous starting request

**Files and interfaces:** Same provider, conversation-contract test, synthetic cases and engineering guide as Task 1. Preserve `promptResponseParams(row, context, history)` and all request fields.

- [x] Add a failing provider-policy contract for nonempty editor plus ambiguous initial request: one concise question in the user's language, `text: null` until clarified, clear new/editor requests bypass it, answers persist through history.
- [x] Add synthetic clarification→new and clarification→reuse cases in French and Spanish; retain explicit bypass, active proposal and natural-continuation cases.
- [x] Replace the earlier permission to offer a fresh idea before the reuse choice is resolved. Document the requested rule without changing editor, session or settings behavior.
- [x] Run conversation/context/preview tests, the existing workflow browser regression, TypeScript, frontend lint, exposure and diff checks. Expected: zero new failures; existing lint warnings reported.
- [x] Commit a descendant of `69c60fbd70137f83409e9a1dca3de16fa5925aef`. Preserve its private six-sample evaluation as historical evidence; root arranges independent review and separate output evaluation of this refinement before integration.
