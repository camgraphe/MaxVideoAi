# Model Decision Content Organization Design

**Date:** 2026-07-15

**Status:** Approved design, pending written-spec review

## Objective

Make the existing localized model JSON documents the only owners of model-page decision copy, remove the two large TypeScript copy maps, and give every published image model the same decision-page behavior.

The migration must preserve the current public output for the 38 models that already have decision copy. It must add decision rendering to `nano-banana-lite` and `seedream-5-0-pro` without changing their current metadata, URLs, canonical/hreflang behavior, or applied pricing.

## Current State

The model-detail route currently has two localized content systems:

1. `content/models/{en,fr,es}/<slug>.json` owns the general localized model page content.
2. `model-page-template-copy.ts` and `model-page-template-copy-additional.ts` own decision-layout copy for 38 models.

The live inventory is:

- 40 model JSON documents in each of `en`, `fr`, and `es`;
- 40 model template configs;
- 38 TypeScript decision-copy entries;
- 114 existing localized decision projections;
- 9 image models, of which 7 currently receive the decision layout;
- 2 image exceptions: `nano-banana-lite` and `seedream-5-0-pro`.

The two TypeScript owners contain about 8,165 source lines. They also duplicate localized URL-building helpers and maintain a central slug registry. The 38 existing entries already have identical structural shapes across English, French, and Spanish.

## Decisions

### Reuse the existing model JSON documents

Every `content/models/{locale}/<slug>.json` document will gain a first-class top-level `decision` field.

No `content/model-decisions` directory, per-slug three-locale bundle, runtime registry, generated TypeScript map, or second filesystem loader will be added.

The resulting rule is:

> All localized editorial content for one model and one locale lives in `content/models/{locale}/<slug>.json`.

### Cover all 40 models

All 120 model documents will contain a non-null `decision` object.

- For the current 38 decision models, the object must be an exact projection of the existing runtime copy, including resolved hrefs.
- For `nano-banana-lite` and `seedream-5-0-pro`, new EN/FR/ES decision content will be derived only from their existing localized JSON and template configuration.
- The two new blocks must not introduce factual claims that are absent from those current sources.
- Their `decision.meta.title` and `decision.meta.description` must exactly equal their current localized `seo.title` and `seo.description`, so their public metadata remains unchanged.

### Keep pricing dynamic

The JSON decision block owns localized pricing labels and the pricing CTA, but never owns numeric prices or scenario totals.

`buildModelDecisionData` will continue to build live pricing scenarios from the existing model template config and canonical pricing helpers. No pricing config, price formula, product amount, or pricing route changes are in scope.

### Keep the component refactor separate

`ModelDecisionPromptingSection.tsx` and `ModelExamplesSection.tsx` are not split in this project. Mixing the content-source migration with a large JSX refactor would weaken the migration proof and increase the blast radius.

## JSON Contract

The new top-level field has this conceptual shape:

```ts
type ModelDecisionContent = {
  modelSlug: string;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    subtitleHighlights: string[];
    paragraph: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    quickLinks: Array<{ label: string; href: string }>;
  };
  media: {
    caption: string;
    description: string;
    renderLabel: string;
    badges: string[];
    altContext: string;
  };
  features: Array<{
    title: string;
    body: string;
    tone: 'audio' | 'continuity' | 'reference' | 'quality' | 'duration' | 'price';
  }>;
  decisionCards: Array<{
    title: string;
    body: string;
    cta: { label: string; href: string };
  }>;
  referenceWorkflows: Array<{ title: string; body: string }>;
  pricingCopy: {
    title: string;
    subtitle: string;
    footnote: string;
    ctaLabel: string;
    ctaHref: string;
    maxDurationNote?: string;
  };
  meta: {
    title: string;
    description: string;
  };
};
```

All objects are strict. Required strings must be non-empty after trimming. Arrays that are visible as page sections must be non-empty. `modelSlug` must exactly match the requested model and the JSON filename selected by the localized content loader.

## Runtime Architecture

### Localized content loader

`frontend/lib/models/i18n.ts` remains the only production filesystem reader for `content/models`.

It will expose the selected document's `decision` value on `EngineLocalizedContent`. General model fields retain their existing fallback behavior, but `decision` is selected only from the requested locale document:

- English reads English;
- French reads French;
- Spanish reads Spanish;
- a missing localized decision block never falls back to English.

The field remains `unknown` at the shared loader boundary. Route-specific validation stays in the model-detail route instead of coupling the shared model loader to a route-local schema.

### Strict decision parser

A focused route-local module, `model-page-decision-content.ts`, will own:

- the strict Zod schema;
- the parsed `ModelDecisionContent` type;
- the model-slug identity check;
- locale-aware href validation;
- explicit missing/malformed-content errors.

It will not read files, cache documents, contain a model registry, calculate prices, or fall back to another locale.

### Decision-data builder

`buildModelDecisionData` will accept the selected raw `decision` value along with the engine and locale. It will:

1. parse and validate the localized content;
2. build the existing pricing scenarios from the unchanged template config;
3. apply the existing localized maximum-duration note behavior;
4. return the existing `ModelDecisionData` shape.

The page metadata builder and `MarketingModelPageLayout` already receive `getEngineLocalized` output. They will pass `localized.decision` into the decision-data builder instead of asking a TypeScript map for copy.

### Removed ownership

After consumers are migrated and the proof is green, delete:

- `model-page-template-copy.ts`;
- `model-page-template-copy-additional.ts`;
- `COPY_BY_MODEL_SLUG`;
- `ADDITIONAL_TEMPLATE_COPY`;
- the duplicated localized path helpers owned only by those files;
- the temporary migration converter and exact-projection proof.

No compatibility facade or fallback map remains.

## Href Policy

Existing href bytes are preserved for the 38 migrated models, including current engine aliases and comparison `order` query parameters.

The strict validator accepts only the existing link families:

- local anchors such as `#prompting` and `#specs`;
- `/app` and `/app/image` engine URLs;
- English `/models`, `/examples`, `/ai-video-engines`, and `/pricing` paths;
- French `/fr/modeles`, `/fr/galerie`, `/fr/comparatif`, and `/fr/tarifs` paths;
- Spanish `/es/modelos`, `/es/galeria`, `/es/comparativa`, and `/es/precios` paths.

English decision content cannot contain French or Spanish marketing prefixes. French cannot contain English or Spanish marketing paths. Spanish cannot contain English or French marketing paths. Locale-neutral app paths and local anchors remain valid in every locale.

## Error Handling

For any of the 40 template-configured models:

- missing `decision` content throws an explicit error with slug and locale;
- malformed JSON decision content throws with the validation path;
- a mismatched `modelSlug` throws;
- a forbidden or wrong-locale href throws;
- missing live pricing data retains the current pricing-builder behavior;
- no error path substitutes English content or the removed TypeScript maps.

This intentionally makes broken localized decision content visible during build and tests rather than silently shipping the wrong language or legacy layout.

## Migration Strategy

### Existing 38 models

A temporary converter will evaluate the current route-facing decision-copy projection for every slug and locale, including the currently derived pricing CTA href, and insert that exact object into the existing JSON document.

Before the old maps are removed, a temporary proof must compare every migrated JSON block against the old runtime projection with deep equality:

- 38 model slugs;
- 3 locales;
- 114 exact projections;
- no ignored fields;
- no string normalization;
- no href rewriting.

### Two image-model additions

`nano-banana-lite` and `seedream-5-0-pro` receive explicit localized decision blocks. Their content must reuse the capabilities, prompts, links, safety language, and pricing wording already present in their localized model documents and template configs.

Their intended visible change is limited to receiving the same decision-layout structure as the other seven image models. Their metadata, canonical URL, hreflang set, publication state, app destination, and applied scenario prices remain unchanged.

### Cutover

The migration occurs in reviewable stages:

1. lock the current inventories and exact old projections;
2. add the two image-model decision blocks and their SEO-preservation tests;
3. insert the 114 exact migrated blocks while the old maps still exist;
4. add the strict parser and permanent 120-document contract;
5. switch metadata and layout consumers to `localized.decision`;
6. delete the old maps and temporary migration artifacts;
7. update architecture documentation and run final production verification.

## Permanent Contracts

Permanent tests must verify:

1. The `content/models/en`, `fr`, and `es` filename inventories are identical.
2. The inventory equals the 40 model-template slugs.
3. Every one of the 120 JSON documents contains a valid non-null decision block.
4. Each `decision.modelSlug` matches its filename and engine model slug.
5. EN, FR, and ES structural paths are identical for each model, including array cardinality.
6. Every required string is non-empty and every visible collection is non-empty.
7. Every href follows the requested locale's policy.
8. No requested locale falls back to English decision content.
9. `buildModelDecisionData` still returns the same public shape and uses live pricing scenarios.
10. `nano-banana-lite` and `seedream-5-0-pro` receive decision data in all three locales.
11. Their decision metadata exactly matches their pre-migration localized SEO metadata.
12. All nine image models use the decision layout.
13. No production file imports model JSON directly; consumers use `getEngineLocalized`.
14. The two old copy files, registries, and temporary converter/proof are absent.
15. Next.js output tracing continues to include all `content/models` documents.

Existing model-content quality tests remain authoritative for localized wording, prompt anchors, factual claims, and model-specific behavior.

## Verification

Focused verification includes:

- model decision-data tests;
- model template-content tests;
- model page architecture tests;
- image-model and model-registry contracts;
- metadata, canonical, hreflang, sitemap, and localized-route tests;
- exact 114-projection migration proof before deletion;
- permanent 120-document content contract after deletion.

Final verification includes:

- `pnpm test:validate`;
- frontend lint;
- public-exposure lint;
- TypeScript without emit;
- model-registry validation;
- architecture audit;
- `git diff --check`;
- production build;
- production smoke tests for representative EN/FR/ES model URLs;
- production smoke tests for `nano-banana-lite` and `seedream-5-0-pro`;
- metadata comparison for those two slugs before and after the cutover;
- a final scoped diff proving no pricing config, route map, sitemap policy, or model registry changed.

## Non-Goals

- No numeric price or pricing-policy change.
- No public route, slug, canonical, hreflang, sitemap, publication, replacement, or tombstone change.
- No rewrite of the 38 existing decision-copy projections.
- No broad rewrite of the general model JSON content.
- No model-registry or generated projection edit.
- No split of `ModelDecisionPromptingSection.tsx` or `ModelExamplesSection.tsx`.
- No admin or CMS feature.
- No persistent migration compatibility layer.

## Success Criteria

The project is complete when:

- all 40 models and all 9 image models use localized decision content from their existing JSON documents;
- the 114 existing parsed projections are field-for-field deep-equal to the old runtime output, with every string and href unchanged;
- the two new image decision pages preserve their current metadata, URLs, and applied prices;
- missing or malformed localized decision content fails explicitly;
- the two TypeScript copy maps and all migration-only artifacts are deleted;
- permanent contracts prevent locale fallback, structural drift, wrong-locale links, missing models, and duplicate production ownership;
- all focused, full, build, and smoke validations pass.
