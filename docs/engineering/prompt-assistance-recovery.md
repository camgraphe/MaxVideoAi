# Bounded Milo reply recovery

Composer Milo saves admission and returns a pending identity before external
preparation. A scoped Next.js `after` wakeup or the production minute cron executes
the saved request. The browser reads that same owner's result. This improves
delivery/recovery without promising a faster model response.

## Owners and limits

| Responsibility | Owner |
| --- | --- |
| Input hash, session, pending gate, level revision, exposure cap | `prompt-assistance/repository.ts` |
| Immutable execution metadata and mixed-version guard | migration 92 |
| Claims, lease fencing and heartbeat | `worker-repository.ts`, `worker.ts` |
| Context, perception, count, one Responses/create, checkpoint | `execution.ts`, existing `provider.ts` |
| Reservation, usage, customer charge and unknown exposure | Existing Studio ledger/resolution owners |
| Reply decoding and idempotent settlement | `service.ts`, `reply-format.ts` |
| Local wait and isolated previous-reply view | Composer transport/polling/previous-reply modules |

The deadline is database admission time plus 600 s, including queue, preparation
and token counting. Counting is a separate operation bounded to 15 s; the single
paid Responses/create receives the remaining budget. Selected model, frozen
effort, output/input ceilings, default tier, `store:false`, `maxRetries:0` and
financial policy retain their owners/values. Historical snapshots stay historical.
No database transaction/lock remains open during any external preparation,
counting or provider request.

A lease lasts at most 180 s, renewed every 30 s and capped at deadline plus 30 s grace.
Queued work initially keeps its lease through that deadline/grace. Lost
preparation can be claimed at most twice, rotating its lease; its former worker
cannot reserve or fail its replacement. Once `call_id` is saved, no path can
create again for that request. This is not supplier-side exactly-once: a crash
between the saved call identity and HTTP dispatch remains conservative unknown.

Evidence is saved before settlement. A checkpoint can settle without another
provider call. Late evidence after waiver keeps the request failed and charges
the customer zero. Cron selects it only while the call is not settled. A false
settlement result marks private `lateSettlementError=USAGE_UNRESOLVED`, avoiding
cron starvation; database exceptions never mark it and remain retryable. Explicit
recovery/support can inspect/retry. Stored responses, even invalid ones, stay
immutable. Never rewrite evidence to force settlement.

## Recovery and context

GET does not dispatch, settle or waive. Authenticated same-origin recovery POST
uses the original identity. It may wake the first execution of an already-admitted
durable request without a call, rechecking state, owner, lease, deadline and
policy. A dispatched request can only be observed, settled from saved evidence,
or closed through the existing resolution owner.

The latest eight terminal turns retain failed human messages exactly, marked
`replyUnavailable`, without an invented assistant answer. Restoration shows a
delivery notice. The last completed request owns any retained proposal/proof;
a failed turn cannot acquire an older proposal's identity.

Browser HTTP waits last at most 15 s; durable polls are serial, normally 2 s apart,
bounded by the saved deadline plus grace. Stop waiting stops only the local wait.
Closing/navigation/New chat remain possible during a reply; another Send stays
account-blocked until the prior request is checked/terminal. New chat preserves
unsent input and rotates ownership. Check previous reply uses a separate
read-only view, with no application/generation callback. A late result never
applies text or generates media automatically. Reference analysis keeps its
existing separate recovery ownership.

The bounded account recovery pointer contains identity/scope/deadline, not prompt
content or proposal proof. Storage failures warn without locking navigation. The
existing authenticated status GET and REQUEST_PENDING expose only the owner's
pending identity, allowing recovery discovery after a storage-less reload.

`store:false` cannot recover an absent supplier response after process loss. A
timeout/missing checkpoint never proves zero cost. Waivers, purchased/included
credits and supplier exposure remain distinct. The cap after three unreconciled
automatic waivers is unchanged; gifts/new chats/projects/levels never reset it.

## Activation and rollout

1. Independently verify Neon primary host/database/operator and review exact 92
   bytes/hash plus current schema definitions. Follow the reviewed-file section
   of [the migration protocol](../deployment/customer-tariff-cutover.md#read-only-schema-inventory).
   Do not replay every historical migration. Using approved libpq credentials
   without a URL in argv or a copied env file, execute only the reviewed file with
   `psql -X --single-transaction -v ON_ERROR_STOP=1 --file neon/migrations/92_milo_reply_workers.sql`.
   The reviewed operator guard/rehearsal compares complete new definitions and
   old-row/old-structure hashes under the bounded DDL lock before commit.
2. Verify preexisting rows remain legacy, with null deadline/owner/worker start
   and zero attempts. No financial backfill or call replay occurs. Inspect
   function body, constraint, trigger, index and defaults; names alone do not
   prove compatibility. Re-run read-only readiness and retain private evidence.
3. Prepare `PROMPT_ASSISTANCE_WORKERS_ENABLED=true` in Preview and Production
   before activating candidate code. Old code ignores it/additive fields and
   continues legacy admissions during preparation. New code refuses new work if
   flag/schema is absent; knowingly deploying that state interrupts Milo. There
   is no synchronous fallback or request-time schema bootstrap.
4. Confirm existing CRON_SECRET presence without reading/copying it, crons
   enabled, Pro + Fluid 800 s capacity, both route `maxDuration=800` exports, and the
   minute `/api/cron/prompt-assistance` definition. `after` is best effort.
   Production cron handles one saved candidate per invocation; overlapping runs
   are safe. Observe fallback throughput and queue age: queued time consumes the
   same 600 s budget.
5. Qualify a Preview on the exact reviewed UI/server commit. Execution owner is
   `preview:<VERCEL_DEPLOYMENT_ID>`, versus stable `production` across releases.
   A shared-DB Preview cannot consume prod work. Preview cron does no global
   work; scoped after/explicit recovery wakes its own admission before the same
   deadline. Do not change secrets for isolation.
6. Complete selected CI, independent whole-change review and normal release/
   alignment checks. The owner performs migration, activation and delivery. A
   paid real-model quality/performance check is a separate decision; offline
   fixtures establish transport/financial behavior.

Migration 92 preserves only the exact old interrupted-preparation UPDATE while a
durable request has an expired lease, live deadline and unused attempt. RETURN
OLD lets old recovery report pending and old admission retain its blocker. Other
errors/context/identity mutations, exhausted attempts/deadlines, legacy closures
and every dispatched financial resolution stay outside this nonfinancial guard.

For rollback keep additive schema and financial history. Never delete/convert
durable rows or replace evidence. Turning off the worker flag also removes queued
work's automatic wakeups; observe/resolve admitted work through its identity and
existing support owners before retiring its runtime. Disabling new assistance
remains an explicit existing policy decision.
