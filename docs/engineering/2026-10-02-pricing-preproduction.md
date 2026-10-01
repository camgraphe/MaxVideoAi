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
account rates/invoice discounts are not certified. Do not silently relabel a LIST
or contract estimate as an observed invoice.

### Contract activation is not a release blocker for the current customer grid

On October 2, the user clarified that waiting for account activation should not
block release when customer prices remain unchanged. Customer amounts come from
authored tariff cells; the signed discount does not recalculate them. Supplier
estimates also feed internal cost snapshots, vendor share and the below-cost
guard, so they are more than display-only margin figures.

A read-only recheck of the private audit captured at
`2026-10-01T23:13:42.379Z`, revision 3,523, compares the discounted Mini/Fast and
Seedream Lite/Pro cases with undiscounted LIST: 1,829 normal/workflow cases and
1,728 source-duration stress cases, **3,557 examined and zero below LIST**.
Their minimum estimated gross margin at LIST is 24.4%, before payment and
operating fees. These are examined cases, not 3,557 unique tariff selectors or
observed invoice amounts. They certify the audited local candidate, not fresh
production tariffs.

For Mini, 5s/720p/16:9 without video input, the customer stays at $0.95:
undiscounted LIST is $0.378 (60.2% estimated gross margin), while the signed cost
estimate is $0.1512 (84.1%). Contract activation therefore changes expected
internal cost and margin, not this customer amount.

Account activation and effective invoice discounts become a non-blocking cost
reconciliation follow-up for this unchanged, LIST-validated grid. Keep the signed
estimates and LIST evidence; add no temporary activation workflow. A future
customer-price reduction that needs the discount to stay above cost must be
checked against the effective supplier rate before approval. Production capture,
parity, migrations, activation and operational acceptance gates remain required.

A separate read-only remote schema inventory at `2026-10-01T23:36:57.180Z`
finds the six new Draft/tariff/direct-quote/activation tables absent; the MCP trial
prerequisites and generation poll table exist. Private schema fingerprint:
`85cfef81e0ad3968caabdaf5c066a5466552e8930bc394f7b92a2d317512a572`.
The configured remote database is inspected without schema bootstrap or any DDL.
This inventory is a migration prerequisite check, not a deployment-environment
or production-price parity certificate.

## Release sequence to execute only after the production decision

1. Freeze the candidate and repeat Git/main/domain alignment and live legacy-payment
   inventory. Capture current production
   pricing rules, factual environment and effective scenario amounts read-only,
   binding database identity, registry/policy hashes, candidate SHA and timestamp.
   Record BytePlus account status as cost-provenance evidence; pending signed
   discount activation alone does not block the unchanged LIST-validated grid.
   Reconcile effective discounts and invoices when account activation completes.
2. Compare the complete candidate with that fresh capture. Disclose exactly the
   approved GPT one-cent floors and proportional Seedance source-duration changes;
   preserve all other customer amounts, including Seedream reference variants.
   A local certificate cannot certify fresh production policy or data.
3. Back up the exact production tariff grid/state/policy and take schema evidence.
   Review migrations 53–60 against the deployed schema, including Draft lineage,
   immutable tariff/quote history, interval locks and historical trial snapshots.
   Migrations must be applied by the explicit deployment owner, never by read paths.
   The pricing paths, in order, are `53_seedance_draft_links.sql`,
   `54_customer_tariff_cells.sql`, `55_customer_tariff_versions.sql`,
   `56_direct_payment_quotes.sql`, `57_customer_tariff_local_activation_events.sql`,
   `58_customer_tariff_bulk_interval_lock.sql`, `59_seedance_draft_final_state.sql`
   and `60_mcp_trial_provider_rasters.sql`. Do not select by numeric prefix alone:
   `53_playlist_opening.sql` is a different main-branch migration. Verify the full
   migration-31 trial prerequisites before 60, preserve historical trial rows and
   use an explicit transaction for its function/constraint replacement.
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

The first full validation used PostgreSQL 14 from
PATH: 6,705 pass, 13 fail, 3 skip; all 13 failures concern tests requiring PostgreSQL
17. It is not accepted as a green gate; final qualification explicitly selects 17.

## Final local acceptance

| Gate | Result and boundary |
| --- | --- |
| Committed whole-candidate validation, `5e8710078` | PostgreSQL 17: 6,721 standard tests passed, zero failures, three skips; all 11 isolated Studio HTTP/browser integration tests passed. |
| Optimized build, `5e8710078` | Passed; all 920 static pages generated, registry/media prebuild, type/lint and sitemap gates included. A Supabase Edge runtime warning was emitted. |
| Private active tariff grid | Revision 3,523; 18,177 cells; 20,446 normal/workflow scenarios across 48 models. Zero quote errors, legacy fallbacks or negative estimated margins. |
| Source-duration stress audit | 6,372 scenarios; zero rejected or below estimated supplier cost. |
| Audio/Tools/Storyboard products | 38 products; zero warnings, missing customer/supplier-reference values or negative estimated margins. |
| Seedream Pro append | Nine source-count variants added at the unchanged 16-cent customer amount; immutable events and private prewrite SQL backup retained. |
| Actual admin browser | Image → Seedream Pro → ten total source images shows $0.117 LIST, $0.1053 contract estimate, $0.16 customer and 34.2% gross margin. Existing authorized local admin session retained. |

Private full audit: `/tmp/mva-current-supplier-audit-preproduction-20261002.json`.
Validation/build logs: `/tmp/mva-preproduction-20261002-validation-final.log` and
`/tmp/mva-preproduction-20261002-build.log`. Actual admin screenshot:
`/tmp/maxvideoai-pricing-preproduction-20261002.jpg`.

### Browser-discovered workflow preflight correction

Actual authenticated browser acceptance found that the media-free preflight
shortcut discarded the server-resolved Draft/final step. A valid final request
returned an ordinary 1080p cell without `meta.workflowStep`, so the creator refused
that quote. The shortcut now carries the trusted step into the existing canonical
quote owner. Client-declared steps still require the server's owned-parent
resolution; neither the local publication gate nor charge validation is relaxed.

Commit `35dda2840` adds a real PostgreSQL HTTP-handler regression with deliberately
different standard, Draft and final prices. RED reproduces the missing Draft
metadata; GREEN selects 77/777-cent workflow cells rather than the 9,999-cent
ordinary offer, preserves normal 480p, rejects an unowned parent and refuses an
inactive workflow tariff. Preflight creates no receipt. All 32 focused preflight,
request and finalization tests pass; TypeScript, frontend lint and whitespace
checks pass. Its environment-free optimized build also passes with 920 static
pages, type/lint and sitemap gates; log:
`/tmp/mva-preproduction-20261002-final-build.log`.
The complete 6,721-test run above belongs to the preceding snapshot;
it is not relabeled as a full rerun of this small transport fix.

The disposable signed-auth browser session verifies the real local workflow
without `draftPreview=1`: the checkbox retains 16:9, locks 480p and one output,
and displays the compact Draft button with its separate current quote. The Media
panel reads an owned ready Draft, requests the current final quote and shows its
historical 52-cent payment plus $5.21 final and $5.73 combined. Canceling keeps the
Draft; wallet remains $100 with no charge receipt or final reservation. Studio's
authenticated project chooser also opens. No provider submission was made.

The session uses an isolated PostgreSQL 17 database, the repository's signed
loopback Auth fixture and a local 320×180 video fixture, not provider output or
real account media. Its exported snapshot receives the same preflight correction.
Missing fixture `job_outputs` data and migration 47 are initialized explicitly,
without changing product read paths. Saving to Media cannot exercise real storage
with unconfigured S3 credentials; app-owned storage and the Studio Draft import
remain live acceptance boundaries. The ordinary localhost Google OAuth problem
is separate from this fixture-backed verification. No legal terms were accepted
through the browser.

The disposable account is signed out through the actual application menu and the
browser visibly returns to the public homepage with **Log in**. Its tab, owned
application/Auth controller and PostgreSQL cluster are closed. The user's existing
admin server, session, worktree and pricing database are retained.

Screenshots: `/tmp/maxvideoai-draft-preproduction-20261002.jpg` and
`/tmp/maxvideoai-draft-final-quote-preproduction-20261002.jpg`. These illustrate
the real interface with disposable test data; they do not certify live storage.
