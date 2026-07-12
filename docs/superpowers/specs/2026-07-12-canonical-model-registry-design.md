# Canonical Model Registry Design

## Status

Approved design for the first architecture-simplification subproject. This document defines the target architecture and migration constraints. It does not authorize pricing, editorial-content, provider-routing, or polling changes.

## Context

Model identity is currently represented by several partially overlapping sources:

- engine definitions and launch configuration;
- `frontend/src/lib/engine-alias.ts` for internal identifier normalization;
- `frontend/config/model-publication.ts` for model, comparison, examples, app, and pricing publication decisions;
- model family and roster helpers;
- redirects in `frontend/next.config.js`, marketing middleware helpers, and route-level `permanentRedirect` calls;
- route-local model, comparison, examples, pricing, sitemap, canonical, and hreflang logic.

Each layer solved a valid local problem, but their accumulated precedence rules make it possible for one model to have different identities or publication states depending on the surface. The locale incidents on the homepage and blog demonstrated the operational cost of allowing routing policy to be distributed. Model routing has the same structural risk and should be simplified before more model-specific exceptions are added.

The live audit performed from `origin/main` on 2026-07-12 found:

- 87 manually maintained engine aliases;
- 79 redirect `source` entries in the `next.config.js` redirects block;
- 41 exact middleware redirect-map entries;
- 8 localized marketing route-level `permanentRedirect` calls;
- 120 localized model JSON files, representing 40 models in three locales;
- 40 model-page template modules;
- legacy model publication lists for surfaceless models, indexed comparisons, app discovery order, suggested opponents, and app variants.

These counts are an audit snapshot, not target limits. They establish the need for a single authority and a parity-first migration.

## Goals

1. Establish one canonical, static registry as the only owner of model identity and publication policy.
2. Preserve every currently supported public URL and all English, French, and Spanish SEO behavior.
3. Convert historical model URLs into deterministic, permanent, single-hop redirects to canonical localized destinations.
4. Preserve existing imports through temporary compatibility facades while consumers migrate incrementally.
5. Make contradictions, ambiguous aliases, redirect chains, and incomplete publication declarations fail in tests or at build time.
6. Keep provider execution identifiers and provider-specific routing outside the public model registry.
7. Complete the migration without database work, network lookups, or additional client JavaScript.

## Non-goals

This subproject does not:

- redesign or recalculate pricing;
- consolidate model-page or comparison editorial copy;
- refactor provider submission, webhook, job finalization, or polling code;
- change which models are publicly available;
- delete historical public URLs;
- change redirect destinations, canonical slugs, metadata, hreflang, JSON-LD, or sitemap inclusion;
- migrate database records or rewrite stored job identifiers;
- rename provider model IDs or move them out of provider adapters;
- perform the later pricing, content, or provider-finalization simplifications.

## Approved Compatibility Policy

### Public URLs

Historical public model URLs are permanent compatibility contracts. They remain accepted and return HTTP 301 directly to the canonical URL for the requested locale. A redirect must never pass through another legacy URL, change locale unexpectedly, or discard a query string that the existing route preserves.

The canonical model route shapes remain:

| Locale | Canonical shape |
| --- | --- |
| English | `/models/{canonicalSlug}` |
| French | `/fr/modeles/{canonicalSlug}` |
| Spanish | `/es/modelos/{canonicalSlug}` |

The registry stores historical model slugs, not a separately hand-authored redirect row for every locale. A single route projector derives the three localized redirects from each historical slug.

### Intentional redirect-status normalization

The current implementation mixes explicit HTTP 301 responses with Next.js `permanent: true` and `permanentRedirect`, which emit HTTP 308. The target contract standardizes historical model URL redirects on explicit HTTP 301. This is the only intentional public behavior normalization in this project; destinations, locale preservation, query behavior, canonical output, and indexation remain unchanged.

### Internal and input aliases

Historical engine identifiers used by code, query parameters, API inputs, or browser storage continue to normalize to a canonical product ID. They are not removed merely because direct imports have disappeared.

Retirement is controlled:

1. identify all static consumers and externally accepted inputs;
2. keep alias-resolution coverage while those inputs remain supported;
3. observe usage through the existing application telemetry when an alias can arrive at runtime;
4. remove an alias only in an explicit compatibility change after a defined observation window and release review.

No internal alias is retired during the registry-introduction wave.

## One-owner Rule

`frontend/config/model-registry.json` is the sole data authority for:

- canonical product ID;
- canonical public slug;
- model family;
- product category;
- historical internal/input aliases;
- historical public model slugs;
- publication state for model, examples, comparison, app discovery, pricing-link, and sitemap surfaces;
- replacement model, when a retired model delegates discovery to another canonical model.

No consumer may introduce a second map or list for any of those fields. Route projectors, selectors, indexes, and compatibility facades are allowed because they derive their results from the registry and do not contain independent policy data.

Engine catalogs, provider adapters, content files, and pricing definitions may repeat a canonical product ID only as a foreign-key reference to a registry entry. That reference does not grant ownership of the canonical slug, family, category, aliases, replacement, or publication policy, and validation fails when the referenced registry entry is missing.

The following remain outside the registry:

- provider model IDs, provider endpoints, provider capabilities, and provider fallback rules;
- localized editorial content and model-page template copy;
- price formulas and billing rules;
- database IDs and job records;
- non-model redirects, including blog, legal, authentication, campaign, and generic marketing redirects.

## Registry Shape

The source is JSON so it can be consumed by `frontend/next.config.js` without importing application TypeScript. `frontend/config/model-registry.ts` is the typed, validated application API. The TypeScript wrapper validates the raw JSON once, constructs read-only indexes, and exposes selectors. It must not restate model data.

`next.config.js` is the sole build-time projector for historical public model redirects. It reads the same JSON and expands public slugs into locale-specific redirect objects; it does not own model data. The production build runs the typed registry validator as an explicit preflight before Next.js evaluates the redirect output, avoiding a second JavaScript validation policy in `next.config.js`.

A conceptual entry has this shape:

```ts
type ModelRegistryEntry = {
  id: string;
  slug: string;
  family: string;
  category: 'video' | 'image' | 'audio';
  aliases: {
    internal: string[];
    publicSlugs: string[];
  };
  publication: {
    model: { published: boolean };
    examples: { published: boolean };
    compare: {
      published: boolean;
      indexed: boolean;
      suggestedOpponents: string[];
    };
    app: {
      published: boolean;
      discoveryRank?: number;
      variantGroup?: string;
      variantLabel?: string;
    };
    pricing: { published: boolean };
    sitemap: { published: boolean };
  };
  replacement: string | null;
};
```

All cross-model references use canonical product IDs, never display names, provider IDs, or aliases. Optional app presentation fields remain optional; booleans are explicit so absence cannot silently mean different things to different consumers.

The exact implementation types may be narrowed during the implementation plan, but they must preserve these ownership and explicitness guarantees.

## Application API

Consumers use the typed wrapper rather than reading JSON directly. The public API should cover these concepts:

- resolve any accepted internal/input identifier to a canonical product ID;
- resolve a canonical ID or historical public slug to one canonical registry entry;
- retrieve an entry by canonical ID or canonical slug;
- list entries published on a named surface in deterministic order;
- read family, category, app variant, discovery, and comparison relationships;
- project localized canonical model paths;
- validate the registry and its cross-references.

Function names are selected in the implementation plan after current call sites are grouped. The contract is more important than preserving today's helper names. Existing helper names, including `normalizeEngineId`, remain available from their current modules as delegating facades until migration is complete.

The registry and its validator are server/build configuration. Client components must receive already-derived engine or publication data through their existing catalog props or browser-safe catalog objects. They must not import the full registry, redirect projection, or validation code into the client bundle.

## Ownership Boundaries

### Registry

The registry answers identity and publication questions only. It can say that a model is canonical, belongs to a family, accepts historical aliases, is visible on a surface, or has a replacement.

### Provider adapters

Provider adapters continue to map a canonical product ID to the provider-specific model ID and request schema. A provider may expose multiple execution routes for one product without changing the public canonical identity. Provider identifiers must not become public aliases automatically.

### Route and SEO builders

Model, examples, comparison, pricing, sitemap, canonical, and hreflang builders consume registry selectors. They continue to own route-specific rendering and SEO assembly, but cannot maintain separate model eligibility or slug maps.

### Redirect layers

Only historical model redirects move under the registry policy. Non-model redirect rules remain in their current owners. `next.config.js` owns the only public redirect projection from registry data. Middleware and route-level code may use the canonical resolver as a defensive fallback, but they cannot define or project independent historical model aliases.

### Localized content

The localized JSON and route templates continue to own user-visible copy. Publication validation checks that required content exists; the registry does not absorb the content itself.

## Data Flow

```text
model-registry.json
  -> typed validation and read-only indexes
  -> compatibility facades
  -> model / examples / compare / app / pricing / sitemap selectors
  -> route data, canonical, hreflang, JSON-LD, and localized links

model-registry.json
  -> next.config.js historical public-slug projection
  -> en / fr / es permanent single-hop redirects

canonical product ID
  -> provider adapter
  -> provider-specific execution ID
```

No database or network dependency participates in registry loading or validation.

## Migration Strategy

The migration uses a progressive strangler pattern. The new registry is introduced beside current behavior, proven equivalent, and then made authoritative one consumer group at a time. It is not a big-bang rewrite.

### Phase 1: Characterize current behavior

Create an executable compatibility matrix from the current implementation before changing ownership. It records:

- all canonical IDs and canonical public slugs;
- all 87 historical internal aliases and their current targets;
- every historical model URL, current status, and destination in English, French, and Spanish;
- publication results for model, examples, comparison, app, pricing links, and sitemap surfaces;
- canonical and hreflang output for representative and edge-case models;
- replacement and family relationships used by current consumers.

The matrix is a test oracle containing input/output compatibility cases, not a second runtime registry. It must not become importable application configuration.

### Phase 2: Introduce and validate the registry

Add `model-registry.json` and the typed wrapper. Populate the registry from current sources without changing application behavior. Add structural and parity tests. At the end of this phase, every registry result must match the current implementation exactly, while all production consumers still use their existing entry points.

### Phase 3: Migrate identity resolution

Make the current alias helper delegate to the registry. Preserve its public import path and return semantics. Migrate direct consumers to the registry API only when doing so reduces ambiguity; do not force unrelated code churn.

### Phase 4: Migrate publication policy

Make `model-publication.ts`, model roster helpers, family helpers, and launch/publication selectors derive from the registry. Remove each legacy publication list as soon as its last independent decision has moved. The old modules remain thin facades where stable imports are valuable.

### Phase 5: Migrate public surfaces and SEO

Move model, examples, comparison, app discovery, pricing-link, sitemap, canonical, hreflang, and JSON-LD eligibility to registry selectors. Migrate one surface at a time and run its focused parity suite before proceeding.

This phase changes ownership, not output. Existing localized content fallbacks and route-specific data builders stay in place.

### Phase 6: Consolidate model redirects

Derive all historical model URL rules from `aliases.publicSlugs` and canonical slugs in the single `next.config.js` projector. Replace hand-authored model-only entries in `next.config.js`, marketing middleware, and route-level redirects with the generated rules or a data-free defensive canonical resolver. Preserve unrelated redirect rules in their existing layers.

Every generated rule uses explicit HTTP 301, preserves locale and existing query behavior, and points directly to the final canonical path. The compatibility test treats the current 301/308 mixture as the characterized baseline through phases 1–5, then asserts the approved uniform 301 contract when this phase lands.

### Phase 7: Remove obsolete policy data

Delete superseded alias maps, model publication lists, and model-only redirect rows only after:

- all production consumers use the registry or a delegating facade;
- the compatibility matrix passes;
- architecture tests show no independent parallel registry;
- focused locale/SEO tests and the full build pass.

Compatibility facades may remain indefinitely when they provide a stable import boundary. A facade is acceptable only if it contains no model policy data.

## Validation Rules

Registry validation fails the focused test suite and production build for any of the following:

1. duplicate canonical ID or canonical slug;
2. empty, malformed, or non-normalized canonical identifiers;
3. an internal alias or public slug that resolves ambiguously;
4. an alias that conflicts with a different model's canonical ID or slug;
5. a cross-model reference to a missing canonical ID;
6. a replacement that points to itself, forms a cycle, or requires a replacement chain;
7. a historical public slug equal to its own canonical slug;
8. a generated redirect whose source equals its destination;
9. duplicate redirect sources with different destinations;
10. a redirect chain or loop;
11. a published surface whose required canonical route or localized content does not exist;
12. a comparison relation that references an unpublished or incompatible comparison target;
13. duplicate app discovery ranks where ordering must be unique;
14. a model published to sitemap without a canonical, indexable model route;
15. a provider ID, price formula, or localized copy block added to the registry.

Validation errors identify the model, field, conflicting value, and expected invariant. Validation is deterministic and performs no network or database calls.

## Redirect and Locale Contract

For every historical public model slug `legacy` targeting canonical slug `canonical`, the projection produces exactly:

```text
/models/legacy       -> /models/canonical
/fr/modeles/legacy   -> /fr/modeles/canonical
/es/modelos/legacy   -> /es/modelos/canonical
```

The projection does not create unprefixed French or Spanish destinations, translate the model slug differently per locale, or fall back to the browser's preferred language. Locale choice comes from the requested path and remains authoritative.

Requests already using a canonical path render directly. Canonical URLs never redirect because of cookies, `Accept-Language`, or a stale locale stored by the client.

## Test Strategy

### New focused contracts

- A registry structure test validates schema, uniqueness, direct references, publication consistency, and forbidden fields.
- A registry parity test compares the new registry with the pre-migration compatibility matrix.
- An alias contract covers every historical input alias and verifies one-step canonicalization.
- A redirect contract evaluates the `next.config.js` output, expands every public slug across English, French, and Spanish, and verifies 301, final destination, query behavior, no chain, and no loop.
- An architecture test rejects new model identity, publication, or public-alias maps outside the registry and approved test fixtures.
- A client-boundary test ensures registry validation and redirect projection do not enter client component dependency graphs.

### Existing focused coverage

The migration keeps and extends the relevant current suites, including:

- `tests/marketing-locale-routing.test.ts`;
- `tests/hreflang-variants.test.ts`;
- `tests/model-page-static-architecture.test.ts`;
- `tests/model-page-template-registry.test.ts`;
- `tests/models-catalog-architecture.test.ts`;
- `tests/examples-route-architecture.test.ts`;
- `tests/compare-page-architecture.test.ts`;
- `tests/pricing-model-links.test.ts`;
- `tests/public-engines.test.ts`;
- `tests/schema-sitemap-architecture.test.ts`;
- `tests/video-pages-sitemap.test.ts`.

Each consumer phase begins with a failing focused contract, migrates the smallest responsibility, and returns the focused suite to green before the next surface moves.

### Required final verification

The completed migration must pass:

```bash
npm run test:validate
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run build
git diff --check
```

A browser smoke matrix covers at least one canonical and one historical model in each locale, plus model, examples, comparison, app, pricing, and sitemap discovery paths.

## Rollout and Rollback

The work is split into reviewable phases. Each consumer moves only after parity is green, so rollback can restore that consumer to its previous facade without discarding the registry or affecting other migrated surfaces.

Before the redirect phase ships, capture the current production response status, destination, canonical, and hreflang for the historical route matrix. After deployment, repeat the same checks and confirm the expected 308-to-301 normalization while inspecting 404, redirect-loop, and unexpected-locale telemetry.

Because public redirects are permanent and can be cached, the redirect phase ships only after all local and preview parity checks pass. Rollback restores the previous redirect consumer, but destinations must not be intentionally changed during this project.

## Documentation and Agent Guardrails

The implementation updates:

- root `AGENTS.md` with the one-owner rule and registry location;
- the model route `AGENTS.md` with the requirement to use registry selectors for identity and publication;
- `docs/engineering/project-structure.md` with the registry boundary;
- a focused `docs/engineering/model-registry.md` explaining how to add, rename, retire, or publish a model safely.

Architecture tests enforce these instructions so a future contributor cannot recreate a parallel alias, publication, or model-redirect table unnoticed.

## Definition of Done

The subproject is complete only when all of the following are true:

- every product model has exactly one canonical registry entry;
- all current canonical IDs, slugs, 87 historical aliases, and historical model URLs retain their current destinations and resolution behavior;
- every historical model URL redirects once to the final canonical path in the same locale;
- model, examples, comparison, app, pricing-link, and sitemap publication match the pre-migration compatibility matrix;
- canonical, hreflang, JSON-LD, and sitemap output are unchanged;
- existing public helper imports still work through data-free facades where retained;
- no runtime model identity, publication, or historical model-redirect policy exists outside the registry;
- provider IDs remain in provider adapters;
- the registry adds no database, network, or client-bundle dependency;
- obsolete parallel lists and maps are removed;
- documentation and `AGENTS.md` guardrails are current;
- focused tests, the full validation suite, TypeScript, lint, exposure lint, build, browser smoke matrix, and `git diff --check` pass.

## Follow-up Architecture Projects

After this registry migration is complete, the following remain separate design and implementation projects:

1. pricing authority and legacy pricing-adapter simplification;
2. model/comparison editorial-content ownership and fallback simplification;
3. shared provider job finalization, persistence, refund, and polling orchestration.

They must not be folded into the registry migration. Keeping them independent limits blast radius and makes each simplification measurable.
