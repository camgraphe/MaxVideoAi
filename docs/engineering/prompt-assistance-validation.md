# First live Milo connection — validation, 2026-10-29

Draft PR #555, branch `codex/prompt-director-composer`. The implementation is opt-in; these results do not authorize rollout or establish live model quality.

## Passing checks

| Check | Result and scope |
| --- | --- |
| `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-*.test.ts tests/studio-assistance-credits-postgres.test.ts tests/studio-assistance-resolution-postgres.test.ts` | **44 passed**, including final recovery/output fixes. Context ownership, live transport, production live-flag UI with intercepted HTTP, clarification, stale proposals, account changes, existing credit funding and support recovery. |
| Live PostgreSQL + Eleven voice + home-price demo + video-excerpt browser tests | **5 passed** after fixture corrections. Shared CSS modules are bundled, audio has the framework environment shim, and existing playback/excerpt focus behavior remains covered. This overlaps the preceding ledger check; counts are not additive. |
| `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json` | Passed after final source edits. |
| Full frontend lint, then scoped lint after final edits | No errors. Full lint reports seven existing warnings in other files. |
| `pnpm lint:exposure` and `git diff --check` | Passed. |
| Connected Studio analysis and mobile browser files | Passed in a clean clone without local environment files. |
| Connected Studio conversation and export-quote browser files | Passed on isolated replay. Initial clean replay hit request/page timeouts; no product timeout changes were made to force a pass. |
| Connected Studio task browser plus MCP route, montage browser, montage HTTP and route integration files | **7 passed**, serially, with cookie/bearer ownership, confirmation, recovery, missing-schema failure and desktop/mobile coverage. |

Studio integration replays used a clean snapshot at `762049d66`, with disposable PostgreSQL 17 and local provider fixtures. The later composer recovery/output fixes are covered by the final 44-test run above. There were no real paid provider calls. Browser fixtures are not a substitute for physical-device keyboard/zoom checks.

## Full-run outcome and follow-up

The initial `pnpm test:validate` run finished **11,071 checks: 11,057 passed, 10 failed, 4 skipped**. It is not reported as a green full-suite run.

- Five Studio browser failures came from the deliberate guard against `.env` files in the working checkout. Those flows passed in the clean snapshot.
- Home-price and video-excerpt standalone browser bundles needed CSS-module outputs after the composer imports changed. The audio audition fixture needed the framework `process.env` definition. All three were corrected and passed, without relaxing assertions about product behavior.
- The command-bar fixture expected switching operations to leave AI assistant. That contradicted the user's accepted mode-preservation behavior; the assertion now expects AI assistant to stay selected and passes.
- The exhaustive initial-tariff test rejected a changed code/database/environment binding. It captures `git rev-parse HEAD`, and this checkout advanced commits during its long run. The stable-snapshot replay passed: 27,071 canonical quote checkpoints, atomic activation and rollback, seven tariff reads. No pricing code or financial assertion was weakened.

`npm run qa:editor` also ran: **1,443 passed, 1 failed, 1 skipped**; the failure was the same local-environment guard for the mobile Studio browser test. That test passed in the clean snapshot. TypeScript/lint were run separately because the combined command stopped at the test failure.

All failures observed in that initial run were corrected or passed on isolated replay. The full command was not rerun as a single green run. Required CI on the final pushed revision remains the merge gate. A full production build was not repeated for this increment; earlier UI-build results are historical, not evidence for the new server path.

## Independent review and documentation audit

The final independent review found no Critical issue and one Important issue: an unknown provider outcome could be waived while the composer lease was still active. The fix preserves the active state for inspection and checks lease expiry atomically on close. Its regression failed before the fix, then passed with active blocking, expired release, repeated support resolution and late supplier evidence.

New service feedback/credits labels remain English by user request; FR/ES translation is deferred. The reviewer did not certify paid supplier quality, shared migration/activation, previously approved visual design decisions, full persistent chat history or dedicated subject/keyframe metadata. Those remain explicit scope or release limits.

The [official-documentation audit](prompt-assistance-practices.md) additionally led to distinct refusal, incomplete and oversized-output handling. Tests verify that these outcomes expose no applicable proposal, settle known usage and do not issue another provider call on replay.

## Still required before activation

1. Apply the explicit migration in the intended controlled environment and configure the two live flags and existing approved assistance policy.
2. Run an agreed paid evaluation of creative quality, long-prompt completion, latency and actual costs for Standard and Max.
3. Qualify physical mobile keyboards/zoom, complete service localization for the intended rollout, and define retained-conversation/evidence deletion policy.
4. Pass required CI and release review. No merge, deployment or shared migration was performed here.
