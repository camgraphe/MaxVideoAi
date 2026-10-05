# Studio assistance credits (gated beta)

Implemented 2026-10-03; the new credit policy remains gated. The approved legacy
assistance policy remains supported until an explicit credit-policy activation. Text-only provider and
protected staging qualification are recorded in the
[main-integration evidence](../operations/studio-main-integration-2026-10-04.md).
That operational record owns migration/deployment status; this guide defines the
accounting contract and does not authorize public paid activation.

## Policy and customer contract (2026-10-05)

The new credit policy is `studio-credits-2026-10-05-v2`. It remains closed in
production until separately approved. An existing
`studio-beta-2026-10-03-v1` approval continues the legacy allowance and wallet-limit
policy without reading credit tables or changing its tariff. Unknown approvals
remain disabled; neither approval implies the other. `assistance-policy.ts` selects
monthly credits and Luna fair use; the public contract lives in
`frontend/src/lib/studio/assistance-contract.ts`.

GPT‑6.1 Sol receives **500 free credits per UTC calendar month**. 1,000 credits
represent USD $1 of customer usage, not 1,000 raw model tokens. Free credits do not
carry forward. Purchased $2/$5/$10 packs grant 2,000/5,000/10,000 credits, accumulate
without expiry and are consumed in purchase order, after available free credits.
The dialog displays available/total quantities, reserved quantities, and per-pack
history. A $2 pack followed by $10 increases total purchased credits to 12,000;
previous consumption is retained in the available amount and gauges.

A `purchase_pack` POST includes fixed `amountCents`, current tariff and expected
account revision, plus a UUID `purchaseKey`. It debits the existing USD MaxVideoAI
wallet once and records a durable purchased lot in the same transaction. It also
explicitly enables purchased Sol usage after free credits. It neither charges a
card nor automatically refills. Replaying the same account/purchase identity
returns current status without another debit, even after the original revision
changed; a different amount/tariff under that identity is refused. Distinct
purchases with one stale revision cannot both succeed. Insufficient funds or an
account restriction rolls back the whole purchase. `disable_paid` pauses new
purchased usage; credits are retained, and existing holds can settle. `resume_paid`
requires the current tariff and revision. Selecting Sol does not resume paused
purchased usage; the dialog provides a separately labelled resumption control.
Legacy paid authorization is inactive for new credit-policy turns and status; its
stored evidence remains unchanged for historical settlement. Only an explicit
current pack purchase or resumption authorizes the new paid tariff.

Allowance, paid spending and paid reservation totals are scoped to each call's
frozen policy and tariff. A rollback to v1 cannot count purchased-credit
consumption as a legacy wallet debit. Unresolved exposure remains visible across
policies, preserving its recovery guard. New pure purchased calls with zero
sponsored exposure do not receive a campaign identity; historical rows remain
unchanged.

`assistance-credit-ledger.ts` owns grant creation, purchases, allocation holds,
settlement and support releases. The account lock serializes these operations.
Reads project an uncreated current-month grant without writing; mutations insert
it once. The month derives from the database transaction clock in UTC. Settlements
and releases return unused holds to their original lots, including an expired
free month; they cannot consume or replenish the next month's grant.
`included.priorReserved` exposes outstanding older-month holds separately from
the current grant and its gauge. No old free remainder becomes spendable again.

Sol tariff `studio-sol-usd-2026-10-05-v2` costs $5 per million noncached input
(tokens use the conservative cache-write supplier basis), $0.20 cached input, and
$20 output, including reasoning once. `quote-studio-assistance.ts` applies **100%
markup** through the canonical pricing kernel: basis ×2, then one upward cent
rounding for the cumulative client message. This implies 50% theoretical gross
margin before other costs when actual supplier cost equals that basis. The earlier
`studio-sol-usd-2026-10-03-v1` quote remains available for historical settlements
at its original 200% markup. Media tariffs are unchanged. Reservations and
settlements always use the call's frozen tariff; unsupported versions fail closed.

Current Sol usage reserves credits, then settles the actual incremental cumulative
message quote. It **never debits the wallet a second time**. Purchases use
`billing_product_key=studio_assistance_pack`; legacy per-call wallet receipts retain
`studio_assistance`. Do not add pack purchase debits to credit usage as two customer
charges. Credit funding stores total quoted/settled customer cents (including free
usage); the call's `charged_cents` records only the purchased portion consumed.

GPT‑6 Luna has **no monthly per-account quota**. The existing owned conversation
lease admits one active message per account. Reservation also refuses another
request while a Luna call has unresolved usage. Its generous context bound is
128,000 input tokens; the existing 2,200 output-token and four-call message bounds
remain. Complex creative direction may recommend GPT‑6.1 Sol; a change requires
an explicit customer choice. Luna uses `reasoning.effort=medium`, like the existing
director. The sponsored campaign remains an operational availability gate, with
its existing persisted $100 supplier ceiling; this code does not increase or renew
it. Production launch requires an explicit operational funding decision, in
addition to policy approval. For conservative campaign protection, a Sol message
using any included credits counts its full call supplier exposure, including calls
with zero additional credits after cumulative cent rounding. Pure purchased
messages do not consume sponsored exposure. Unknown exposure stays held.
`sponsoredAvailable` projects campaign availability without exposing its budget.
When sponsored funds are exhausted, Luna and Sol with available free credits are
unavailable. Free-first order is preserved; buying a pack cannot bypass this
outage, and the dialog explains and disables that purchase. Sol with no available
free credits can still use authorized purchased lots, independently of the
sponsored campaign.

GET `/api/studio/assistance` remains private and read-only. Its `credits` projection
adds free month/renewal, purchased totals and ordered pack quantities. The client
schema refuses inconsistent balances. The earlier `authorize_paid` ceiling is
retained only for the legacy injected policy, and is refused by the new policy.
Existing wallet ceilings are not converted into purchased lots: they were never
prepaid. No customer or historical balance is rewritten by the migration.

The discreet footer uses the live MCP integration registry and localized setup
paths for ChatGPT, Claude and Codex. Links open separately from the editor; the
external assistant's plan/limits apply. They do not install, authorize or spend.

## Dispatch and recovery

1. The owned conversation request records its selected assistant and funding mode
   once. Later account-choice changes cannot replace an in-flight model or tariff.
   A policy transition reports `policy_changed` with the actual scoped completed
   call count. Before any dispatch, the client may explicitly start a new request.
   Fully settled partial work is closed once and offers an explicit follow-up,
   without redoing its saved actions. Unknown or reserved usage prevents that
   closeout. A canonical support waiver can release a new request without turning
   an unknown old response into permission to replay it.
2. The Responses input-token-count endpoint counts the exact prospective payload,
   including image inputs and tool schemas. This is a non-generative preflight,
   not a second assistant response. A counting error stops before reservation or
   model dispatch. Input must be at most 272,000 tokens; output is capped at 2,200.
   Native requests use `service_tier=default`, global OpenAI processing, no SDK
   retries, no built-in billable tools, and at most four dispatched responses per client message, including retries.
3. Each model dispatch requires a committed conversation-response checkpoint and
   a monetary reservation in one transaction. The restriction lock, campaign lock, and account lock serialize competing work.
   Current Sol calls reserve the maximum incremental credits across owned lots.
   Wallet locks apply at pack purchase; legacy paid calls retain their original
   per-call wallet reservation contract.
4. The complete response checkpoint precedes any proposed tool execution. Settlement
   records only numeric usage and model/tier/version facts, releases unused supplier
   exposure, and releases unused credit holds (or legacy wallet holds) atomically. Customer cents are
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
returns the exact unresolved customer reservation to its original credit lots
(or refunds its legacy wallet reservation) and closes its inactive message,
while retaining unknown supplier usage and full supplier exposure. Late trusted
usage may settle provider facts without another customer charge or refund. Active
thinking leases, unfinished actions and saved creation intents are refused. An
expired thinking lease can be explicitly revoked under the locked turn and
database clock before closing the message; late workers cannot execute with the
revoked identity. Generic admin refunds cannot bypass this owner. There is no automatic
expiration or release of unknown holds.

For legacy wallet-funded calls, the reservation appears as an `app_receipts` charge and its unused part
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

Migrations `54_studio_assistance_ledger.sql`,
`62_studio_assistance_resolutions.sql` and `63_studio_assistance_credits.sql` are
explicit and never run by readers. Migration 63 adds immutable lot identity,
funding/allocation outcomes and support `refund_credits` evidence.
It stores account choices, immutable requested call identity and settled outcomes,
provider nanodollar min/max, customer cents, response/request identity and versions.
New usage facts contain no prompt, output, reference URL, key or reasoning content.
Existing response checkpoints retain their prior ownership and privacy contracts.
Financial evidence does not cascade away when a Studio project is deleted. An admin
viewer must authorize the read, whitelist fields and clearly label unresolved rows.
This ledger does not claim an immutable complete historical prompt/context manifest.

## Activation and validation

Local/preview integration requires `STUDIO_ASSISTANCE_ENABLED=true` and migrations 54, 62 and 63.
Configured non-global `OPENAI_BASE_URL` endpoints are rejected by this policy; regional
processing needs its own reviewed rates and must not be silently rerouted.
Production credits additionally require
`STUDIO_ASSISTANCE_APPROVED_POLICY=studio-credits-2026-10-05-v2`. The earlier
production approval keeps the legacy policy operational and does not activate
credits. Runtime status, new turn identities and assistant interface guidance
follow the effective policy; historical responses and settlements retain their
recorded versions. Legacy support and settlement require only migrations 54/62;
credit activation also requires migration 63. Merely enabling the
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
