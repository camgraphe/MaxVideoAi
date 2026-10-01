# BytePlus contract pricing checkpoint — 2026-10-01

Branch: `codex/bytedance-pricing-grid`. The user personally accepted order form
`CT20260925128931` for the account associated with this application. The authorized
acknowledgment to Zen was sent in the existing email conversation. No further
message is authorized by this checkpoint.

## Commercial decision

Use the signed terms immediately in the local admin's cost and margin analysis.
Do not implement a temporary activation workflow. Check the actual contract status
and effective account discounts in BytePlus immediately before pushing/releasing.
The observed console status during this checkpoint was **In contract generation**;
its Business discount management table had no rows yet. The admin amounts are
therefore estimates under the adopted signed terms, not a claim that account
configuration or an invoice has already been verified.

| Offer · 5 s · 720p · 16:9 · no video input | Supplier LIST | Signed discount | Contract estimate | Unchanged customer total | Estimated gross margin |
| --- | ---: | ---: | ---: | ---: | ---: |
| Seedance 2.0 Mini | $0.378 | 60% | $0.1512 | $0.95 | 84.1% |
| Seedance 2.0 Fast | $0.6048 | 50% | $0.3024 | $1.52 | 80.1% |
| Seedance 2.0 | $0.756 | 0% | $0.756 | $1.89 | 60.0% |
| Seedance 2.5 | $1.1556 | 0% | $1.1556 | $2.89 | 60.0% |

These are estimated tokens and gross margins before payment fees, retries and
operating costs. Contract amounts are before tax/credits. LIST remains a dated
public source; the agreement discounts current LIST and does not freeze dollars.
Seedream Lite and Pro's listed output/reference SKUs receive 10% off. There is no
new customer price decision or global margin formula in this change.

## Ownership and boundaries

- `byteplus-account-contract.ts` is the single server owner for signed discounts,
  SKU matching and the half-open UTC+8 validity period.
- `byteplus-normal-cost.ts` shares the factual normal-task LIST calculation with
  both the admin and the active manual quote. A review caught the previous padded
  retail subtotal in the manual floor: a profitable Mini 31¢ price was rejected
  against a 73¢ floor. It now uses $0.1512 (rounded supplier floor 16¢), accepts
  31¢ and rejects 15¢. Snapshot base, vendor share, gross difference and source
  metadata agree. The unchanged 95¢ current customer cell remains 95¢.
- `provider-cost-comparison.ts` applies those terms to factual LIST usage and
  preserves explicit contract/invoice evidence as separate inputs.
- `tariff-provider-comparison.ts` supplies the actual configured account region to
  both representative inventory and exact selected scenarios.
- Admin rows show contract cost, unchanged customer quote and estimated gross
  margin. Expanded rows show LIST, discount, validity, native token rate and source.
- The contract is not applied to Fal, another region, unsupported usage, 2.0 4K,
  2.5 1080p or Draft/final, or the disabled 1.5 offer. No unspecified SKU is invented.
- No payment, provider call, database migration, tariff edit, remote push or
  production deployment is performed by this local implementation.
- The inactive legacy formula and saved paid snapshots are unchanged. Only the
  active manual path consumes the factual cost; the production code gate stays off.

## Verification

New regressions cover exact discount SKUs, UTC+8 boundaries, exclusions,
contract expiry, image/reference quantities, independent Fal costs, admin render,
unchanged retail cents and consistent manual settlement provenance. The price
simulator's preview is exercised locally without confirming a customer edit.
Baseline checks retain 178 immutable and 577 public scenarios; the audit has
266 scenarios, 262 matches, four existing approved differences and no mismatch.

## Release checks retained

1. Verify contract completion and the account's effective discount rows immediately
   before push. Reconcile actual SKU/region/dates against the adopted terms.
2. Recheck the dated public LIST if it changed; observe actual usage/invoices after
   a separately authorized provider canary. Credits never establish zero cost.
3. Capture current production customer tariffs/overrides and certify the activation
   candidate against them. Preserve only separately approved price deltas.
4. Review migrations, historic direct payments and rollback; follow the GitHub PR,
   Quality CI, main and Vercel Git delivery policy with production authorization.
5. Draft remains a local interface preview and disabled backend foundation. Its
   paid lifecycle, independent tariffs and provider acceptance require completion
   before publication.

Fresh fetch: local `main` and `origin/main` both resolve to
`10589cc6b368bae3647ec9d00fba1b73c8b20128`; the feature branch contains that commit.
