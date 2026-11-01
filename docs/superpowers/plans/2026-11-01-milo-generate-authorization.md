# Milo Generate Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent hidden old drafts from generating in Milo workspaces until the current conversation prompt is explicitly applied, while preserving manual generation and readable quotes.

**Architecture:** Keep application proof in the existing shared Milo preview hook, separate from proposal availability and quote readiness. Publish its derived mode/permission to the real generation owners; shared Composer guards its button, image guards its enclosing form, and audio guards its owner handler. Reuse one accessible contextual-help wrapper without changing the proposal/review surface.

**Tech Stack:** React, TypeScript, Next.js, existing esbuild/Playwright browser fixtures, node:test.

**Spec:** docs/superpowers/specs/2026-11-01-milo-generate-authorization.md

## Global Constraints

- User approved implementation; no new confirmation gate.
- Video/image/audio surfaces with Milo + Generate only; no Studio, timeout or billing changes.
- Keep 53px preview, ellipsis, eye, review UI, current quote/source/engine guards and live pricing.
- No customer data, real model/media calls, purchases or production mutations.

## Review Focus

- Restored chat or account switch must not inherit an application proof.
- Failed/new messages and edits followed by reverting must not revive old proof.
- Compatible aspect-ratio changes must preserve application and quote updates.
- Native image form requestSubmit and keyboard activation must not bypass the guard.
- Mobile help must be reachable while the amount remains readable.

---

### Task 1: Shared permission and enforced workspace actions

**Files:**
- Modify: frontend/components/composer/usePromptAssistancePreview.ts; PromptAssistanceComposer.client.tsx; prompt-assistance-copy.ts
- Modify: frontend/components/Composer.tsx; frontend/components/composer/composer-types.ts
- Create: frontend/components/composer/GenerationActionHelp.client.tsx and its CSS module
- Modify: image/_components/ImageWorkspaceComposerSurface.tsx; audio/_components/AudioCreationEditor.tsx; audio/AudioCreationWorkspace.tsx
- Test: tests/milo-generation-authorization-browser.test.ts plus focused existing fixture helpers as needed

**Interfaces:**
- Hook exposes whether the current editor text was explicitly applied in the current conversation and compatible context.
- PromptAssistanceComposer publishes `{blocked:boolean, hint:string|null}` through an optional callback; no callback means no new owner wiring.
- Composer publishes effective submission eligibility to the image owner; button and form enforce it. Audio editor publishes Milo gate to its owner handler.

- [x] Write behavior tests using the real components and submission boundary. Cover all acceptance cases and the five Review Focus conditions; media/LLM requests are intercepted.
- [x] Run the new tests on the unchanged production code. Expected: meaningful failures because Generate currently accepts the old draft.
- [x] Implement application proof lifecycle and localized guidance in the shared Milo owners. Exclude supported reviewable scalar controls from hard compatibility identity; require text/account/conversation/source identity.
- [x] Implement shared guarded action/help rendering, preserving the amount and quote updates; guard the image form and audio generate handler explicitly.
- [x] Run the new tests. Expected: all pass, no unexpected external network request.
- [x] Run focused existing Milo, composer quote/layout, image form, audio, architecture tests; lint, typecheck and exposure guard. Expected: pass; record any environment/pre-existing failures exactly.
- [x] Update the workspace engineering contract and record verification. Commit the bounded change with spec/plan and synthetic tests.

### Task 2: Whole branch verification and review handoff

**Files:** same change set; no new feature scope.
**Interfaces:** consumes the committed implementation and verification record; produces a clean commit for parent review.

- [ ] Inspect complete diff and run git diff --check plus relevant selected validation lanes required by repository CI rules. Expected: clean / passing.
- [ ] Obtain a fresh whole-branch review using parent coordination; address important findings with failing behavior tests before fixes.
- [ ] Report worktree, branch, commit SHA, exact commands/results and any limitations. Wait for parent review; do not merge or deploy.


## Candidate verification, 2026-11-01

- Baseline before production edits: 6 existing tests pass.
- RED: all 9 initial behavior tests fail on the unchanged base (enabled old-draft action / missing guidance). Additional proposal-edit and delayed wallet/auth tests reproduced their failures before correction.
- GREEN: 14 new browser tests plus generation/auth/architecture checks pass, 32/32 total in the final follow-up command.
- Existing focused regression group: 120/120 pass, including quote layout, localized compact proposal bar, image restoration, Milo settings/recovery and audio. The async continuation follow-up is covered separately above.
- `pnpm --prefix frontend exec tsc --noEmit`: pass. `pnpm --prefix frontend run lint`: 0 errors, 7 pre-existing unrelated warnings. `pnpm lint:exposure` and `git diff --check`: pass.
- Synthetic desktop/mobile captures of discussion, ready and applied states were reviewed; preview bar/review behavior and amount readability retained. No provider/media/payment request or customer account was used.
- In-memory proof is deliberately not restored from storage/history. Qualified scalar controls reuse the existing compatibility owner; hard changes and text/proposal divergence revoke it.
- Parent review, Quality CI, exact preview and production gates remain outstanding. No merge or deployment is part of this implementation handoff.
