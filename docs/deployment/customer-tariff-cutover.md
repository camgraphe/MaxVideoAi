# Customer tariff cutover

Prepared October 2, 2026, for `codex/bytedance-pricing-grid`.
The [local acceptance record](../engineering/2026-10-02-pricing-preproduction.md)
owns completed checks and their limits. This runbook prepares the production
decision; it grants no permission to mutate a remote environment or publish.
The [local PR proposal and complementary checks](2026-10-02-pricing-pr-proposal.md)
record the latest read-only deployment/commercial/schema observations and the
prepared next external step. They do not renew the deployed quote certificate.

## Freeze the release inputs

Use the committed isolated candidate and the normal
[GitHub/Vercel delivery path](github-vercel.md). Preserve the Desktop checkout.
Immediately before a release decision, repeat:

```sh
git fetch origin main
pnpm deployment:check
```

The candidate must contain current `origin/main`. Record both domain deployment
IDs and Git revisions. A read-only schema report cannot replace this check.

Capture the current production commercial policy and effective customer quotes
through the deployed quote owner or its exact Git source with matching factual
configuration. Bind the database identity, capture time, registry, effective
engine overrides, pricing rules, factual environment and candidate commit.
Do not call the local active grid or a candidate's simulated legacy path proof
of deployed prices. Keep the original capture immutable.

The [October 2 deployed comparison](../engineering/2026-10-02-pricing-deployed-comparison.md)
records the completed read-only source/configuration capture and offline
monetary reconstruction. Refresh its operational inputs at publication time.
Keep the reviewed upscale factor/source-estimation corrections separate from
model tariff changes. Preserve existing production billing-product values:
sandbox defaults are not a replacement for captured production records.

Reproduce the whole candidate against that capture. Report the approved GPT
one-cent floors and proportional Seedance input-duration corrections separately,
including original/new cents and affected selectors. Preserve other prices,
including Seedream's original one-source amount in additional-source variants.
Require complete supported-domain coverage and exact parity outside those
disclosed, reviewed changes. Do not copy a local approval fingerprint onto production data.

Pending BytePlus discount activation is not a blocker for unchanged customer
amounts checked above LIST. Keep signed estimates separate from observed invoice
amounts and reconcile actual discounts afterward. A new price reduction that
depends on the discount requires effective supplier-cost verification.

## Read-only schema inventory

The dedicated command accepts an explicitly selected private environment file,
never an ambient `DATABASE_URL`. It permits a direct Neon connection or a local
Unix socket; pooled connections and host/options overrides are rejected. Database
connections default to read-only and the inventory uses a repeatable-read,
read-only transaction. It reads catalog definitions, not customer/payment rows.
Duplicate URL parameters are rejected. The effective target hash includes host
or socket directory, port, database, user and transport. The inventory subprocess
removes ambient PostgreSQL overrides; explicit driver fields and a password
callback prevent ambient authentication or `.pgpass` from supplying credentials.
Connection loss aborts evidence publication and closes the reader through the
controlled error path. Neon TLS verifies the server certificate.

From the clean repository root:

```sh
PRICING_SCHEMA_ENV_FILE=/absolute/private/release.env \
PRICING_SCHEMA_OUTPUT=/absolute/private/new-schema-report.json \
pnpm pricing:cutover:schema
```

The new private output binds the code commit, hashed database identity, schema
definitions and the bytes of these exact migration files, in order:

1. `neon/migrations/53_seedance_draft_links.sql`
2. `neon/migrations/54_customer_tariff_cells.sql`
3. `neon/migrations/55_customer_tariff_versions.sql`
4. `neon/migrations/56_direct_payment_quotes.sql`
5. `neon/migrations/57_customer_tariff_local_activation_events.sql`
6. `neon/migrations/58_customer_tariff_bulk_interval_lock.sql`
7. `neon/migrations/59_seedance_draft_final_state.sql`
8. `neon/migrations/60_mcp_trial_provider_rasters.sql`
9. `neon/migrations/61_customer_tariff_cutover_events.sql`

Inspect columns, constraints, triggers and function definitions; presence alone
does not establish a compatible schema. Missing prerequisite tables/functions
need explicit migration review. In particular, 60 requires the complete deployed
migration-31 trial boundaries. An unfamiliar provider-cost function is refused.
The report always says `activationReady: false` and `schemaReviewRequired: true`.
It does not certify customer-price parity, grant writes or execute migrations.
An absent `mcp_trial_provider_cost_matches_snapshot` is an expected pre-60 state:
60 creates it before replacing the old inline funding check. The report marks
this as `created_by_migration_60`, separately from mandatory missing functions.

Do not select migrations by their numeric prefix: `53_playlist_opening.sql` is
an independent main-branch migration. Do not replay every repository migration
as this branch's cutover action. Apply reviewed exact files only, using the
explicit deployment owner, `psql --single-transaction -v ON_ERROR_STOP=1` and a
direct connection. Preserve 60's atomic function/constraint replacement.
Some older files include their own transaction boundaries; qualify each exact
file's failure behavior before use. Never run DDL from a quote/read handler.

The current PostgreSQL schema test applies these nine files, replays them, and
compares historical jobs, receipts and old trial pricing snapshots byte for byte.
Tariff state stays inactive and empty. It also rejects writes from the inventory
transaction. This qualifies the fixture schema; production still needs its own
fresh structural review and backup.
The rehearsal includes the old inline trial-cost constraint observed in the
deployed schema, with the raster predicate absent before migration 60.

## Review the activation operation

Back up the exact target policy, tariff state, cells and versions before writing.
Review an operation bound to the current production capture, complete candidate,
target identity, actor and expected revision. Under state/policy/interval locks,
reproduce the certificate and append immutable activation evidence in the same
transaction as the new cells and revision. Any changed input or failure aborts.
Preserve existing temporal versions and paid snapshots.

`pricing:activate:local` deliberately refuses remote targets. Migration 57 records
local sandbox activation history; it is not a production activation API. Do not
substitute a Neon URL, loosen its guards, or reuse its local certificate.
The production-specific activation operation and commercial manifest must be
reviewed at the release decision. The complete grid and coordinated activation
sequence were approved on October 2. The authored production switch now enables
the default reader only for `NODE_ENV=production`, including Vercel previews.
Development retains the separate explicit Unix-socket sandbox gate. Production
quote audit scripts must set `NODE_ENV=production`; older baseline collectors
do not select it automatically.

Apply the reviewed compatibility migrations before the Git deployment. With
the migrated database still inactive, the deployed reader quotes the existing
legacy policy. Capture fresh bound evidence and perform the separate atomic
initial activation afterward. Missing schema or an unavailable database refuses
production quotes. Enabling the source flag never activates database state.

### Prepared initial activation and recovery owner

The [initial-operation qualification](../engineering/2026-10-02-pricing-initial-cutover.md)
records the committed-source tests, review corrections and retained-grid policy
compatibility for this separate owner. It does not authorize production execution.

`server/pricing/customer-tariff-cutover.ts` is the separate maintenance writer;
`pricing:cutover:execute` is its manual entry point. It is never invoked from a
route, build, deploy hook, or `pricing:activate:local`. An inactive authored flag
or a runtime other than production refuses production maintenance before opening
a database connection. The CLI selects the runtime before importing quote owners.
No production command has been executed at this release preparation checkpoint.

This operation is deliberately limited to the first installation: inactive
revision zero, no current cells, no closed versions, and no prior cutover event.
It refuses to replace a staged or already edited database. Migration 61 adds
immutable activation/recovery evidence without activating prices. Prior evidence
of the **eight** earlier files remains dated evidence of those eight files.

The sandbox's retained grid contains 18,177 rows, including 3,186 obsolete
Seedance fixed selectors without an input-duration dimension. Current generation
always resolves a duration-specific or continuous selector for those video inputs.
`projectInitialCustomerTariffCutoverCells` prepares the 14,991 effective rows for
a fresh installation, returning all 3,186 excluded rows for a separate immutable
source archive. Unknown unused rows are refused. This projection never edits the
sandbox or removes its history. Every installed row must be selected by the real
canonical acceptance; quote parity, rather than a copied staging row count,
determines equivalence.

The reviewed private JSON release implements `CustomerTariffCutoverRelease`:
full literal cell components; an ordinary/workflow/input-stress quote inventory;
actual deployed old cents, proposed cents, and separately approved changes;
deployed Git/deployment identity; current target/code/registry/factual and
commercial hashes. Its fingerprint hashes the entire body. Preparation leaves
`activationReady: false`; sealing an artifact is not deployment permission.
The capture expires after fifteen minutes. Production provenance must come from
the deployed source comparison described above; merely changing a fixture's
`evidenceKind` is not a substitute for that capture or its operator review.

The writer uses an explicitly selected direct TLS Neon or isolated Unix-socket
pool, independently of the application's ambient database. A branded transaction
must also belong to this selected connection. Actual transport/database/user and
the actor's current administrator authority are checked with the application's
precedence: a nonempty `user_roles` admin population is authoritative; otherwise
the exact actor must be present in `app_admins`. These tables remain locked through
the transaction, including the empty role population. No role is granted, and
missing permission tables or failed queries refuse maintenance. State,
cell/history and commercial tables are locked together. Hashes include pricing
rules, settings, availability overrides and billing products. Settings timestamps
alone are excluded; policy timestamps retain their selection semantics. Secrets
never enter bindings. Quote contexts use the app's actual read-only configured
engine projection, including administrator pricing settings.

The operation derives the complete current inventory itself. It reproduces full
continuous coefficients and band boundaries from the captured customer baseline
and the reviewed compilation owners. Seedance rates must preserve the approved
positive variant margin; GPT floors must equal the actual reference ceiling.
Safe endpoint quotes alone cannot approve an altered fractional curve or an
additional overcharge. It also validates continuous input domains, inserts fresh
revision-one cells, and validates all
canonical quotes through the real selector database reader **inside the same
transaction**. Missing prices, legacy fallback, below-cost quotes, any cent
mismatch or an unused extra cell abort the entire installation. Code/environment
are checked again before commit. The immutable evidence and the regular pricing
history event commit with the activation.

The manual entry point requires explicit `PRICING_CUTOVER_MODE`,
`PRICING_CUTOVER_OPERATION`, `PRICING_CUTOVER_ENV_FILE`,
`PRICING_CUTOVER_ACTOR` and `PRICING_CUTOVER_CONFIRM`. Activation additionally
requires `PRICING_CUTOVER_RELEASE`; recovery requires `PRICING_CUTOVER_EVENT`.
An optional new `PRICING_CUTOVER_RECEIPT` file is private and never overwrites an
existing file. The immutable target event is authoritative after a lost response;
inspect it and current state before retrying. A successful repeat activation is
refused. Run only from the clean reviewed repository root.

Recovery appends a compensating event and deactivates the exact initial active
revision. It preserves every current cell, closed version and financial snapshot.
It refuses subsequent edits, a changed commercial input, a mismatched event or
another target. **This is the database component of recovery.** Restore the
recorded deployed code and matching factual configuration through the normal
delivery path as a coordinated release action; database deactivation alone does
not undo separately disclosed tool algorithms or restore a Vercel deployment.
Recover the database while the selected candidate still supports the maintenance
operation, then restore code/configuration. A rollback after intervening admin
edits requires a newly reviewed recovery plan.

The [exact-grid rehearsal](../engineering/2026-10-02-pricing-cutover-rehearsal.md)
adds a private review package with all 18,177 current cells, exact migration bytes,
deployed comparison inputs and a PostgreSQL 17 failure/recovery rehearsal.
Whole-grid installation/deactivation in that harness is a fixture simulation;
it is not a production writer or certificate. Its separate local backup cannot
replace a production backup. The user's existing local admin stays unchanged.

## Acceptance and recovery

Repeat the live legacy direct-payment inventory immediately before cutover.
Unbound captured payments need original evidence; current prices cannot reconstruct
an old paid quote. Stop and reconcile any newly created legacy direct checkout.

After passing Quality CI and an authorized Git release, verify both live domains
against the merged revision. Check quote/revision parity across app, MCP, Studio,
Pricing, model pages, comparisons and current public examples; historical receipts
stay unchanged. Verify admin preview, stale-review rejection, confirmation, history
and rollback against the same effective quote.

The real app-owned storage/polling and Studio Draft import canary remains separate
from fixture tests and the completed shortest provider pair. It requires explicit
authorization for external storage and any paid task. Draft currently remains a
local gated text-to-video workflow; this runbook does not publish it automatically.

Record the rollback code deployment and commercial revision before release.
Restore commercial state through a new immutable compensating event under locks;
do not delete history, rewrite paid amounts or replay provider tasks. Accepted
jobs keep their original paid quote and Draft/final lineage. Recheck both domains,
quotes and historical settlement after recovery.
