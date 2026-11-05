# Studio Native Creation Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this single task inline. Parent coordinates independent review and delivery after PR607.

**Goal:** Give clients without assets useful native creative direction while retaining authentic-footage and execution boundaries.

**Architecture:** Add one compact block to the existing active Studio instruction owner. Use the real director with injected offline Responses for request-envelope verification; keep natural-language quality criteria separate from those tests.

**Tech Stack:** TypeScript, Node test runner, existing Studio director.

**Spec:** `docs/superpowers/specs/2026-11-03-studio-native-creation-guidance.md`

## Global Constraints

- No provider/media calls, migration, billing, authorization or feature-gate changes in this creative task. The parent-authorized adjacent reply fix supplies the shared cap for the task instruction; its other runtime changes are separately owned.
- Preserve saved real-footage constraints, client confirmation and exact capability/reference facts.
- No customer content in committed fixtures; no generic permission to ideate or mandatory recipe.
- Delivery follows PR607 through the parent's normal GitHub/CI process.

## Review Focus

Missing subject stays a legitimate question; real-footage alternatives stay conditional; missing optional references do not block ideas; inactive media stays unavailable; no added payment or external-search authority.

### Task 1: Deliver compact creative guidance through the active director

**Files:** Modify `frontend/src/server/studio/conversation-director-instructions.ts`; create `tests/studio-native-creation-guidance.test.ts`; document ownership in `docs/engineering/studio-editor-architecture.md`. The spec contains the synthetic scenario matrix.

**Interface:** Existing `buildStudioDirectorInstructions(features): string` and `createStudioConversationDirector(options)(context)` remain unchanged.

- [x] Write request-envelope tests for native creative guidance, retained authentic-footage memory and enabled/disabled media/payment tools. Expected: the new guidance assertion fails before implementation.
- [x] Add the compact instruction block, preserving the existing prompt-size budget. Expected: new tests pass without modifying runtime authority or response limits.
- [x] Run the new test plus existing director/actions, capability/catalog, scope, film planning, pricing and confirmation tests. Expected: zero failures; injected responses are explicitly not a semantic evaluation.
- [x] Run focused ESLint, frontend typecheck, exposure guard and diff check. Expected: exit 0. Document actual results and limits, then commit only owned files; no push/merge.
