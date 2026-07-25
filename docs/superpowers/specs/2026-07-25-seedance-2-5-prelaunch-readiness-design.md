# Seedance 2.5 Prelaunch Readiness Design

Date: 2026-07-25

Status: approved design, pending implementation plan

## Context

Dreamina publicly describes Seedance 2.5 as a forthcoming model with longer video generation, 4K output, richer multimodal references, reference-to-video control, and localized editing. The same official page still labels the model as coming soon. The current BytePlus ModelArk documentation exposes Seedance 2.0, Seedance 2.0 Fast, and Seedance 2.0 Mini model IDs, but no Seedance 2.5 API contract.

MaxVideoAI already has a direct BytePlus ModelArk integration with asynchronous submission, polling, storage copying, failure normalization, pricing, and admin-gated routing. That foundation is suitable for Seedance 2.5, but several current branches treat any unrecognized Seedance engine as the Fast variant. This creates an unacceptable prelaunch risk: an unknown future model could inherit the wrong model ID, duration and resolution caps, or vendor rate.

The authenticated workspace also supports typed image, video, and audio reference fields. Current limits are enforced independently per field. There is no shared multimodal reference budget, even though future Seedance workflows may require one combined limit.

## Decision

Use a staged hybrid launch:

1. Prepare the provider architecture, generic reference-budget capability, tests, and localized launch content now.
2. Keep Seedance 2.5 absent from the executable engine catalog, canonical model registry, generated projections, app discovery, pricing, sitemap, and public routes.
3. Add the actual engine only after BytePlus publishes an official API contract.
4. Promote the model through hidden admin testing, public `noindex`, and finally indexed/public stages after technical and commercial gates pass.

This approach preserves launch speed without inventing provider facts or publishing a thin, potentially misleading SEO page.

## Goals

1. Make the BytePlus Seedance integration fail closed for unknown engine IDs, model IDs, and pricing profiles.
2. Preserve the current runtime, public output, and billing behavior of Seedance 2.0 Standard, Fast, Mini, and the hidden direct Fast engine.
3. Introduce an explicit, typed, mode-aware aggregate reference-budget contract that can later represent a 50-reference workflow.
4. Prepare factual EN, FR, and ES Seedance 2.5 content and a launch packet without exposing a route.
5. Define the evidence and gates required to add and publish the real model quickly once the API becomes available.

## Non-goals

- Do not add a `seedance-2-5` runtime engine or canonical registry entry.
- Do not guess or reserve a BytePlus model ID.
- Do not reuse Seedance 2.0 token rates, dimensions, FPS, margin inputs, or failure-charging assumptions for Seedance 2.5.
- Do not claim that Dreamina product-surface features are available through the BytePlus API.
- Do not publish, index, sitemap, price, compare, or expose Seedance 2.5 in the app.
- Do not change the effective Seedance 2.0 reference limits in this batch. The existing copy-versus-validation discrepancy around 12 versus 15 combined references is recorded but must be resolved separately with provider evidence.
- Do not redesign the full asset picker or render fifty empty reference slots.

## Alternatives Considered

### Technical preparation only

This is the safest runtime option, but it leaves localized content, launch messaging, and publication review until the API arrives.

### Public indexed waitlist immediately

This may capture search demand earlier, but the model-page architecture requires an engine definition. Creating one now would force MaxVideoAI to encode unconfirmed execution capabilities or introduce a marketing-only engine shape that the current catalog is not designed to represent.

### Chosen hybrid

Prepare all reversible technical foundations and unpublished content now. Keep the route absent until an official engine definition can be authored. This avoids false claims while reducing the post-API launch path to factual configuration, canary testing, and controlled publication.

## Architecture

### 1. BytePlus Seedance capability profiles

Add one focused provider-side profile module adjacent to the existing BytePlus ModelArk adapter. The profile registry is keyed by canonical MaxVideoAI engine ID and initially contains only the currently supported BytePlus Seedance variants.

The profile contract owns factual runtime selection:

```ts
type BytePlusSeedanceProfile = {
  engineId: string;
  modelConfigKey: BytePlusSeedanceModelConfigKey;
  supportedModes: readonly Mode[];
  durationOptions: readonly number[];
  resolutions: readonly Resolution[];
  aspectRatios: readonly AspectRatio[];
  framesPerSecond: number;
  generatedAudio: boolean;
  pricingProfileKey: BytePlusSeedancePricingProfileKey;
  routing: {
    providerOverrideConfigKey?: BytePlusSeedanceProviderOverrideConfigKey;
    adminOnlyConfigKey: BytePlusSeedanceAdminOnlyConfigKey;
    allowedModesConfigKey: BytePlusSeedanceAllowedModesConfigKey;
    alwaysDirect: boolean;
  };
};
```

Exact type names may be adjusted during implementation to match existing conventions, but the ownership boundary is binding:

- Engine selection, caps, routing configuration, and accounting keys come from a recognized profile.
- No branch may use Fast as the fallback for an unknown engine.
- Existing exported helpers remain as compatibility wrappers where they have current consumers.
- Profile lookup for an unknown engine returns an explicit unavailable result or throws a typed provider configuration error before submission or billing.
- Provider IDs remain in the provider/config layer and never become canonical registry aliases.

The initial profile registry covers:

- `seedance-2-0`
- `seedance-2-0-fast`
- `seedance-2-0-mini`
- `seedance-2-0-fast-byteplus`

There is deliberately no Seedance 2.5 profile in this batch.

### 2. Fail-closed accounting

The current accounting helper defaults non-Standard and non-Mini IDs to the Fast rate. Replace that implicit default with an explicit pricing profile lookup.

The accounting contract must:

- preserve every current unit rate and resolution/input-type distinction;
- preserve the existing 24 FPS and token-dimension behavior for current models;
- reject an unknown engine or missing pricing profile before a charge can be calculated;
- never emit a zero price or Fast price as a recovery path;
- leave canonical commercial policy and margin ownership unchanged.

No authored pricing policy, frozen pricing baseline, or customer-visible amount changes in this batch.

### 3. Aggregate multimodal reference budget

Extend the input-schema type with one explicit aggregate capability:

```ts
type EngineReferenceBudget = {
  fieldIds: string[];
  modes?: Mode[];
  maxTotal: number;
  countUniqueUrls: boolean;
};
```

`EngineInputSchema` receives an optional `referenceBudget` property. Per-field `maxCount` remains authoritative for each media type; the aggregate budget adds a second cross-field guard.

Generic behavior:

- Client insertion evaluates the next complete asset state atomically.
- Server validation counts normalized values across the declared fields.
- Duplicate URLs count once when `countUniqueUrls` is true.
- Mode filtering prevents unrelated fields from consuming the budget.
- Provider payload construction performs a final defensive check.
- Engine changes reconcile retained asset fields against the destination schema before generation.
- Error messages distinguish a per-field limit from the shared reference budget.

This batch implements and tests the generic contract but does not attach it to the current Seedance engines. Therefore existing Seedance 2.0 behavior remains unchanged. Seedance 2.5 will receive a real budget only when the BytePlus API documents the combined and per-media limits.

The future high-volume UI should reuse the existing progressive-slot behavior and add a shared `used / total` indicator. Bulk asset selection, compact thumbnails, audio-library browsing, and stable `@ImageN`/`@VideoN`/`@AudioN` ordering belong to the later factual Seedance 2.5 engine batch, not this preparation batch.

### 4. Unpublished launch content

Use the existing model setup workflow to create:

- `content/models/en/seedance-2-5.json`
- `content/models/fr/seedance-2-5.json`
- `content/models/es/seedance-2-5.json`
- `docs/model-launch/seedance-2-5.md`
- an engine stub under `docs/model-launch/`

The localized content is rewritten from the scaffold and may state only:

- ByteDance/Dreamina has announced Seedance 2.5 as forthcoming;
- product-surface capabilities explicitly described by official Dreamina material;
- MaxVideoAI API availability, price, timing, and executable limits are not yet confirmed;
- the page is launch preparation and not a live generation offer.

The content must not contain:

- an app generation CTA;
- a provider model ID;
- a customer price or vendor rate;
- a guaranteed release date;
- API capability language inferred from Dreamina;
- claims that Seedance 2.5 is available on MaxVideoAI.

The model setup command may generate a registry skeleton for review, but the skeleton is not inserted. Canonical registry validation requires a factual engine-catalog entry, so the route remains nonexistent rather than partially modeled.

### 5. Publication state machine after API release

Once official BytePlus documentation exists, use these stages:

1. **Hidden execution**
   - Add the factual raw engine definition and canonical registry entry.
   - Keep every publication field false.
   - Configure explicit `enabled=false`, `adminOnly=true`, and public routing disabled defaults.
   - Add the real model ID through environment/provider configuration.

2. **Admin canary**
   - Enable only for authenticated admins.
   - Validate submission, polling, output copying, expiration handling, moderation errors, usage accounting, and refunds.
   - Run the fixed quality/cost benchmark suite.

3. **Public noindex**
   - Publish the model route with `indexable=false`.
   - Keep sitemap, pricing, compare, and broad app discovery disabled until their prerequisites pass.
   - Use a waitlist or limited-availability CTA only if generation access is intentionally restricted.

4. **Public indexed**
   - Enable app, pricing, sitemap, examples, comparisons, and indexation independently through the canonical registry.
   - Keep Seedance 2.0 as an active alternative unless a separate retirement decision is approved.

## Data and Control Flow

For current engines:

```text
canonical engine ID
→ recognized BytePlus Seedance profile
→ runtime caps and routing
→ validated request options and references
→ provider payload
→ asynchronous task
→ usage/accounting profile
→ canonical pricing policy
→ persisted result or refund
```

For an unknown future engine:

```text
unknown engine ID
→ no profile
→ explicit unavailable/configuration failure
→ no provider submission
→ no wallet charge
```

## Error Handling

- Unknown engine profile: reject before request normalization.
- Missing model configuration: reject before provider submission.
- Unknown pricing profile: reject before billing authorization or settlement.
- Aggregate reference overflow: return a customer-safe validation error with the actual maximum.
- Engine downgrade with excess retained assets: deterministically prune or block according to the destination schema before payload construction.
- Provider safety and copyright errors: preserve the existing normalized Seedance customer messaging.
- BytePlus outage or overload: preserve existing queue/retry behavior; do not introduce a fallback to a different Seedance version.

## Testing Strategy

Implementation follows red-green-refactor. Each new behavior must first be represented by a focused failing test.

### Provider and accounting contracts

- Profile parity for Standard, Fast, Mini, and hidden direct Fast.
- Unknown engine profile fails explicitly.
- Unknown pricing profile cannot inherit the Fast rate.
- Existing model IDs, modes, duration options, resolutions, FPS, audio flags, and unit rates remain unchanged.
- Existing provider adapter line-count and module-boundary contracts remain valid.

Primary tests:

- `tests/byteplus-provider-architecture.test.ts`
- `tests/generate-byteplus-submission.test.ts`
- `tests/generate-request-options.test.ts`
- `tests/seedance-2-pricing.test.ts`

### Reference-budget contracts

- Per-field limits still apply.
- Aggregate limits apply across image, video, and audio fields.
- Unique URL counting is deterministic.
- Mode-scoped fields do not consume unrelated budgets.
- Client insertion and server validation agree.
- Engine switching cannot submit retained assets beyond the destination schema.
- Payload construction rejects defensive overflow.

Primary tests:

- `tests/validate-request.test.ts`
- `tests/workspace-assets.test.ts`
- `tests/workspace-generation-inputs.test.ts`
- relevant workspace contract tests

### Launch-content contracts

- EN, FR, and ES files have the exact `seedance-2-5` identity.
- No localized content exposes an app-generation CTA, model ID, price, or availability claim.
- No canonical registry, generated runtime, app, pricing, sitemap, examples, or comparison surface includes Seedance 2.5.
- The launch packet records the official-facts gate and required promotion commands.

Primary tests:

- `tests/model-setup-cli.test.ts`
- a focused `tests/seedance-2-5-readiness.test.ts`

## Verification

Focused verification:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-request-options.test.ts \
  tests/seedance-2-pricing.test.ts \
  tests/validate-request.test.ts \
  tests/workspace-assets.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/model-setup-cli.test.ts \
  tests/seedance-2-5-readiness.test.ts
```

Repository guards:

```bash
pnpm model:registry:check
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

A production build is run if implementation touches shared schema serialization, engine catalog generation, or model-page loading.

## Acceptance Criteria

The preparation batch is complete only when:

1. Every current BytePlus Seedance engine resolves through an explicit profile.
2. Unknown engines and pricing profiles fail closed with no provider request and no charge.
3. All existing Seedance 2.0 capability and price assertions remain unchanged.
4. The generic aggregate reference-budget contract is enforced consistently in tested client, server, and payload paths without being enabled for current engines.
5. Seedance 2.5 localized launch content exists but cannot resolve to a public or executable model.
6. No Seedance 2.5 model ID, rate, API limit, or launch date is invented.
7. Focused tests, pricing baselines/audit, registry checks, lint, TypeScript, and diff checks pass with fresh evidence.

## Official API Facts Required for the Next Batch

Before adding the real engine, obtain and record:

- canonical BytePlus model ID and supported regions;
- entitlement and release status;
- supported input modes and payload roles;
- duration, resolution, aspect-ratio, FPS, and audio options;
- combined and per-media reference limits, formats, sizes, and durations;
- prompt/reference anchor syntax and ordering rules;
- editing and extension semantics;
- task status, webhook, output, expiration, and usage schemas;
- moderation and provider error codes;
- concurrency, RPM, quotas, and service tiers;
- vendor pricing units, input-type distinctions, failure charging, and refund behavior.

Only this evidence can authorize a Seedance 2.5 runtime profile, pricing facts, and publication change.
