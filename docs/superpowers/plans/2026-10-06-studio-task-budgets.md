# Studio Task Budgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Finish bounded creative tasks with explicit assistance ceilings, durable memory and safe continuation.
**Architecture:** Keep current assistance credits and canonical action journals. Add a versioned task resource policy, queue/worker and private authored memory. UI enqueues tasks and reads status; only the worker dispatches model calls.
**Tech Stack:** Next.js/React, TypeScript/Zod, PostgreSQL 17, existing OpenAI SDK/CLI runtime.
**Spec:** `docs/superpowers/specs/2026-10-06-studio-task-budgets-design.md`

## Global Constraints

- Existing isolated branch; no production activation, migration or paid probe.
- Existing credential and unchanged v1/v2 retail rates, monthly 500 credits and pack prices.
- Profiles: quick 100 credits/2 calls/2200 output/12000 input/180 seconds; standard 250/4/2200/24000/300; complex 500/8/6000/48000/600.
- Complex explicitly confirmed on Sol. One active task per account.
- Maximum 24 calls/2000 approved credits after explicit revisioned approvals.
- Shared campaign/account/credit locks and frozen existing journal recovery; no unknown retries.
- Generation/analysis/export confirmations remain distinct; no post-delivery work.
- Exact authored memory plus bounded retrieval; no hidden summary/embedding charge.

## Review Focus

- A late provider reply after another worker examines an expired lease must retain known usage without a second dispatch.
- Enqueue/approval/dispatch concurrent with model selection, account restriction or project deletion must preserve the frozen model and permission checks.
- Changing feature activation or an old tariff must not strand saved settled outputs or relax old message limits.
- Replay of completed edits/preparations during continuation must neither mutate nor reserve again; a delivered quote must never resume.
- Old client instructions outside the recent window must be available without crossing accounts, obeying current-context bounds and treating media/text as data.

### Task 1: Pure policy and client wire contracts

**Files:** `frontend/src/lib/studio/task-budget-contract.ts`, image-conversation contract; `tests/studio-task-budget-contract.test.ts`.
**Interfaces:** `studioTaskSelectionSchema`, `studioTaskResumeSchema`, `studioTaskStatusSchema`, `STUDIO_TASK_PROFILES`, `STUDIO_TASK_POLICY_VERSION`.

- [ ] Write RED tests for exact profile ceilings/confirmation, Lua complex rejection, strict resumes and safe status projection.
- [ ] Run focused test (Expected: missing module/exports).
- [ ] Implement pure versioned profiles, strict DTOs and optional task fields on existing wire contracts; legacy payloads remain valid.
- [ ] Run focused tests and existing image contracts (Expected: pass); commit.

### Task 2: Owned queue, frozen budgets and shared-credit enforcement

**Files:** migration 65; `frontend/src/server/studio/tasks/{policy,repository,service,budget}.ts`; assistance ledger/provider bounds; `tests/studio-task-budget-postgres.test.ts`.
**Interfaces:** `createStudioTaskService(actor,dependencies)` → enqueue/read/resume; owned `readStudioTaskBudget`; `enforceStudioTaskReservation`.

- [ ] Write/run RED PostgreSQL tests for zero-dispatch enqueue, frozen model, credit cap, missing/foreign expanded-slot authority, paused paid packs, 20/60 limits, duplicate approvals and project/account races.
- [ ] Implement explicit schema/identity triggers and readiness reads; reuse assistance turn/call/credit owners for quotes and budget checks. Preserve legacy 4/2200 defaults.
- [ ] Implement revisioned approvals and active-account serialization; confirm complex and cumulative maximum before enqueue/resume.
- [ ] Run task and legacy credit/recovery tests (Expected: pass); commit.

### Task 3: Durable worker, adaptive director and exact memory

**Files:** `frontend/src/server/studio/tasks/{worker,memory}.ts`, worker CLI; conversation director/run/repository/service hooks; `tests/studio-task-worker-postgres.test.ts`, `tests/studio-task-memory-postgres.test.ts`.
**Interfaces:** `runStudioTaskWorkerOnce(dependencies)`, task execution proof/profile into existing service/director; `readStudioTaskMemory` and `project_recall`.

- [ ] Write/run RED tests: worker-only dispatch, phase deadlines/fencing, saved-response replay, unknown no retry, continuation without duplicate edits/quotes, completed quote cannot resume.
- [ ] Write/run RED memory tests: original authored brief outside 30 rows, relevant older notes, newer instructions, foreign isolation, bounded input and zero paid summary.
- [ ] Execute existing service with guarded task proof, heartbeat/lease/deadline, dynamic calls/output/effort and existing checkpoint replay. Progress derives from known actions; pauses preserve partial reply.
- [ ] Add memory note/retrieval and stable instruction prefix; optional recall tool is task-only and actor scoped. Add worker/once scripts.
- [ ] Run task/director and legacy action/recovery suites (Expected: pass); commit.

### Task 4: Authenticated route and client task controls

**Files:** task route handler/resume route, existing conversation handler; route-local task hook/profile/progress components and composer integration; `tests/studio-task-route.test.ts`, `tests/studio-task-hook.test.ts`, connected task browser integration.
**Interfaces:** existing submit returns owned conversation with task state; profile selection passed as exact `taskBudget`; resume posts exact revision/approval identity.

- [ ] Write/run RED route/hook tests for enqueue-only POST, same-origin/scope/body guards, explicit complex, duplicate clicks, stale session responses, mount/read no dispatch.
- [ ] Add task-gated queue adapter and safe saved-state reads. Existing generation confirmation handler stays canonical.
- [ ] Add visible profile ceiling, complex confirmation, deterministic progress and paused options (within ceiling/extension/simplify), with consumed/reserved credits and no implicit pack/model switch.
- [ ] Run real desktop/mobile browser with real PostgreSQL/API and fake bounded model (Expected: one task/approval, no hidden call or generation); commit.

### Task 5: Integration, operating guide and fresh review

**Files:** Studio engineering guides/spec/plan progress.

- [ ] Run `npm run qa:editor`, relevant legacy financial/recovery tests, MCP parity, exposure and diff checks (Expected: pass).
- [ ] Run canonical browser lane and full build (Expected: pass); document explicit migration/worker/activation and pilot metrics.
- [ ] Fresh whole-change review against starting commit `0d89d8399`; Important fixes each RED→GREEN plus green suite. Record rulings/deferred minors.
- [ ] Commit complete candidate, preserve the worktree, report exact verified scope and production gates. No production merge/deploy.
