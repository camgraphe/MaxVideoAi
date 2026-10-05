# Studio assistance credit activation — 2026-10-05

Owner: application engineering. Product-owner approval: explicit “oui go” after
reviewing 500 monthly Sol credits, $2/$5/$10 packs and Luna without a monthly
per-account quota. The customer panel and accounting implementation were already
merged in PR #384; this release activates them through the production policy.

## Approved scope and funding

- Production policy: `studio-credits-2026-10-05-v2`.
- Keep `STUDIO_ASSISTANCE_ENABLED=true`.
- Apply only `63_studio_assistance_credits.sql`, after verifying migrations 54/62.
- Retain the existing persisted `studio-discovery-2026-10` supplier campaign's
  $100 ceiling. Do not renew or increase it. The preflight at 08:18 UTC found
  $99.715266725 remaining, 21 settled calls and no unresolved calls.
- Purchased packs require an explicit customer confirmation and use the existing
  wallet. Activation itself makes no purchase, wallet debit or model request.
- Do not convert historical wallet spending limits into purchased credits.
- Preserve existing conversations, receipts, call identities and frozen tariffs.
  Free-first accounting and the sponsored availability guard continue to apply.
- External MCP media pricing and audio publication gates are unchanged.

## Migration evidence and procedure

Verified the production Vercel database against the primary read-write Neon
endpoint in project `shy-flower-71253790`, branch `br-late-term-aeo22xpz`.
Sensitive credentials stay outside Git and reports. The migration uses the
existing database credential with the verified direct endpoint.

First rehearse on a short-lived copy of the production branch. The attended
validation branch is `br-round-water-aef53p6v`, parent `br-late-term-aeo22xpz`,
created only for this release and expiring at 12:00 UTC. Migration rehearsal
completed at 08:20 UTC in 338 ms. Delete only this temporary branch after checks;
do not clean up other tasks' branches as part of this activation.

Migration 63 SHA-256:
`3a8af9acad0463c66d69e3e02bac6c2614637d0d9f2e6736aba08a6a70b12cd3`.

Execute the exact committed migration in one repeatable-read transaction with
an advisory migration lock, 5-second lock timeout and 60-second statement timeout.
Do not run the bulk migration runner. Fingerprint all six legacy assistance
tables and `app_receipts` inside that transaction before and after the DDL,
excluding only the newly added defaulted `refund_credits` column. Require identical
row counts and SHA-256 digests, three empty credit tables, four credit protection
triggers and the nonnullable default-zero support refund column before committing.
The rehearsal preserved all 11,967 receipts and all legacy assistance rows.
Abort and roll back on any failed assertion or lock timeout.

Production migration completed at 08:22 UTC in 188 ms. The same transaction
assertions passed: legacy row counts and digests were identical, all 11,967
receipts were preserved, and the three empty credit tables and four protection
triggers were verified before commit. The effective environment policy was still
v1 during this additive migration.

## Delivery and validation

1. Verify additive migration 63 on production while v1 remains enabled.
2. Update only the existing production `STUDIO_ASSISTANCE_APPROVED_POLICY` value.
   Retain its environment identity and other settings; never expose credentials.
3. Merge this validated operational record through GitHub after required Quality
   CI and `pnpm deployment:check`. Let the existing Vercel Git integration build
   `main`; an environment update requires that fresh deployment.
4. Require both `maxvideoai.com` and `api.maxvideoai.com` to serve the same READY
   deployment from the exact merged Git SHA. Record deployment identity, framework,
   build duration and the runtime error inspection window in release evidence.
5. Open a fresh authenticated Studio tab. Verify the new credit panel, monthly
   free quantity, $2/$5/$10 choices, purchase review/cancel and existing history.
   Do not debit a real customer's wallet merely to smoke-test the purchase.
6. Confirm read-only status has not created lots or changed wallet receipts.
   Existing requests retain frozen versions; policy changes require an explicit
   new message or follow-up and never replay unknown supplier work.

Fresh focused qualification on main `2dbe2f40acb31d92a2bed716c6da48f4fa81de29`:
21 tests passed, zero skipped, covering disposable PostgreSQL credit transactions,
legacy/v2 compatibility, dialog contracts and cumulative canonical pricing.
Public secret-exposure checks passed. PR #384 owns the broader provider/dialogue,
route, browser and financial qualification; this activation adds no provider calls
or paid media tests. A visible production panel check does not replace those tests.

## Recovery

If activation fails, restore only the production policy value to
`studio-beta-2026-10-03-v1` and redeploy the exact validated Git-backed source using
the approved production delivery procedure. Preserve migration 63 and all credit
evidence; never drop credit tables, reset the campaign or rewrite balances.
Existing credit calls must settle or reconcile under their recorded policy and
tariff. Legacy status and support remain compatible with the additive schema.
Keep unresolved work held until canonical support reconciliation supplies trusted
evidence or records an explicit waiver.

Screenshots, sanitized migration assertions and final deployment verification are
stored outside the repository in the attended release evidence directory:
`/Users/adrienmillot/.codex/visualizations/2026/10/05/studio-assistance-activation/`.
