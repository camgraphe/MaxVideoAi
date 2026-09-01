# Task 9 report — publication-gated pricing and PAYG discovery

Date: 2026-09-01

## Revision

- Reviewed base and pre-commit HEAD: `033f0d7800b10683df03716ee0edc2a5d29c4443`
- Implementation commit: this report is committed with the implementation, so the final hash is recorded in the handoff.

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
- P0 supported-model configs deliberately have no fallback URL. A row without a published localized model link is omitted.
- Hidden P0 lookup configs are omitted rather than falling back to the general pricing route.
- Sparse example data returns only examples backed by visible pricing rows; it never relabels generic checks with configured model IDs.
- Pricing and PAYG comparison links require the canonical pair to pass `isPublishedComparisonSlug`, in addition to the model allowlist.
- Updated natural-question, model-decision, no-subscription, subscription-comparison, FAQ, lookup, example, metadata, and JSON-LD feature copy in genuine EN/FR/ES language.
- All localized model links derive from route helpers: `/models/{slug}`, `/fr/modeles/{slug}`, `/es/modelos/{slug}`. Pricing anchors derive from the canonical slug as `{slug}-pricing`.

Locale parity and link audits:

- `pnpm --prefix frontend run i18n:check`: FR 4,207 keys and ES 4,201 keys, parity OK.
- `pnpm --prefix frontend run seo:check`: SEO, llms, internal-link, and public-media guards all passed.
- The PAYG data owner is 397 lines, within the 400-line architecture contract; locale modules are 293 lines each and the type owner is 177 lines.

## Verification

Focused Task 9, PAYG, pricing-link/architecture/rendering, and Task 5 pricing command:

```text
75 tests, 75 passed, 0 failed
```

All P0 suites:

```text
68 tests, 68 passed, 0 failed
```

Additional gates:

```text
pnpm pricing:audit                              218/218 matches; 0 mismatches
pnpm model:registry:check                       pass; projections current; no roster changes
pnpm --prefix frontend run i18n:check           pass
pnpm --prefix frontend run seo:check            pass
pnpm --prefix frontend exec tsc --noEmit        pass
npm --prefix frontend run lint                   pass; 0 warnings
npm run lint:exposure                            pass
git diff --check                                 pass
```

## Deviations and residual risks

- `payg-jsonld.ts` was intentionally not modified. The approved task brief requires preserving the generic starter-credit Offer unchanged and forbids inventing per-model offers; localized JSON-LD feature copy is owned by the three content modules and was refreshed there.
- P0 names now exist in localized acquisition prose/config, but no hidden model row, card, lookup, example, hero preview, anchor, or link renders until publication. Task 14 remains the sole registry flag flip.
- Verification ran under Node `v23.9.0`; the repository declares Node 22.x, so pnpm emitted the existing engine-version warning. All requested gates nevertheless completed successfully.
