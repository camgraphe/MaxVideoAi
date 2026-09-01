# Task 5 report — canonical P0 video pricing

Date: 2026-09-01

## Revision

- Base: `165e24dacbc2d60e7f7a8afe55c607031b6d52bd`
- Pre-commit HEAD while authoring this report: `165e24dacbc2d60e7f7a8afe55c607031b6d52bd`
- Final implementation commit: reported in the Task 5 handoff because a commit cannot contain its own hash.

## Outcome

The shared factual pricing-definition path now selects per-mode rates, distinguishes output duration from trusted input-audio duration, and adds paid reference-image facts before entering the existing `quoteCanonicalPricing` commercial kernel. No P0-ID calculator, second margin owner, provider adapter, environment variable, poller, or direct-provider route was added.

All seven hidden P0 engines retain exact Fal vendor facts across billing and browser-safe public projection:

- Wan 3: 5/10/20 cents per output second at 480p/720p/1080p.
- Wan 3 Prime: 6.8/14/28 cents per output second; the factual kernel preserves 40.8 cents for 6 seconds at 480p before the canonical quote applies its configured integer presentation rounding.
- LTX 2.5 Fast: 9/13/19/30 cents per output second at 720p/1080p/1440p/2160p; A2V uses 13 cents per trusted input-audio second at 1080p.
- LTX 2.5 Pro: 12/17 cents per output second at 720p/1080p; A2V uses 17 cents per trusted input-audio second at 1080p.
- Grok Imagine Video 1.5: 8/14/25 cents per output second for T2V/I2V; ref2v is 8/14 cents at 480p/720p plus 1 cent for every reference image, with no free reference.
- FLUX.3: 17/29 cents per output second for normal generation and 41/53 cents for extend at 720p/1080p.
- FLUX.3 Draft: 6 cents per output second for normal generation and 12 cents for extend at fixed 720p.

## RED evidence

Before production edits:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/p0-video-pricing-parity.test.ts \
  tests/pricing-definition.test.ts \
  tests/pricing-billing-projection.test.ts \
  tests/pricing-public-projection.test.ts
```

Result: 45 tests, 40 passed, 5 failed. The intended failures proved:

- LTX Fast A2V billed 6 output seconds instead of 9 input-audio seconds in factual, billing, and public paths;
- Grok ref2v omitted the first paid reference cent;
- LTX A2V did not fail closed when input-audio duration was absent;
- engine definitions had no mode/reference projection.

Wan Prime's pre-existing base rate already preserved 6.8-cent precision, so that literal test was green in the initial run; it remains a regression guard for multiplication and canonical rounding.

The audit integration received a second focused RED before its implementation: 9 of 10 P0 tests passed and the new audit-manifest projection failed on the first missing `billing:p0:*` scenario. The shadow fixture/generator test then failed with 8 rows instead of 40 and no generation command.

## Implementation

### One factual definition path

- Added structurally mirrored mode rate, duration-basis, and reference-image rule types to engine configuration and `@maxvideoai/pricing` definitions.
- Extended `computePricingDefinitionFacts` generically. It does not branch on P0 engine IDs.
- Mode rates resolve before the canonical quote. Missing resolution-specific mode facts fail closed.
- `input_audio` duration requires an explicit positive finite source duration; requested output duration is never substituted on paid prepared/execution paths.
- Reference counts must be non-negative safe integers. Grok's authored rule applies only to ref2v and charges every provided reference.
- Billing and public facts adapters pass the same normalized mode, reference count, and input-audio duration into the package.
- Pricing-detail merges and engine clones retain the new nested facts when database overrides omit them.

### Paid and legacy surfaces

- Site generation obtains LTX A2V duration only from trusted media-library metadata returned by the existing media-constraint validator. Client attachment duration is ignored. The billing request and persisted receipt metadata carry the trusted fact.
- Site generation passes the normalized reference-image array length to canonical billing, covering Grok ref2v.
- MCP prepare and confirmation execution use resolved private source-audio metadata. If preparation cannot resolve a positive audio duration, canonical facts fail closed.
- MCP project budget uses its explicit declared A2V source-clip duration because no media is resolved on that informational surface; the same fact is forwarded into canonical preflight.
- The legacy direct wallet endpoint now accepts a separate generation-mode field. It refuses Grok ref2v with `validated_reference_count_required` and LTX A2V with `trusted_input_audio_duration_required`, returning 422 rather than underquoting.
- Refund behavior remains unchanged and continues to use persisted charged amounts.

### Audit and downstream manifest

- Added one frozen normalized input manifest at `frontend/src/lib/pricing-audit/p0-video-scenarios.ts`. It contains the common 6-second/720p case for all seven engines, every published rate tier, Grok reference counts, FLUX extend, and LTX A2V with a distinct 9-second input-audio duration.
- Tests keep literal expected totals separate from production facts while consuming those same scenario inputs.
- Added all 32 P0 scenarios to the canonical pricing audit and preserved the 12 frozen legacy LTX 2.0/LTX 2.3/Wan 2.5 audit rows after their estimator publication flags changed in earlier tasks.
- Added `pricing:shadow-additions` and `pricing:shadow-additions:generate`; the generator projects the P0 rows through the existing canonical audit path.
- `tests/fixtures/pricing-shadow-additions.v1.json` now contains 40 rows: 8 existing rows plus 32 generated P0 rows.
- `tests/fixtures/pricing-parity.v1.json` remains byte-identical to the base 178-row immutable fixture.
- `pricing:public-baseline:generate` was run. Because P0 is still hidden, `tests/fixtures/pricing-public-projections.v1.json` remains byte-identical at 507 rows.

## GREEN evidence

Focused pricing, authority, paid-site, MCP, wallet, audit, and public suites:

```text
146 tests, 146 passed, 0 failed
```

The command covered:

- P0 literal facts and billing/public quote parity;
- pricing definition, package projection, canonical kernel, billing/public authority and refund contracts;
- direct generation preflight/receipt and video execution contracts;
- MCP prepare, confirmation pricing basis, and project budget;
- wallet direct fail-closed behavior and route architecture;
- pricing shadow generation/audit and public projection.

Final deterministic gates:

```text
pnpm pricing:baseline                 immutable (178 rows)
pnpm pricing:shadow-additions         current (40 rows)
pnpm pricing:public-baseline          current (507 rows)
pnpm pricing:audit                    218/218 matches, 0 mismatches
pnpm --prefix frontend exec tsc --noEmit
npm --prefix frontend run lint        pass, 0 warnings
npm run lint:exposure                 pass
git diff --check                      pass
```

The repository-wide `pnpm test:validate` completed with 3,804/3,811 passing. Its seven failures are outside the Task 5 diff and reproduce previously introduced Task 4/6 contract gaps: Black Forest Labs theme tokens, the known unverified public-HTTPS H3 duration case, paid asset URL materialization, Seedance 2.5 paid field projection, app-enabled template links, registry redirects, and the workspace composer split contract. The Task 5 focused owners and all pricing gates are green.

## Tests added or materially extended

- `tests/p0-video-pricing-parity.test.ts`
- `tests/wallet-direct-pricing.test.ts`
- `tests/generate-billing-preflight.test.ts`
- `tests/mcp-prepare-generation.test.ts`
- `tests/mcp-project-budget.test.ts`
- `tests/pricing-shadow.test.ts`

## Deviations and residual risks

- The public projection fixture intentionally has no P0 rows while registry pricing publication remains false. Tasks 9/14 must rerun the sole public generator after atomic publication.
- An informational MCP A2V budget has no resolved media object; its explicit requested duration is therefore defined as the planned source-audio duration. Paid prepare/confirm never use that fallback.
- The legacy wallet direct surface cannot validate attachment metadata, so exact media-priced modes are deliberately refused there. Normal T2V/I2V quotes continue unchanged.
- Wan Prime facts preserve fractional cents, while the canonical compatibility profile still rounds the displayed/charged vendor subtotal and commercial components to integers. This is existing kernel policy, not a loss of provider-rate precision.
- All P0 routing remains Fal-only. A future direct-provider agreement must be implemented and reviewed as a separate routing task.
