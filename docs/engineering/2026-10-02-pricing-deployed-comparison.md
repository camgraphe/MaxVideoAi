# Deployed pricing comparison — October 2, 2026

This continuation resumes the interrupted commercial capture on
`codex/bytedance-pricing-grid`. Adrien reports the BytePlus contract as validated.
Signed rates already used in local supplier estimates remain in place; customer
cells do not recompute from the discount. No settled invoice discount is newly
observed here.

## Source and scope

Fresh `git fetch origin main` finds local main and origin/main at
`d10ad458743aef68e6e9be12cad9c611f06077b8`, with zero divergence. Both live domains
serve Git deployment `dpl_B1xi8TtrQ1viCBJ3XbEjWG6HCS4y` at that revision.
Compared candidate source: `464906cd1987af55946b27d5e3db2141d6acd91a`.
Subsequent documentation does not relabel that source attribution.

The production snapshot at `2026-10-02T08:16:27.244Z` reads four pricing rules,
53 engine settings, nine overrides and 16 billing products in a repeatable-read,
read-only transaction through the explicitly pinned direct connection and
controlled reader. No schema bootstrap, customer/payment/media read or remote
write occurs.

Database identity:
`8c5b3a3228a5e3db8a4785b5da1590b2126d24b336a57bd190f5fffe95e231ad`.
Commercial hash:
`d56aba99bc939aa1a14683b68ee03c13cec25c344342619b6c761c724d98d8d5`.
Billing-product hash:
`35f5e91b10dc8ee781c30100495d19923b7d6210cade3687cfbbacdd8bcb07cf`.
A final capture at `2026-10-02T08:33:57.278Z` finds both hashes unchanged.
The interrupted snapshot is retained separately; its engine-setting refresh
timestamps differ, with no changed pricing/options/administrator values.

Quotes are reconstructed offline from a clean Git clone of the exact deployed
source and its own pricing package. Its rule-row mapper, system-default/configured
engine projection, mode pricing and canonical billing owner receive the captured
production rows. No database/provider credential is present during calculation;
fetch is prohibited. The six Luma price environment dependencies are absent from
the deployed environment, so deployed versioned defaults apply. Both registry,
policy and Luma configuration hashes are recorded.

Audio and storyboard use the deployed canonical snapshot owners. Fixed/dynamic
tools and finishing reproduce the deployed composition using its unchanged
factual/canonical helpers and captured product/policy rows. The old billing-product
reader's schema bootstrap is never invoked. This is monetary reconstruction,
not live HTTP, provider-routing or endpoint-readiness acceptance.

## Results

Candidate model amounts bind the private active-grid audit at
`2026-10-01T23:13:42.379Z`, revision 3,523. Its 20,446 collected cases match the
current scenario export exactly. The local model state and 18,177 cells remain
unchanged during product alignment.

| Scope | Result |
| --- | --- |
| Ordinary video/image cases, 48 models | 20,122 compared; 19,825 unchanged, 297 disclosed changes, zero errors or unexplained differences. |
| GPT Image 2.5 Flare/Sunburst reference edits | Exactly 24 approved one-cent increases; e.g. 2 → 3 cents for one medium 1024×1024 output with one source. |
| Seedance 2.5 video-input minima | Exactly 273 approved proportional corrections: 91 each in ref2v, v2v and extend. Example: 4s/480p/square with 2s input, 35 → 61 cents. |
| Seedance input-duration stress | 6,372 cases: 2,913 unchanged, 3,459 increases under the reviewed proportional policy; no errors or unrelated differences. Includes cases also in the ordinary matrix. |
| Audio/Tools/Storyboard references | 38 compared; 37 unchanged, one disclosed source-estimation correction, no missing quote. Bounded reference inventory, not exhaustive continuous tool coverage. |
| Draft/final workflow | 324 new local-only offers, excluded from old deployed-price parity; ordinary 480p/1080p is not their fallback. |

FlashVSR's reference correction was reviewed on September 30: 10s/720p/30fps at
2× changes from $1.25 to $2.22. Supplier estimation follows the submitted factor
instead of an unused 1080p target; the coefficient remains ×4. Other affected
factor variants, including FlashVSR 4× and explicit SeedVR 2×/4×, remain covered
by the preceding factor-pricing work. This 38-row comparison does not claim those
variants are unchanged. Historical paid snapshots keep their stored amounts.

## Local demonstration data aligned

Three unrelated sandbox defaults differed from actual production records:

| Product | Sandbox before | Deployed amount / sandbox now |
| --- | --- | --- |
| Qwen Angle single | $0.07 | $0.08 |
| Character Builder Draft | $0.08 | $0.15 |
| Character Builder Final | $0.15 | $0.30 |

These are existing production database values, not changes to authored defaults
or proposed production prices. The private Unix-socket sandbox is aligned through
the existing preview/fingerprint/confirmation service and configured local admin.
All three updates and immutable events commit in one transaction; a private
before-state is retained. Other products and the complete model tariff state are
unchanged. Fresh shared product inventory returns all 38 customer/supplier
references with zero warnings. No production product is updated.

Sixteen focused product-confirmation/factor-pricing tests pass without failures
or skips. No application code changes here; the preceding full qualification
remains attributed to `951e11353` in the [acceptance record](2026-10-02-pricing-preproduction.md).

## Evidence and release boundary

Private evidence: `/tmp/mva-pricing-production-capture.kpam77r5`.
`commercial-comparison-evidence-manifest.json` binds captures, exported contexts,
comparison implementation/report, monetary configuration, alignment receipt,
fresh product quotes and verification by SHA-256. Manifest hash:
`58b76ef7164ab9f6740ce16f102b039816506da97a796d9370a21666350dc029`.
It has `activationReady: false` and grants no production writes.

Reproduction requires a clean clone of the recorded deployed SHA, its own pricing
package alias, installed dependency links and a sanitized production environment
without database/provider credentials. Run the retained comparison script against
the immutable private captures/exports; do not substitute candidate pricing code.

The [runbook](../deployment/customer-tariff-cutover.md) still requires a reviewed,
target-specific activation operation/manifest and exact migrations; fresh
publication-time Git/domain/schema/commercial/legacy-payment checks; Quality
CI/preview; and the user's production decision. This comparison manifest is not
a writable activation certificate. Real app-owned storage and Studio Draft import
remain a separately authorized canary; Draft remains local-only.

No push, PR publication, merge, deployment, production environment/database/storage
write, payment action, paid provider task or external message occurs here.
