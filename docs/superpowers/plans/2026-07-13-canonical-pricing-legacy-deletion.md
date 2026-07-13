# Canonical Pricing Legacy Deletion Implementation Plan

> **For Codex:** Execute this plan inline with the `superpowers:executing-plans` workflow. The user explicitly approved work on `main`. Use strict red-green-refactor for each production change and keep every current price unchanged.

**Goal:** Remove the retired pricing facade and duplicate commercial calculators so every live price, margin, surcharge, discount, and settlement split is produced by the canonical pricing package and policy resolver.

**Architecture:** Keep provider-cost facts and presentation metadata close to their provider adapters, but route all commercial policy through `@maxvideoai/pricing`. Replace live “legacy versus canonical” comparisons with comparisons against the immutable pre-canonical parity fixture. Browser audio quotes use the same canonical public quote owner as the other public surfaces; server billing continues to use the server policy resolver.

**Tech Stack:** TypeScript, Next.js 15 App Router, Node test runner through `tsx`, `@maxvideoai/pricing`, JSON pricing policy fixtures.

---

## Task 1: Introduce narrow shared contracts and remove facade utility imports

**Files:**

- Create: `frontend/src/lib/pricing-context.ts`
- Modify: `packages/pricing/src/projection.ts`
- Modify: `packages/pricing/src/index.ts`
- Modify: `frontend/server/pricing/quote-billing.ts`
- Modify: `frontend/server/pricing/quote-public.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/app/api/generate/_lib/billing-preflight.ts`
- Modify: `frontend/src/server/images/execute-image-generation.ts`
- Modify: `frontend/src/server/tools/angle.ts`
- Modify: `frontend/src/server/tools/upscale.ts`
- Modify: `frontend/src/server/tools/background-removal.ts`
- Test: `tests/pricing-billing-projection.test.ts`
- Test: `tests/pricing-architecture.test.ts`

1. Add failing tests for the new `PricingContext` owner, exported settlement projection helpers, and the absence of runtime imports from `@/lib/pricing`.
2. Run the focused tests and confirm they fail because the new contract/helper exports do not exist.
3. Move the type without changing its shape; move `getPlatformFeeCents` and `getVendorShareCents` into the pure pricing projection package without changing fallback behavior.
4. Redirect every production import to the narrow owners.
5. Re-run the focused tests and the generation preflight tests.
6. Commit the green batch as `refactor: narrow pricing compatibility contracts`.

## Task 2: Replace specialized commercial snapshots with provider facts

**Files:**

- Create: `frontend/src/lib/luma-ray2-pricing-config.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/src/lib/pricing-definition.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Test: `tests/pricing-billing-migration.test.ts`
- Test: `tests/pricing-architecture.test.ts`
- Test: provider pricing tests for Luma, Seedance, and GPT Image 2

1. Freeze the current billing scenario outputs as explicit assertions so the test no longer imports the retired facade.
2. Add failing architecture assertions that billing facts must not import specialized snapshot builders and that Luma Ray 2 environment defaults have a factual configuration owner.
3. Run the focused tests and confirm the architecture test fails on the current imports.
4. Build `base`, `addons`, `facts`, and metadata directly from existing provider calculators. Use `applyEnginePricingOverride` plus `buildPricingDefinition` for the standard fallback.
5. Move only Luma Ray 2 environment/default resolution into `luma-ray2-pricing-config.ts`; do not move any margin or discount math.
6. Re-run billing parity, provider, public projection, and TypeScript checks.
7. Commit the green batch as `refactor: isolate canonical pricing facts`.

## Task 3: Route browser audio pricing through the canonical public owner

**Files:**

- Modify: `frontend/src/lib/audio-generation.ts`
- Modify: `frontend/src/lib/pricing-public-quote.ts`
- Modify: `frontend/server/pricing/quote-billing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/audio/AudioWorkspace.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/src/lib/pricing-audit/canonical-facts.ts`
- Test: `tests/audio-generation-config.test.ts`
- Test: `tests/audio-workspace-architecture.test.ts`
- Test: `tests/pricing-billing-migration.test.ts`
- Test: `tests/pricing-public-projection.test.ts`

1. Change tests to require an audio facts/presentation builder with no margin constant or local snapshot calculator, and a canonical public audio quote that preserves all current totals.
2. Run the focused tests and confirm failure on the old `buildAudioPricingSnapshot` ownership.
3. Keep audio provider-cost component logic in `audio-generation.ts`; remove its 150% margin constant and arithmetic.
4. Add a canonical public audio snapshot projection in `pricing-public-quote.ts` using the `audio-current` policy/profile.
5. Update workspace and pricing hub consumers. Preserve metadata by deriving any compatibility margin field from the resolved canonical policy, not a second constant.
6. Re-run audio, workspace, billing, public projection, and baseline checks.
7. Commit the green batch as `refactor: canonicalize public audio pricing`.

## Task 4: Retire live legacy collectors and delete old commercial layers

**Files:**

- Delete: `frontend/src/lib/pricing.ts`
- Delete: `frontend/src/lib/pricing-specialized-snapshots.ts`
- Delete: `frontend/src/lib/pricing-audit/legacy-collectors.ts`
- Modify: `frontend/src/lib/pricing-audit/canonical-collectors.ts`
- Modify: `frontend/src/lib/pricing-audit/matrix.ts`
- Modify: `frontend/scripts/pricing-public-baseline-collector.ts`
- Modify: `scripts/pricing-baseline.ts`
- Modify: `scripts/pricing-audit.ts`
- Modify: `package.json`
- Test: `tests/pricing-shadow.test.ts`
- Test: `tests/pricing-public-authority.test.ts`
- Test: `tests/pricing-foundation-architecture.test.ts`
- Test: legacy specialized pricing tests that import `pricing.ts`

1. Add failing tests requiring the three legacy modules to be absent and the audit to compare canonical output against `tests/fixtures/pricing-parity.v1.json`.
2. Run focused tests and confirm failure because the files still exist and collectors still import live legacy paths.
3. Make canonical audit collectors accept immutable fallback rows for unsupported presentation-only scenarios. Load the fixture only in Node scripts/tests, keeping browser/server modules free of `node:fs`.
4. Convert `pricing:baseline` into immutable fixture validation and remove the unsafe legacy regeneration command.
5. Switch the public baseline collector from the old facade to `computeCanonicalPublicSnapshot`.
6. Replace tests of deleted calculators with canonical policy/facts assertions, then delete the three legacy files.
7. Run both baselines and the 178-scenario audit; require zero drift and zero mismatches.
8. Commit the green batch as `refactor: delete legacy pricing engine`.

## Task 5: Tighten semantic one-owner guard and documentation

**Files:**

- Modify: `tests/pricing-consumer-inventory.test.ts`
- Modify: `tests/pricing-architecture.test.ts`
- Modify: `tests/pricing-foundation-architecture.test.ts`
- Modify: `tests/pricing-public-authority.test.ts`
- Modify: `tests/pricing-billing-authority.test.ts`
- Modify: `docs/engineering/pricing-engine.md`
- Modify: `docs/engineering/llm-working-guide.md` if its pricing workflow references compatibility paths

1. Add a semantic source scan that permits commercial formulas only in `packages/pricing/src` and policy values only in the versioned/DB policy owners.
2. Confirm the guard fails on any remaining duplicate margin, surcharge, discount, or settlement formula.
3. Remove or migrate the remaining duplicate and stale architecture assertions until the guard passes without weakening its patterns.
4. Document the final single-owner architecture, immutable migration baseline, current admin edit workflow, and safe price-change procedure.
5. Run focused architecture tests.
6. Commit the green batch as `test: enforce one pricing calculation owner`.

## Task 6: Full verification and delivery on main

1. Run `pnpm pricing:baseline` and require the immutable 178-row fixture to validate.
2. Run `pnpm pricing:public-baseline` and require all 492 rows to remain unchanged.
3. Run `pnpm pricing:audit` and require 178 matches, 0 mismatches.
4. Run `pnpm test:validate`, `npm --prefix frontend run lint`, `npm run lint:exposure`, `cd frontend && ./node_modules/.bin/tsc --noEmit`, `git diff --check`, and the live architecture audit.
5. Run `pnpm --prefix frontend run build` because public routes and the audio workspace changed.
6. Inspect `git status`, recent commits, and the final diff. Do not push unless the user explicitly asks.

