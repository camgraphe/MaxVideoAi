# MEAS-01 job journey implementation plan

> Execute inline with superpowers:executing-plans; one independent branch review at the end.

**Goal:** Persist immutable server reservation context for new video/image jobs.
**Architecture:** Authenticated web boundary or validated confirmation actor supplies a separate typed argument. Existing transactional INSERTs own all four fields. An explicit migration precedes runtime; a read-only aggregate distinguishes direct evidence, historical quote evidence and unknown/conflict.
**Tech stack:** Existing TypeScript, PostgreSQL 17 and node:test/tsx; no dependencies.
**Spec:** `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-10-25/growth-measurement-wave-03/{README.md,LOT.md,RECETTE.md,write-read-map.csv}`.

## Constraints

- Isolated branch from current origin/main; no shared Desktop edits.
- No files from PRs #514, #515, #516; no live DB, provider, payment, merge or deployment.
- Four nullable columns, no defaults/backfill; immutable even on legacy rows.
- Actor authorization, wallet transactions, idempotence and rollback remain authoritative.
- No client body/header/referrer authority, no PII or browser analytics changes.
- Audio, included trials, imports and specialized tools remain outside promised coverage.

## Review focus

- Malformed internal context must fail before financial reservation; user fields cannot choose context.
- Legacy quote parser fallback cannot become historical origin proof.
- Repeated/concurrent confirmation across releases retains first context and one charge.
- Failed job INSERT rolls back wallet receipt and prevents provider submission.
- Partial SQL NULL bundles fail; unmigrated collector returns unavailable, not zero activity.

## Task 1: storage and atomic writers

Files: new `frontend/src/server/generations/job-journey-context.ts`, `neon/migrations/81_job_journey_context.sql`; existing bootstrap declaration and initial video/image writers. Tests: `job-journey-context.test.ts`, `job-journey-context-postgres.test.ts`, existing transaction tests.

Interface: readonly `JobJourneyContext`, web/confirmed builders and strict normalizer; optional `journeyContext` on writers. Missing internal argument means unknown/unknown/1 and validated server SHA or null.

- [ ] RED: helper mapping/validation, SQL coherence, legacy immutability and rollback tests.
- [ ] Add migration and CREATE TABLE columns, normalize before financial reservation and insert atomically.
- [ ] GREEN: unit and disposable PostgreSQL tests, including repeat migration and fresh bootstrap.

## Task 2: authenticated boundaries

Files: video/image web routes, execution option transports, `confirm-generation.ts`, `paid-generation-execution.ts`; tests of actual mocked routes and confirmations.

Interface: optional `journeyContext` travels separately from body; required context in `ReservePaidGenerationInput`, built only after quote ownership/actor validation for wallet reservation.

- [ ] RED: forged payloads, same account/all actors/media, legacy quote, duplicate confirmation and ownership denial.
- [ ] Propagate web and actor context; continuations retain stored values.
- [ ] GREEN: acquired route/confirmation/integration tests and synthetic C01–C14.

## Task 3: aggregate and delivery

Files: `docs/engineering/job-journey-context.md`, checked-in SQL and collector, projection PostgreSQL test, scoped receipt.

Interface: read-only collector accepts UTC [start,end) and static admin exclusions; checks required schema, returns aggregate rows or unavailable. Exact user/job raw wallet quote evidence; no OAuth default.

- [ ] RED: C15–C18 projection fixtures, exclusions, bounds, missing schema and unknown/conflict.
- [ ] Implement versioned SQL/collector and migration-first runbook, preserving evidence layers.
- [ ] GREEN: focused financial/consent tests, TypeScript, lint/exposure/diff check and feasible build.
- [ ] Independent review; fix significant findings with regression tests; commit and draft PR, attach to chat.
