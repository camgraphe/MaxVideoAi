# Task 3 report — Seven raw Fal engine contracts

## Status

Implemented the seven raw, deliberately unaggregated Fal engine contracts and their three shared fact modules. The authoritative source was `docs/model-launch/p0-video-model-family-refresh.md`, including its post-review 23-schema inventory, Grok 15-second cap, and USD/cents units.

## TDD evidence

### Initial RED

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts
```

Result: expected failure, exit 1. The architecture contract reported `wan-3-shared.ts should exist under fal-engines`; the raw contract failed with `Cannot find module '../frontend/src/config/fal-engines/wan-3'`. Summary: 4 tests, 1 pass, 3 fail.

### Ownership RED

After the first GREEN, the strengthened registry-ownership assertion was run before removing nested `providerMeta.modelSlug`:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts
```

Result: expected failure, exit 1: `wan-3 providerMeta should not author modelSlug`. Summary: 6 tests, 5 pass, 1 fail. All seven nested authored model slugs were then removed; endpoint ownership remains in each mode plus `defaultFalModelId`.

### Brand-contract RED

The self-review cross-checked Task 6's declared partner IDs and added a test before correcting the raw facts:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts
```

Result: expected failure, exit 1: `'alibaba' !== 'wan'`. Wan now uses the established `wan` brand and FLUX uses the future partner ID `black-forest-labs`; provider attribution remains Alibaba and Black Forest Labs, with Fal endpoint prefixes kept separately.

### GREEN

Focused command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts
```

Result: PASS, 9/9 tests.

Final fresh verification:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts tests/model-registry-architecture.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Result: PASS. Tests 17/17; TypeScript exit 0; ESLint exit 0; public exposure check passed; diff check exit 0.

## Exact exports and modes

| Export | Ordered canonical modes |
| --- | --- |
| `WAN_3_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `ref2v` |
| `WAN_3_PRIME_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `ref2v` |
| `LTX_2_5_FAST_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `a2v` |
| `LTX_2_5_PRO_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `a2v` |
| `GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `ref2v` |
| `FLUX_3_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `fl2v`, `extend` |
| `FLUX_3_DRAFT_FAL_ENGINE_REGISTRY` | `t2v`, `i2v`, `fl2v`, `extend` |

Total: 7 raw entries and 23 exact Fal endpoints. `keyframes-to-video`, `draft-enhance`, `r2v`, `v2v`, and unprojected provider modes are absent.

The architecture test now distinguishes:

- the existing aggregate's known modules and exports;
- all ten new Task 3 source modules;
- the seven P0 registry exports that must remain explicitly absent from `fal-engines/registry.ts` until Task 6.

## Files

Created:

- `frontend/src/config/fal-engines/wan-3-shared.ts`
- `frontend/src/config/fal-engines/wan-3.ts`
- `frontend/src/config/fal-engines/wan-3-prime.ts`
- `frontend/src/config/fal-engines/ltx-2-5-shared.ts`
- `frontend/src/config/fal-engines/ltx-2-5-fast.ts`
- `frontend/src/config/fal-engines/ltx-2-5-pro.ts`
- `frontend/src/config/fal-engines/grok-imagine-video-1-5.ts`
- `frontend/src/config/fal-engines/flux-3-shared.ts`
- `frontend/src/config/fal-engines/flux-3.ts`
- `frontend/src/config/fal-engines/flux-3-draft.ts`
- `tests/p0-video-engine-contracts.test.ts`
- `.superpowers/sdd/2026-09-01-p0-video-model-family-refresh/task-3-report.md`

Modified:

- `tests/fal-engine-catalog-architecture.test.ts`

`frontend/src/config/fal-engines/registry.ts` and generated registry projections were not modified.

## Self-review

- The raw entries author runtime/provider facts only. They do not author `modelSlug`, `family`, `category`, publication surfaces, lifecycle, successors, or legacy policy.
- The tests import the raw modules directly, so the seven entries cannot leak into public materialization before Task 6.
- All 23 schema field inventories are represented by exact provider field IDs. Provider enum values such as Wan `adaptive`, LTX `2160p`, FLUX `2:1`, and special first/last/reference fields are preserved.
- Raw brand IDs align with existing/future partner ownership: `wan`, `lightricks`, `xai`, and `black-forest-labs`; owner names remain distinct from Fal distribution endpoints.
- Wan reference-to-video includes the five reference channels, per-channel counts/sizes, combined duration limits, minimum video fps, at-least-one product gate, and file/web thinking and mutual-exclusion facts.
- Base prices use cents correctly (`$0.05/s` = `5` cents, not `5` dollars). Special charging is documented without pretending the generic calculator is exact: Grok reference-count surcharge, FLUX extend rates, and LTX input-audio-second billing remain Task 5 work.
- Each new source module is below the 500-line architecture limit; no shared helper combines variant-specific endpoint or pricing facts.

## Concerns / follow-up boundaries

- Task 4 must implement and test canonical UI/request translation where current unions differ from Fal vocabulary: Wan `auto -> adaptive`, LTX `4k -> 2160p`, and typed FLUX support/projection for provider aspect `2:1`. The raw `inputSchema` and mode caps retain provider values so this cannot be silently lost.
- Task 5 must implement the three exact special pricing paths before publication.
- Task 6 owns hidden aggregation after canonical identities exist. Until then, the new modules are intentionally unreachable through `RAW_FAL_ENGINE_REGISTRY`.
- A paid-generation launch still requires the source and billing recheck called for by the frozen contract; this task defines pre-publication facts only.
- Verification ran under the worktree's Node `v23.9.0`; the repository declares Node 22.x.
