# Task 9 report — publication-gated pricing and PAYG discovery

Date: 2026-09-01

## Revision

- Reviewed base and pre-commit HEAD: `033f0d7800b10683df03716ee0edc2a5d29c4443`
- Initial implementation commit: `3bf9d4f5593906a6219e33d348c1c7ab09236d31`.
- Review-fix commit: this report is committed with the fix, so the final hash is recorded in the handoff.

## Outcome

The pricing hub and pay-as-you-go acquisition surface are prepared for the seven P0 video models without publishing them. No model-registry flag, generated runtime/catalog/roster projection, provider route, billing fact, rate, or JSON-LD Offer amount changed.

Pricing discovery now requires all of the following:

- a video-capable entry;
- `available` or `limited` availability;
- `current` or `legacy` lifecycle;
- canonical pricing publication (`surfaces.pricing.includeInEstimator`).

Model-page, comparison, or app visibility is no longer a substitute for pricing publication. Consequently, `deep_legacy` and `retired` entries cannot re-enter the current pricing matrix through a historical indexable page.

A pure `buildVideoPricingRowsFromEntries(entries, locale)` seam lets the same canonical entries be tested with hidden and published fixture flags. The production wrapper still consumes `listFalEngines()`.

## RED evidence

`tests/p0-pricing-discovery.test.ts` was created before production edits and run with the repository's Node test runner:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json \
  --test tests/p0-pricing-discovery.test.ts
```

Initial result: **7 tests, 2 passed, 5 failed**. The failures were caused by the intentionally missing supplied-entry builder/predicate behavior and proved that hidden/visible fixtures, lifecycle ordering, localized links, PAYG publication gating, and quote propagation were not yet implementable through a pure seam.

After the implementation, the initial file completed **7/7 passing**. The independent code review then identified three untested edge cases. Regression tests produced a second clean RED of **9 tests, 6 passed, 3 failed** for exactly:

- positional generic example checks being relabeled as hidden P0 examples on a sparse hub;
- a future unpublished comparison suggestion exposing a hidden P0 opponent;
- input-order-dependent sorting caused by a non-transitive pairwise comparator.

The fixes remove positional example synthesis, require canonical comparison publication in both pricing and PAYG, and deterministically reorder family variants inside the stable quote-sorted family slots. The expanded Task 9 file now completes **9/9 passing**, including reversed-input order equality.

The first root review requested two further regressions. Before production changes, the official public-baseline check failed on the stale 507-row fixture. The new PAYG tests also failed because a configured lookup without a visible row still received the implicit `/pricing#video-pricing` fallback and because no supplied-config seam existed for a future ID. After the fix, the expanded discovery file completes **11/11 passing**: an unknown future config produces no card, lookup, example, or href without a canonical pricing row, then produces all three exact anchored surfaces when that row is supplied. A separate regression preserves the eight explicitly authored model-page fallbacks.

## Hidden and visible fixture proof

The tests clone the live Fal entries and change only the relevant publication flags; imported registry JSON and global catalogs are never mutated.

- Hidden fixture: all seven P0 IDs are absent from pricing rows and from PAYG pricing rows, hero previews, supported-model cards, lookup cards, example costs, model fallback URLs, and comparison links.
- Visible fixture: all seven appear in pricing, supported-model cards, and lookup cards; the four family representatives appear in PAYG pricing, hero previews, and example costs.
- LTX order is exactly `ltx-2-5-pro`, `ltx-2-5-fast`, `ltx-2-3`, `ltx-2-3-fast`.
- Wan order is exactly `wan-3-prime`, `wan-3`, `wan-2-6`.
- Grok order is `grok-imagine-video-1-5`; FLUX order is `flux-3`, `flux-3-draft`.
- Current P0 entries are recommended; LTX 2.3 and Wan 2.6 are legacy.
- `ltx-2`, `ltx-2-fast`, and `wan-2-5` remain absent even when a test fixture enables every discovery surface.

The live registry remains hidden and unchanged. `pnpm model:registry:check` reported 50 valid models, 2 tombstones, a current 50-entry engine catalog, and no roster changes.

## Quote provenance

P0 lookup/example scenarios reference the existing `5s-720p` pricing-hub preset. The displayed values are read from each `VideoPricingRow.quotes` object, which is produced through the canonical public pricing facts and quote path.

The behavioral test replaces one LTX 2.5 Pro fixture quote display with `$432.10` and proves that the value propagates to:

- the PAYG pricing matrix;
- the lookup card;
- the example cost;
- the hero preview.

The same value remains absent from locale content. Source guards also confirm that the pricing/PAYG config and EN/FR/ES content contain no P0 total/rate owner. `pnpm pricing:audit` completed with **218/218 matches and 0 mismatches**.

The generic starter-credit Offer JSON-LD remains byte-for-byte unchanged: both existing `price: '10.00'` literals remain generic starter-credit offers, with no P0 Product/Offer or model total added. Only caller-owned localized feature prose changed.

## PAYG and locale work

- Added the seven P0 IDs to supported-model and lookup contracts, and one representative per family to example-cost contracts.
- Added current-first family selection for LTX, Wan, Grok, and FLUX while removing deep-legacy IDs from preferred and comparison selection.
- P0 supported-model configs deliberately have no fallback URL. More generally, every supported-model config without a visible row is omitted unless it owns an explicit published fallback URL.
- Every price lookup requires a visible canonical pricing row. There is no implicit general-pricing fallback and no duplicated P0 publication-ID set.
- Discovery configuration is injectable into the pure PAYG builder, so future config fixtures prove fail-closed behavior without editing an allowlist.
- Sparse example data returns only examples backed by visible pricing rows; it never relabels generic checks with configured model IDs.
- Pricing and PAYG comparison links require the canonical pair to pass `isPublishedComparisonSlug`, in addition to the model allowlist.
- Updated natural-question, model-decision, no-subscription, subscription-comparison, FAQ, lookup, example, metadata, and JSON-LD feature copy in genuine EN/FR/ES language.
- All localized model links derive from route helpers: `/models/{slug}`, `/fr/modeles/{slug}`, `/es/modelos/{slug}`. Pricing anchors derive from the canonical slug as `{slug}-pricing`.

Locale parity and link audits:

- `pnpm --prefix frontend run i18n:check`: FR 4,207 keys and ES 4,201 keys, parity OK.
- `pnpm --prefix frontend run seo:check`: SEO, llms, internal-link, and public-media guards all passed.
- The PAYG data owner is 366 lines, within the 400-line architecture contract. Its 61-line discovery configuration is isolated in `payg-discovery-config.ts`; locale modules are 293 lines each and the type owner is 177 lines.

## Reviewed public-baseline refresh

The pricing predicate intentionally removed deep-legacy entries from the rendered pricing hub. The official `pnpm pricing:public-baseline:generate` command rewrote only `tests/fixtures/pricing-public-projections.v1.json`.

A structured before/after comparison proves:

- 507 rows before and 472 rows after;
- exactly 35 deletions, 0 additions, and 0 modifications;
- exactly seven removed scenarios for each of `ltx-2-fast`, `ltx-2`, `lumaRay2_flash`, `lumaRay2`, and `wan-2-5`.

No immutable pricing parity or shadow fixture changed. The read-only baseline command now reports `current (472 rows)`, including under the machine-specific environment overrides exercised by the contract test. `pnpm pricing:audit` remains at **218/218 matches and 0 mismatches**.

## Verification

Focused Task 9, PAYG, pricing-link/architecture/rendering, and Task 5 pricing command:

```text
89 tests, 89 passed, 0 failed
```

All P0 suites:

```text
70 tests, 70 passed, 0 failed
```

Additional gates:

```text
pnpm pricing:audit                              218/218 matches; 0 mismatches
pnpm pricing:public-baseline                    current (472 rows)
pnpm model:registry:check                       pass; projections current; no roster changes
pnpm --prefix frontend run i18n:check           pass
pnpm --prefix frontend run seo:check            pass
pnpm --prefix frontend exec tsc --noEmit        pass
npm --prefix frontend run lint                   pass; 0 warnings
npm run lint:exposure                            pass
git diff --check                                 pass
```

The repository-wide `pnpm test:validate` completed with **3,868/3,872 passing**. The remaining four failures are unchanged and outside the Task 9 diff: Black Forest Labs theme tokens, the generate-route attachment-processing contract, the synthetic registry replacement fixture lifecycle, and the workspace composer split contract. The previous public-pricing-baseline failure is resolved.

## Deviations and residual risks

- `payg-jsonld.ts` was intentionally not modified. The approved task brief requires preserving the generic starter-credit Offer unchanged and forbids inventing per-model offers; localized JSON-LD feature copy is owned by the three content modules and was refreshed there.
- P0 names now exist in localized acquisition prose/config, but no hidden model row, card, lookup, example, hero preview, anchor, or link renders until publication. Task 14 remains the sole registry flag flip.
- Verification ran under Node `v23.9.0`; the repository declares Node 22.x, so pnpm emitted the existing engine-version warning. All requested gates nevertheless completed successfully.
