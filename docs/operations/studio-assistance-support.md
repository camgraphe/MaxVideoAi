# Studio assistance support

This procedure resolves customer reservations separately from provider cost evidence.
It requires migrations 54 and 62 and the matching application source. It does not
enable assistance, create a model request, replenish an allowance, or authorize
media generation. The command has no public HTTP endpoint.

## Inspect the exact target

Use the approved database credential environment on the operator's machine. Do not
paste a database URL or key into a ticket. Set `STUDIO_SUPPORT_TARGET` to the
independently verified database host, port and database name, in the form
`host:5432/database`; Unix-socket local fixtures use `socket-path:5432/database`.
The command rejects a mismatch before any database operation. `--environment`
records whether the intended target is `local`, `staging` or `production`.

From the repository root:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json frontend/scripts/resolve-studio-assistance.ts --target "$STUDIO_SUPPORT_TARGET" --environment production --list
```

This is a read-only queue of unresolved supplier calls, with at most 100 rows per page.
The JSON result has `items` and `nextCursor`; when the latter is not null, repeat
the same command with `--cursor <nextCursor>`. Optional `--limit` accepts 1–100,
`--user <exact-user-id>` restricts the account, and `--waiver` accepts `all`,
`unwaived`, `waived` or `automatic`. The automatic filter selects customer waivers
recorded by `system:composer-unanswered`. A cursor is tied to its user and waiver
filters. Rows are ordered by waiver status, creation time and call ID. This is not
a snapshot: settlements or other changes during a scan can remove or move rows;
repeat the scan when a complete current inventory is required. Only unknown calls
and reservations older than three minutes are included.

Customer holds
come first; rows marked `customer_waived` retain supplier exposure but no longer hold
the customer's money or prevent their assistance choices. Use the exact call ID
for the next command. Review this queue at opening, during the opening support
watch, and for assistance billing tickets. Record the call ID and outcome in the
support case. Do not present gross reservation receipts as recognized revenue;
the assistance ledger's settled `charged_cents` owns customer charges.

The admin Studio interaction view shows known/unknown supplier cost, the original
customer reservation, and any support release. It is scoped to nondeleted Projects
and requires an audited reveal. The queue also covers financially retained calls
whose Project was deleted. Neither queue nor command outputs prompts or responses.

## Diagnose the composer exposure cap

For an account reporting that support recovery is required, verify its exact user
ID through the approved support process, then run this read-only diagnostic:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json frontend/scripts/resolve-studio-assistance.ts --target "$STUDIO_SUPPORT_TARGET" --environment production --diagnose --user "$STUDIO_SUPPORT_USER"
```

`unreconciledCount` uses the admission cap's exact predicate: automatic composer
waivers whose supplier calls are not settled. `blocked` means at least three such
calls, not that every other admission condition is clear. This diagnostic includes
recent reserved calls if present, unlike the age-filtered general queue. Follow
`nextCursor` with `--cursor`, keeping the same exact user; the opaque cursor is
bound to that account and `--limit` is bounded to 100.
Each page and its count are a statement snapshot, while per-call evidence checks and
subsequent pages can race with settlement. Evidence previews run at most two at a
time. Rerun from the start after changes.

`ready` means the existing settlement preview accepted recorded, scoped usage at
inspection time; run the usual `settle_recorded` preview and fingerprinted apply
below. `evidence_unavailable` includes missing or invalid evidence and never means
zero usage. `already_settled` means the preview observed a settlement after page
selection; that row and its original reserved exposure can still appear in the
page's earlier count, so restart the diagnostic to refresh the cap state. An HTTP
provider request ID alone is not usage evidence, and provider
responses use `store:false`; do not assume they can be retrieved. If no valid
recorded evidence exists, retain the exposure and escalate rather than resetting
the counter, inventing usage, or applying another waiver. A settlement after a
customer waiver records supplier facts without charging that customer again.
The diagnostic is read-only and does not reveal prompts or responses.

## Recover a recorded response first

Set `STUDIO_SUPPORT_CALL` to the exact call UUID. Preview is the default:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json frontend/scripts/resolve-studio-assistance.ts --target "$STUDIO_SUPPORT_TARGET" --environment production --call "$STUDIO_SUPPORT_CALL" --action settle_recorded
```

This action accepts only provider usage already recorded under the same user,
Project, request, lease and response index. It refuses absent, malformed,
out-of-bounds or unsupported-model/tier evidence. There is no usage JSON argument
and no supplier API call. Review the returned identity and fingerprint. Set
`STUDIO_SUPPORT_FINGERPRINT` to that exact fingerprint and `STUDIO_SUPPORT_OPERATOR`
to the named operator's internal identity, then apply the reviewed decision:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json frontend/scripts/resolve-studio-assistance.ts --target "$STUDIO_SUPPORT_TARGET" --environment production --call "$STUDIO_SUPPORT_CALL" --action settle_recorded --apply "$STUDIO_SUPPORT_FINGERPRINT" --operator "$STUDIO_SUPPORT_OPERATOR" --reason "Support case STUDIO-123: reconcile the recorded response"
```

An intervening change invalidates the preview. Inspect again; do not alter the
database to force it through. Repeating the same approved operation is idempotent.
After settlement, the user may explicitly resume the original saved request; the
existing response/action checkpoints prevent repeated completed actions. Recovery
beyond the normal retry limit cannot dispatch another model call. Settlement can
recover after paid authorization is disabled or an account restriction is applied.

## Release the customer's unresolved reservation

If no usable recorded evidence exists, choose `waive_unknown` with the same
preview/apply workflow. This is an explicit support decision to absorb an unknown
supplier outcome. A timeout is never treated as proof of zero supplier usage.

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json frontend/scripts/resolve-studio-assistance.ts --target "$STUDIO_SUPPORT_TARGET" --environment production --call "$STUDIO_SUPPORT_CALL" --action waive_unknown
```

Use the returned new fingerprint for `--apply`, with a named operator and support
case reason. The command validates the original wallet charge, refunds exactly
that unresolved reservation once, records an immutable support decision, and
closes the original message with an honest saved reply after all its customer
holds are resolved. Earlier settled charges and completed edits remain. The
customer can read/resume this closed message and compose a new follow-up. The
original instructions and actions are never resent automatically.

For included Sol or Luna, no wallet credit is created. Their supplier exposure
continues consuming the original account/campaign allowance until authoritative
usage is known. New Projects do not reset that exposure. For paid Sol, the released
reservation returns to the existing authorized budget; this does not raise the
budget, select a different model, enable a disabled budget, or recharge the wallet.

Actual supplier state and usage stay unknown, with the full supplier reservation
retained. If authoritative evidence later reaches the existing settlement owner,
it may record the real provider cost, but it cannot recharge this waived call or
refund the customer again. Supplier accounting and customer support disposition
remain separately inspectable. The CLI cannot import arbitrary supplier evidence;
evidence obtained outside the durable checkpoint needs an individually reviewed
binding to the existing internal settlement seam.

## Refusals and escalation

- An active thinking lease is refused. An expired thinking lease with no started
  actions, saved draft or quote can be explicitly revoked by the reviewed waiver.
  The transaction locks the exact turn, checks expiry using the database clock,
  rotates its lease identity and records the revoked identity before closing it.
  A late worker can report supplier usage but cannot execute an action or overwrite
  the closed reply. This also recovers exhausted retry attempts after a process
  crash. Expiry never means that provider usage was zero; it only makes the old
  execution lease eligible for explicit revocation. Never edit lease state by hand.
- Saved creation intents, quotes or unfinished actions require their own recovery;
  this command cannot discard or repeat them. Missing/deleted Projects are allowed
  only when there is no live owned turn to execute.
- A changed preview, receipt mismatch, prior unrelated refund, or unknown schema
  is a hard refusal. Inspect the exact records; do not fabricate usage, use a
  generic wallet refund/top-up, reset an allowance, or delete financial rows.
- If unresolved customer holds accumulate, disable new assistance through
  `STUDIO_ASSISTANCE_ENABLED=false`, keep support reconciliation available, and
  investigate the provider/storage failure. Saved reservations and financial
  evidence survive the disable.

Generic admin refunds reject Studio assistance charges. Only the assistance owner
may reconcile them, because it also owns subsequent usage settlement and the
customer's remaining budget. There is no automatic expiration, bulk apply,
automatic supplier retry, or background credit issuance in this procedure.

## Composer pending replies

Composer admission/worker recovery is documented in
[bounded Milo reply recovery](../engineering/prompt-assistance-recovery.md).
The browser may stop waiting or leave the chat while its saved request continues;
Check previous reply remains attached to the original chat and never applies or
generates automatically. A new Send may stay account-blocked up to its fixed 600 s
deadline plus closeout grace. This is not cancellation or a second charge.

Durable work checkpoints late supplier evidence even after customer waiver. Cron
can settle valid saved evidence without recharging the customer or reopening the
failed reply. Invalid evidence marked `lateSettlementError=USAGE_UNRESOLVED` needs
explicit recovery/support and retains unknown exposure; it is not proof of zero
cost. A transient database failure leaves automatic settlement retryable. Use the
same exact-call diagnostic and fingerprinted support owners above. Never reset
the exposure cap or rewrite a stored response to restore access.
