# Compact Milo prompt preview implementation plan

> Execute inline in the isolated follow-up branch.

**Goal:** Make Milo's prepared prompt visible within the existing 53 px bar.

**Architecture:** Add a truncated clickable excerpt to the shared assistance
panel and update its review button and localized labels. Reuse the current
expanded review state, editor and guarded Apply callback.

**Tech stack:** React, CSS modules, Lucide, existing Playwright component fixtures.

**Spec:** `docs/superpowers/specs/2026-10-30-milo-prompt-preview-design.md`.

## Constraints and review focus

- Preserve 53 px, the review surface, full editable text and apply/stale guards.
- Check long/multiline suggestions, narrow FR/ES controls, touch targets,
  script/lyrics labels, and editing/back navigation without geometry shifts.
- Browser plugin not available; use the repository's Playwright fixtures.
- Native worktree creation cannot target the product from this OUTREACH chat;
  use an ignored product-local Git worktree, isolated from PR #563.

## Task: shared proposal bar

- [x] Extend the existing rendered layout coverage to expose the missing excerpt
  and assert stable height, ellipsis and review/apply behavior; observe failure.
- [x] Update `PromptAssistancePanel.client.tsx`, `prompt-assistance.module.css`
  and `prompt-assistance-copy.ts`. Update two existing Review locators.
- [ ] Run focused DOM/browser coverage, TypeScript, lint and public exposure.
  Inspect desktop/mobile screenshots and review the diff.
- [ ] Commit and open a separate follow-up PR. Incorporate #563 and current main
  before delivery and follow the repository's GitHub/Vercel checks.

## Verification so far

- Existing DOM baseline passed. New excerpt assertion failed before implementation.
- Touch-target assertion exposed the 34 px icon; fixed to 44 px and rerun green.
- 12 focused DOM/browser tests pass, including Chromium/WebKit input coverage.
- Real-composer QA: EN/FR/ES at 320/390/1440 px; 53 px bar, ellipsis, no overlap,
  unchanged review geometry, no generation, and no browser runtime errors.
- TypeScript and public exposure pass. ESLint: zero errors, seven unrelated
  existing warnings. Browser plugin absent; used repository Playwright fixtures.
