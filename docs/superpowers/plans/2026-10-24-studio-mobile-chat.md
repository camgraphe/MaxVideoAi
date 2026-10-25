# Studio mobile chat implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this task in this session.

**Goal:** Give the mobile conversation most of the visible screen with one-tap references, preserving desktop.

**Architecture:** Scope the shell and compact controls to the authenticated conversation below 768px. Reuse the owned media shelf, assistance dialog and timeline; mobile panels overlay the chat and restore focus on close. Keep quote, generation and billing owners unchanged.

**Tech Stack:** Next.js, React, CSS modules, native dialog, connected Playwright/PostgreSQL fixture.

**Spec:** User-approved design in this chat on 2026-10-24: one compact header, references by the composer, compact composer and mode selector, on-demand montage, navigation in the app menu, compact completion status and latest-message control.

## Global constraints

- Desktop remains visually and functionally unchanged at 768px and above.
- References retain original identities, account scope, attachment persistence and preview permissions.
- Opening controls never submits generation, changes the assistant or spends credits.
- Keep explicit quotes, errors, reserved credits and recovery actions visible.
- Preserve accessible names, Escape, focus restoration, 44px mobile targets and 16px input text.

## Review focus

- Long conversations keep their reading position when panels open or close.
- Three or more references remain selectable, removable and previewable with the keyboard open.
- Switching between mobile and desktop does not leave a modal or hidden playing media.
- Account/project navigation clears temporary panel state and viewport listeners.
- Empty, pending and failed conversations keep all essential actions reachable.

### Task 1: Compact mobile conversation

**Files:** conversation page and route-local shell, media panel, assistance control, task status and stylesheet; connected Studio browser tests; Studio architecture guide.

**Interfaces:** Consume existing shelf selection/attachment callbacks and timeline props. Add only mobile presentation state and a scoped visual-viewport shell.

- [x] Add a connected browser regression with a long conversation and three owned references; assert at least 60% of a 390×844 viewport for the log, one-tap references, focus restoration, navigation and no overflow.
- [x] Run against the baseline and retain the failing geometry and screenshot.
- [x] Implement the mobile shell and reusable overlay controls; desktop rendering stays intact.
- [x] Update existing connected tests for the deliberate mobile interactions; add short viewport and desktop parity checks.
- [x] Run focused browser verification on Chromium and WebKit, inspect screenshots, then run qa:editor, lint:exposure and test:editor:e2e.
- [x] Document ownership and verified limits. Commit the candidate for immutable runtime checks and fresh review.

## Execution notes

User explicitly approved implementation; continue without another plan approval. Worktree created with the native app tool from origin/main at 5030bb6a6.

## Verification — 2026-10-25

- Product candidate: `c08a2f5b8`; final browser expectation update: `6fb92f9ab`.
- With the same loaded three-reference/two-clip fixture at 390×844, the conversation grew from 164.5px to 683px (80.9% of the viewport).
- Desktop header, history, input, media shelf and timeline bounds match baseline `5030bb6a6` exactly at 1440×900.
- `npm run qa:editor`: passed (1,398 tests passed, one existing skip, zero failures), including TypeScript, lint and diff validation. `npm run lint:exposure`: passed.
- Focused connected mobile regression: passed on Chromium and WebKit, including references, selected-image visibility, attachment removal, focus restoration, scroll preservation, multiline input, short screens and simulated visual-viewport height/offset changes.
- Fresh review identified a retained timeline insertion being replayed after a breakpoint remount. The regression failed with four clips instead of three, then passed on both engines after preserving component identity; no additional timeline writes occur on resize.
- `npm run test:editor:e2e`: completed all 37 browser files (59 cases). 57 passed; two montage recovery cases used the old directly-visible mobile timeline control. Their test flow now opens Film tools. Both cases and the connected conversation passed on focused rerun (3/3); no unresolved failures remain.
- Local screenshots and geometry: `output/playwright/studio-mobile-chat/` (ignored proof artifacts).
- Physical iPhone Safari keyboard behavior remains a device check; WebKit plus visual-viewport emulation is the available local coverage. No production deployment was performed.
