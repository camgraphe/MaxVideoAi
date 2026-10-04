# Studio assistance accounting (gated beta)

Implemented 2026-10-03; production activation remains off. Text-only provider and
protected staging qualification are recorded in the
[main-integration evidence](../operations/studio-main-integration-2026-10-04.md).
That operational record owns migration/deployment status; this guide defines the
accounting contract and does not authorize public paid activation.

## Policy and customer contract

`frontend/src/server/studio/assistance-policy.ts` owns the initial versioned policy:
$1 maximum supplier-cost discovery allowance for Sol, $0.25 maximum sponsored Luna
allowance, both once per account, and one $100 aggregate sponsored campaign. These
are product-funded cost ceilings, not wallet credit. The customer projection shows
remaining percentages. Reservations consume the available percentage until settled.
The server may stop a request with a positive remainder when its conservative next
call reservation cannot fit. New projects and browser sessions do not renew grants.
Existing account limits and the campaign limit persist in PostgreSQL; changing a
code default does not silently reset them.

`frontend/src/lib/studio/assistance-contract.ts` owns the dated customer disclosure.
Sol costs USD $7.50 per million noncached input tokens, $0.30 per million cache-read
input tokens, and $30 per million output tokens. Output includes reasoning tokens
once. The price includes all provider calls and retries within the same client
message; exact nanodollar facts are aggregated before the next-cent rounding.
Noncached input has one fixed customer rate whether or not the provider reports a
cache write. Image tokens, instructions, schemas, tool results and repeated history
are input. This tariff is not an assertion that supplier cost is always exact.

`frontend/server/pricing/quote-studio-assistance.ts` projects the conservative
standard provider basis through `quoteCanonicalPricing`, with a 200% markup,
zero discounts/surcharges, and message-level upward subtotal rounding. This is the
new Studio assistant product and `client_message` unit; media prices are unchanged.
Every call stores the tariff/rate/policy versions and the cumulative canonical quote.
Receipts use `billing_product_key=studio_assistance` and `surface=tool`.

GET `/api/studio/assistance` returns `{ok:true,result:StudioAssistanceStatus}`.
POST uses the strict `StudioAssistanceChoice` union: explicit budget authorization
with current tariff/revision, explicit Luna/Sol choice, or paid-budget disable.
`budgetCents` is the absolute cumulative authorized ceiling; it must cover money
already spent/reserved and may leave at most $20 unspent, including pending reservations.
`maxAdditionalBudgetCents` is the maximum amount the customer may add to the current
authorization, after counting its remaining and reserved amounts. It does not fund
the wallet. Funding the wallet does not authorize assistance. No automatic reload,
card charge, or automatic switch to Luna exists. New paid calls stop immediately
when the paid authorization is disabled. Existing reservations can still settle.

## Dispatch and recovery

1. The owned conversation request records its selected assistant and funding mode
   once. Later account-choice changes cannot replace an in-flight model or tariff.
2. The Responses input-token-count endpoint counts the exact prospective payload,
   including image inputs and tool schemas. This is a non-generative preflight,
   not a second assistant response. A counting error stops before reservation or
   model dispatch. Input must be at most 272,000 tokens; output is capped at 2,200.
   Native requests use `service_tier=default`, global OpenAI processing, no SDK
   retries, no built-in billable tools, and at most four dispatched responses per client message, including retries.
3. Each model dispatch requires a committed conversation-response checkpoint and
   a monetary reservation in one transaction. The campaign lock, account lock,
   then the existing wallet reservation lock serialize competing work. Paid work
   reserves the canonical maximum incremental cents from the same receipt wallet.
4. The complete response checkpoint precedes any proposed tool execution. Settlement
   records only numeric usage and model/tier/version facts, releases unused supplier
   allowance, and refunds unused wallet reservation atomically. Customer cents are
   the incremental difference between cumulative message quotes. Replaying a settled
   response neither counts tokens nor calls the model nor charges again.
5. If settlement storage fails after a response is checkpointed, a retry settles that
   saved response before using it. Once the two-attempt retry ceiling is reached,
   an owned recorded response permits a recovery-only lease: it does not consume
   another attempt and cannot count tokens, reserve funds or dispatch another model
   call when saved responses end. Missing or invalid usage, an unknown model/tier,
   usage above the reserved token bounds, or a timeout stays unresolved. Its full
   reservation remains held. Another lease cannot resend a message with unresolved
   assistant usage. New requests share the same reduced account/campaign availability.

New assistance calls use the same account-restriction policy as media generation,
including included Sol, sponsored Luna and paid Sol. A strict read in the new-call
preflight stops before token counting when the account is restricted or the lookup
is unavailable. Reservation checks the restriction again inside its transaction,
before campaign/account/wallet locks, using the existing restriction table lock.
A restriction committed during preflight therefore prevents spending and dispatch.
The gate returns `ACCOUNT_RESTRICTED`; it does not apply to turn reopening or
settlement. Saved responses remain replayable and existing reservations can settle
or refund their unused portion after a restriction, without new supplier work.

A request rejected before any model dispatch returns a depletion error with
`nextAction.safeToStartNewRequest=true`. After the explicit budget/model choice,
the UI can preserve its draft and references and send a new request ID. If any call
was dispatched, that flag is false. If all earlier calls settled, a depleted
message is closed with a saved partial reply and `canStartFollowup=true`; after an
explicit model/budget choice the client may clear its pending marker and compose a
new follow-up, retaining the original prompt and partial reply in history. Never
automatically resend the original instructions, which might repeat completed edits.
The same saved partial closeout applies to the cumulative four-call cap and exhausted
recovery-only replay, with `nextAction.reason=call_limit`, but only when every usage
row for that message has settled. This technical cap needs an explicit “Start
follow-up” action, with no additional budget or model choice. Retrying the closed
request returns its saved reply without replaying actions or charging again.
Unresolved usage has `canStartFollowup=false`. Do not erase its pending request or
create a replacement automatically. Responses already saved under
the older unmetered pilot replay without retroactive billing.

`settleStudioAssistanceCall` is the idempotent internal reconciliation seam. It
requires trusted provider evidence and has no public endpoint. For a transport
failure with neither durable response nor trusted usage evidence, automatic
supplier reconciliation is deliberately unavailable. A wall-clock timeout is not
evidence that usage was zero. The separate `assistance-resolution.ts` owner and
[support command/runbook](../operations/studio-assistance-support.md) provide
scoped recorded-response settlement or an audited customer waiver. The latter
refunds the exact unresolved customer reservation and closes its inactive message,
while retaining unknown supplier usage and full supplier exposure. Late trusted
usage may settle provider facts without another customer charge or refund. Active
thinking leases, unfinished actions and saved creation intents are refused. An
expired thinking lease can be explicitly revoked under the locked turn and
database clock before closing the message; late workers cannot execute with the
revoked identity. Generic admin refunds cannot bypass this owner. There is no automatic
expiration or release of unknown holds.

The reservation initially appears as an `app_receipts` charge and its unused part
as a refund, using the existing wallet locking contract. Reporting must distinguish
unresolved holds from recognized assistance revenue, using settled `charged_cents`
in the Studio ledger; do not sum gross reservation receipts as revenue. No unrelated
media charge or receipt implementation is modified.

## Provider facts and audit

`assistance-provider-facts.ts` records dated supplier rates separately from customer
pricing. For Sol, standard USD rates per million tokens are $2 input, $0.10 read,
$2.50 write and $10 output. Luna is $0.10/$0.01/$0.125/$0.50. Verified 2026-10-03:
[Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), and
[token counting](https://developers.openai.com/api/docs/guides/token-counting).

A missing cache-write counter preserves a supplier cost interval: the lower bound
assumes ordinary noncached input and the upper assumes cache writes. Allowance
settlement uses the upper bound. Retail pricing remains exact because it has one
noncached rate. Missing usage/model/tier remains unknown, not zero. Long-context,
regional and nonstandard tiers are not supported by this tariff and fail closed.
Provider-returned aliases must be explicitly recognized before settlement; never
infer their rates from string prefixes.

Migrations `54_studio_assistance_ledger.sql` and
`62_studio_assistance_resolutions.sql` are explicit and never run by readers.
It stores account choices, immutable requested call identity and settled outcomes,
provider nanodollar min/max, customer cents, response/request identity and versions.
New usage facts contain no prompt, output, reference URL, key or reasoning content.
Existing response checkpoints retain their prior ownership and privacy contracts.
Financial evidence does not cascade away when a Studio project is deleted. An admin
viewer must authorize the read, whitelist fields and clearly label unresolved rows.
This ledger does not claim an immutable complete historical prompt/context manifest.

## Activation and validation

Local/preview integration requires `STUDIO_ASSISTANCE_ENABLED=true` and migrations 54 and 62.
Configured non-global `OPENAI_BASE_URL` endpoints are rejected by this policy; regional
processing needs its own reviewed rates and must not be silently rerouted.
Production additionally requires
`STUDIO_ASSISTANCE_APPROVED_POLICY=studio-beta-2026-10-03-v1`. Merely enabling the
old conversation flag can no longer dispatch an unmetered native model. The older
image-only native path fails closed; the action director is the metered path.
Offline tests explicitly inject response/token-count providers. They do not prove
real Sol/Luna tool quality, latency or provider-account eligibility.

Focused tests are `tests/studio-assistance-*.test.ts`: disposable PostgreSQL covers
account and aggregate campaign contention, isolation, funding vs authorization,
subcent aggregation, revoked budgets, unknown transport outcomes, settlement lost
ACK, persisted-response replay, and native action orchestration with injected Luna.
The real-service recovery test covers repeated settlement outages past the retry
ceiling, paid settlement exactly once, cumulative call-cap closeout, action replay
idempotency, and mixed known/unknown usage remaining locked.
Route tests cover session identity, CSRF, strict payloads and bounded body reads.
Existing conversation-run, route, usage and canonical-pricing contracts also run.
Before production review, qualify actual token-count/response parity, representative
Sol and Luna tasks, non-default provider billing settings, support reconciliation,
and the new customer-visible consent and wallet-hold language.
