# Final review fixes report

## Scope

Resolved all four Important findings from the final branch review in one implementation commit:

- removed the stale Seedance publication-shaped launch policy and added a semantic one-owner guard;
- implemented validated replacement retirement and direct localized replacement redirects;
- separated model-page publication from indexation and sitemap route decisions while preserving the legacy surface shape;
- made the registry/prebuild check compare every generated model projection exactly without writes.

## TDD evidence

### RED

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts tests/model-registry-redirects.test.ts tests/model-page-publication.test.ts tests/model-generated-projections.test.ts tests/model-registry-architecture.test.ts
```

Result: 17 passed, 6 failed as expected. Failures covered the missing replacement retirement contract, cycle classification, replacement redirect projector, route publication helper, exact generated-projection helper, and the stale Seedance publication policy detected by the new semantic guard.

### GREEN

Focused command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts tests/model-registry-redirects.test.ts tests/model-page-publication.test.ts tests/model-generated-projections.test.ts tests/model-registry-architecture.test.ts tests/model-registry-parity.test.ts tests/model-page-static-architecture.test.ts tests/fal-engine-catalog-architecture.test.ts tests/public-engines.test.ts
```

Result: 43/43 passed. The redirect baseline remains exactly 141 generated rules because the current registry has no replacement entries; mutation fixtures cover canonical and historical replacement sources in EN/FR/ES.

Full suite:

```bash
pnpm test:validate
```

Result: 1892/1892 passed, 0 failed.

## Verification

All passed:

```bash
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm model:registry:check
pnpm model:check
pnpm --prefix frontend run build
git diff --check
```

Production build emitted `frontend/.next/BUILD_ID` value `RTCBSQsDTWGpqiqw_OSRG`.

The registry check was run between two SHA-1 snapshots of all five generated projections. Every hash was unchanged:

- runtime: `ed8cc174389747aacf558618d472711bc62145b7`
- engine catalog: `801a3a8f3b374c3ab951ddf600a0f73d0145e714`
- frontend roster: `0ef7da61a4b3f07ff2e75327a9cc04f2f95dd6e5`
- docs roster JSON: `0ef7da61a4b3f07ff2e75327a9cc04f2f95dd6e5`
- docs roster CSV: `093e56ba1c974442bcf1b3396b43d353c1541e86`

Incidental dated SEO matrix updates and the model-roster report timestamp produced by verification were reversed. `model:check` retained its pre-existing 12 non-blocking content/family warnings and reported 0 critical findings.

## Commits

- Final-review base: `804db073f76de1e933495cf5c4d11d296039486f`
- Implementation: `972b11821684c57e2984dd4fa74d8bbfa6896879` (`fix: harden model registry contracts`)
- Report: committed immediately after this file.

## Remaining concerns

No known correctness blocker. The live registry currently exercises replacement behavior only through mutation fixtures; the first real retirement will be protected by the same validator, redirect, one-hop, and exact-projection checks.
