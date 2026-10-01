# Seedance 2.5 local Draft lifecycle

## Scope

This continuation implements real server orchestration for one text-to-video
Draft 480p and a separately paid final 1080p, retaining the previously approved
workspace checkbox. The existing preview remains a simulation until creator
controls are connected and the local workflow is explicitly enabled. Production
execution is unavailable through the local gate.

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

## Remaining release gates

- Connect the approved workspace UI, owned library and Studio actions to the real
  quote/job path; retain deliberate MCP exclusion until separately supported.
- Bounded paid account canaries for Draft, final, cancellation, storage and
  failure/refund after a successful Draft, with an approved budget.
- Verify the contract's console activation immediately before any push, as
  requested by Adrien; no extra pending-contract UI is introduced.
- Production migrations/manual activation/payment reconciliation, marketing
  claims and direct-provider retirement remain their explicit release gates.

No production write, provider job, email, push or deployment is performed by
this local implementation.

## Local verification checkpoint

- PostgreSQL 17 lifecycle/submission/poll/charge and workflow pricing/seed checks: 43 passed, zero skipped. Definitive submission rejection unlocks final retry only after its exact refund receipt; uncertain acknowledgement keeps the reservation.
- Standard validation suite: 6,639 passed, 3 skipped. Studio HTTP tests deliberately refuse a checkout containing environment files and must run from an isolated committed checkout.
- TypeScript, frontend lint, exposure lint and diff whitespace checks passed. The existing 178 immutable billing and 577 public scenario baselines are unchanged.
