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

`tasks/previous-work.ts` also carries failed action receipts and selected historical
model mode facts across owned segments. Its query joins the same task/account/project
and excludes deleted projects and the current segment. Authored prompts, raw provider
payloads, private media URLs and historical prices are not projected. At most twelve
receipts are returned, with bounded fact payloads and explicit omission markers.
An action receipt marked completed may have `result.ok=false`; it is not successful
work. Historical facts never bypass current canonical quote validation.

The director fingerprints proven unsupported single-clip duration scenarios
independently of prompt wording and setting order. A repeated identical scenario
stops before another comparison executes and ends without a continuation loop, only
after checking the diagnostic's catalog fingerprint against the current matching
catalog. Newly available candidates or changed duration capabilities invalidate
the negative evidence without another paid discovery call.
Generic/legacy no-match failures, prompt corrections and temporary pricing outages
can still be revalidated; they do not prove an impossible duration. Changed component
scenarios, creation quotes and timeline edits remain available. The history projection
retains safe duration/audio/format facts from comparison failures as well as model
details. It caps each payload at 4,000 characters and the complete array at 12,000,
reserving minimal failure identities before optional facts. Fingerprints use the
stored scenario internally; unknown settings, prompts and URLs are omitted from
model-visible comparison summaries.

Recovering a paid comparison Response with no action receipt checks the current
catalog: the same fingerprint reproduces the stop; changed/missing evidence allows
one current comparison, followed only by replay of previously purchased Responses.
This also covers interruption before the original catalog check completed. If no
paid follow-up remains, a bounded reply preserves recovered prices/errors and
reports the unfinished film without another continuation. `readCompletedStudioAction`
verifies account/project/turn/lease and exact action hash without claiming or
executing it. Older completed receipts still recover subsequent purchased outputs;
the guard cannot reserve another model call.

Continue retains the ceiling. Sol extensions permit +100/+250/+500 credits, up to
2,000 credits and 24 calls total; UI offers a labelled +100 choice. Nothing buys
a pack or resumes purchased usage. Complex needs a fresh checkbox
for each new request. Context/output pauses offer simplification or a new Complex
request; more credits alone do not expand a frozen profile. Funding opens assistance.

Under the monthly-credit policy, an owned task whose next Sol reservation fails
with `included_exhausted` or `paid_budget_exhausted` automatically retries that
same undispatched step once with sponsored Luna. The dispatch owner recounts the
actual Luna request, caps its output at 2,200 tokens, and retains the conversation,
references and completed tool receipts; Sol's opaque reasoning/native item IDs are
omitted while tool correlation and Luna's own reasoning items remain intact. The
ledger rechecks the declined Sol bounds under the account lock before admitting
the first Luna call. Further calls and continuation segments stay with Luna using
the recorded call evidence. Initial task/turn model, profile, source fingerprint,
step limits, deadlines and old financial records remain immutable. Task status
projects the effective recorded model, and the UI retains already consumed Sol
credits alongside included Luna assistance. The account's preferred model and
purchased-credit authorization do not change.
When task dispatch is enabled and sponsored Luna is available, zero remaining
Sol credits do not block the composer before the task reaches that preflight.

Fallback never dispatches after unknown provider usage, expired/superseded leases,
permission or policy failures, replay-only recovery, context limits or task-credit
ceilings. Luna retains sponsorship availability and request limits. No pack,
generation, analysis or export is implicitly confirmed. Legacy assistance policies
continue to require explicit model selection. Regression coverage lives in
`studio-task-luna-fallback-postgres.test.ts` and the connected task browser test.

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
