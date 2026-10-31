# Milo Reply Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clarify conversational reply-language precedence without changing creative-text language rules.

**Architecture:** Keep language policy in composer `provider.ts`; the app guide defers to that policy. Document the bounded conversation context without adding another language or memory owner.

**Tech Stack:** TypeScript, existing OpenAI request builder, Node test runner through tsx.

**Spec:** `docs/superpowers/specs/2026-10-31-milo-reply-language-design.md`

## Global Constraints

- Preserve public schemas, destination decoding, recovery, application proof, storage, billing, model selection and UI.
- Preserve creative-text language rules; add no language detector, translation call or preference persistence.
- Use existing offline checks; do not claim semantic model validation or run live provider/browser QA.
- The task's already supplied execution and independent parent review replace another design or execution approval round.

## Review Focus

Current instruction versus conversation inertia; quoted material versus the user's own instruction; spoken language versus commentary; an applicable explicit preference; ambiguous text with locale only as last fallback. These semantic cases need real-model evidence to qualify behavior; offline source assertions cannot prove them.

### Task 1: Clarify and verify the shared instruction

**Files:** Modify `frontend/src/server/prompt-assistance/provider.ts`, `frontend/src/server/prompt-assistance/app-guide.ts`, and `docs/engineering/milo-workflow-chats.md`.

**Interfaces:** Existing `promptResponseParams` consumes the same current input and history and returns the same provider/public formats. No signature or schema changes.

- [ ] Run the existing context-audit, conversation-contract, reply-boundary and provider-budget tests on the unchanged base; expected: passing.
- [ ] Replace only the ambiguous reply-language sentence with the precedence in the spec; preserve the adjacent creative-text rules verbatim. Make app guidance defer to it and document the eight-exchange limit.
- [ ] Rerun those checks and relevant existing context, route, review and storage checks; expected: passing. No new copy-only assertion or simulated semantic test.
- [ ] Run TypeScript, frontend lint, exposure and diff checks; inspect a production build if feasible without credentials or live product actions. Expected: no errors; report existing warnings or limits.
- [ ] Review the complete diff against the spec, commit, push the isolated branch and open a PR. Parent independently reviews the exact candidate and owns Preview, CI, merge and deployment gates.
