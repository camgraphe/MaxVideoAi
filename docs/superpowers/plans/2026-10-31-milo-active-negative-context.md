# Milo active negative context implementation plan

> Execute inline under the already approved root handoff; root coordinates independent review and release gates. Use the executing-plans and verification-before-completion workflows proportionately to this single bounded change.

**Goal:** Keep unavailable negative-prompt draft values out of Milo context and suggestion identity without losing them.

**Architecture:** Derive one applicable companion in the shared Composer from its existing prepared `negativePromptField`. Use it at the three current context/identity call sites. Preserve the owning state and all downstream guards.

**Stack:** React, TypeScript, esbuild, JSDOM, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-31-milo-active-negative-context.md`.

## Constraints and review focus

- No live requests or private-state inspection.
- Preserve supported companion bytes and all other companion fields.
- Preserve hard invalidation for supported companion, engine and mode changes.
- Preserve draft state during an unsupported interval and restore its offered input on return.
- Use the prepared schema's mode applicability; do not infer support from model names.
- Preserve legacy empty/absent identities without accepting a former nonempty context as compatible.

## One task: project the owned companion

Files: modify `frontend/components/Composer.tsx`; add `tests/prompt-assistance-negative-context-dom.test.ts`; document the contract in `docs/engineering/prompt-assistance.md`.

- [x] Add synthetic behavior tests using the real Composer and preview hook, with live transport disabled. Assert omission and stable identities for inactive values; exact transmission and invalidation for active values; draft retention and engine/mode guards.
- [x] Run the new file against baseline and record assertion failures for the existing divergence, without accepting setup errors as RED.
- [x] Derive `assistanceNegativePrompt` once: preserve the raw value when offered; otherwise normalize a present string to `''` and keep an absent value `undefined`. Substitute it only at the three Milo context/identity uses. Verify legacy empty/absent keys and the distinct canonical draft of a former nonempty companion.
- [x] Run the new tests and relevant existing context, state, review and architecture checks; record GREEN.
- [x] Run TypeScript, exposure lint, frontend lint, full source build and `git diff --check`; complete author self-review.

Post-commit handoff: record exact base, HEAD/tree, commands, results and limits in the private report for root. Publication remains with root.

## Execution evidence

- Baseline RED: three of five scenarios failed on leaked context, unstable inactive identity and mode-specific inapplicability; supported behavior and draft retention already passed.
- Compatibility RED: projecting an inactive empty string to `undefined` changed a legacy key. The final projection preserves both empty and absent identities; the former nonempty canonical draft remains distinct.
- Initial fast suite found the existing 500-line Composer cap exceeded by one. Folding the single-use placeholder description alias keeps identical presentation and preserves the cap; no assertion was relaxed.
- Final focused run: 86/86. Final fast suite: 10,234 passed, zero failed, one existing authoring-validator skip. TypeScript, exposure and full build passed (990 static pages); lint had zero errors and seven pre-existing warnings.
- Author self-review complete; root owns the independent review, publication, exact-HEAD CI/Preview and delivery. No live semantic quality or private-state occurrence is claimed.

## CI fixture follow-up after d1fef7f

- The pending-review browser test reproduced the CI failure: its original companion case did not offer the field, so its hard-invalidation expectation contradicted the approved inactive-companion contract. A disposable PostgreSQL probe identified that failed case's unfinished request as the blocker of the next case; no product guard change was needed.
- The reload fixture now supplies the negative field from the prepared schema. Keep the original inactive case and add an offered Wan 2.6 case edited through its visible input, observing persistence and compatibility between changes and after return. Keep the optional historical preflight comparison for all original scenarios; exclude only the explicitly added different-engine scenario.
- A subcase cleanup hook targets only unfinished request identities that it successfully claimed. A deliberate failing probe preserved the first assertion failure while the next case passed without a blocker; terminal history and financial rows are untouched.
- Final follow-up validation: 66/66 across all three reload-fixture consumers and related guard tests, TypeScript/exposure/diff checks passed, frontend lint retained its seven existing warnings. The product frontend tree is unchanged from d1fef7f; its earlier build/fast results above are not presented as a new-HEAD CI run.
