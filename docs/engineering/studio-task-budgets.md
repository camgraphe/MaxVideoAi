# Studio task budgets and background execution

Implemented on the isolated Studio branch on 2026-10-06. This describes the
candidate. The authorized paid-provider qualification and production activation
procedure are recorded in `docs/operations/studio-media-tasks-activation-2026-10-06.md`.

`src/lib/studio/task-budget-contract.ts` owns the separately versioned resource
policy `studio-task-budget-2026-10-06-v1`. Existing assistance v1/v2 tariffs,
500 monthly credits and pack prices stay unchanged. Ceilings are not flat fees.
Sol consumes free credits before explicitly enabled purchased credits; Luna stays
sponsored. Conservative next-call quotes must fit the remaining ceiling before
reservation, so the financial cap can stop work before the call/token maxima.

| Profile | Maximum credits | Calls/segment | Output/call | Input/call | Time | Recent turns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Quick | 100 ($0.10) | 2 | 2,200 | 12,000 | 180s | 4 |
| Standard | 250 ($0.25) | 4 | 2,200 | 24,000 | 300s | 8 |
| Complex, explicitly confirmed Sol | 500 ($0.50) | 8 | 6,000 | 48,000 | 600s | 12 |

Reasoning is low, medium, and adaptive medium/high respectively. Visible replies
remain bounded to 2,400 characters; long generation directions belong in tools.
Caching follows recorded provider facts; no hit or saving is assumed.

## Ownership and recovery

`tasks/service.ts` serializes enqueue and client commands. It freezes exact input,
model, profile and owned source fingerprint with the existing assistance turn.
Client model/revision must match the locked account. There is one active queued,
running or unknown task per account; paid Sol allows 60 initial tasks/hour,
included-only Sol and Luna retain 20.

`tasks/conversation-adapter.ts` returns queued turns immediately. GET and polling
never execute the worker, count tokens or dispatch. Generation, analysis and
export keep their separate exact-price confirmation owners. Quote preparation or
a useful completed reply ends work; delivery/polling never starts a critique.

`tasks/worker.ts` uses a three-minute owned lease and thirty-second heartbeat.
Every dispatch checks worker/project, deadline and activation; reservation checks
frozen profile/source permissions under existing campaign/account locks. Status
projects real phases and credits without source URLs or invented percentages.

Delivered drafts and action receipts stay immutable. Explicit continuation creates
a new execution segment of the same task. All segments share cumulative credits,
one ceiling and cent rounding; old segments cannot dispatch. Exact historical
action replay returns the immutable receipt and a replay marker. Previous saved
work is supplied to the director to avoid repeating successful edits/preparations.

Continue retains the ceiling. Sol extensions permit +100/+250/+500 credits, up to
2,000 credits and 24 calls total; UI offers a labelled +100 choice. Nothing buys
a pack, resumes purchased usage or switches models. Complex needs a fresh checkbox
for each new request. Context/output pauses offer simplification or a new Complex
request; more credits alone do not expand a frozen profile. Funding opens assistance.

Qualified saved responses settle/replay without repurchasing them, even when new
dispatch is disabled. Automatic known recovery is bounded to two attempts.
Explicit recovery verifies stored model, tier, usage and original reservation,
then uses replay-only execution without increasing caps. Missing/unqualified usage
stays reserved and blocks new work for reconciliation/support. The existing operator
resolution also reconciles the owned task: a customer waiver closes and fences it
once no unresolved calls remain; qualified settlement queues only saved-result
replay, without increasing caps or making another provider call. Late original
responses can save usage after fencing. Cancellation applies only to queued work
and preserves recorded consumption; it cannot treat a live unknown call as free.

`tasks/memory.ts` retrieves exact client notes and legacy messages, excluding
server-created continuation segments: original brief plus three relevant/recent
notes with explicit truncation. Task-only `project_recall` reads up to four bounded
owned notes. They are historical data, overridden by newer client instructions.
No paid summarizer, embedding, analysis or model heartbeat runs in the background.

## Activation and verification

Apply explicit `neon/migrations/65_studio_task_budgets.sql` after the existing
conversation/assistance migrations. Readiness checks all four task tables;
imports and requests never bootstrap them. Run `pnpm studio-tasks:worker` or
`pnpm studio-tasks:worker:once` with the existing database and `OPENAI_API_KEY`.
The worker host must support the ten-minute segment and run matching source/flags;
HTTP polling is not a worker. The Vercel Pro/Fluid host uses
`STUDIO_VERCEL_WORKERS_ENABLED=true`: accepted queued POSTs schedule a scoped
`after()` wake-up; authenticated minute crons reclaim saved work if it is lost.
The task route/cron allows 800 seconds for one segment, including bounded
provider/settlement overhead. GET status and media delivery never schedule work.
The cron requires the actual `CRON_SECRET`, without header-only fallback.
Enable `STUDIO_CONVERSATION_TASKS_ENABLED=true`
alongside actions and the existing approved credits assistance policy. Other
generation/edit/export/media-analysis flags remain independent. Disabling tasks
preserves status and qualified replay-only recovery while stopping new calls.

Before broad activation, obtain an explicitly authorized small live pilot and
measure completion/pause reasons, p50/p95 actual credits, reservations/unknown
usage, queue wait, context rejection, cached tokens, duplicate edits and approval
retries. Offline validation does not authorize spending a live key or buying packs.

PostgreSQL tests prove cumulative caps, scope, frozen model/source, rate allowance,
bounded recovery and unknown holds. The browser fixture owns its committed Next
snapshot, PostgreSQL 17 and test-only authentication; an injected offline worker
checks zero-dispatch reads, Complex consent, mobile overflow, continuation and
reload. These are functional checks, not production latency or Core Web Vitals claims.
