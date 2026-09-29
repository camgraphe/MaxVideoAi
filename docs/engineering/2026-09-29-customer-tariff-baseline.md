# Customer tariff baseline — 2026-09-29

This is a **read-only, incomplete cutover baseline**, not a tariff activation or a new price list. The corrected collector ran in a PostgreSQL `REPEATABLE READ READ ONLY` transaction at `2026-09-29T16:41:13.764Z`. The configured local database URL matched the linked Vercel production environment by hostname, database name and username. No URL or credential is recorded here.

| Evidence | Result |
| --- | ---: |
| App-published models / registry families | 48 / 15 |
| Finite sampled scenarios with an effective canonical quote | 66,549 / 66,549 |
| Quote failures among those scenarios | 0 |
| Unresolved capability boundaries | 122 |
| Loaded effective database pricing rules | 4 |
| Effective quote provenance among sampled scenarios | 66,549 database / 0 versioned |

Registry SHA-256: `4e377d9738c1b5d83dd8edc1907b463530010f6539dbe794e0479117c1cf7611`. The non-secret database identity digest is `d94373ce0b23caf83e2c6b1dcf80d3e64772560db942f547ba62e1e637f7029c`; effective rule-set digest is `4bf7ed318141ebaa8481b6074bf3f65774ff13d76683ef8bddcd238bef197277`.

The unresolved boundaries comprise 59 automatic aspect-ratio paths, 29 automatic/open duration paths, 18 reference-image count/metadata paths, six automatic/custom resolutions, four fractional input-video duration paths, three open input-video duration paths, two open input-audio duration paths and one unbounded reference-token budget. Representative trusted input durations and token thresholds are included in the sampled matrix; that does **not** establish full coverage of their continuous or media-dependent values. No price should be invented for these paths.

The raw report is an ignored local file at `.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/effective-baseline-v3.json`. It contains customer cents, rule provenance and exact selectors for every sampled row. This correction passes the proper input-image count to first/last-frame and reference-image modes; 24 shared scenario IDs changed price versus the earlier draft report. Re-run `PRICING_BASELINE_OUTPUT=<new ignored path> pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/collect-effective-customer-tariffs.ts` after any registry, capability or database rule change. The command refuses to overwrite an existing report and never writes to the database.

`pnpm pricing:baseline` retained its 178 immutable rows. `pnpm pricing:public-baseline` retained 577 current rows. `pnpm pricing:audit -- --json` reported 266 scenarios, 262 matches, four approved changes and zero mismatches. These older audits sample other fixed surfaces and do not close the 122 capability gaps above.

**Cutover gate:** manual tariffs remain inactive. Build continuous unit terms or verified bounded selectors for the unresolved capabilities, repeat the effective quote collection against a fixed database revision, and compare every supported quote to its proposed explicit tariff to the cent before an isolated activation. Production activation remains a separate reviewed operation.
