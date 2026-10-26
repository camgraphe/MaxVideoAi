# Admin tariff batches

The optional **Tariff batches** section in `/admin/pricing` authors literal prices
for the complete 226-class Kling 4 domain or an explicitly selected subset. It
neither publishes the model nor enables generation. The existing unit editor and
canonical billing owners remain authoritative. No runtime coefficient is added.

## Admission and compatibility

Migration `81_customer_tariff_batches.sql` adds a disabled control row, a durable
operation journal and immutable receipts. It writes no tariffs. PostgreSQL 17 is
required (the executor uses its transaction timeout). Installation and activation
are separate release decisions; normal Git/Quality CI/Vercel delivery rules apply.

Admission requires `PRICING_ADMIN_BATCHES_ENABLED=1`,
`PRICING_ADMIN_BATCHES_TARGET_ID` equal to the control row's UUID, and an enabled
control row whose `source_id` equals `VERCEL_GIT_COMMIT_SHA`. Rebind the control row
only to an explicitly reviewed deployed commit. Older deployments cannot confirm
new or old previews. Missing schema/configuration fails closed. Local development
instead uses `PRICING_ADMIN_BATCHES_SOURCE_ID` and requires a localhost Unix-socket
DB URL; no remote development override is accepted. The tariff registry itself
must already be active through its existing code and database gates.

Disabling admission stops new previews/confirmations; authorized status and
reconciliation remain available. An apply transaction takes a shared control lock,
so disabling waits for that transaction to finish. Disabling is not a rollback of
already committed prices.

## Ownership and protocol

`server/pricing-admin/tariff-batches/` owns the workflow:

- `kling.ts` adapts canonical scenarios, deduplicates continuous Modify into two
  classes, and compiles LIST recipes using decimal integer arithmetic.
- `input.ts` accepts strict bounded USD proposals: at most 226 distinct classes,
  a 1–10 multiplier with at most six fractional digits, or explicit fixed/unit
  prices. HTTP bodies are limited to 2 MiB. Client actor, timestamps, currency,
  target IDs, expiry and routing properties are rejected.
- `planner.ts` resolves actual effective cells from a complete model-scoped snapshot (including every exact exception and historical/future interval), preserves their stable IDs, quotes
  through `computeCanonicalBillingSnapshot`, and validates continuous domains
  through `validateCurrentContinuousTariffDomain`. Unavailable state never means
  missing. Exact active exceptions and scheduled future prices block a continuous batch edit. The selected-model loader remains in the canonical tariff store and validates unknown ownership rather than assuming it is absent.
- `service.ts` owns durable preview, claim, apply, status and reconciliation.
  `store.ts` owns operation SQL; existing tariff and event stores own prices and
  immutable per-cell history. Routes delegate through `http.ts`, which requires
  admin authorization before reading the body and same-origin JSON for mutations.
- Route-local React components render selection, complete review (including inspectable previous/proposed expressions, provenance, versions and intervals) and recovery.
  The hook stores only the operation UUID in versioned browser storage scoped to the authenticated administrator. History
  lists fetch 50 compact summaries; receipt details load on demand.

A preview persists a server-created operation UUID, actor, normalized proposal,
complete plan, source/target identity and ten-minute expiry. Its SHA-256 fingerprint
also includes canonical supplier facts and loaded policy. No tariff/event writes
occur during preview. `create_missing` preserves conforming cells and refuses
different existing prices. `replace_selected` refuses missing targets. Overlap,
unsupported options or other uncertainty blocks confirmation of the whole batch.

Confirm accepts only `{operationId, fingerprint}`. A short locked transaction
claims `previewed → accepted` and increments the execution epoch. Only that winning
handler calls apply. Apply locks the operation, control, global tariff revision,
then policy, rebuilds the fingerprint, and writes every changed row through
`upsertCustomerTariffCell` on the same branded executor. Versions, per-cell events,
receipt and `committed` status commit together. The global revision increases by
one per changed cell. Conforming rows retain all dates, IDs and event history.
Each changed row retains the existing store's server timestamp semantics; atomic
visibility does not imply a single historical effective instant.

Waits are capped at one second, statements and the complete PostgreSQL transaction
at five seconds. A failure rolls back the entire financial transaction. These are
qualification bounds, not permission to lengthen production timeouts. Revalidation
runs once after commit; a failure warns that prices committed and must not be
submitted again. It does not undo or mutate the immutable receipt. A pending refresh record commits with the receipt; its operational outcome survives reload. The authorized same-origin refresh endpoint retries only invalidation, including when price admission is disabled. It never re-enters confirmation or writes financial history.

A duplicate confirmation reads the existing operation. Status is read-only.
Reconciliation takes the operation row with `NOWAIT`: a live executor returns
`accepted`; a committed operation returns its original receipt. If an accepted
operation has no committed receipt and no lock owner, reconciliation marks it
`not_applied` and increments its epoch. Any delayed executor then fails its
status/epoch guard. A lost SQL commit response follows this same recovery path.
An unavailable response stays unknown until the durable status can be read.

Rollback is a new preview using an immutable prior receipt. Each selected current
cell must exactly equal the recorded after-state, including ID, version and dates;
same-price ABA edits therefore block rollback. Restoration creates new versions.
Active creations cannot be rolled back to absence. The UI offers restoration of
the operation's updated cells and preserves creations. The API permits an explicit
subset of eligible cells from a receipt owned by the same administrator.

## Exact import

Import the complete proposal below, using canonical selectors returned by the
options endpoint. This example selects the 5-second 720p text-to-video class:

```json
{
  "schemaVersion": 1,
  "modelId": "kling-v4",
  "intent": "replace_selected",
  "reason": "Reviewed customer tariff",
  "pricing": { "kind": "explicit" },
  "selections": [{
    "selector": {
      "engineId": "kling-v4", "mode": "t2v", "resolution": "720p",
      "durationSec": "5", "billingInputType": "no_video_input"
    },
    "price": { "kind": "fixed", "customerCents": 118 }
  }]
}
```

Continuous prices use `kind=unit_terms`, `rounding=up`, and one term with
`unit=billable_seconds` and a literal `centsPerUnit`. Supply continuous selectors
from the canonical options; do not enumerate sampled input durations.

## Local verification and operational limits

The batch planner, routes, real PG17 and connected browser tests are under
`tests/admin-tariff-batch*.test.ts`. The browser fixture mounts the real components
and service against a disposable database; HTTP authorization boundaries have a
separate route test. Fixtures check the Unix socket and PG17 before application
DDL and never use inherited remote credentials. Existing exhaustive tariff,
reservation/revision, paid snapshot and admin smoke suites remain required.

Local latency measurements do not establish remote database latency or production
readiness. Before later activation: review the exact published source, pass current
required CI, reconcile migration numbering, install migration while disabled,
verify both production domains against that source, check PG17 and control target,
and qualify latency on the authorized target. Any unknown state or contention
failure requires a fresh current-state review. Never replay a timed-out batch or
infer absence from an unavailable lookup. Keep the operation UUID for recovery.
