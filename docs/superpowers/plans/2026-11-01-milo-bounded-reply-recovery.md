# Milo bounded reply recovery implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve failed human briefs and finish or recover one bounded Milo request independently of the browser connection, without changing its selected quality or economic policy.

**Architecture:** Save admission in the existing composer request/assistance owners, acknowledge promptly, and execute under a fenced lease via an immediate `after` wakeup plus cron reconciliation. Poll private saved state; only complete replies may own a proposal. Financial uncertainty continues through the existing settlement/waiver owners.

**Tech Stack:** Next.js 15.5.25, Node 22, TypeScript, PostgreSQL 17, pinned OpenAI SDK, React, existing Vercel after/cron infrastructure.

**Spec:** `docs/superpowers/specs/2026-11-01-milo-bounded-reply-recovery-design.md` (owner-approved approach and bound; independent builder check: no important unanswered questions).

## Global constraints

- 600 seconds from saved admission; immutable deadline; route `maxDuration=800`.
- Model, frozen reasoning, runtime output bound (6000 on current levels), input bound 32000, `store:false`, `maxRetries:0`, rates and credit rules stay authoritative.
- One durable call identity and at most one paid Responses/create generation per request; preparation/reads/count are separate operations inside the same fixed deadline, never inside a DB transaction. No automated paid replay.
- Worker lease 180 seconds, heartbeat 30 seconds, capped at deadline + 30 seconds; at most two preparation attempts, only before a call exists.
- Poll every two seconds, one outstanding GET, each HTTP operation bounded to 15 seconds; Stop waiting does not cancel supplier work.
- No automatic proposal application/generation, no synthetic assistant answer for failed messages, no exposure/allowance resets.
- No customer data in git, no production mutations, no paid model/media calls, no agent merge/deploy.

## Review focus

1. Old preparation worker resumes after its lease was replaced: no reservation, state overwrite or second create (Task 2 race tests).
2. Worker loses process after saving call identity or after response persistence: unknown exposure or saved settlement, never a new create (Task 2 recovery tests).
3. Failed turn follows a valid unapplied proposal: reload must retain exact proposal identity without granting failed-turn review proof (Task 1/3 tests).
4. Browser stops, changes account/workflow or reloads while a request runs: keep the owned pending identity and fence late replies, no resend (Task 3 browser tests).
5. Worker flag/schema missing, policy disabled, cap reached or cron wakeup duplicated/lost: honest admission/closure with no unbounded queue or spending (Task 2 route/financial tests).

---

### Task 1: Preserve failed human turns and proposal identity

**Files:**
- Modify: `frontend/src/server/prompt-assistance/repository.ts`, `sessions.ts`, `provider.ts`.
- Modify: `frontend/src/lib/prompt-assistance/session.ts`, `preview-state.ts`.
- Modify: `frontend/components/composer/usePromptAssistancePreview.ts`, `usePromptAssistanceTransport.ts`, `PromptAssistancePanel.client.tsx`, `prompt-assistance-copy.ts`.
- Test: `tests/prompt-assistance-session.test.ts`, `tests/prompt-assistance-session-browser.test.ts`, `tests/prompt-assistance-preview-state.test.ts`.

**Interfaces:**
- `readPromptHistory(row)` continues returning provider user/assistant messages. Latest eight terminal requests include intact failed user messages with an unavailable-delivery marker and no assistant item.
- Complete `PromptSessionSnapshot.turns` retain their existing shape. Add failed turns `{requestId,message,state:'failed',reply:null,error:string}`.
- Export `lastCompletedPromptRequestId(snapshot)` from the browser-safe session contract; every proof-matching caller uses it.
- Extend user `PreviewMessage` with an optional failed-delivery flag; the transcript renders a localized failure notice, not an assistant response.

- [x] **Step 1: Write RED tests** for failed long brief → short continuation. Assert provider history includes the complete failed message, emits no assistant reply for it, keeps chronological order and excludes another account/session. Assert a session GET restores that failed user text and does not extend expiry or mutate financial rows.
- [x] **Step 2: Run focused tests** with `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-session.test.ts tests/prompt-assistance-preview-state.test.ts`; record the expected missing-history/failed-turn assertions.
- [x] **Step 3: Implement** terminal history projection, failed-turn snapshot union, completed-request identity helper and failed-delivery transcript rendering. Preserve successful turn payloads and public `{reply,text}`.
- [x] **Step 4: Add identity regression**: success proposal, later failed user turn, reload. The old proposal retains its actual completed request ID; failed review proof cannot promote it, and no proposal is applied.
- [x] **Step 5: Verify** focused unit/PostgreSQL tests and `tests/prompt-assistance-session-browser.test.ts`; use only synthetic records. Commit this independently useful correction.

### Task 2: Durable admission and one fenced execution

**Files:**
- Create: `neon/migrations/92_milo_reply_workers.sql`.
- Modify: `frontend/src/server/prompt-assistance/repository.ts`, `service.ts`, `provider.ts`, `route-handler.ts`, `recovery.ts`.
- Create: `frontend/src/server/prompt-assistance/execution.ts`, `worker.ts`, `worker-host.ts`, `worker-policy.ts`, `worker-repository.ts`.
- Modify: `frontend/app/api/prompt-assistance/route.ts`, `frontend/vercel.json`.
- Create: `frontend/app/api/cron/prompt-assistance/route.ts`.
- Create: `tests/prompt-assistance-worker-postgres.test.ts`, `tests/prompt-assistance-worker-route.test.ts`, `tests/helpers/prompt-assistance-service.ts`.
- Adapt service fixtures: existing prompt assistance live/reply-boundary/session/timeout PostgreSQL tests use the helper to admit then execute, rather than keeping a production synchronous provider path solely for tests.

**Interfaces:**
- `sendPromptAssistance(userId,input,{policy?})` persists admission and returns a normal pending/result projection; never calls count/create.
- `runPromptAssistanceWorkerOnce({scope?,policy?,executionDependencies?}) -> Promise<boolean>` handles one owned saved candidate. Scope is `{userId,sessionId,requestId}`.
- `executePromptAssistance(row,dependencies)` owns context/perception/count/reservation/create/checkpoint/settlement, extracted from the existing service; only a claimed worker calls it.
- `schedulePromptAssistanceWorker(scope)` schedules the saved scope with `after`; a wakeup failure is logged without dropping admission.
- `promptWorkersReady(db)` checks migration readiness without DDL; activation also requires `PROMPT_ASSISTANCE_WORKERS_ENABLED==='true'`.
- `PromptAssistanceResult` gains optional `phase:'queued'|'preparing'|'calling'|'recovering'` and `deadlineAt:string`. Existing state and reply meanings do not change.
- `readPendingPromptRequestPointer(userId)` returns only `{sessionId,requestId,scope,phase,deadlineAt?}` for that owner's blocker; REQUEST_PENDING error payload may include it, never the old prompt/reply.

- [x] **Step 1: Write RED PG17 tests**: admission returns before a blocked fake create and reserves no credits; two worker claims/racing cron+wakeup invoke create once; advance the fixture past the former 90-second boundary and finish the original call under the 600-second deadline.
- [x] **Step 2: Write fencing/recovery RED tests**: reclaimed preparation lease rotates and fences the old worker's reserve/error update; heartbeat renews only the owned live lease and respects the fixed deadline; a crash after call identity cannot redispatch; saved response replay settles once; an expired unanswered call closes through its owner; a late waived response reconciles without recharging or exposing a suggestion.
- [x] **Step 3: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-worker-postgres.test.ts tests/prompt-assistance-worker-route.test.ts` and record failures proving missing admission/worker behavior.
- [x] **Step 4: Implement migration and worker policy/repository** with immutable execution version/deadline, bounded preparation attempts, advisory/row locks and exact lease checks. Retain old request/call identities and financial rows. No request-time bootstrap.
- [x] **Step 5: Extract execution** and fence its reservation and failure updates. Use the row's remaining fixed deadline for count/create. Persist terminal provider evidence before settlement; never create after a durable call identity exists.
- [x] **Step 6: Implement wakeup/cron and route admission** using existing cron authorization. Both invoking routes declare 800 seconds. Add the minute cron. Missing migration/flag refuses new admissions before writes/spending; authenticated legacy recovery remains available.
- [x] **Step 7: Add financial/access RED→GREEN regressions** for exposure cap, policy disable/restriction, changed selected-level revision, another user's GET/recovery, malformed/duplicate requests, lost wakeup, exhausted preparation attempts and missed/duplicate cron. Assert unchanged reservation, waiver, usage and customer-charge semantics.
- [x] **Step 8: Verify** worker/route tests, existing prompt timeout/reply-boundary/live/session suites and assistance financial suites selected by CI. Commit the server correction after checks pass.

### Task 3: Poll, stop and restore the same owned reply

**Files:**
- Create: `frontend/components/composer/prompt-assistance-polling.ts` (browser-safe polling orchestration).
- Create: `frontend/components/composer/prompt-previous-reply-storage.ts`, `PromptPreviousReply.client.tsx` (one account recovery pointer and its isolated read-only view).
- Modify: `frontend/components/composer/usePromptAssistanceTransport.ts`, `usePromptAssistancePreview.ts`, `PromptAssistanceFeedback.client.tsx`, and existing copy/module styles only as needed for a status notice.
- Create: `tests/prompt-assistance-worker-browser.test.ts`.
- Modify: existing live/recovery/session browser tests where the new admission response is relevant.

**Interfaces:**
- Polling consumes the saved session/request identity, an AbortSignal and the server deadline; it returns only validated status for that identity.
- Admission/recovery POSTs use 15-second HTTP limits, then poll private GETs every two seconds with no overlapping request. The worker never receives the browser signal.
- The owner stores pending identity before send, retains it after interruption and clears it only on a valid terminal result. Existing account/workflow fencing and explicit proposal application remain authoritative.
- `PreviousReplyRef` stores `{version:1,scopeKey,serverScope,sessionId,requestId,deadlineAt?,status:'admitting'|'pending'|'unknown'|'terminal'}` under an account key, separately from the active chat. Compare identity on writes; no proposal/review proof or raw message is stored in it.
- `checkPreviousReply()` reads/recovers the original identity into a separate read-only panel, never active onResult/onRestore. `newChat(unsentMessage)` remains available while pending, saves unsent input synchronously, rotates session/epoch and leaves the original recovery pointer intact.

- [x] **Step 1: Write RED browser tests**: POST acknowledges pending immediately, GET remains pending beyond the former boundary, then returns a complete proposal. Assert one message POST, no automatic Use prompt/Generate, exact request identity, and no overlapping GET while a slow poll is unresolved.
- [x] **Step 2: Add stop/reload/account tests**: Stop waiting aborts only local polling; Check reply resumes the same request without another message POST; reload restores pending; an old workflow/account result cannot update the new owner; deadline/failed/unknown states retain an honest recovery path. New chat/close/navigation remain available while only SEND is blocked. New chat preserves unsent text, rotates the active identity/epoch and retains the separate original pointer. Check previous reply displays original content only in its read-only view; closing it preserves new-chat input. Account changes hide it; storage failure warns without locking navigation. Another-chat REQUEST_PENDING supplies an owned pointer and never resends the rejected message.
- [x] **Step 3: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-worker-browser.test.ts`; record the expected missing automatic polling behavior.
- [x] **Step 4: Implement bounded polling** and saved phase/deadline presentation, keeping the approved command bar geometry and existing review/application safeguards. Add the bounded account recovery pointer, synchronous unsent-input persistence and explicit read-only previous-reply view. Fence every callback by session/request/chat epoch so an owner surviving New chat cannot deliver an old reply into its new session. Do not claim percentage progress or cancellation of supplier work, and do not relax account-wide pending SEND admission.
- [x] **Step 5: Verify** new browser tests plus existing recovery/auth/session/pending-review/response-focus suites. Test restored failed briefs and an older valid proposal together. Commit the complete browser lifecycle.

### Task 4: Whole-candidate validation and operational handoff

**Files:**
- Modify: `docs/operations/studio-assistance-support.md` and the design with final implementation/rollout evidence.
- Create: `docs/engineering/prompt-assistance-recovery.md` for admission/worker/ledger ownership, activation, limits and uncertainty.
- Update test runner selection only if its conservative selectors omit the new migration/worker/browser responsibility.

- [x] **Step 1: Document and announce before candidate publication** exact owner operations: additive migration92 via the reviewed Neon migration workflow on an approved direct connection; set `PROMPT_ASSISTANCE_WORKERS_ENABLED=true` for Preview and production before new code is deployed (old code ignores it); verify existing cron secret/enablement and800s capacity; qualify a Preview built from the exact commit. Do not deploy knowingly missing prerequisites. Document legacy recovery, support diagnostics, the retained global-pending limit and explicit `store:false` uncertainty. Queueing changes delivery reliability, not selected LLM quality or the economic ceiling.
- [x] **Step 2: Fetch main and incorporate the delivered Generate-authorization change** once the parent confirms it landed; preserve its explicit-application and manual-generation guards.
- [ ] **Step 3: Run** TypeScript, focused integration/browser/financial suites, frontend lint, exposure lint, full build when feasible, and `git diff --check`. Record exact failures and limits; do not use real provider calls to fill verification gaps.
- [ ] **Step 4: Obtain independent whole-branch review** against the approved spec and financial/identity boundaries. Resolve material findings and rerun affected checks.
- [ ] **Step 5: Hand off** commits, test evidence, runtime rollout prerequisites and any remaining limits to the parent. No merge, production migration, worker activation, deployment or paid semantic validation by this agent.

## Self-review

The plan covers every spec boundary: persisted admission, at-most-one dispatch,
fixed deadline, missed/duplicate wakeups, lease fencing, honest uncertainty,
financial owners, terminal human history, proposal identity and browser lifecycle.
All five review-focus cases have tests in their owning tasks. Interfaces retain
the public reply and exact successful history semantics; no test fixture requires
a paid call or customer data. Server implementation remains in this isolated worktree. The owner-directed UI
worktree is integrated through reviewed commits, followed by independent
whole-candidate review.

Execution ownership ruling: new durable admissions persist an immutable trusted execution owner: production is stable across deployments, Preview is bound to its deployment ID. Worker selection filters it even for a scoped wakeup. A shared-DB Preview cron never consumes the production queue; Preview uses its scoped after/recovery wakeups only. A lost Preview wakeup therefore needs explicit recovery on its original deployment before the same fixed deadline; it cannot silently migrate execution to production or another Preview. No secrets are copied or altered for isolation. Legacy admissions retain their default legacy marker and are never new-worker dispatch candidates.

Recovery wakeup ruling: an explicit authenticated recovery POST may schedule the already-admitted durable identity when it still has no call_id; this is the first execution of that saved admission, not a replay of a paid create. It cannot create a new request, renew the immutable deadline, change the frozen model/runtime, or acquire a different execution owner. The worker revalidates saved state, lease, deadline and current policy before reserving. Once call_id exists, recovery/cron can only observe, settle saved evidence or close through the existing resolution owner; no second Responses/create is possible. This supersedes the initial blanket wording that a recovery POST never dispatches. Legacy admissions are never woke into new execution.
