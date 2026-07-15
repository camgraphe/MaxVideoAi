# Model Prompting Content Organization Design

**Date:** 2026-07-15

**Status:** Approved; implementation plan ready

## Objective

Make the existing localized model JSON documents the only owners of model-specific Prompt Lab editorial content, reduce `ModelDecisionPromptingSection.tsx` to a focused renderer, and remove the current hybrid ownership between JSON `custom` fields and route-local TypeScript fallback trees.

The migration must preserve the current visible Prompt Lab projection for all 40 configured models in English, French, and Spanish, except for objectively verifiable defects documented and tested individually. It must not change public routes, SEO behavior, pricing, model capabilities, workspace behavior, or media selection.

## Current State

The Prompt Lab section currently has two overlapping editorial-content systems:

1. `content/models/{en,fr,es}/<slug>.json` stores a partial set of prompt, demo, tab, and guide values under `custom`.
2. `ModelDecisionPromptingSection.tsx` stores large model- and locale-specific fallback builders, summaries, example prompts, labels, and selection branches.

The live inventory is:

- 40 model JSON documents in each of `en`, `fr`, and `es`;
- 120 model-locale projections;
- about 3,114 lines in `ModelDecisionPromptingSection.tsx`;
- roughly 2,300 lines of model-specific localized content and content builders;
- roughly 580 lines of model-selection and display orchestration;
- roughly 190 lines of final JSX;
- existing focused coverage of 69 passing architecture, template-content, decision-data, Kling O3, and Gemini Omni tests.

The component's size is therefore a symptom rather than the primary problem. The primary problem is double ownership: some visible values come from localized JSON, others from TypeScript fallbacks, and the final projection depends on a long conditional merge. This makes locale completeness and model parity difficult to prove.

## Decisions

### Reuse the existing localized model documents

Every `content/models/{locale}/<slug>.json` document gains a first-class top-level `prompting` object.

No `content/model-prompting` directory, second filesystem loader, generated TypeScript content map, model-family fallback file, CMS, database table, or compatibility registry is added.

The ownership rule is:

> All model-specific localized Prompt Lab editorial content for one model and one locale lives in `content/models/{locale}/<slug>.json` under `prompting`.

This rule does not force generic interface chrome to be copied into all 120 documents. Labels such as Copy, Copied, Show prompt, View full, Text to video, and Audio on remain in one small route-local `en`/`fr`/`es` table because they are generic UI vocabulary, not model-specific editorial content.

### Cover all 40 configured models

All 120 localized model documents contain a non-null `prompting` object.

- Every currently visible Prompt Lab field is materialized from the effective route-facing projection, including values currently produced only by TypeScript fallbacks.
- English, French, and Spanish structures are identical for a given model, including array cardinality and explicit `null` blocks.
- A requested locale never borrows the English `prompting` object.
- Model-specific content is never selected by a slug conditional after migration.

### Preserve behavior and correct only proven defects

The migration is exact by default. It preserves strings, whitespace where user-visible, prompt order, tab order, notes, links, labels, and conditional section presence.

A content difference is permitted only when all of the following are recorded:

- model slug;
- locale;
- exact old value;
- exact new value;
- objective evidence that the old value is defective;
- a focused permanent regression assertion.

Permitted defect classes are limited to wrong-language text, spelling or transcription errors, broken or wrong-locale links, internal contradictions, and claims that conflict with the canonical model capability configuration. Stylistic rewriting, tone polishing, prompt expansion, and speculative product corrections are excluded.

The migration verifier begins with an empty correction allowlist. If no qualifying defect is found, the final implementation must report zero intentional content differences. If a qualifying defect is found, the allowlist entry is reviewed before cutover and its correction remains protected by a permanent test after migration-only tooling is deleted.

The reviewed migration manifest contains exactly 18 permitted differences: four qualifying wrong-locale guide links and 14 customer-visible wrong-language `still`/`stills` strings exposed by the existing localized-content forbidden-term contract.

| # | Slug | Locale | Path | Exact old value | Exact new value | Objective evidence |
|---:|---|---|---|---|---|---|
| 1 | `dreamina-seedance-2-0-mini` | `fr` | `section.guide.href` | `/models/dreamina-seedance-2-0-mini` | `/fr/modeles/dreamina-seedance-2-0-mini` | The localized route contract defines `/fr/modeles`. |
| 2 | `dreamina-seedance-2-0-mini` | `es` | `section.guide.href` | `/models/dreamina-seedance-2-0-mini` | `/es/modelos/dreamina-seedance-2-0-mini` | The localized route contract defines `/es/modelos`. |
| 3 | `seedance-2-0-fast` | `fr` | `section.guide.href` | `/models/seedance-2-0` | `/fr/modeles/seedance-2-0` | The localized route contract defines `/fr/modeles`. |
| 4 | `seedance-2-0-fast` | `es` | `section.guide.href` | `/models/seedance-2-0` | `/es/modelos/seedance-2-0` | The localized route contract defines `/es/modelos`. |
| 5 | `luma-uni-1` | `fr` | `imageExamples.intro` | `Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.` | `Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.` | The localized-content contract rejects English `still`/`stills` in customer-facing French copy. |
| 6 | `luma-uni-1` | `fr` | `imageExamples.items.0.badge` | `2K still` | `Visuel 2K` | Same localized-content contract. |
| 7 | `luma-uni-1` | `fr` | `imageExamples.items.0.prompt` | `Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | `Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | Same localized-content contract. |
| 8 | `luma-uni-1-max` | `fr` | `imageExamples.intro` | `Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.` | `Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.` | Same localized-content contract. |
| 9 | `luma-uni-1-max` | `fr` | `imageExamples.items.0.badge` | `2K still` | `Visuel 2K` | Same localized-content contract. |
| 10 | `luma-uni-1-max` | `fr` | `imageExamples.items.0.prompt` | `Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | `Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | Same localized-content contract. |
| 11 | `luma-uni-1` | `es` | `imageExamples.intro` | `Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.` | `Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.` | The localized-content contract rejects English `still`/`stills` in customer-facing Spanish copy. |
| 12 | `luma-uni-1` | `es` | `imageExamples.items.0.title` | `Still de campaña` | `Imagen de campaña` | Same localized-content contract. |
| 13 | `luma-uni-1` | `es` | `imageExamples.items.0.badge` | `Still 2K` | `Imagen 2K` | Same localized-content contract. |
| 14 | `luma-uni-1` | `es` | `imageExamples.items.0.prompt` | `Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | `Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | Same localized-content contract. |
| 15 | `luma-uni-1-max` | `es` | `imageExamples.intro` | `Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.` | `Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.` | Same localized-content contract. |
| 16 | `luma-uni-1-max` | `es` | `imageExamples.items.0.title` | `Still de campaña` | `Imagen de campaña` | Same localized-content contract. |
| 17 | `luma-uni-1-max` | `es` | `imageExamples.items.0.badge` | `Still 2K` | `Imagen 2K` | Same localized-content contract. |
| 18 | `luma-uni-1-max` | `es` | `imageExamples.items.0.prompt` | `Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | `Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | Same localized-content contract. |

The non-customer `kind: "layout"` semantic enum remains unchanged and is excluded by key from the existing localized-content scan; `prompting` itself remains fully scanned. All 18 corrections receive exact permanent assertions. Any additional difference still requires the full evidence and review policy above.

### Keep runtime facts derived

The JSON object owns editorial content, not live product state. These values continue to come from the current model registry, template configuration, route data, and media helpers:

- selected demo media and fallback media;
- supported generation modes;
- actual duration and aspect ratio;
- audio availability;
- workspace destination and engine query parameters;
- current model identity and capability flags;
- prices, credit costs, and billing policy.

An existing localized presentation override may be stored in JSON only when it is part of the current visible editorial projection and cannot be derived without changing output. Such an override is presentation copy, not a new product fact.

## JSON Contract

The new top-level field has this conceptual shape:

```ts
type ModelPromptingContent = {
  modelSlug: string;
  section: {
    title: string;
    intro: string | null;
    tip: string | null;
    guide: { label: string; href: string } | null;
    referencesTitle: string | null;
  };
  tabs: Array<{
    id: string;
    label: string;
    title: string;
    description: string | null;
    copy: string;
  }>;
  tabNotes: Array<{
    tabId: string;
    body: string;
  }>;
  globalPrinciples: string[];
  engineWhy: string[];
  demo: {
    title: string;
    promptLabel: string;
    prompt: string;
    notes: string[];
    summary: {
      subject: string;
      action: string;
      camera: string;
      style: string;
      output: string;
    };
    presentationOverrides: {
      modeLabel: string;
      outputLabel: string;
      duration: string | null;
      aspectRatio: string | null;
      audioChipMode: 'media' | 'supported' | 'on' | 'off' | 'silent';
      audioChipLabel: string | null;
      altContext: string;
    };
  } | null;
  imageExamples: {
    title: string;
    intro: string;
    workspaceLabel: string;
    items: Array<{
      id: string;
      title: string;
      badge: string;
      kind: 'image' | 'references' | 'edit' | 'typography' | 'layout' | 'quality';
      prompt: string;
    }>;
  } | null;
};
```

This is the target field vocabulary. The parser and JSON documents use this normalized shape instead of preserving legacy fallback function names or the old `SoraCopy` field layout. It must not grow into a generic rich-content abstraction.

All objects are strict. Unknown fields fail validation. Required strings are non-empty after trimming. Arrays may be empty only where the current projection renders no items; the three locales must agree on their cardinality. Optional visible blocks use explicit `null` rather than implicit fallback behavior. Video models have a non-null `demo`; image models have non-null `imageExamples`. Tab IDs and image-example IDs are unique, and every `tabNotes.tabId` references an existing tab.

`modelSlug` must equal the requested model slug and the localized JSON filename. Guide and editorial hrefs must use approved public route families and the correct locale. Workspace URLs are not authored in this object; they are derived by the view-model builder.

## Runtime Architecture

### Localized content loader

`frontend/lib/models/i18n.ts` remains the only production filesystem reader for `content/models`.

The shared loader exposes the selected document's `prompting` value on `EngineLocalizedContent`. General model fields retain their current behavior, while `prompting` uses exact-locale selection:

- English reads only the English document;
- French reads only the French document;
- Spanish reads only the Spanish document;
- a missing localized object never falls back to English.

The field remains `unknown` at the shared loader boundary. Model-page route code validates it through the route-local Prompt Lab schema. No route or component imports a model JSON file directly.

### Strict Prompt Lab parser

Add `_lib/model-page-prompting-content.ts` as the sole owner of:

- the strict Zod schema;
- the parsed `ModelPromptingContent` type;
- the slug identity check;
- non-empty and relational validation;
- locale-aware editorial href validation;
- explicit missing and malformed-content errors.

It does not read files, choose models, calculate runtime values, contain fallback copy, or substitute another locale.

### Pure view-model builder

Add `_lib/model-page-prompting-view-model.ts` to combine validated editorial content with existing runtime inputs. Its output is the complete render-ready Prompt Lab view model.

The builder derives:

- demo media and fallback display behavior;
- actual mode, duration, aspect ratio, and audio state;
- workspace URL and engine parameters;
- generic presentation state needed by the renderer.

The builder is pure. It receives all dependencies as arguments and does not read files, inspect browser state, fetch data, or maintain a model-slug fallback tree. Model differences enter through validated content and existing canonical runtime configuration.

### Generic UI copy

Add `_lib/model-page-prompting-ui-copy.ts` for the small generic interface vocabulary shared by every model. It contains one typed object for each supported locale and no model slug keys, prompts, capability claims, URLs, or model-specific summaries.

This table is not a second Prompt Lab content owner. It is equivalent to component chrome localization and prevents duplicating identical button labels across 120 documents.

### Rendering

`ModelDecisionPromptingSection.tsx` becomes a server renderer of at most 300 physical lines. It receives a render-ready view model and composes the existing focused client components:

- `ModelDecisionPromptTabs.client.tsx`;
- `ModelDecisionCopyButton.client.tsx`;
- `ModelDecisionDemoMedia.client.tsx`.

It contains no model-specific prose, model slug switch, locale-specific prompt table, filesystem access, or workspace-route construction.

`ModelPromptingSection.tsx` resolves the validated Prompt Lab data once and passes the resulting view model to the active renderer. If its default rendering branch remains necessary, that branch consumes the same parsed content/view model and may not retain `SoraCopy` prompt fields as a compatibility source.

## Removed Ownership

After every consumer uses the new contract and parity proof passes, remove these Prompt Lab fields from localized `custom` content and from the corresponding `SoraCopy` types/builders:

- `promptingTitle`;
- `promptingIntro`;
- `promptingTip`;
- `promptingGuideLabel`;
- `promptingGuideUrl`;
- `promptingTabs`;
- `promptingGlobalPrinciples`;
- `promptingEngineWhy`;
- `promptingTabNotes`;
- `demoTitle`;
- `demoPromptLabel`;
- `demoPrompt`;
- `demoNotes`;
- any additional Prompt Lab-only demo-summary field discovered by the exact projection inventory.

Unrelated `custom` fields, including gallery, general tips, metadata, or other model-page sections, remain untouched.

Also delete:

- all model- and locale-specific Prompt Lab fallback functions from `ModelDecisionPromptingSection.tsx`;
- all model-specific prompting selection branches from the wrapper and builders;
- the temporary legacy projection extractor;
- the temporary converter;
- the temporary old/new deep-comparison bridge.

No compatibility facade, fallback map, or deprecated prompt field remains in production.

## Data Flow

The final server-side path is:

```text
getEngineLocalized(locale, slug)
  -> exact-locale prompting: unknown
  -> parseModelPromptingContent(prompting, locale, slug)
  -> buildModelPromptingViewModel(content, runtime inputs, ui copy)
  -> ModelDecisionPromptingSection(viewModel)
```

Content validation occurs before rendering. Runtime derivation occurs once. Client components receive only the interactive props they already need.

## Error Handling

For every one of the 40 configured models:

- a missing `prompting` object throws an explicit error containing model slug, locale, and source context;
- a malformed object throws with the failing validation path;
- a mismatched `modelSlug` throws;
- a duplicate or dangling tab ID throws;
- a forbidden or wrong-locale editorial href throws;
- no error path substitutes English content, `custom` prompt fields, or TypeScript fallback copy.

Missing optional demo media remains normal product behavior. The view-model builder retains the current media fallback and empty-display behavior instead of treating media availability as malformed editorial content.

## Migration Strategy

### Phase A: characterize the effective legacy projection

The current source cannot be migrated by copying JSON `custom` values alone because TypeScript fallbacks own much of the rendered result.

A temporary pure legacy projector must therefore capture the complete effective view-facing editorial projection for:

- 40 model slugs;
- 3 locales;
- 120 model-locale projections;
- every prompt, tab, note, principle, explanation, title, label, guide link, demo summary, and image example;
- every current conditional presence decision and array order.

Runtime facts such as media resolution, duration, aspect ratio, audio state, and generated workspace URLs are characterized separately so the migration does not mistakenly copy live state into editorial JSON.

### Phase B: materialize localized Prompt Lab content

A one-time converter inserts one `prompting` object into each existing localized model document. It uses the characterized legacy projection and preserves every user-visible editorial value exactly.

The converter must not translate, normalize, reorder, trim, rewrite links, invent missing content, or derive one locale from another. Any qualifying objective correction uses the explicit allowlist policy and a dedicated assertion.

### Phase C: prove parity before cutover

While both representations temporarily exist, a verifier deep-compares all 120 old and new editorial projections:

- all object paths;
- exact strings;
- array cardinality and order;
- tab identities and relationships;
- optional and `null` section presence;
- guide and editorial hrefs.

The verifier fails on every difference not listed as an approved objective correction. Representative derived-runtime matrices additionally compare media-present/media-absent, audio-on/audio-off, video/image modes, duration, aspect ratio, and workspace destinations to prove that the new view-model builder preserves runtime behavior.

### Phase D: cut over and delete the hybrid system

After parity is green:

1. expose exact-locale `prompting` through `getEngineLocalized`;
2. validate it with the strict route-local parser;
3. render through the pure view-model builder;
4. switch every Prompt Lab consumer;
5. remove Prompt Lab fields from `custom`, `SoraCopy`, and `buildModelPageCopy`;
6. delete all TypeScript model-content fallbacks and slug-selection branches;
7. delete migration-only tools and duplicate proof fixtures.

The final repository contains one model-specific editorial owner, not a permanent converter or two synchronized representations.

## Route, SEO, Pricing, and Product Preservation

This project does not change:

- public model URLs or localized route segments;
- redirects;
- canonical or hreflang generation;
- metadata titles or descriptions;
- JSON-LD or FAQ schema;
- robots or sitemap membership;
- model publication, replacement, or tombstone policy;
- numeric prices, credits, billing formulas, or pricing labels outside Prompt Lab;
- model capability configuration;
- app route families or workspace behavior;
- selected media assets or media publication policy.

Prompting guide links and workspace links must resolve to the same destinations as before. Route and SEO tests are preservation guards, not migration targets.

## Permanent Architecture Contracts

Tests must discover the model inventory from the existing canonical model/template configuration and localized document filenames, not maintain a second manual list.

Permanent contracts verify:

1. The English, French, and Spanish model filename inventories are identical and match the 40 configured models.
2. Every one of the 120 documents contains a valid non-null `prompting` object.
3. `prompting.modelSlug` matches the filename and requested canonical slug.
4. EN, FR, and ES structural paths and array cardinalities match for each model.
5. Required strings, relationships, tab IDs, and hrefs satisfy the strict runtime contract.
6. Requested-locale content never falls back to English.
7. No production consumer imports model JSON directly or creates a second loader.
8. No Prompt Lab-only field remains in localized `custom`, `SoraCopy`, or `buildModelPageCopy`.
9. No model-specific text or slug decision tree remains in the renderer, parser, view-model builder, or generic UI-copy module.
10. `ModelDecisionPromptingSection.tsx` remains at or below 300 physical lines.
11. `_lib/model-page-prompting-content.ts` remains at or below 300 physical lines, `_lib/model-page-prompting-view-model.ts` remains at or below 300, and `_lib/model-page-prompting-ui-copy.ts` remains at or below 180.
12. The existing client tab, copy, and media components remain the owners of their browser-only interactions.
13. Missing or malformed fixture content fails with actionable slug, locale, and field context.
14. Next.js output tracing continues to include all localized model documents.
15. Every approved objective correction, if any, has a dedicated permanent regression assertion.

Permanent tests protect structure and runtime output without keeping a duplicate full-text copy of all Prompt Lab prose.

## Verification

Focused verification includes:

- the existing 69-test Prompt Lab/model-page baseline;
- strict 40-by-3 content inventory and parser tests;
- legacy/new deep equality for all 120 projections before legacy deletion;
- decision-layout and template-content architecture tests;
- Kling O3 tab, principles, engine-why, and prompt behavior;
- Gemini Omni prompt behavior;
- Happy Horse 1.1 fallback behavior;
- all image-model prompt examples and workspace destinations;
- demo media presence and absence;
- audio-on and audio-off display;
- duration and aspect-ratio derivation;
- localized guide and internal-link validation;
- explicit regression tests for every approved objective correction.

Final verification includes:

- full `pnpm test:validate`;
- frontend lint;
- public-exposure lint;
- frontend TypeScript without emit;
- model-registry/content validation;
- architecture audit;
- `git diff --check`;
- production frontend build;
- representative production smokes for English, French, and Spanish model URLs;
- Prompt Lab, demo, tabs, copy action, media state, workspace links, canonical, and hreflang checks in those smokes;
- a final scoped diff proving no route, SEO, pricing, model-registry, or media-policy source changed.

## Non-Goals

- No style rewrite or broad prompt-quality editorial pass.
- No change to model capabilities, prompting recommendations, or product claims except a proven objective defect.
- No change to numeric prices or billing behavior.
- No public route, redirect, canonical, hreflang, metadata, schema, sitemap, or publication change.
- No rewrite of the shared model localization loader beyond exposing exact-locale `prompting` data.
- No generic content framework, CMS, admin editor, database migration, or generated production registry.
- No persistent compatibility layer or English fallback.
- No refactor of `ModelExamplesSection.tsx`; examples are the next separate project.

## Success Criteria

The project is complete when:

- all 120 localized model documents are the only owners of model-specific Prompt Lab editorial content;
- every migrated projection is deep-equal to the legacy visible projection except explicitly evidenced and tested objective corrections;
- a requested locale cannot silently display English Prompt Lab content;
- runtime media, mode, duration, aspect ratio, audio, and workspace-link behavior remain unchanged;
- `ModelDecisionPromptingSection.tsx` is a focused renderer at or below 300 physical lines;
- Prompt Lab-only `custom` and `SoraCopy` fields, model-specific TypeScript fallbacks, slug trees, and migration artifacts are deleted;
- generic UI chrome has one typed locale table and no model-specific content;
- route, SEO, pricing, registry, and media contracts remain unchanged;
- all focused, full, build, architecture, and localized smoke validations pass;
- `ModelExamplesSection.tsx` remains untouched for its separate follow-up project.
