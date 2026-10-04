# Exact pricing grid rehearsal — October 2, 2026

Continuation of the approved cutover preparation from clean candidate
`9b9b6c30188dfa786b5269b5f17371244858eb48`. This phase exports the qualified grid
and rehearses it on an owned disposable database. No application implementation,
authored production switch, production record or user's admin runtime changes.

## Private review package

The package contains all **18,177 current tariff cells**, their separate local
source backup, captured production commercial records, exact scenario exports,
the accepted deployed comparison and the exact eight pricing migration files.
Input hashes bind the prior [deployed comparison](2026-10-02-pricing-deployed-comparison.md).
The source is read in a repeatable-read, read-only transaction through a pinned
Unix socket. Its effective state hash still matches the qualified revision 3,523;
there are no closed source tariff versions.

Production billing products are retained separately from the local grid. The
package does not propose replacing them with sandbox defaults or importing local
actor/revision/history as production history. The source backup is a **local**
backup; a production backup is still required at the release decision.

Durable private copy, excluded from Git:
`.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/cutover-package-20261002-9b9b6c301-reader-verified/`.
Directories are mode 0700 and files 0600. Its README explains reproduction from
the recorded clean source and a fresh private copy. No database/provider
credential is exported. `package-manifest.json` hash:
`cf3c8277518b096ed560a3393930a30258bfdaa60e7df136b739c9b9f94b39a0`.

`completed-rehearsal-evidence-manifest.json` binds the package manifest, fixture
harness, accepted/diagnostic logs, result and original-sandbox verification. Hash:
`799484aa3c1a52fd0e98f6a6c6ba9353f7411652aebc31f30ed83c5e1a17db00`.
Both manifests explicitly retain `activationReady: false` and
`productionWriteAuthorized: false`.

## Rehearsal results

The accepted run at `2026-10-02T09:50:33.309Z` uses PostgreSQL 17.6 with a newly
owned private Unix socket and no TCP listener. Fetch is prohibited. No external
service, provider task, payment action or production database is contacted.

| Check | Result |
| --- | --- |
| Exact pricing migrations | Eight packaged files applied, then replayed; two passes. |
| Whole-grid loading | All 18,177 cells loaded in one local fixture transaction. |
| Injected failure after cells/state/events | Full rollback: zero cells/events, inactive revision 0. |
| Canonical matrix | 20,446 amounts match the accepted candidate comparison, including 324 separately identified local workflow offers. |
| Seedance input-duration stress | All 6,372 amounts match their accepted candidate inputs; these overlap matrix cases. |
| Quote results | Zero missing/non-manual/discrepant quotes; 26,818 actual database-backed canonical matrix/stress reads, no tariff-state override. |
| Actual admin edit and rollback | Pika $0.26 → $0.31 → $0.26, revisions 1 → 2 → 3; stale review rejected. |
| Tariff history | Two closed versions retained; database rejects deletion of versions and local activation evidence. |
| Full-grid recovery simulation | Append compensating event and deactivate at revision 4; cells and versions retained. |
| Historical settlement | Synthetic paid job, receipt and both historical trial snapshots unchanged byte for byte. |
| Existing commercial products | All captured production product values unchanged in the fixture. |
| Cleanup | Owned disposable database/socket removed after the accepted run. |

The canonical owner derives every quote selector and uses its normal
`loadCustomerTariffQuoteState` reader against the installed grid. The harness
counts all 26,818 database reads; it does not choose or filter cells itself.
The actual single-price recovery calls the existing preview/fingerprint/confirm
service and canonical reader. Both intermediate and restored amounts are asserted,
as is rejection of the original formerly-valid fingerprint after the edit. Whole-grid installation and deactivation are private
fixture simulations under state/table locks. They **do not implement or qualify
a production activation/rollback writer** and do not reproduce a production
certificate under live target locks.

Prerequisite fixture setup uses the current migrations; compatibility with the
older deployed migration-31 inline trial constraint remains separately qualified
by the [schema rehearsal](2026-10-02-pricing-preproduction.md). This run adds exact
data-volume and recovery evidence, not a new claim of production schema identity.
The first two harness attempts correctly abort on fixture errors: an unsupported
one-hour MCP lifetime, then comparing two different scenario-hash formats. The
final fixture uses the existing ten-minute lifetime and the exact export format;
diagnostic logs remain bound alongside the accepted run.

## Independent review and one fix pass

A fresh package review identifies one Important evidence gap and two initially
Minor gaps: the first harness manually selected one cell before canonical pricing;
it did not assert the intermediate price or reuse a formerly-valid preview; and
initial socket/import failures were outside the cleanup scope. These concern the
accuracy of acceptance claims and bounded failure cleanup, so all enter one fix
pass. No application code changes.

A new regression first fails with **0 versus 26,818** required database reads, then
passes using the default canonical database reader. An early-failure probe first
finds one leaked owned database (removed by its bounded test cleanup), then passes
with cleanup covering the complete post-creation scope. Actual $0.31 intermediate
pricing, valid-preview staleness and $0.26 recovery also pass. The complete
corrected harness succeeds. The earlier per-cell report and review diagnostics
remain private, explicitly superseded by the reader-verified evidence. No second
review of the same package is requested.

The reviewer leaves production operations/certificates/live canaries outside this
phase, earlier outage/supplier/browser contracts with their prior qualification,
historical production preservation with its release gate, and live admin runtime
inspection outside the read-only hash evidence. These exclusions remain
disclosed; this fixture cannot replace those checks.

## Original local admin preserved

A separate pinned, repeatable-read/read-only verification after the disposable
run finds the user's complete model-state and billing-product hashes unchanged.
The admin remains on revision **3,523 with 18,177 cells**. Its database, session,
environment, runtime and authored inactive production flag are preserved.

## Remaining release work

This package prepares the [cutover review](../deployment/customer-tariff-cutover.md).
It does not replace the production-specific locked activation operation/manifest,
fresh publication-time target/schema/commercial/payment/Git/domain evidence,
Quality CI/preview or the user's production decision. The local activation helper
keeps its remote-target refusal. Code and database activation must be reviewed
together; migration presence alone never enables customer tariffs.

Real app-owned storage/polling and Studio Draft import remain a separately
authorized operational canary. Draft stays locally gated. No new support/Zen
message, paid provider task, push, PR, merge, deployment or remote write occurs.
