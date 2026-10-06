# Studio: bounded creative tasks

Approved conversational scope: Adrien's “Okay, go for it” on 2026-10-06.
Implement on the existing isolated Studio branch. No production activation or
paid provider pilot is implied. Reuse the existing OpenAI credential.

## Intended experience

Studio should finish useful creative work without unbounded token spending.
Creation stays first. A task stops after delivering its reply or preparation;
generation completion never initiates analysis, critique or another model call.
Luna keeps images and ordinary work. Media analysis keeps its separate Sol review.
Monthly included credits, pack prices and retail token rates stay unchanged.

The client chooses a visible assistance ceiling before sending a task:

| Profile | Initial calls | Output ceiling per call | Input ceiling | Reasoning | Task deadline | Sol maximum credits |
|---|---:|---:|---:|---|---:|---:|
| quick | 2 | 2200 | 12000 | low | 180 seconds | 100 |
| standard | 4 | 2200 | 24000 | medium | 300 seconds | 250 |
| complex | 8 | 6000 | 48000 | adaptive medium/high | 600 seconds | 500 |

These are independent upper bounds. Cost takes precedence: eight calls does not
authorize eight calls at their largest input/output bounds. Every paid call must
reserve its conservative incremental cumulative quote before dispatch. Completed
usage consumes actual shared credits; no flat profile fee. Complex requires an
explicit client confirmation and Sol selection. A task never buys a pack, resumes
paused purchased usage or changes model for the client. Luna may use quick/standard
with its existing sponsorship protections and no Sol credit charge.

## Frozen resource policy and financial ownership

Introduce `studio-task-budget-2026-10-06-v1`, separate from immutable assistance
tariffs v1/v2. Existing requests without a task budget retain four calls/2200
output and their existing recovery. New tasks freeze profile, exact ceiling,
selected assistance model/mode, input and settings. The existing assistance
turn/call and credit-lot owners still price, reserve and settle all chat calls.
No parallel financial consumer, fabricated call or second wallet debit.

Migration 65 creates task queue, approval events and durable authored memory
notes. It expands SQL numeric capacity to 24 response slots/6000 output tokens,
while runtime authorization keeps old requests at their original bounds. A
schema trigger also rejects expanded call slots/bounds without an owned frozen
task policy. No reader or import applies migrations or grants credits.

## Queue and worker

Submission is a short authenticated same-origin mutation. It persists one task
and freezes assistance in an owned transaction, then returns queued status. It
does not dispatch OpenAI or a generation. One active chat task per account;
the old synchronous path also respects an existing queued/running task.

An explicit CLI worker executes the existing conversation service and canonical
actions. It does not replace their quote, scope, revision or journal owners.
It claims a fenced worker identity, establishes a deadline, renews a three-minute
lease while active and uses the same image-turn lease for mutation fencing.
Deadlines and worker ownership are rechecked before new paid dispatch. A slow
provider call receives a bounded timeout appropriate to the remaining deadline.

Expired work with unknown provider usage stops in unknown state; no redispatch.
Known saved responses/actions may replay without paying or mutating twice.
Settlement recovery remains available if the new feature is disabled. Queue
status polling is read-only and cannot start, continue or renew work. Progress
labels are derived from recorded phase/tool actions, not additional model calls.
Deleting a project or restricting an account prevents further dispatch.

## Pauses and explicit continuation

A resource stop shows actual consumed/reserved credits, completed steps and the
saved partial reply. Unknown usage offers result recovery/support, not another
paid attempt. An ordinary resource pause offers:

- Continue within the same financial ceiling, adding one bounded call tranche.
- Extend the ceiling by 100/250/500 credits after exact client confirmation.
- Send a simplified new request, optionally selecting Luna through the existing
  assistance control. Never silently switch the frozen task's model.

Approvals are revisioned, owned and idempotent. Maximum 24 total calls and 2000
approved credits per task; exceeding them requires a new explicit request.
An approval can only resume a paused task with fully known usage, never a
completed reply, delivered quote or running/unknown dispatch. It records the
prior partial reply, retains every paid response/action receipt and adds another
bounded deadline. Resumption replays the original checkpoints before continuing.
Expired generation/analysis/export quotes keep their existing renewal controls.

## Memory and context

Save exact client-authored messages and reference identities as private project
memory notes during submission. Retain the original brief and retrieve relevant
older notes using PostgreSQL text search, without embeddings or a paid summary.
Data is explicitly untrusted historical content; newer requests and current
canonical facts take precedence. No signed media URL is introduced into notes.

Build context from current message, existing editable project summary/decisions,
authoritative current generation/timeline facts, a bounded recent window (4/8/12
exchanges for quick/standard/complex) and at most four relevant older notes. Read
original notes on demand through an owned `project_recall` tool. Saved legacy
messages can participate without a backfill write. Token counting remains the
authority: an oversized context pauses usefully rather than silently discarding
the current brief or pretending every instruction was remembered.

Stable instructions and tools precede changing task/step facts to help caching.
Do not assume a cache hit when reserving or promising savings. Store existing
usage counters for later qualification; all reasoning belongs in output usage.

## Limits and interface

Keep 4000 characters per message and eight distinct references. Keep existing
20/hour protection for Luna/included-only Sol, raising enabled paid Sol to 60/hour
under the task policy. Count new task identities across projects, including the
legacy journal, without double-counting a task's own worker-created turn.

The composer displays profile ceiling and separate media prices. Complex has a
clear confirmation, not a hidden automatic escalation. Task cards show queued,
working, paused, completed, failed or unknown; no fake percentage or completion.
Client POSTs use exact IDs/policy/revision/ceilings. Reopening or duplicate clicks
cannot create another task, budget approval, paid call or generation. Polling is
bounded, account/project scoped, and cancelled on unmount/session changes.

## Activation and validation

`STUDIO_CONVERSATION_TASKS_ENABLED=true` requires assistance credit policy,
actions, explicit migration and a running dedicated worker. Off preserves the
legacy route and reads saved task state safely. No price/free-grant change.

Verify real disposable PostgreSQL: shared funding cap and conservative reserve,
expanded bounds reject absent/foreign policy, one-account concurrency, repeated
approvals, paused purchased usage, lease fencing and late known usage, no unknown
retry, current/old memory, recovery after disabling, no read-time mutations.
Verify real hooks/browser: queued submission makes zero provider calls, duplicate
submit/continuation once, scoped polling, visible budgets, explicit complex,
mobile layout, result reload, and generation confirmation remains separate.
Run editor QA, canonical browser lane, full build, exposure and relevant legacy
financial/recovery contracts. Fresh whole-change review, then regression fixes.
