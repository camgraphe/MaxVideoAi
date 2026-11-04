# Milo Inline Analysis Implementation Plan

> **For agentic workers:** Use the approved parallel execution: independent provider transport and credit guidance repairs; parent owns UI and integration; a protocol worker owns server/shared response changes.

**Goal:** Make reference analysis actionable from the chat and repair the diagnosed delivery/feedback failures.

**Architecture:** Keep existing analysis service, credit ledger and durable browser recovery. Add a versioned structured recommendation and render the existing confirmation lifecycle inside the transcript.

**Tech Stack:** Next.js, React, TypeScript, existing PostgreSQL ledger, node:test and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-milo-inline-analysis-design.md`

## Global constraints

No automatic paid analysis or writing continuation. No public private-media exposure. No financial policy changes. GitHub delivery only; preserve concurrent main changes.

## Review focus

- A reference is replaced at the same slot before clicking the recommendation.
- A quote expires while its confirmation remains visible.
- Reload or a lost response occurs immediately after confirmation.
- A customer has unsent text when analysis completes.
- A customer changes workflow, account or chat while an analysis is pending.

## Task 1: Versioned recommendation

- [ ] Add failing protocol tests for a validated recommendation and old response decoding.
- [ ] Extend private response protocol, durable version selection and public optional action. Validate current field/slot/modality/interval before exposing it.
- [ ] Carry the action through public result, history and chat state without changing replacement semantics.
- [ ] Verify unknown versions, invalid references and legacy recovery; commit owned files.

## Task 2: Inline analysis lifecycle

Files: `PromptReferenceAnalysis.client.tsx`, its CSS, `PromptAssistancePanel.client.tsx`, `PromptAssistanceComposer.client.tsx`, perception browser tests.

- [ ] Add a failing browser test requiring the analysis surface inside the transcript and no dialog.
- [ ] Render one analysis owner in the transcript; retain a compact entry action when closed. Accept an optional validated recommendation.
- [ ] Retain explicit quote/confirm, stale-context guard, durable polling and recovery. Offer explicit continuation without replacing unsent text.
- [ ] Test reference replacement, expiration, reload, workflow/account scope, Lite and mobile layout; commit.

## Task 3: Independent repairs

- [ ] Provider worker proves private audio failure, adds authorized transport signing and distinct inaccessible-reference feedback, tests privacy and canonical persistence.
- [ ] Feedback worker explains remaining vs reserved credits with explicit next actions; supplies account support destination; verifies no automatic financial action.
- [ ] Review and integrate their commits; run focused combined checks and TypeScript.

## Task 4: Delivery

- [ ] Independent review; address findings and update engineering documentation.
- [ ] Push a reviewable GitHub candidate; wait for all selected Quality CI checks.
- [ ] Qualify exact READY Git Preview with `deployment:check --preview` and exercise affected UI.
- [ ] Fetch current main, incorporate any concurrent delivery, revalidate candidate and run premerge production alignment.
- [ ] Merge through GitHub; verify both domains at the merge SHA and affected interface. Report confirmed results and limits.
