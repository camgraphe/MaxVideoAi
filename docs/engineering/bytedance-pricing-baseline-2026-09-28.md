# ByteDance pricing baseline — 2026-09-28

Base commit: `add7b773b24af04ae7ef33917628dcea3f67c58e` (`origin/main` when the isolated branch was created). This is a **versioned-policy** baseline, not a claim about the effective production database overrides.

The existing read-only guards passed before implementation:

| Guard | Result |
| --- | --- |
| `pnpm pricing:baseline` | 178 immutable rows |
| `pnpm pricing:public-baseline` | 588 current rows |
| `pnpm pricing:audit` | 266 scenarios, 262 matches, 4 approved changes, 0 mismatches |

`tests/fixtures/bytedance-versioned-price-baseline-2026-09-28.json` freezes 202 representative and edge customer quotes under the versioned policy, including Seedance video modes, resolution and duration extremes, 1.5 audio on/off, video-input versus no-video input, and current Seedream size/mode combinations. For each row it records the customer amount, historical quote “vendor subtotal”, policy source and rule/profile. That subtotal is **not** to be treated as BytePlus cost for padded Seedance 2.x. This fixture is a local regression reference for the new quote path; production may differ.

## Configured Neon database read — 2026-09-29

The local Vercel CLI environment file supplied a Neon application database URL. `pnpm pricing:bytedance-effective-baseline` read its pricing rules inside a `REPEATABLE READ, READ ONLY` transaction, then reproduced the 202 frozen scenarios using the billing quote owner and those effective rules. The resulting [configured database fixture](../../tests/fixtures/bytedance-configured-db-price-baseline-2026-09-29.json) records four loaded rules, the rule-set hash, policy provenance, quote breakdowns and 202 customer totals. All 202 totals match the versioned fixture to the cent; all resolve through the database global rule. No database writes or customer price changes were made.

Neon's project inventory identifies the URL endpoint as the `DATAMAXVIDEOAI` project's default `main` branch. The URL's deployment environment has **not** been independently matched to Vercel production, so this is not yet a certified production baseline. The collector fails if it cannot first reproduce the frozen versioned rows. To capture another read-only report, set `PRICING_BASELINE_ENV_FILE` to an existing local environment file or set `DATABASE_URL`, set `PRICING_BASELINE_OUTPUT` to a new file path, then run `pnpm pricing:bytedance-effective-baseline`. It creates a new report and refuses to overwrite an existing one. Never treat the report's `legacyQuoteBasisCents` as actual supplier cost.

Coverage to add before activating a manual grid:

- Confirm that the configured Neon URL is the current production application database, then repeat the read-only collection against that verified target. The connected Chrome blocked direct access to the authorized pricing-inventory endpoint (`ERR_BLOCKED_BY_CLIENT`); the local Vercel CLI environment file is a separate source.
- Aspect-ratio variants, 2.x input-video duration and audio combinations, image quantity/reference-image/pixel-tier charges, and any client-specific Studio/MCP scenarios not represented by the 202-row versioned snapshot.
- Provider Draft and final amounts, which do not yet exist in MaxVideoAI. They require separate quotes and may have no “current customer price” to preserve.
- Actual BytePlus invoice lines and contract activation. Contract `CT20260925128931` remains “To be confirmed” in the connected console; effective negotiated cost is unknown.

The manual-tariff activation gate must compare effective production quotes across every currently sellable scenario to the newly computed amounts, to the cent. Missing coverage blocks activation or that new feature. A newly introduced Draft/final scenario gets an explicit reviewed price instead of an invented historical amount.
