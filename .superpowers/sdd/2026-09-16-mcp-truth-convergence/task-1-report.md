# Task 1 Report: Lock Current Production Truth With a Red Contract

## Implementation

Added the contract test `active MCP truth records follow the enabled production boundary` immediately before `directory facts do not outrun checked-in claims or host evidence` in `tests/mcp-legal-support-readiness.test.ts`.

The contract asserts the exact enabled production publication flags and checks that the claims matrix, support runbook, and directory submission records no longer contain known pre-production wording. It also asserts the current fourteen model-visible tools plus one app-only helper wording and the disabled trial state.

Runtime configuration and the checked-in truth documents were not changed.

## Tests and results

Command:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-legal-support-readiness.test.ts
```

Result: expected RED. 14 tests ran; 13 passed and 1 failed. `git diff --check` passed.

## RED evidence

The new contract failed because `docs/marketing/mcp-public-claims-matrix.md` still contains `publicMarketing=false`, `publicIndexing=false`, `Production transport disabled`, and related pre-production wording. The same contract is intended to expose stale wording in the support runbook and directory submission records as those assertions are reached after the first failure is corrected.

## Files changed

- `tests/mcp-legal-support-readiness.test.ts`
- `.superpowers/sdd/2026-09-16-mcp-truth-convergence/task-1-report.md`

## Self-review

- Test name and placement match the task brief.
- Publication object matches `frontend/config/mcp-publication.json` exactly.
- Regex assertions and current-state wording match the brief verbatim.
- No runtime configuration or production document was edited.
- Diff is whitespace-clean.

## Concerns

The focused test is intentionally failing until the follow-up tasks update the stale claims, support, and directory records. No implementation concern beyond that expected red state.
