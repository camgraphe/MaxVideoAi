# Pricing branch preproduction acceptance — October 2, 2026

This continuation remains local. No push, PR publication, merge, deployment,
production database/environment/storage mutation, payment change or message is
part of its authorization. `customer-tariffs.json.active` remains false.

## Independent review and resolved findings

One fresh review covered `d10ad4587..dd5a133e6` across canonical quotes, continuous
retail tariffs, captured payments, Draft lineage, public current-price consumers
and local migration evidence. It found no confirmed Critical issue and two
Important issues.

### Seedream Pro reference accounting

Actual image charging, image estimates and MCP settlement now forward the total
validated submitted image count. The shared Seedream factual projection includes
the main edit source once and every additional source. Admin comparison and
manual settlement use that same count. Coverage includes all ten allowed sources;
the original single-source selector is preserved. Additional-source variants have
separate guarded cells, retaining the original authored customer amount. Lite's
per-output retail identity remains unchanged.

For one 2K 16:9 Pro output, ten sources produce $0.117 LIST and $0.1053 signed
contract estimate rather than $0.090/$0.081 for one source. A nine-cent manual
proposal for ten sources is rejected. The actual image billing helper, estimate,
MCP transaction and admin guard are exercised against disposable PostgreSQL 17.
Historical paid quotes remain unchanged. These are supplier estimates, not invoice
verification.

The private sandbox append uses a private fingerprinted preview, locked reproduction, a
bounded insertion and an immutable change event; its receipt is kept outside Git. It preserves the one-source
customer amount across the nine newly exposed source-count variants.

### Legacy direct-payment deployment boundary

Keep `DIRECT_PAYMENT_QUOTE_UNAVAILABLE` fail-closed: old Stripe metadata may lack
framing, audio and the complete original snapshot, so reconstructing a quote from
today's prices would be unsafe.

A read-only inventory of the configured live Stripe account completed all pages
on October 1 at 23:02:58 UTC (October 2 local time): 855 intents examined, **zero
legacy `kind=run` intents**, zero captured unreconciled legacy payments and zero
open legacy direct checkouts. Its private report records live/test mode and the
pagination boundary; it contains no secret/client-secret export. Database access
uses a repeatable-read, read-only transaction and no schema bootstrap.

This resolves the inventory gate at that instant. Repeat the inventory immediately
before publication, since the current production version can create new old-style
intents. If any appear, stop cutover and review their immutable paid/job/receipt
facts. Recover only with sufficient original evidence; otherwise prepare explicit
cancellation/refund/reconciliation for approval. This continuation performs none
of those financial writes.

## Account and Git evidence

Fresh `git fetch origin main` finds local main and origin/main at
`d10ad458743aef68e6e9be12cad9c611f06077b8`. The read-only `deployment:check` confirms
both maxvideoai.com and api.maxvideoai.com serve the same READY Git-main deployment
`dpl_B1xi8TtrQ1viCBJ3XbEjWG6HCS4y` with that SHA. The candidate contains it.

Read-only BytePlus Finance evidence still shows contract `CT20260925128931` as
**In contract generation**, completion time absent, and the account discount list
empty. Keep the signed terms in cost estimates as the user requested; effective
account rates/invoice discounts are not certified. Recheck activation before
publication; do not silently relabel a LIST estimate as an observed invoice.

## Release sequence to execute only after the production decision

1. Freeze the candidate and repeat Git/main/domain alignment, live legacy-payment
   inventory and BytePlus contract activation checks. Capture current production
   pricing rules, factual environment and effective scenario amounts read-only,
   binding database identity, registry/policy hashes, candidate SHA and timestamp.
2. Compare the complete candidate with that fresh capture. Disclose exactly the
   approved GPT one-cent floors and proportional Seedance source-duration changes;
   preserve all other customer amounts, including Seedream reference variants.
   A local certificate cannot certify fresh production policy or data.
3. Back up the exact production tariff grid/state/policy and take schema evidence.
   Review migrations 53–60 against the deployed schema, including Draft lineage,
   immutable tariff/quote history, interval locks and historical trial snapshots.
   Migrations must be applied by the explicit deployment owner, never by read paths.
4. Prepare a production-specific, locked reproduction and atomic activation of
   the reviewed grid/revision/event. The existing `pricing:activate:local` command
   intentionally refuses production and must not be repurposed by substituting a
   remote DATABASE_URL. Production activation needs its own reviewed manifest and
   execution path. Enable the code switch only alongside that complete grid.
5. Run GitHub Quality/build checks and inspect the preview; merge/deploy only with
   the user's production authorization. Smoke-test current quote parity across
   app/MCP/Studio/public pages and a bounded authenticated paid workflow, preserving
   quoted amounts, refunds and original media.
6. Roll back code to the recorded Git deployment if necessary. Restore commercial
   state through a new immutable compensating event under the revision lock;
   never delete tariff versions, rewrite paid receipts or replay a provider call.
   Handle jobs already accepted using their original captured quote and lineage.

## Remaining acceptance boundaries

Automated local auth, database, charging/refund and provider-boundary fixtures are
separate from a real authenticated app-owned storage canary. The preceding shortest
provider Draft/final pair succeeded; it does not prove real app storage/polling.
No additional paid call is authorized by this continuation. Production-specific
capture/activation and that operational canary remain explicitly bounded release
steps. Draft generation is deliberately local-only, text-to-video and one iteration
until a reviewed publication decision changes that gate.

Full candidate validation, optimized build and actual browser acceptance results
are added below when complete. The first full validation used PostgreSQL 14 from
PATH: 6,705 pass, 13 fail, 3 skip; all 13 failures concern tests requiring PostgreSQL
17. It is not accepted as a green gate; final qualification explicitly selects 17.
