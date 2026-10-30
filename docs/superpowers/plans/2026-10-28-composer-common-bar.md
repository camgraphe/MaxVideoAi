# Composer common bar implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this existing approved UI refinement.

**Goal:** Adapt the selected common-bar proposal to the existing video/image app surfaces.

**Architecture:** Route-local owners supply the existing model selector through a presentational composer context. Shared controls render the compact navigation and visible operations; the existing generation toolbar is unchanged. Prompt review exchanges the transcript for the editor within the same bounded stage.

**Tech Stack:** Existing React, Next.js, CSS modules, EngineSelect and browser fixtures.

**Spec:** docs/design/prompt-composer/REFINEMENT-6.md

## Global constraints

- Preserve player dimensions/components and gallery rail.
- Preserve generation, quotes, uploads and account/draft ownership.
- English review UI; retain localized copy support.
- Development preview only; no new dependencies.

## Review focus

- Model picker must remain reachable in both writing tabs, unsupported prompt modes and multi-scene mode.
- Media navigation must never disappear from audio or non-composer routes.
- Long prompts, references and labels must fit at 320 px.
- Review, returning to chat and the first reply must not push the reply field down.
- Changing model or source must still invalidate proposals and use the existing availability rules.

### Task 1: Adapt the common bar and conversation

**Files:** shared Composer/PromptAssistance components; new composer control context and compact model control; AppNavigation; video shell/preview dock; image composer surface; focused prompt-assistance browser/DOM tests and workspace contracts.

**Interfaces:** `ComposerWorkspaceControls` provides a ReactNode model control. `ComposerCommandBar` consumes it and the existing mode switch props. `WorkspaceComposerModel` adapts existing EngineSelect props to its supported custom trigger.

- [x] Add a failing assertion that Review replaces the transcript without moving the reply field.
- [x] Rehome navigation/model entry points behind the existing preview gate; preserve fallback access and real callbacks.
- [x] Bound the conversation, add same-space Review and independent Expand, keep application action and input visible.
- [x] Run focused prompt-assistance and workspace contracts, TypeScript, lint/exposure. Expected: pass, no new warnings.
- [x] Inspect actual local app, model popup, quote updates and responsive fixture. Do not generate media.
- [x] Commit and independent review; no material findings. Validation in refinement documentation. Deliver through the existing draft PR.

## Execution record

Implemented in `92c012840` from `a75d48f62`. Thirteen prompt-assistance tests and 84 relevant contracts passed; TypeScript, lint (seven existing warnings), exposure and diff whitespace checks passed. The independent review reported one nonblocking French narrow-width padding issue, deferred in the refinement document. No further architectural rulings were needed. Live LLM/credits and production deployment remain outside this increment; authenticated UI checks were performed by the implementer.
