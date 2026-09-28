# ByteDance pricing baseline — 2026-09-28

Base commit: `add7b773b24af04ae7ef33917628dcea3f67c58e` (`origin/main` when the isolated branch was created). This is a **versioned-policy** baseline, not a claim about the effective production database overrides.

The existing read-only guards passed before implementation:

| Guard | Result |
| --- | --- |
| `pnpm pricing:baseline` | 178 immutable rows |
| `pnpm pricing:public-baseline` | 588 current rows |
| `pnpm pricing:audit` | 266 scenarios, 262 matches, 4 approved changes, 0 mismatches |

`tests/fixtures/bytedance-versioned-price-baseline-2026-09-28.json` freezes 202 representative and edge customer quotes under the versioned policy, including Seedance video modes, resolution and duration extremes, 1.5 audio on/off, video-input versus no-video input, and current Seedream size/mode combinations. For each row it records the customer amount, historical quote “vendor subtotal”, policy source and rule/profile. That subtotal is **not** to be treated as BytePlus cost for padded Seedance 2.x. This fixture is a local regression reference for the new quote path; production may differ.

Coverage to add before activating a manual grid:

- Effective production `app_pricing_rules` and policy provenance; the connected Chrome blocked direct access to the authorized pricing-inventory endpoint (`ERR_BLOCKED_BY_CLIENT`). Do not infer absence of DB overrides.
- Aspect-ratio variants, 2.x input-video duration and audio combinations, image quantity/reference-image/pixel-tier charges, and any client-specific Studio/MCP scenarios not represented by the 202-row versioned snapshot.
- Provider Draft and final amounts, which do not yet exist in MaxVideoAI. They require separate quotes and may have no “current customer price” to preserve.
- Actual BytePlus invoice lines and contract activation. Contract `CT20260925128931` remains “To be confirmed” in the connected console; effective negotiated cost is unknown.

The manual-tariff activation gate must compare effective production quotes across every currently sellable scenario to the newly computed amounts, to the cent. Missing coverage blocks activation or that new feature. A newly introduced Draft/final scenario gets an explicit reviewed price instead of an invented historical amount.
