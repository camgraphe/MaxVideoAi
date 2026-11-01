# Bounded Milo replies and faithful failed-turn recovery

## Decision and intent

The owner approved application-owned asynchronous execution with a 600-second
deadline from admission. A long creative brief with references must remain a
saved, recoverable request instead of depending on a 100-second browser wait.
This does not promise a faster answer or a useful answer within 90 seconds.

The selected model, frozen effort, 6000-token runtime ceiling, 32000-token input
limit, `store:false`, provider `maxRetries:0`, tariffs and assistance ledger remain
authoritative. One admitted request may dispatch at most one paid Responses/create
generation call. Media preparation, reads and input-token count are separate
operations, all inside the same fixed 600-second application budget. No database
transaction or lock is held while any of those external operations run.
Unknown supplier usage remains unknown; customer waivers never reset exposure.
No customer records, prompts or account actions belong in this change.

## Approaches considered

1. Extend the synchronous POST: rejected because a lost connection still couples
   delivery to execution, and increasing one timeout only reaches another limit.
2. Save admission, acknowledge promptly, run under a fenced application worker,
   poll owned saved state, and reconcile lost wakeups: selected. The project
   already uses Next.js `after`, database leases, heartbeat and Vercel cron for
   Studio tasks. This adds no provider retry or new financial allowance.
3. Provider background execution with retained responses: rejected here because
   it changes the `store:false` data-retention contract and needs another decision.

## Infrastructure and its limits

The repository pins Node 22 and Next.js 15.5.25. Existing Studio worker routes use
`maxDuration=800` and a minute cron. `after` is a post-response callback, bounded by
the invoking route's duration; it is not a durable queue. Cron delivery can be
missed or duplicated and does not automatically retry a failed invocation. The
database request is the source of truth, not the callback or a process-local map.

- [Next.js 15 after documentation](https://github.com/vercel/next.js/blob/v15.1.11/docs/01-app/03-api-reference/04-functions/after.mdx)
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Cron delivery and concurrency](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Vercel currently documents 800 seconds on Pro/Enterprise with Fluid Compute.
Actual project capacity, cron enablement and the existing cron secret must be
verified at rollout; source configuration alone is not proof of that live setup.
Both the admission route (whose `after` runs the wakeup) and the new cron route
declare 800 seconds, leaving platform headroom beyond the application deadline.

## Durable admission and execution

Add migration `92_milo_reply_workers.sql`; never initialize schema on a request.
Extend `prompt_assistance_requests` with:

- `execution_version`: immutable `legacy-sync-v1` default or `durable-v1` for new
  admissions; existing requests are never redispatched.
- `execution_deadline_at`: immutable timestamp, database admission time + 600 s
  for `durable-v1`; null for historical rows.
- `worker_started_at`: null until a worker acquires execution ownership.
- `worker_attempts`: preparation-attempt count, initially zero, bounded to two.

The existing request lease is the worker identity. No second financial queue or
Studio project is created. The call continues to use `composer:<session>` and
the existing shared assistance turn, reservation, settlement and resolution owners.

`sendPromptAssistance` becomes admission only. It preserves request hashing,
account-wide pending protection, session checks, selected-level revision checks,
the three-unreconciled-automatic-waiver cap and frozen runtime creation. It saves
the request before returning the normal public `pending` result. No media reads,
input-token count or provider create occurs in the admission response.

Activation requires migration readiness and
`PROMPT_ASSISTANCE_WORKERS_ENABLED=true`. A disabled/unready worker fails before
new admission; it never silently falls back to the old synchronous provider call.
Historical reads, recorded-response recovery and support settlement stay available.

A scoped `after` wakeup and `/api/cron/prompt-assistance` (each minute, existing
cron authorization owner) invoke the same worker. The worker selects a saved
candidate and acquires the existing `prompt-assistance:<user>` advisory lock plus
the exact row lock. It may claim only an unstarted request or an expired
preparation lease with no `call_id`, before the original deadline. An expired
preparation can be reclaimed once, with a rotated lease and no deadline extension.

An active worker uses a 180-second lease, renewed every 30 seconds while its exact
lease owns `preparing`/`calling` and the fixed deadline has not elapsed. The lease
never extends beyond deadline + 30 seconds. A queued unstarted request is retained
until its admission deadline plus closeout grace; it must not look like an expired
provider call after three minutes merely because a wakeup was lost.

The existing provider execution is extracted from admission. Reservation requires
the exact worker lease, state `preparing`, a live lease and no existing call.
Context persistence and every failure update are fenced by that lease or the
already-persisted call identity. An old preparation worker cannot reserve under a
replacement lease or fail another worker's request.

After `call_id` is durable, neither another worker nor recovery may dispatch a
provider call. A crash between reservation and HTTP transmission is conservatively
unknown; it is never treated as proof of zero usage. A worker/cron may finish a
saved complete response without dispatch, or close an expired unanswered call
only through the existing financial owner. Provider creation and token count use
the original fixed deadline; preparation consumes this budget. A complete provider
response is saved before settlement and UI delivery, as today.

## Failure and recovery semantics

- Unstarted preparation past its deadline fails without a provider reservation.
- Provider timeout/connection loss retains unknown supplier exposure and uses the
  existing unanswered closeout to release eligible customer holds once.
- Valid saved evidence settles and decodes without another provider call.
- A response arriving after customer waiver remains available for supplier
  reconciliation, cannot charge that waived customer and cannot resurrect a
  closed suggestion.
- GET reads remain private, account/session scoped and mutation-free. Explicit
  recovery POSTs keep their existing settlement/closeout authority, not dispatch.
- A disabled assistance policy or account restriction before dispatch refuses new
  spending through the existing owners; a saved response can still reconcile.

`after`/cron cannot recover an absent `store:false` provider response after process
loss. This limitation is stated honestly and covered by the existing uncertainty
and exposure controls. This change must not claim exactly-once supplier execution
or complete provider-cost recovery; its guarantee is at-most-one application
dispatch identity per admitted request and no automated paid replay.

## Browser lifecycle and conversation fidelity

The POST returns admission promptly. The transport then polls GET every two
seconds, at most one outstanding poll, with each HTTP operation bounded to 15 s.
Public `reply` remains `{reply,text}`. Optional result `phase` and `deadlineAt`
identify saved queue/preparation/calling/reconciliation state, not token progress.
Polling stops at a terminal result, local Stop waiting, scope/account change or
the saved deadline plus 30 seconds. Losing the browser never cancels server work.

Stop waiting keeps the pending request identity and exposes Check reply. Recovery
checks the same request and resumes bounded polling; it does not resend the brief.
Reload or another workflow cannot deliver a late reply into the wrong chat. A
late result is never applied to an editor or used to generate media automatically.
No new server-side cancellation semantics or wallet refund action is introduced.

The existing account-wide pending SEND policy is retained. Stop waiting, closing
the assistant, navigation and New chat remain available; none cancels supplier
work or frees the active send slot. New chat changes the active session, clears
its proposal/proofs and preserves unsent user text. A separate account-scoped
recovery pointer retains the previous session/request/scope before admission is
sent; its updates compare the original identity. It contains no prompt, media URL
or review proof. There is one such pointer, not an old-chat library; replace it
only when the prior identity is explicitly terminal and another send starts.

Check previous reply opens an isolated read-only view of that original identity.
It performs authenticated recovery/status checks without invoking the active
chat's onResult/onRestore, proposal hydration or proof promotion. Closing this
view preserves the active chat's unsent message. A stale callback after New chat
is fenced by captured session/request/chat epoch, not only component ownership.
Account changes abort view/polling and hide the other account's recovery state.

A rejected send in another chat preserves its unsent text and receives a private
pointer to that account's blocker, allowing the same explicit check even when
local storage is unavailable. Storage failure keeps in-memory recovery and a
truthful persistence warning, without locking navigation. A terminal previous
reply unblocks a later explicit send; a running request blocks only SEND until
it finishes or bounded closeout occurs. This concurrency limit can last up to
600 seconds plus closeout grace and is documented, not disguised as cancellation.

Keep the existing compact command bar and explicit application/review proofs.
Queued work is shown as saved, running work as waiting, and unresolved/failed work
as such. No progress percentages, invented provider status or faster-answer claim.

Provider history selects the latest eight terminal requests in exact chronological
order, including failed user messages. Successful assistant replies remain exact.
A failed turn contributes its intact user message and an explicit unavailable
delivery marker, never an invented assistant reply or claim of a completed action.
The final count/create parameters and 32000-token admission check remain identical;
no silent summarization or removal of creative details is added.

Session restoration returns complete turns unchanged and adds a failed-turn form
with `state:'failed'`, `reply:null` and a safe error code. The UI retains the user
bubble and a localized delivery-failure notice. Only actual completed turns may
own a proposal/review proof; a new failed turn cannot relabel an older proposal.
The latest successful request ID used for proof matching is derived explicitly
from completed turns, rather than the last terminal row of any kind.

## Rollout, verification and boundaries

Use only synthetic long briefs, synthetic reference images and disposable PG17.
Cover worker races, stale lease, lease renewal, lost wakeup, crash after reservation,
saved response replay, late response after waiver, exposure cap, policy disable,
browser stop/reload/account changes and failed-turn proposal identity. No live paid
model/media run is authorized for implementation verification.

Apply the additive migration and prepare the true worker flag in Preview and
production before the functional Preview/final deployment. Old code ignores that flag and the
additional columns, so existing admissions continue during preparation. Verify
cron authentication, schedule, capacity and both route duration declarations.
Qualify a functional Preview on the exact candidate commit before main delivery;
do not knowingly deploy a runtime that suddenly refuses every new admission for
missing migration/flag. Preserve old failed and
unknown financial records; no backfill re-executes them. Incorporate main after
the independent Generate-authorization change lands. Run selected financial,
integration and browser CI, obtain an independent whole-change review, and leave
merge/deployment to the owner. A real-model quality/performance check is a separate
owner decision after the offline candidate, not evidence supplied by fixtures.

Execution ownership ruling: new durable admissions persist an immutable trusted execution owner: production is stable across deployments, Preview is bound to its deployment ID. Worker selection filters it even for a scoped wakeup. A shared-DB Preview cron never consumes the production queue; Preview uses its scoped after/recovery wakeups only. A lost Preview wakeup therefore needs explicit recovery on its original deployment before the same fixed deadline; it cannot silently migrate execution to production or another Preview. No secrets are copied or altered for isolation. Legacy admissions retain their default legacy marker and are never new-worker dispatch candidates.

Recovery wakeup ruling: an explicit authenticated recovery POST may schedule the already-admitted durable identity when it still has no call_id; this is the first execution of that saved admission, not a replay of a paid create. It cannot create a new request, renew the immutable deadline, change the frozen model/runtime, or acquire a different execution owner. The worker revalidates saved state, lease, deadline and current policy before reserving. Once call_id exists, recovery/cron can only observe, settle saved evidence or close through the existing resolution owner; no second Responses/create is possible. This supersedes the initial blanket wording that a recovery POST never dispatches. Legacy admissions are never woke into new execution.

Independent review corrections: durable failed requests with saved late evidence and a nonsettled supplier call are settlement candidates, while their customer-visible failed state and zero waived charge remain unchanged. Settled calls are excluded. A false settlement result marks server-only lateSettlementError=USAGE_UNRESOLVED, which excludes automatic retries while preserving unknown exposure; explicit recovery/support can still retry. Database exceptions never write this marker and remain cron-retryable.

Mixed-version compatibility: migration92’s existing execution-identity guard first enforces immutable identity, then preserves only the exact old interrupted-preparation UPDATE (state/error/updated_at only), for durable preparing rows with no call/evidence, an expired lease, a live deadline and an unspent preparation attempt. RETURN OLD lets old recovery report pending and old admission retain its blocker. Other failure codes/update shapes, exhausted attempts/deadlines, legacy rows and every dispatched/waived call remain outside this nonfinancial guard.
