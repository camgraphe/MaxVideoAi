# Seedance 2.5 local Draft lifecycle

## Scope

This continuation implements real server orchestration for one text-to-video
Draft 480p and a separately paid final 1080p, retaining the previously approved
workspace checkbox. Creator controls are wired behind the explicit local gate;
`draftPreview=1` continues to show the approved simulation. Production execution
is unavailable through that gate.

`seedance-workflow-request.ts` resolves an owned MaxVideoAI Draft job before a
final quote, rejects unsupported/client provider identifiers and inherits its
prompt, duration, framing and audio. `initial-seedance-final.ts` reserves that
parent in the same transaction as the ordinary wallet receipt and initial job.
Competing final job IDs cannot both charge; repeating an existing owned job
returns that job. Migration 59 adds the final completion state.

`seedance-workflow-submission.ts` emits the actual ModelArk Draft or final payload
and persists server submission provenance. A final sends only the original
provider Draft reference and 1080p. Timeout/5xx/lost acknowledgement is held for
review rather than refunded and resubmitted automatically. Completed output
passes through the existing owned storage path before Draft eligibility. Provider
GET's missing 2.5 Draft flag does not determine this state.

## Pricing and retry

`workflowStep=draft|final` distinguishes two manual price cells under the same
Seedance 2.5 identity. Missing/inactive cells refuse quotation. Normal-task
contract discounts cannot be applied to either workflow step. LIST estimates
reuse the existing factual dimensions/rates; actual completion-token accounting
remains independent. Separate job IDs retain independent charges and snapshots.

A failed final remains linked until its full owned charge/refund and refunded
payment status are verified. It can then receive a new quote/job; late outcomes
from the former attempt cannot alter that link. The original paid Draft remains
completed and downloadable. Partial refunds and ambiguous provider outcomes
never unlock a retry.

The BytePlus poll failure owner commits terminal failure, the wallet refund
receipt and refunded payment status in one database transaction. An interrupted
refund rolls back the terminal transition, so the next poll can retry. The locked
persisted job supplies the refund owner, amount, currency and snapshot; a stale
poll object cannot change them. Concurrent callbacks can commit only one refund.
Workflow reconciliation follows the committed transaction and keeps its existing
owned terminal recovery path.

Admin scenario controls expose Standard generation, Draft 480p and Final 1080p
with the supported step resolution locked. The normal public catalogue matrix
does not silently expand into unlaunched workflow capabilities.

## Local tariff initialization

`frontend/scripts/seed-local-seedance-workflow-tariffs.ts` prepares a read-only,
fingerprinted copy of current normal customer cents into independent workflow
cells. Run with `pnpm exec tsx --tsconfig frontend/tsconfig.json` and that script
path from the worktree root. Confirmation requires its fingerprint in
`SEEDANCE_WORKFLOW_SEED_CONFIRM`. The command requires committed clean code,
the sandbox `.env.local`, a configured local admin, development and a verified
actual Unix-socket PostgreSQL connection. The apply service reproduces the
quotes under tariff/policy locks, inserts only missing workflow cells and records
an immutable pricing event. Existing normal prices are preserved. Later edits
use the existing admin preview/confirmation path.

The pricing sandbox startup applies migrations 53 and 59 along with the pricing
migrations. Its operational migration helper verifies the actual database
connection is a Unix socket before any DDL. It never initializes schema from a
read route. The current sandbox was updated in place with unchanged fingerprints
for its 14,982 tariff cells, tariff revision, versions, receipts and pricing rules;
provider credentials remain blank and execution remains off.

## Remaining release gates

- Authenticated browser smoke of the real quote/job path in workspace, library
  and Studio. The shared action has DOM coverage for separate price confirmation,
  retained outputs and expiry. The current local admin cookie is not a creator
  session and does not authorize workflow quotes. Keep deliberate MCP exclusion
  until separately supported.
- The minimum paid Draft/final provider happy path passed (see below). App-owned
  storage, cancellation and failure/refund after a successful Draft still require
  bounded canaries with a separately approved budget.
- Verify the contract's console activation immediately before any push, as
  requested by Adrien; no extra pending-contract UI is introduced.
- Production migrations/manual activation/payment reconciliation, marketing
  claims and direct-provider retirement remain their explicit release gates.

The local implementation does not write production application data or send
email, push or deploy. The separately authorized provider canary below created
exactly one paid Draft and one paid final.

## Creator ownership

The workspace hook obtains a separate canonical Draft quote, locks 480p and
persists the application job ID before dispatch in an account-scoped storage key.
An ambiguous response or reload recovers that same attempt; neither starts a new
paid task automatically. The account-scoped sidecar stores original request facts
and the quote revision, never a session token, and is removed when owned history
confirms the job. After an authoritative owned 404, an explicit resend uses the
exact original job ID, payload and quote. An explicit new Draft action is available
only after a known terminal state.

The shared library/Studio action receives only an owned application job ID. Its
read-only route returns settings, historical paid amounts, expiry and linked
output eligibility. A final quote uses the original settings server-side and a
fresh tariff revision. The user confirms the additional charge after seeing the
already paid Draft, final surcharge and combined total. Both application job
links remain accessible. Status tracking polls both owned jobs through the
existing job route, including terminal linked finals. That route may repair the
lineage of its one owned durable terminal BytePlus 2.5 job after a transient
persistence outage; the workflow DTO route remains read-only. Repair never makes
a provider call, initializes schema or changes receipts. A lineage outage cannot
skip completed media output projection. An exact server-confirmed final refund
permits a fresh quote and confirmation; ambiguous or partial refunds remain held.
Studio output links pass through its existing save/ACK navigation owner. Late
session reads cannot revive a logged-out account.

MCP intentionally excludes both workflow steps from its public preparation
schema. A normal 480p generation remains distinct from a Draft task.

## Local verification checkpoint

- PostgreSQL 17 lifecycle/submission/poll/charge and workflow pricing/seed checks: 43 passed, zero skipped. Definitive submission rejection unlocks final retry only after its exact refund receipt; uncertain acknowledgement keeps the reservation.
- Latest standard validation suite after the review fix pass: 6,651 passed, zero failed, 3 skipped. Focused creator, terminal recovery, auth and Studio contracts: 90 passed, zero skipped. Isolated committed checkout Studio HTTP suites: 4 passed, zero skipped. Browser integration is separate and has not been run for this checkpoint.
- TypeScript, frontend lint (zero warnings), exposure lint and diff whitespace checks passed. The existing 178 immutable billing and 577 public scenario baselines are unchanged. Fresh fetch confirms local main and origin/main both at 10589cc6b, already included in the branch. Optimized Next.js build passes from the isolated environment-free committed checkout; the compiler reports a Supabase process.version/Edge warning. No deployment is performed.

## Minimum-cost provider canary

Adrien authorized a $5 maximum pair and requested the shortest, cheapest test.
The existing application payload builders and ModelArk client submitted one
4-second, 1:1, silent text-to-video Draft and one final, using
`dreamina-seedance-2-5-260628` on the configured Singapore API. Both completed.
No retry or additional paid task was submitted.

| Step | Requested tier | Measured output | Provider tokens | LIST-based cost (USD) |
| --- | --- | --- | ---: | ---: |
| Draft | 480p | 640×640, H.264, 24 fps, 97 frames | 38,800 | 0.415160 |
| Final | 1080p | 1440×1440, HEVC, 24 fps, 97 frames | 196,425 | 2.2981725 |

Both files measure 4.041667 seconds, contain no audio, and retain the same square
framing. Combined LIST cost is **$2.7133325**, excluding taxes; this is calculated
from reported usage and the published rates, not an observed invoice. Raw private
responses, signed media URLs and downloaded evidence remain outside Git. The
running local pricing sandbox keeps blank provider credentials and execution off.

The canary exposed a factual estimator bug: historical short-side dimensions
underestimated square provider usage. The correction shares the [published 2.5
raster table](https://docs.byteplus.com/zh-TW/docs/modelark/seedance-2-5) between
accounting, manual supplier cost and admin comparison. It covers all eighteen
published resolution/ratio pairs and retains existing customer prices. Corrected
4-second estimates are $0.410880 for square Draft and $2.274480 for square final;
the provider's extra frame explains the slight difference in completed usage.
In 16:9, Draft is 854×480 and final is 1920×1080. A 640×480 file would be 4:3.

This provider happy path does not certify authenticated browser orchestration,
app-owned storage, failure/refund, cancellation, Studio browser integration or
production readiness. No production application DB, environment or storage was
changed. The pre-push console contract check remains required.

Fresh checks for the dimension correction: 205 focused BytePlus/Seedance tests
passed with no failures or skips. TypeScript, frontend lint, exposure and
whitespace checks passed. The 178 immutable billing and 577 public scenario
baselines remain unchanged. The full-suite/build results above belong to the
preceding implementation checkpoint and were not rerun for this focused fix.

## Local continuation checks

The same factual raster correction now covers Standard 2.0, Mini and Fast. The
published 2.0 rasters differ from 2.5 at 480p and use their own capability limits.
Accounting, manual supplier facts and admin share the corrected estimator;
customer tariffs remain unchanged. Provider/Seedance/sandbox checks passed 214
tests without skips. A subsequent PostgreSQL fault injection reproduced a job
committing `failed` before its refund, then passed after the transaction fix.
The focused refund/provider regression group passed 32 tests without skips.
It also exercises exhausted final-output copy retries: only the final is
refunded, the paid Draft remains ready, and a terminal poll repeats no copy.
These storage checks simulate the external copy boundary; they are not a live
storage canary. Broad validation of this continuation is recorded separately
after completion.
