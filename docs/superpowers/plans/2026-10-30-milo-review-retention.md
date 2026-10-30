# Milo review retention implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Continue the current inline implementation and fresh final review workflow.

**Goal:** Enforce the user's 90-day internal review-context policy without deleting workspace history or operational/financial evidence.

**Architecture:** Expire shared review reads against the database clock and remove only review-only snapshots/notes with a bounded authenticated hourly job. Extend immutable guards with an exact age-qualified removal exception; never use a general bypass.

**Tech Stack:** Existing Next.js/TypeScript, PostgreSQL 17, Vercel cron and node:test.

**Spec:** `docs/superpowers/specs/2026-10-29-milo-review-retention-design.md`.

## Global Constraints

- 90 elapsed days from immutable creation; no extension on reading/retry.
- Only composer `context_json.reviewInput`, Studio `review_context_json` and expired annotation note text are physically removed.
- Original input/reply/provider evidence, recovery settings, creations, financial rows, access audits and verdict/issue metadata remain unchanged.
- Remain in PR #555. No production migration, configuration, merge or cleanup.
- Customer copy distinguishes review snapshots from original history and provider retention; no anonymization or legal-certification claim.

## Review Focus

- An old unresolved provider operation must still settle/recover after review-only cleanup.
- Cleanup racing with reveal/annotation must not expose aged content or silently recreate snapshots.
- Duplicate source IDs across owners, projects or sessions must not cross scopes.
- A reader at exactly 90 days must refuse access before the next cron runs.
- Missing schema/secret, partial batches and an old client retry must fail clearly without deleting other data.

### Task 1: Enforce and qualify review retention

**Files:**
- Create `neon/migrations/91_assistant_review_retention.sql`.
- Create `frontend/server/admin-assistant-review/retention.ts`.
- Create `frontend/app/api/cron/assistant-review-retention/route.ts`.
- Modify `frontend/server/admin-assistant-review/{read-model,contracts}.ts`, `frontend/vercel.json`.
- Modify `frontend/app/(core)/admin/assistants/_components/AssistantReview.client.tsx`.
- Tests `tests/assistant-review-retention-postgres.test.ts`, `tests/assistant-review-retention-route.test.ts`, `tests/admin-assistant-review-dom.test.ts`, existing shared-review and live-composer suites.

**Interfaces:**
- `cleanupAssistantReviewContext({limit?,dryRun?})` returns aggregate `{dryRun,composer,studio,notes,hasMore}`. Default limit 100, maximum 500 per table; reject invalid bounds. Use existing `withDbTransaction`; no raw content returned.
- `assertAssistantReviewActive(tx,createdAt)` rejects expired sources with `AssistantReviewError('review_expired',410)` using the database clock. Called under existing source locks before reveal/audit/annotation.
- `handleAssistantReviewRetentionCron(req,{env?,run?})` requires a nonempty configured secret and existing `authorizeCronRequest`; authenticated failures return generic 503. No configurable public target or cutoff. Successful responses contain aggregate counts only.

- [ ] Add PostgreSQL regressions for 89-day/90-day snapshots, dry-run, bounded/repeated/concurrent batches, scoped duplicate IDs, expired reveal/annotation, note expiration and preservation of all non-target columns. Include attempts to replace before expiry or repopulate after expiry. Exercise migration 90→91 and reapplication of 91.
- [ ] Run the new PostgreSQL suite. Expected: FAIL because retention behavior is absent.
- [ ] Implement the exact-removal guards in migration 91, with partial indexes on eligible snapshot/note creation times. Timestamp/identity changes remain rejected. Existing access-audit immutability remains intact.
- [ ] Implement cleanup using CTE row selection, `FOR UPDATE SKIP LOCKED`, fixed 90-day predicates and exact composite key joins. Set bounded statement/lock timeouts. Dry-run uses selects only. `hasMore` reflects still-eligible entries.
- [ ] Add the locked read boundary and distinct expired client message. Clear already displayed detail/note when an action returns 410. Do not display raw backend errors.
- [ ] Add cron auth/success/failure tests, observe RED, implement the handler and schedule at minute 19 every hour. Missing or incorrect auth must never invoke cleanup.
- [ ] Extend real composer PostgreSQL coverage to verify preserved replay/recovery input and supplier evidence after review cleanup; add DOM expiry coverage and observe it fail before the UI correction.
- [ ] Run `node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-concurrency=1 tests/assistant-review-retention-postgres.test.ts tests/assistant-review-retention-route.test.ts tests/admin-assistant-review-postgres.test.ts tests/admin-assistant-review-route.test.ts tests/admin-assistant-review-dom.test.ts tests/prompt-assistance-live-postgres.test.ts`. Expected: all pass, no skipped new retention tests.
- [ ] Commit the scoped implementation/tests and design/plan.

### Task 2: Explain and qualify the policy for release

**Files:**
- Modify `frontend/app/(core)/legal/privacy/_components/PrivacyArticle{En,Fr,Es}.tsx` and the current legal version owner as required by actual ownership.
- Modify `frontend/app/(core)/legal/subprocessors/_lib/subprocessors-copy.ts` and `frontend/app/(localized)/[locale]/(marketing)/ai-video-prompt-generator/_lib/milo-copy.ts`.
- Update `docs/engineering/assistant-review.md`, migration README and `docs/marketing/milo-launch-delivery-2026-10-29.md`.
- Test `tests/milo-review-retention-copy.test.ts` plus affected legal/marketing contracts.

**Interfaces:**
- Consumes Task 1's fixed 90-day access limit, hourly cleanup, original-source preservation and new migration 91.
- Produces localized factual customer explanations and ordered, target-specific migration/activation instructions, with no backend model names in tier marketing.

- [ ] Explain authorized human quality review, review-context expiry and hourly deletion. Distinguish saved original conversations/media/billing and provider policies. Include Milo generators alongside Studio in the provider description.
- [ ] Check the current legal-version source before updating it; do not change production `legal_documents` or accepted consents. Record any required publication step explicitly.
- [ ] Verify EN/FR/ES meaning and matching FAQ/schema output with focused tests; run TypeScript, exposure, lint and diff checks. Expected: no new errors/warnings.
- [ ] Reconfirm isolated Neon branch identity `test/milo-pr555-live-20261029` (`br-tiny-base-aeohobbn`), inspect schema, apply only pending migrations 90 and 91 in order to that QA target using the exact reviewed SQL. Verify signatures/indexes and unchanged native counts. Run read-only dry-run; no broad hosted cleanup or synthetic backdating of customer rows.
- [ ] Obtain fresh focused independent review of this increment and its effect on recovery/financial guards; address consequential findings with regressions.
- [ ] Commit and push only this branch. Update PR #555 with the selected policy and evidence, and qualify the new candidate with required CI and exact Preview admission. Earlier successful CI belongs to `f175c2941` only.

The selected 90-day scope and continuation request authorize this bounded implementation. Builder choices are recorded above; production delivery remains a separate final action. The design builder check reported no important unanswered question.
