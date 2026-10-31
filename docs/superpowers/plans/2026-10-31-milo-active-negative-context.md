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
