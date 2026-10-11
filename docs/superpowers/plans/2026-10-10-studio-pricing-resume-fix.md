# Studio pricing and continuation repair

> **For agentic workers:** Use superpowers:executing-plans for this repair, with test-driven-development and a final independent review.

**Goal:** Explain unsupported single-generation comparisons and stop spending additional assistance calls on unchanged failed work during continuation.

**Architecture:** Keep canonical single-output pricing and all requested constraints. Add structured live capability diagnostics to the existing comparison failure. Carry bounded historical failures and model facts across owned task segments; block unchanged failed comparisons while retaining component creation and timeline actions so a montage can advance.

**Tech Stack:** TypeScript, existing Responses director, immutable PostgreSQL conversation receipts, Node test runner and disposable PostgreSQL 17.

**Spec:** The user's 2026-10-10 request in this chat, supported by five recorded `pricing.compare` failures with `durationSec=60`, no prepared media, and 460 included credits consumed.

## Global constraints

- Preserve the requested total duration; never silently price a shorter clip as the whole video.
- Keep exact quotes and human media confirmation; no provider generation or production data writes during validation.
- Preserve immutable receipts, assistance policies, task ceilings, account/project isolation and deleted-project protection.
- Historical facts are data, not instructions or current prices; preparation still validates current capabilities.
- Do not repeat writes or suppress unknown-usage recovery.

## Review focus

- No matches caused by audio/settings/provider failure must not be mislabeled as excessive duration.
- Discrete durations and continuous ranges must remain distinct.
- Continuation must include unsuccessful receipts and bounded capability facts without private media URLs.
- Duplicate failed comparisons must stop without suppressing supported component pricing, quotes or timeline actions.
- Malformed comparison inputs still allow a corrected request; exact quote preparation and recovery remain available.

### Task 1: Actionable comparison diagnostics

**Files:** `frontend/src/server/agent-api/generation-price-comparison.ts`, `tests/generation-price-comparison.test.ts`, `docs/engineering/pricing-engine.md`.

- [x] Add tests for a 60-second request against the real LTX 2.5 Pro capability and for an unrelated mismatch.
- [x] Observe failures, then attach bounded live duration/audio facts to the existing `AgentApiError.nextAction` without changing prices or relaxing constraints.
- [x] Run comparison and Studio/MCP price-contract tests.

### Task 2: Continuation progress and bounded failure handling

**Files:** Studio task execution/worker, new `tasks/previous-work.ts`, conversation director/instructions, regression tests and `docs/engineering/studio-task-budgets.md`.

- [x] Reproduce a fresh unsupported comparison and continuation after a saved failed comparison.
- [x] Retain bounded owned failure/capability evidence and stop repeated unchanged comparisons while permitting component quotes and montage edits.
- [x] Prove no repeated pricing read, no extra continuation loop and no implicit media charge; retain ordinary corrected-input and quote recovery behavior.
- [x] Run focused tests, editor validation, lint/type/exposure checks and the repository validation suite.
- [x] Review the final patch independently, resolve actionable findings and commit the verified branch.

## Execution record

- Baseline: 22 focused pricing/task tests passed before changes.
- Root cause: all five incident comparisons requested one 60-second output. No current candidate matched; a generic error discarded the live duration facts. Continuation passed only successful action names, omitting failures and capability results.
- Ruling: implement directly within the user's repair authorization; no additional design approval is needed for reversible fixes and tests.
- User clarification: Studio must perform the montage with its existing tools, not stop at recommending a montage. Keep those tools available after a comparison mismatch.
- Verification so far: the two new comparison diagnostic tests failed before implementation and then passed; continuation/duplicate-comparison regressions failed before the repair. The 25-test focused pricing/task suite and frontend TypeScript check pass after the fix. An initially incomplete video-preparation test fixture was corrected to include the existing required aspectRatio/source fields.
- Independent review exposed lost duplicate-stop recovery, overblocking corrected prompts/temporary prices and omitted comparison-only mode facts. Each issue was reproduced before repair. Hard suppression now requires proven unsupported duration; paid response recovery checks immutable action receipts and cannot dispatch new Responses. Historical evidence retains safe comparison mode facts and minimal failure identities within its complete 12k-character budget.
- A real PostgreSQL service test assembles six ready 10-second videos plus a ready 60-second narration into the canonical sequence after the impossible comparison, then recovers a deliberately lost duplicate-stop save without another response/action. No generation quote, job or charge is created by that test.
- Follow-up review reproduced a newly available compatible model blocked by stale duration evidence. Shared candidate/duration catalog fingerprints now invalidate that failure before a fresh duplicate is suppressed, while already purchased recovery remains bounded. The user's creative clarification is implemented as variable subject/pacing/continuity guidance; real-capability regressions also cover three 20-second and two 30-second component workflows, without fixing every project to ten-second clips.
- Final review regressions also cover interrupted catalog checks and replay of refreshed prices/errors. A cached unprocessed read can refresh facts, but all subsequent checkpoints are replay-only. Longer duration options survive history bounds, and the eight-model mismatch diagnostic retains the longest component choices first. Independent review found no remaining issue in the recovery/history changes.
- Candidate checks: 51 focused tests pass; TypeScript with incremental caching disabled passes; frontend lint has zero errors and five existing warnings; exposure and diff checks pass. The editor suite passed 1,207 tests with one existing skip. Repository lanes passed 7,133 fast tests, 814 integration tests and 33 browser tests; MCP client checks passed. The earlier all-tests run completed its exhaustive financial tests but failed two oversized-guidance assertions, subsequently repaired and reverified. One isolated MCP/HTTP fixture timed out under concurrent suite load; committed-candidate integration is rechecked separately before handoff. No test assertions, budget limits or timeouts were weakened.
