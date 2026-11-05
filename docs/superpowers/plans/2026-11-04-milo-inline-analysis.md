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

- [x] Add failing protocol tests for a validated recommendation and old response decoding.
- [x] Extend private response protocol, durable version selection and public optional action. Validate current field/slot/modality/interval before exposing it.
- [x] Carry the action through public result, history and chat state without changing replacement semantics.
- [x] Verify unknown versions, invalid references and legacy recovery; commit owned files.

## Task 2: Inline analysis lifecycle

Files: `PromptReferenceAnalysis.client.tsx`, its CSS, `PromptAssistancePanel.client.tsx`, `PromptAssistanceComposer.client.tsx`, perception browser tests.

- [x] Add a failing browser test requiring the analysis surface inside the transcript and no dialog.
- [x] Render one analysis owner in the transcript; retain a compact entry action when closed. Accept an optional validated recommendation.
- [x] Retain explicit quote/confirm, stale-context guard, durable polling and recovery. Offer explicit continuation without replacing unsent text.
- [x] Test reference replacement, expiration, reload, workflow/account scope, Lite and mobile layout; commit.

## Task 3: Independent repairs

- [x] Provider worker proves private audio failure, adds authorized transport signing and distinct inaccessible-reference feedback, tests privacy and canonical persistence.
- [x] Feedback worker explains remaining vs reserved credits with explicit next actions; supplies account support destination; verifies no automatic financial action.
- [x] Review and integrate their commits; run focused combined checks and TypeScript.

## Task 4: Delivery

- [x] Independent review; address findings and update engineering documentation.
- [ ] Push a reviewable GitHub candidate; wait for all selected Quality CI checks.
- [ ] Qualify exact READY Git Preview with `deployment:check --preview` and exercise affected UI.
- [ ] Fetch current main, incorporate any concurrent delivery, revalidate candidate and run premerge production alignment.
- [ ] Merge through GitHub; verify both domains at the merge SHA and affected interface. Report confirmed results and limits.

## Execution evidence before PR

- Protocol/shared commit: `01165d06c`; 80 protocol/PostgreSQL checks and 49 expanded units passed.
- Integrated UI/media/credit verification: 65 tests passed; TypeScript and exposure passed. Browser verification covers Chromium/WebKit workflow stability.
- Independent reviews found two issues: a recovered analysis was reset by a historical recommendation, and a pre-dispatch signing outage incorrectly retained a trial reservation. Both were reproduced before correction and covered by regression tests.
- Ruling: continuation fills only an empty message field and requires the existing Send action. This preserves unsent instructions and explicit consent for writing usage.
- Ruling: quoted/completed cards collapse excerpt controls to keep the cost and actions readable in the existing transcript height; Change excerpt restores editing before a new estimate.
- No model/runtime/creative-length change: the observed long reply completed; no separate repeatable latency defect was established. The inline action addresses the avoidable clarification loop.
- Lint has zero errors and seven pre-existing warnings in unrelated files. No paid provider calls or customer data mutations were used for qualification.

## Final candidate refinements

- Capability negotiation keeps the existing strict public reply/history shapes for clients opened before this release. New clients explicitly advertise inline analysis; stored results and the versioned provider protocol remain unchanged. Route/PostgreSQL and browser header tests cover both generations of clients.
- Known pre-dispatch funding rejection on analysis confirmation retains the quote and exposes Milo settings without leaving the chat locked. Lost acknowledgement and unknown server outcomes retain the existing recovery lock. Five browser flows and TypeScript passed.
- Initial full CI identified two obsolete provider-response fixtures in the browser advice and output-length/refund suites. These fixtures must use the new strict provider version while preserving their original apply/Undo and settlement assertions; the latest candidate remains gated on the complete selected Quality CI.
