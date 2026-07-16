# Model Examples Content Organization Design

**Date:** 2026-07-16

**Status:** Approved for written-spec review

## Objective

Make the existing localized model JSON documents the only owners of model-specific Examples editorial content, reduce `ModelExamplesSection.tsx` from 1,588 lines to a focused orchestrator, and remove the current mixture of localized JSON fields, route-local TypeScript copy trees, slug conditionals, runtime derivation, and JSX.

The migration must preserve the current public Examples projection for all 40 configured models in English, French, and Spanish. It must not change routes, localized slugs, metadata, canonical URLs, hreflang, JSON-LD, pricing, model capabilities, media selection, section order, workspace destinations, or visible styling.

## Current State

`ModelExamplesSection.tsx` currently owns four different responsibilities:

1. generic and model-specific localized interface copy;
2. runtime transformation of real gallery media;
3. model-specific proof cards, filters, image fallback examples, poster selection, and alt text;
4. default and decision renderer JSX.

The live inventory is:

- 40 configured model identities;
- 120 localized model documents across `en`, `fr`, and `es`;
- 1,588 lines in `ModelExamplesSection.tsx`;
- 105 documents with authored `galleryTitle`;
- 105 documents with authored `galleryIntro`;
- 102 documents with authored `galleryAllCta`;
- 87 documents with authored `recreateLabel`;
- zero documents with `gallerySceneCta`;
- 240 lines of disabled curated title/category logic guarded by `useCuratedLabels = false`;
- multiple model-slug classifiers used for editorial copy, filter behavior, badges, alt text, and fallback examples.

The missing localized values are currently filled by runtime fallbacks. The effective user-facing projection therefore cannot be understood from the JSON document alone.

## Chosen Approach

Use one hybrid source-of-truth boundary:

> Localized JSON owns model-specific Examples editorial content. Pure TypeScript owns runtime media and capability derivation. Focused components own rendering.

This avoids both rejected alternatives:

- a mechanical file split that keeps the same duplicate ownership;
- a fully declarative JSON design that stores live media, capabilities, routes, or other runtime facts in editorial content.

## Ownership Rules

### Localized JSON owns editorial content

Every `content/models/{locale}/{slug}.json` document gains a strict top-level `examples` object.

The object owns:

- section title and intro;
- default-renderer CTA copy when currently present;
- recreate-label copy;
- the ordered model-contextual filter IDs and labels;
- the five decision proof cards;
- localized fallback image-example titles, categories, aspect-ratio labels, alt text, and semantic filter tags when those fallback items are currently active.

Every currently implicit fallback value is materialized into the corresponding localized document. The final 120 projections do not depend on English fallback copy or model-slug editorial branches.

### Generic UI copy stays centralized

Generic vocabulary shared by every model remains in a small route-local locale table:

- view/open render;
- view all examples;
- empty-filter message;
- audio-on, audio-off, and silent badges;
- duration formatting;
- generic no-preview copy.

This module contains no model slugs, model-specific claims, prompts, media paths, or workspace routes.

### Runtime owns live facts

The following remain derived from existing runtime inputs and configuration:

- real gallery videos and image assets;
- optimized/raw poster URLs;
- actual duration and aspect ratio;
- actual audio state and audio capability;
- media links and recreate destinations;
- model identity and display name;
- image/video mode;
- selected fallback poster asset;
- gallery availability;
- runtime tags inferred from real media metadata.

The editorial object cannot author prices, capabilities, registry identity, generated media, or public route destinations.

## JSON Contract

The conceptual target shape is:

```ts
type ModelExamplesContent = {
  modelSlug: string;
  section: {
    title: string;
    intro: string;
    defaultCtaLabel: string | null;
    recreateLabel: string | null;
  };
  filters: Array<{
    id:
      | 'all'
      | 'cinematic'
      | 'product'
      | 'action'
      | 'vertical'
      | 'audio'
      | 'campaign'
      | 'typography'
      | 'reference'
      | 'final'
      | 'grounded'
      | 'edit'
      | 'wide'
      | 'character'
      | 'batch'
      | 'ui'
      | 'mask'
      | 'infographic';
    label: string;
  }>;
  proofItems: Array<{
    id: string;
    icon:
      | 'audio'
      | 'image'
      | 'maximize'
      | 'pen'
      | 'shield'
      | 'sparkles'
      | 'type'
      | 'users'
      | 'zap';
    title: string;
    body: string;
  }>;
  fallbackItems: Array<{
    id: string;
    title: string;
    category: string;
    aspectRatio: string;
    alt: string;
    tags: string[];
  }> | null;
};
```

All objects are strict. Unknown fields fail validation. Required strings are non-empty after trimming. IDs are unique. `modelSlug` must match the requested slug and filename. `filters` begins with exactly one `all` entry, and every fallback tag references a declared filter ID. `recreateLabel` remains explicitly `null` where the current projection intentionally renders no recreate action.

`proofItems` has exactly five items because the current decision proof grid renders five cards for every configured model. The three locale documents for one model must have the same filter IDs, proof IDs, icon keys, fallback-item IDs, tag values, array order, and nullability. Filter labels remain localized because the same semantic ID currently has model-contextual presentation such as `Product / Ad`, `Product still`, and `Product`.

`fallbackItems` is non-null only where the current production path actually activates localized image fallback cards. Dormant branches are not activated during migration. Unreachable fallback definitions are deleted rather than materialized as new behavior.

Poster URLs are intentionally absent. A route-local static-media resolver maps the validated fallback item ID to its existing poster asset. Missing poster configuration preserves the current `fallbackImageUrl` and empty-poster behavior.

## Exact-Locale Loading

`frontend/lib/models/i18n.ts` remains the only production filesystem reader for model content.

The shared normalized loader exposes `examples` as exact-locale data:

- English selects the English document's `examples`;
- French selects the French document's `examples`;
- Spanish selects the Spanish document's `examples`;
- a missing localized object never borrows the English object.

The shared loader keeps the field as `unknown`. The model route validates it through a route-local strict parser. No route, component, converter, or test adds a second filesystem loader or directly imports model JSON documents for production rendering.

## Runtime Architecture

### Strict content parser

Add `_lib/model-page-examples-content.ts` as the sole owner of:

- the strict schema;
- the parsed content type;
- slug identity checks;
- unique and relational ID validation;
- per-document relational validation;
- descriptive errors containing slug, locale, source context, and failing path.

It performs no file reads, runtime media selection, capability checks, slug-based content selection, or locale fallback.

### Generic UI copy

Add `_lib/model-page-examples-ui-copy.ts` for generic locale vocabulary only.

Filter IDs are semantic and typed. Their model-contextual labels come from validated exact-locale content. The visible filter set is derived from the tags that exist in the final view-model items, so runtime media determines availability without owning editorial labels.

### Static fallback media

Add `_lib/model-page-example-media.ts` for non-localized fallback poster assets keyed by model identity and fallback item ID.

This module owns static asset selection only. It contains no localized copy, categories, alt text, proof content, or capability claims.

### Pure view-model builder

Add `_lib/model-page-examples-view-model.ts` to combine validated content with explicit runtime inputs.

The builder derives:

- section visibility;
- real-gallery items;
- active fallback items when real media is absent;
- localized metadata labels;
- audio, duration, aspect ratio, category, and tags;
- available filters;
- default and decision presentation data;
- final links and recreate destinations.

The builder is pure and immutable. It reads no files, fetches no data, inspects no browser state, and contains no model-specific editorial copy. Model identity may be used only as an explicit lookup input to the static-media resolver outside the pure editorial transformation.

### Rendering

The final rendering boundary is:

- `ModelExamplesSection.tsx`: variant selection and null/orchestration boundary, target at most 120 physical lines;
- `ModelDecisionExamplesSection.tsx`: decision layout and proof-grid composition, target at most 220 lines;
- `ModelDefaultExamplesSection.tsx`: retained default layout, target at most 220 lines;
- `ModelDecisionExamplesGallery.client.tsx`: existing interactive filtering and show-more behavior, with no new content ownership.

Renderers receive one render-ready view model. They contain no locale switch, model slug branch, fallback content builder, poster registry, workspace URL construction, or runtime tagging algorithm.

## Final Data Flow

```text
getEngineLocalized(locale, slug)
  -> exact-locale examples: unknown
  -> parseModelExamplesContent(examples, locale, slug)
  -> resolve static fallback media from current model identity
  -> buildModelExamplesViewModel(content, runtime media/capabilities/links, ui copy)
  -> ModelExamplesSection(viewModel, variant)
  -> focused default or decision renderer
```

Content is validated once. Runtime derivation occurs once. Client code receives only filterable gallery items and generic interactive labels.

## Removed Ownership

After parity and cutover, remove these fields from localized `custom` content and from `SoraCopy`/`buildSoraCopy`:

- `galleryTitle`;
- `galleryIntro`;
- `galleryAllCta`;
- `gallerySceneCta`;
- `recreateLabel`.

Also delete:

- model-specific proof-card copy trees from `ModelExamplesSection.tsx`;
- image fallback editorial arrays from TypeScript;
- slug-specific filter-copy branches;
- slug-specific alt-prefix branches that can be expressed from explicit model display input;
- disabled curated title/category maps and `useCuratedLabels`;
- temporary legacy projection, converter, correction bridge, and parity tooling after cutover.

No compatibility facade, deprecated `SoraCopy` gallery field, or TypeScript editorial fallback map remains.

## Migration Strategy

### Phase A: characterize current output

Create a temporary pure legacy projector for all 40 models and three locales. It captures the complete effective editorial projection, including implicit title/intro/recreate fallbacks, proof cards, active image fallback items, IDs, icons, tags, ordering, and explicit nulls.

Characterization separates editorial output from runtime facts. Real gallery media, selected posters, runtime URLs, duration, aspect ratio, and actual audio state are not copied into JSON.

### Phase B: materialize 120 strict objects

A one-time converter inserts one `examples` object into each existing localized model document.

The converter:

- uses the same production normalization path as the route;
- writes only the new `examples` object during the first migration phase;
- does not translate, rewrite, trim, reorder, normalize punctuation, or invent content;
- reports the exact document inventory and projected differences;
- is idempotent.

The default correction manifest is empty. Any proposed visible correction requires prior review with slug, locale, exact old value, exact new value, and objective evidence. Without such approval, old/new editorial parity must be exact.

### Phase C: prove parity before renderer cutover

For every one of the 120 projections, deep-compare the parsed new object with the characterized legacy projection.

The parity gate fails on:

- any changed string;
- missing or additional fields;
- order or cardinality changes;
- changed icon/filter/tag semantics;
- changed nullability;
- any unapproved correction.

It also proves that removing `examples` from each migrated document leaves the original document semantically unchanged.

### Phase D: cut over runtime and renderers

Expose exact-locale `examples`, parse it once, build one view model, and cut both default and decision renderers over to that model.

The active section must no longer consume gallery copy through `SoraCopy` or model-specific TypeScript fallbacks.

### Phase E: delete temporary ownership

Remove the five old `custom` fields, old types/builders, dead curated maps, legacy projector, converter, parity bridge, and temporary tests. Retain permanent strict-content, view-model, architecture, scaffold, locale, and renderer behavior tests.

## Error Handling

For every configured model and locale:

- a missing `examples` object throws with model slug, locale, and source context;
- a malformed object throws with the failing validation path;
- mismatched model identity throws;
- duplicate proof or fallback IDs throw;
- invalid icon or filter tag throws;
- locale structure divergence fails the content contract;
- no error path substitutes English, old `custom` fields, or TypeScript editorial fallbacks.

Missing real gallery media remains normal. The view-model uses fallback items only when the migrated content explicitly represents the currently active fallback behavior; otherwise it preserves the existing empty state.

## Permanent Contracts

Permanent tests must cover:

- exactly 120 strict non-null `examples` objects;
- exact filename/slug identity;
- EN/FR/ES structural parity per model;
- exact-locale loader selection with no English fallback;
- no legacy gallery keys under `custom`, root content, `SoraCopy`, or production helpers;
- no model IDs in the parser, pure builder, UI-copy module, or renderers;
- no filesystem access in parser or builder;
- real video gallery transformation;
- silent-video audio/filter behavior;
- image fallback behavior and poster attachment;
- missing-media and empty-state behavior;
- filter availability derived from item tags;
- default and decision renderer parity;
- immutable/frozen inputs;
- scaffold output for EN/FR/ES including a strict `examples` object;
- architecture line caps and active ownership boundaries.

The migration-only 120-way parity bridge is deleted after cutover. Permanent representative fixtures retain the highest-risk behaviors without keeping the old implementation alive.

## Verification

Focused verification includes model content, localization normalization, model template content, layout architecture, Examples architecture, model-specific marketing surfaces, and scaffold tests.

Final verification includes:

- full `test:validate` suite;
- TypeScript;
- frontend lint;
- exposure lint;
- model registry check;
- architecture audit;
- `git diff --check`;
- production build;
- localized production smokes for representative video and image models in EN, FR, and ES;
- canonical, hreflang, JSON-LD, route, section-order, gallery-filter, show-more, recreate-link, and empty/fallback assertions.

The final diff must contain no pricing, billing, registry, model capability, route-family, sitemap, or unrelated content changes.

## Non-Goals

This work does not:

- redesign the gallery UI;
- change which real examples are selected;
- add or remove public routes;
- change pricing or billing;
- change model capabilities or registry identity;
- introduce a CMS, database, generic rich-content engine, second content directory, or second loader;
- activate dormant fallback examples;
- rewrite translations or editorial tone;
- alter Prompt Lab or Decision content ownership.

## Acceptance Criteria

The work is complete only when:

- all 120 localized model documents contain strict `examples` content;
- requested locale content never falls back to English;
- old and new editorial projections are exactly equal unless an explicitly approved correction manifest exists;
- the active section consumes one pure render-ready view model;
- `ModelExamplesSection.tsx` is at most 120 physical lines;
- focused renderers are each at most 220 physical lines;
- model-specific editorial branches and disabled curated maps are absent from production TypeScript;
- the five old `custom`/`SoraCopy` gallery fields are absent;
- all required tests, build, and localized production smokes pass;
- final review reports no unresolved Critical or Important findings.
