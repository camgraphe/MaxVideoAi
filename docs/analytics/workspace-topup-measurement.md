# Workspace first-top-up measurement

Added 2026-09-30 after the local-currency payment review in PR #367.

## Collection

The existing authenticated `/api/checkout-events` endpoint writes to
`checkout_interaction_events`. No new table or tracker is introduced. Operational
events contain amount/currency/status/timing, never prompts, emails or payment
details. The server obtains the user from authentication. Collection is best effort:
browser events can be lost; an absent event is not proof of an absent interaction.

| Event | Meaning |
| --- | --- |
| `topup_review_opened` | Payment modal committed while the tab is visible, once per modal mount. |
| `topup_currency_resolved` | Currency request finished; `ready` or USD `fallback`, with `latency_ms`. |
| `topup_quote_resolved` | Quote request finished; `ready` or `error`, with request latency and the local amount before tax. |
| `topup_quote_displayed` | Settled quote rendered while the tab is visible; not proof the user read it. Deduplicated by amount/currency/display value within a modal mount. |
| `topup_quote_fallback_displayed` | The Stripe fallback message was rendered, without a displayed quote. |

These events use `metadata.source=workspace`, `measurement_version=1`, mode
`hosted`. Aborted/superseded requests emit no resolution event. Latencies cover
request dispatch through response parsing, excluding the other request and UI
commit. `amount_cents` is USD wallet credit; `payment_amount_minor` is the charge
currency. `tax_included=false`; do not sum currencies or treat quotes as revenue.

Existing stages remain authoritative for their own purpose:

- `hosted_checkout_requested`: actual submit, before CAPTCHA/session creation.
- `hosted_checkout_redirecting`: navigation attempted, with the Stripe session ID;
  not proof the external Stripe page loaded.
- `hosted_checkout_success_return` / `hosted_checkout_cancelled_return`: browser
  return, not verified payment. Returns currently omit source; recover attribution
  from the exact session's redirect rather than assigning all returns to billing.
- `app_receipts` with type `topup` and a Stripe payment-intent reference: recorded
  Stripe wallet credit. It is not net cash/revenue; refunds, fees and tax remain in
  Stripe. The webhook's confirmed payment remains separate from browser events.
- `express_checkout_session_ready`: passive preparation, never payment intent.

## Repeatable report

`workspace-topup-funnel.sql` is a single read-only query. Set its three UTC bounds
explicitly for each snapshot and bind `:admin_ids` from the current
`frontend/lib/admin/exclusions.ts` definition. Never copy those IDs into OUTREACH.
The initial bounds are a fixture/baseline window; quote events did not exist then.
Zero observations produce a **null rate**, not 0% conversion.

The cohort is each non-admin person's first observed workspace review **in the
selected window**, excluding anyone with an earlier Stripe top-up. Observe seven
days after that review. Quote → workspace submit → first Stripe top-up must occur
in this order. These are unique people, not an event/session count. Cohorts with
less than seven days of follow-up are pending and excluded from the percentage.

`ordered_first_topup_users` includes the first Stripe top-up after the click even
if it took another path. `session_matched_first_topup_users` additionally requires
the receipt's exact session to match a subsequent workspace redirect. A missing
redirect event can undercount this stricter measure. The success-return count is
a separate browser signal, attributed only through an exact-session workspace
redirect; never substitute it for a receipt.

This is an observed sequence, not causal attribution, an A/B test, or a complete
journey model. Reopening is a new review event; changing bounds can move a person's
first observed review. Compare only fixed, disjoint cohorts with equivalent
follow-up, route mix and acquisition mix. Initial rollout changes both collection
and presentation, so historical quote-view conversion cannot be reconstructed.
The query uses server reception timestamps. Concurrent beacons can arrive out of
order; loss or reordered delivery can undercount the ordered stages and matched
returns. Absence of a stage does not establish an abandonment cause.

Read-only SQL/CSV snapshots and the business baseline belong in the OUTREACH
`sources/2026-09-30/business-activation/` dossier. Keep only aggregates there.
