# Dedicated Google Ads measurement configuration

The dedicated MaxVideoAI advertising account uses Google tag `AW-18532862533`.
The existing Analytics property and server payment-event outbox remain the source
of payment measurement. No campaign or advertising spend is part of this change.

## Production configuration

Set these Vercel Config variables for **Production only**, then release through
the normal GitHub-main deployment path:

| Variable | Value | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-18532862533` | Configure the dedicated advertising destination after analytics and advertising consent. |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` | Empty string | Disable the legacy browser checkout-return conversion. An absent variable would fall back to the old target, so keep an explicit empty value. |

The previous shared variables retain their Development and Preview scope.
`GA4_MEASUREMENT_ID` remains `G-BTRB7JZ39R`; do not create a second Analytics
property or change its API secret for this account migration.

`AnalyticsScripts` gates Google Ads on both consent categories. `GoogleAds`
deduplicates destination configuration and sets `allow_enhanced_conversions: false`.
`useBillingTopupAnalytics` returns before dispatch when its conversion target is
empty. This existing behavior makes an application-code change unnecessary.

## Account association and payment measurement

Link the existing Analytics property to the dedicated Ads account with
auto-tagging enabled. Keep personalized advertising and Analytics editing access
from Ads disabled for this measurement-only connection. Keep enhanced conversions
disabled; this migration does not authorize customer-data uploads or remarketing.

The existing server projection emits `purchase` and `topup_completed` from
confirmed wallet receipts, with settlement value/currency and a transaction ID.
Import only one purchase action into Ads to avoid counting both as purchases.
These events measure wallet funding, not earned product revenue or lifetime-first
customers. Consent coverage, admin exclusions, ingestion and click attribution
must remain visible in reporting; successful HTTP delivery alone does not prove
that an Ads conversion was attributed.

## Validation and rollback

- Run the existing consent and commercial-exclusion tests before release.
- Require Quality CI and `pnpm deployment:check` before merge; verify both live
  domains against the merged source after the Git deployment completes.
- Verify the built tag configuration and the explicit empty browser-conversion
  target. In a consented non-admin browser, verify the new destination; analytics
  consent alone must not activate advertising measurement.
- Verify the Analytics link, auto-tagging and imported conversion settings in
  the actual account. Allow platform propagation without manufacturing a purchase.
- For a configuration rollback, restore the previous Production values
  (`AW-992154028` and `AW-992154028/7oDUCMuC9rQbEKyjjNkD`) through a reviewed release.
  Restoring the latter also restores the weaker browser-return signal; do not use
  it as the dedicated account's primary payment action. A source rollback by itself
  does not restore Vercel environment variables.

Campaign selection, audience research, keywords and media-budget approval are
handled separately. The earlier Studio pilot remains a hypothesis under review.
