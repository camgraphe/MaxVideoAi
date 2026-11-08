# Milo Lite output headroom implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline and request an independent review before delivery.

**Goal:** Let new Lite requests finish their reasoning and visible answer within a larger, explicitly reserved output allowance.

**Architecture:** Version the shared runtime and task profile. New Luna requests retain high reasoning with 32,000 total output tokens; Standard/Max retain 6,000. Historical runtime/task snapshots remain authoritative. An explicit additive migration extends only validated, owned Luna policies; no automatic retry, model switch, tariff or customer-budget increase.

**Tech Stack:** TypeScript, Responses API, PostgreSQL 17.

**Spec:** User request of 8 November 2026, plus the recorded Luna failures that consumed the entire 6,000-token output bound in reasoning.

## Global constraints

- Preserve model/effort, request identity, maximum calls, customer-credit ceilings and exact usage settlement.
- Reserve the actual frozen provider ceiling before dispatch. Old reservations retain 2,200/6,000-token bounds.
- New policy dispatch requires its explicit migration. No DDL at request time.
- Partial, refused and malformed provider output remains unusable; no silent truncation or automatic paid retry.

## Review focus

- Composer and Studio must send the same new Lite bound.
- Historical v1–v3 tasks and runtime v1 must not expand on replay.
- Forged model, runtime, bounds, ownership and leases must fail closed in PostgreSQL.
- Usage above 6,000 must settle once; replay must not call the provider or charge twice.
- Standard/Max and existing sponsored fallback keep their frozen policy.

## Task 1: Version and enforce the Lite allowance

- [x] Add failing runtime and real PostgreSQL regressions for 32,000-token Lite requests and old snapshots.
- [x] Update the runtime/task owners, readiness checks and provider reservation validation; add migration 96 and current-schema fixtures.
- [x] Exercise composer settlement with >6,000 output tokens, replay, isolation and unchanged credits.
- [ ] Update operating docs; run focused tests, Studio/composer suites, lint, exposure, TypeScript and build.
- [ ] Obtain independent review; qualify a bounded real Luna response if existing credentials are available.
- [ ] Publish through PR and required CI, apply the reviewed pending migration, merge and verify both production domains.
