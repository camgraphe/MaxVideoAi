# Initial pricing cutover qualification — October 2, 2026

Continuation of the approved local preparation on `codex/bytedance-pricing-grid`.
Implementation source: `baffc07310310389d97c07937ebe4138aa27b84c`, tree
`68e8968edb205547eaff4a25dbfcf0f8297e3f83`, based on `3b1f2900f`.
The subsequent documentation commit does not change that qualification source.
The [cutover runbook](../deployment/customer-tariff-cutover.md) owns the release
procedure. This record grants no publication or production-write authorization.

## Completed maintenance operation

`pricing:cutover:execute` now has a separate initial activation and compensating
recovery owner. It accepts an explicitly selected connection, current administrator
and full private release artifact. It verifies the target, source/configuration,
commercial inputs and complete quote inventory under transaction locks. It is
never called by a route, build or deployment hook. The authored production tariff
switch remains **false**, and production execution refuses before connecting.

Initial activation requires an empty inactive database at revision zero. The
immutable activation evidence, regular pricing history, cells and revision commit
together. The canonical quote owner reads the uncommitted cells through its actual
selector reader on the selected transaction. It does not preselect a cell or use
the application's ambient pool. Missing/fallback quotes, changed amounts, unused
cells, changed commercial inputs or connection loss abort the operation.

The effective installation contains **14,991 cells**. The source sandbox retains
all **18,177 cells**, including **3,186 obsolete Seedance fixed input selectors**
without an input-duration dimension. Projection archives those old rows separately;
it does not delete them or import sandbox revision/history into a new database.
Every installed cell must be selected by actual canonical acceptance.

Recovery deactivates the exact initial revision and appends immutable compensating
evidence. It retains cells, versions and historical financial snapshots, and
refuses a later edit or changed commercial input. It returns the recorded deployed
code identity for coordinated code/configuration recovery. Database deactivation
alone does not restore a deployment or undo the separately reviewed tool changes.

## Independent review and corrections

One fresh review of this maintenance delta found zero Critical, two Important
and zero Minor findings. Both Important findings entered one correction pass;
there was no second review or repeat review of earlier completed packages.

1. **Complete continuous-price parity.** A cost-safe Wan band change at 0.04995
   input seconds changes 33 to 34 cents while leaving every integer checkpoint
   unchanged. Activation now reproduces and compares the complete reviewed curve,
   including coefficients and band boundaries, using the captured original
   baseline and effective commercial configuration.
2. **Exact approved pricing policy.** A GPT extra cent is refused when the old
   amount already reaches the actual supplier-reference ceiling. Native Seedance
   rates must reproduce the reviewed positive variant margin or approved fallback
   anchor; an inflated proportional rate is refused.

The three regression probes first reproduce missing rejection, then pass with the
new guard. The same probes also pass in the complete committed-source validation.
Existing subsequent admin price edits retain their explicit preview/confirmation
flow; these extra restrictions belong to the initial migration.

## Execution evidence

Validation runs from a disposable local Git clone of the exact implementation
commit, with shared dependencies and **no private environment files copied**.
PostgreSQL 17 is selected explicitly. Fixtures own private Unix sockets with no
TCP listener; the user's existing admin database/runtime is not their target.

| Gate | Result and scope |
| --- | --- |
| Complete standard suite | 6,738 passed; zero failures; three existing skips. |
| Isolated Studio integrations | All 11 passed; zero failures or skips; the complete `pnpm test:validate` process exits zero. |
| Optimized build | Exit zero; all 920 static pages generated; registry/media prebuild, type/lint and sitemap gates included. Existing Supabase Edge-runtime and Browserslist warnings remain. |
| Frontend lint and exposure lint | Both exit zero. |
| Initial activation and recovery | Actual PostgreSQL test passed, including complete effective grid, injected late transaction failure and compensating recovery. |
| Canonical acceptance per complete activation | 20,122 ordinary, 324 local workflow and 6,372 input-stress checks: 26,818 actual transaction-backed canonical quotes. These counts overlap and are not unique selectors. |
| Failure/recovery invariants | Zero cells/events and inactive revision zero after injected failure; 14,991 cells and two immutable events retained after successful activation/recovery; original synthetic paid snapshot and product values unchanged. |
| Source/transport guards | Explicit selected-pool and uncommitted-reader RED→GREEN; production refusal, backend disconnect, stale/integrity/commercial checks and later-edit recovery refusal pass. |
| Exact schema preparation | Nine exact pricing migrations applied and replayed on PostgreSQL 17; historical fixture jobs/receipts/trial snapshots preserved. Older eight-file evidence remains scoped to those eight files. |
| Retained grid compatibility | Offline full-policy reproduction accepts the original retained grid's 14,991 effective cells across all 20,122 ordinary cases using the previously captured production commercial settings. Zero database/network access. |

The retained-grid check uses the immutable capture from `2026-10-02T08:16:27.244Z`.
It establishes compatibility with the new full-policy guard; it is not a fresh
production capture, quote acceptance or deployment authorization.

Current logs: `/tmp/mva-cutover-baffc0731-validation.log`,
`/tmp/mva-cutover-baffc0731-build.log`, `/tmp/mva-cutover-baffc0731-lint.log`,
`/tmp/mva-cutover-baffc0731-exposure.log`, and
`/tmp/mva-cutover-retained-policy-20261002.log`. A private durable evidence copy
belongs to this plan's `initial-cutover-review-20261002/` directory, excluded from
Git, with directories mode 0700 and files 0600. It contains no connection secrets.
The sixteen-artifact qualification manifest SHA-256 is
`d2fc7bf9d47fef29a4c10f13bc403479c6b8b7e316664ad931fb89fed62fa0ae`.
After retaining and verifying these hashes, only the owned disposable qualification
clone is removed. The original worktree, private evidence and admin runtime are
retained. A separate private cleanup receipt binds the manifest.

Fresh fetch finds local `main` and `origin/main` aligned at
`d10ad458743aef68e6e9be12cad9c611f06077b8`, zero divergence. The implementation
contains that revision, 124 commits ahead and zero behind. Deployment/domain
identity is not rechecked in this phase; repeat it at publication time.

## Decisions made in this continuation

| Decision, in order | Reason and consequence if wrong |
| --- | --- |
| First installation requires empty inactive revision zero. | Preserve existing history; an already staged target needs a separately reviewed installation. |
| Install 14,991 effective selectors and archive 3,186 obsolete rows. | Current generation uses duration-aware input selectors; an unknown unused row or quote mismatch aborts, while the original source remains intact. |
| Production provenance and publication authorization remain operator gates. | Fixture labels cannot prove a deployed baseline; require a fresh independently reviewed production capture before release. |
| Actual remote schema, credentials, routing, invoices and deployment recovery remain publication checks. | Only local preparation is authorized; reject mismatched real evidence before releasing. |
| Read actual current-source execution evidence before claiming qualification. | Reviewer assertions do not establish execution; an unverified tree cannot qualify. |
| Preserve prior packages as scoped historical evidence. | Review only the new owner and run all existing contracts; a newly discovered cross-surface issue needs a concrete regression before publication. |

No deferred Minor finding from the new review.

## Remaining release boundaries

Before a production decision, refresh deployed commercial/quote/configuration,
Git/domain, direct-payment and schema evidence; review the target-specific release
artifact, backup and exact nine migration files; run Quality CI and inspect the
preview. Then obtain the user's authorization for publication and remote writes.
None of those writes, nor a push, merge, deployment, paid provider task, payment
action or external message, occurred in this continuation.

Draft remains a local gated text-to-video workflow. Its real app-owned storage,
polling and Studio import canary still needs separate operational authorization.
The user-reported validated BytePlus contract retains signed cost estimates;
effective invoice discounts are not newly observed here. The already qualified
unchanged customer amounts checked above LIST do not wait on that reconciliation.
