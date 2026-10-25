# MEAS-01 delivery receipt — 25 October 2026

Draft candidate only. No merge, deployment, live migration, production read, real
payment, generation or provider/storage/Auth operation was performed.

## Candidate and scope

- Branch: `codex/meas01-job-journey`, isolated native Codex worktree.
- Main/base: `4c35aaf1e18715d0d3c0d84ae96d056728cd55a4`; fetched again before delivery.
- Independently reviewed implementation: `1c1763dcf7fc87bf53079f9439d7a921d33915bb`.
- Post-review changes: migration procedure ordering, fixture whitespace, completed
  plan checkboxes and additional direct consent/no-network assertions. No runtime change.
- The PR head supplies the final delivery SHA (this receipt cannot include its own
  commit hash). Product contract: [job-journey-context.md](../engineering/job-journey-context.md).
- Aggregate SQL: [job-journey-origin-coverage-v1.sql](../analytics/job-journey-origin-coverage-v1.sql).
- PR #514 checked at `4f5ad6b00410d740fda8aa7a61b1bc22485de157`, #515 at
  `e010490222d9d741ba0c092f778db69a8c62ebdf`, #516 at
  `592da0743ee0aec1c7149ed995c755a3f1a2e8a7`: all open, no file overlap.
  Their product work, Desktop checkout, historical CSVs and shared roadmap/evidence
  were left untouched.

## Executed synthetic evidence

Frozen lockfile install in this worktree, Node 22.23.4, Next 15.5.25 and disposable
PostgreSQL 17 from the repository resolver. Initial shared node_modules were older;
those preliminary runs were superseded by the isolated final validation below.

| Check | Result |
| --- | --- |
| Combined targeted suite below | 142 passed, 0 failed, 0 skipped |
| `pnpm --prefix frontend exec tsc --noEmit` | Passed |
| `npm --prefix frontend run lint` | 0 errors; 7 preexisting warnings in untouched files |
| `npm run lint:exposure` | Passed |
| Candidate-range `git diff --check` | Passed after fixture whitespace correction |
| `pnpm --prefix frontend run build` with DATABASE_URL and DATABASE_URL_UNPOOLED removed | Passed, including prebuild, 970 static pages and next-sitemap |
| Independent fresh-context review | No Critical/Important product findings; two delivery cleanups addressed |

The combined command is `node scripts/run-postgres-tests.mjs pnpm exec tsx
--tsconfig frontend/tsconfig.json --test` with these files:

```text
tests/job-journey-context.test.ts
tests/job-journey-context-postgres.test.ts
tests/job-journey-confirmation-postgres.test.ts
tests/job-journey-web-boundaries.test.ts
tests/job-journey-origin-projection-postgres.test.ts
tests/generation-initial-job-transaction.test.ts
tests/mcp-confirm-generation.test.ts
tests/mcp-confirm-generation-concurrency.test.ts
tests/integration/mcp-paid-generation.test.ts
tests/generate-route-context.test.ts
tests/analytics-consent.test.ts
tests/analytics-role-lifecycle.test.ts
tests/generate-initial-video-job-architecture.test.ts
tests/image-generation-server-architecture.test.ts
tests/video-generation-service-parity.test.ts
tests/image-generation-service-parity.test.ts
tests/customer-tariff-initial-job-postgres.test.ts
tests/mcp-trial-confirmation.test.ts
tests/toolbox-generation-scope-postgres.test.ts
tests/image-generation-paid-recovery-postgres.test.ts
```

C01–C18 cover mapping/SHA/validation; strict bundles, migration replay and fresh
bootstrap; immutable legacy/current contexts; wallet races and INSERT/missing-schema
rollback; both real web adapters with forged inputs and denied auth; same account
on three confirmed actors and both media; wrong user/client/project/origin; duplicate
confirmations and release A/B recovery; exact aggregate evidence, conflicts/nulls,
READ ONLY, admin/flag exclusions, cutoff equalities and unavailable schema; and
consent refused/granted with identical context and no boundary network request.
The 98 documentary checks in the external handoff were not counted as product tests.

## Decisions and review dispositions

- Executed the supplied approved LOT inline with one independent final reviewer.
- Explicit unknown v1 stays direct unknown. Only all-NULL context can use historical
  raw quote evidence. This intentionally favors lower coverage over invented origin.
- NULL media and included MCP trials are explicitly out_of_scope in the aggregate;
  specialized products, audio and imports remain outside promised instrumentation.
- Legacy quote parser fallback is tested at the authenticated injected dependency.
  Current SQL refuses raw NULL origins; no authorization predicate was weakened.
  Such quotes remain unconfirmable through that SQL gate.
- The acquired integration fixture was stale relative to base main: tool inventory,
  audio publication flag and two synthetic reference hosts were aligned with already
  published behavior. All financial assertions and auth/reference gates remain.
- The proposed ProcessEnv Pick type required a property not declared by Node's index
  signature; an explicit optional SHA environment type and default server snapshot
  preserve the narrow contract without casts.
- Review's two P3 items were required delivery fixes: the whole branch must pass the
  whitespace check, and the documented existing-definition preflight must occur
  before the migration replaces trigger/function definitions. No runtime fix was needed.
- Live schema state/locking duration, domain alignment, deployed SHA and coverage
  start were deliberately not judged. Provider/payment/storage evidence is synthetic.
  No deferred product correctness finding remains; seven unrelated lint warnings remain.

## Migration and CI state

`81_job_journey_context.sql` is prepared and tested, **not applied live**. Existing
schema needs this explicit migration before the new runtime on either host. Future
operators must check drift before mutation and rehearse locking, as documented.
Rollback application code while retaining nullable columns, CHECK and immutability;
no historical backfill, context clearing or paid job replay.

Repository policy selects **Fast checks + Database/media integration + Browser +
Exhaustive financial cutovers** for this branch. Remote Quality CI begins on the
PR push; its check surface is the authoritative current state. This receipt does
not claim a remote CI pass or a completed exhaustive/browser lane. No selection
rule, skip marker or branch protection was changed. Required CI must pass on the
latest candidate before any separately authorized merge.

Actual production coverage start is **unset for every boundary**. Runtime SHA and
future UTC coverage starts must be established only after an authorized migration,
Git deployment and verification of both public/API hosts. No production analytics
query was run, and a local synthetic pass proves no historical acquisition or live
first-use/completion measurement.
