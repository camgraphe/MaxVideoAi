# Pay-as-you-go Page Architecture Design

Date: 2026-07-16
Status: approved design, implementation not started

## Context

The localized Pay-as-you-go AI Video Generator route is already a healthy server route with focused data, JSON-LD, and video-showcase helpers. Its remaining large owner is:

```text
frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/
  _components/PayAsYouGoPageView.tsx  707 lines
```

The live architecture audit reports that file at 708 audit lines. It currently owns:

- a locale-selection closure;
- view-only localized copy arrays and cards;
- price-display derivation helpers;
- one shared section header;
- one hero quote card;
- fourteen ordered page sections;
- final page composition.

Localized editorial ownership is also spread across:

- `page.tsx` for metadata;
- `payg-page-data.ts` for primary page copy and pricing labels;
- `PayAsYouGoPageView.tsx` for view-only copy;
- `payg-jsonld.ts` for structured-data copy;
- the showcase component/data boundary for showcase labels.

This split makes locale completeness difficult to audit and encourages future copy to be added to whichever file is most convenient.

## Goals

1. Give all Pay-as-you-go editorial copy one strict route-local content boundary.
2. Keep EN, FR, and ES complete and exact-locale with no English fallback.
3. Reduce `PayAsYouGoPageView.tsx` to a short section orchestrator.
4. Keep render components free of translation selection and pricing derivation.
5. Preserve every visible string, link, section, style, metadata field, JSON-LD output, and runtime behavior.
6. Preserve all current numeric prices and pricing formulas.
7. Add architecture and behavioral contracts that prevent copy and calculation ownership from drifting back into renderers.

## Non-goals

- No price, margin, credit, starter-offer, quote, or billing-policy change.
- No route, localized slug, redirect, canonical, hreflang, sitemap, or indexing change.
- No content rewrite, translation correction, SEO rewrite, or model-list change.
- No redesign, class-name cleanup, section reordering, or responsive-layout change.
- No change to playlist selection, media ordering, video labels, or showcase fallbacks.
- No promotion of one-route components into shared marketing folders.
- No new state library, client boundary, CMS, or runtime filesystem loader.
- No migration of this route to JSON content in this lot.

The approved correction manifest is empty. Any customer-visible difference is a failed migration.

## Chosen Architecture

Use a strict route-local TypeScript content catalog, one render-ready data builder, and four grouped section owners.

```text
locale
  -> getPayAsYouGoContent(locale)
  -> exact locale content
  -> buildPayAsYouGoPageData(content, runtime pricing inputs)
  -> render-ready PayAsYouGoPageData
  -> PayAsYouGoPageView
  -> focused grouped section components
```

The content boundary is a single API backed by one complete document per locale:

```text
_content/
  types.ts
  en.ts
  fr.ts
  es.ts
  index.ts
```

`index.ts` is the only route-facing content selector. It returns only the requested locale and never uses `?? en`, a default-locale merge, or partial overlays.

The three physical locale modules prevent the new content owner from becoming another 500-line file. Together they form one editorial boundary, not three competing loaders.

## Strict Content Contract

`PayAsYouGoContent` owns all authored localized text for the route:

- metadata title, description, image alt, and keywords;
- hero, trust items, CTA labels, and quote-card labels;
- natural-language questions and answers;
- model-testing-order copy;
- meaning and no-subscription copy;
- audience cards;
- subscription comparison labels and rows;
- workflow steps;
- quote-factor labels;
- pricing-section labels and explanatory copy;
- price-lookup and example-cost labels;
- refund-policy copy;
- FAQ copy;
- showcase UI labels;
- localized Breadcrumb, Service, and WebApplication JSON-LD prose.

It does not own:

- price numbers;
- pricing formulas;
- selected pricing rows;
- model runtime facts;
- route destinations derived from configuration;
- playlist videos or media URLs;
- Schema.org numeric starter-offer values;
- Lucide components or JSX.

The locale modules use `satisfies PayAsYouGoContent`. Permanent tests additionally validate every required string recursively, fixed array relationships, and the expected structural signature across EN, FR, and ES.

Repeated wording may remain repeated inside one locale document when different surfaces intentionally own different sentences. The goal is one ownership boundary, not unsafe phrase-level deduplication.

## Exact-locale Behavior

`getPayAsYouGoContent(locale)` performs an explicit lookup and throws a descriptive error if a supported locale has no complete document. It never substitutes English.

The contract covers exactly the application locales:

```text
en
fr
es
```

Compile-time exhaustiveness and runtime contract tests both guard that set. Adding a future locale requires adding a complete document before the build can pass.

## Data and View-model Boundary

`payg-page-data.ts` remains the canonical pure builder for the page. It combines the strict content document with the existing pricing-hub projection and route facts.

The following current view helpers move into that builder boundary:

- visible-price detection;
- first visible quote selection;
- example-price label formatting;
- example-cost model matching;
- hero quote preview-row preparation.

The builder returns plain render-ready data. Components may map rows to JSX, but they do not choose translations, infer pricing fallbacks, search for matching models, or format price labels.

Dynamic pricing remains sourced from the existing pricing hub. The builder must not duplicate or freeze pricing values in the editorial catalog.

Existing missing-price behavior remains unchanged: the localized live-quote label is used only where the current page uses it today.

## Page and JSON-LD Flow

`page.tsx` stays the route orchestrator:

1. resolve the locale;
2. select the exact locale content;
3. build page data;
4. load showcase videos;
5. build canonical URLs and JSON-LD;
6. render scripts and `PayAsYouGoPageView`.

`generateMetadata` reads the metadata projection through the same content selector.

`payg-jsonld.ts` stops owning locale maps. Its builders accept the relevant localized JSON-LD projection as an explicit input and retain the existing Schema.org structure, URLs, numeric offer values, and serialization behavior.

The showcase keeps its existing runtime locale input where formatting requires it, but every authored showcase label comes from the strict content projection.

## Component Structure

```text
_components/
  PayAsYouGoPageView.tsx
  PayAsYouGoHeroSections.tsx
  PayAsYouGoGuideSections.tsx
  PayAsYouGoPricingSections.tsx
  PayAsYouGoTrustSections.tsx
  PayAsYouGoSectionPrimitives.tsx
  PayAsYouGoVideoShowcase.tsx
```

### `PayAsYouGoPageView.tsx`

Owns only the `<main>` element and the existing section order:

1. Hero
2. Video showcase
3. Natural questions
4. Model testing order
5. Meaning
6. Audience fit
7. Subscription comparison
8. Workflow
9. Quote factors
10. Price per model
11. Price lookup shortcuts
12. Example costs
13. Refund policy
14. FAQ

It receives render-ready page data and showcase data. It contains no locale map, price helper, icon table, or section JSX.

### `PayAsYouGoHeroSections.tsx`

Owns:

- `HeroQuoteCard`;
- `HeroSection`;
- `NaturalQuestionsSection`;
- `ModelTestingOrderSection`.

### `PayAsYouGoGuideSections.tsx`

Owns:

- `MeaningSection`;
- `AudienceFitSection`;
- `SubscriptionComparisonSection`;
- `WorkflowSection`;
- `QuoteFactorsSection`.

### `PayAsYouGoPricingSections.tsx`

Owns rendering only for:

- `PricePerModelSection`;
- `PriceLookupShortcutsSection`;
- `ExampleCostsSection`.

It consumes already formatted rows and labels. It contains no pricing algorithm or locale selection.

### `PayAsYouGoTrustSections.tsx`

Owns:

- `RefundPolicySection`;
- `FaqSection`.

### `PayAsYouGoSectionPrimitives.tsx`

Owns the route-local `SectionHeader`, shared container class, and semantic icon-ID-to-Lucide mapping. It does not become a global shared component because there is no second consumer.

## Icon Boundary

Editorial content uses a small semantic icon vocabulary such as:

```text
model
preview
video
refund
duration
resolution
audio
credits
```

Content modules do not import React or Lucide. The primitive/component boundary maps these IDs to the exact current icons. Unknown icon IDs fail the strict content contract.

## Physical Line Caps

Permanent architecture tests lock these caps:

- `page.tsx`: at most 120 lines;
- `PayAsYouGoPageView.tsx`: at most 100 lines;
- each grouped section module: at most 250 lines;
- section primitives: at most 120 lines;
- `payg-page-data.ts`: at most 400 lines;
- each locale content module: at most 350 lines;
- content types and selector individually: at most 180 lines;
- JSON-LD builder: at most 120 lines;
- showcase component/data modules retain their current focused boundaries and remain below 250 lines.

No permanent Pay-as-you-go source file may appear in the architecture audit at the 500-line threshold.

## Migration and Parity Strategy

The refactor uses a characterization-first sequence.

Before moving copy, capture normalized EN, FR, and ES manifests from the current implementation. The manifests cover:

- section order and presence;
- headings, paragraphs, list items, questions, and answers;
- table headers and cells;
- CTA and link text plus destinations;
- metadata output;
- Breadcrumb, Service, and WebApplication JSON-LD output;
- showcase labels and empty/showcase states;
- pricing rows, formatted price cells, and example costs as produced by the existing pricing builder.

The manifests are semantic rather than screenshot hashes. A failure must identify the changed field or ordered item.

Temporary migration fixtures or bridges may be used to prove exact before/after equality. They are removed after the permanent content, builder, and renderer contracts cover the final architecture.

Permanent tests do not freeze independently authored price numbers in a second fixture. They prove that displayed price cells and example costs are projections of the existing pricing hub, so future intentional price changes keep one owner.

## Error and Empty-state Behavior

- Missing or incomplete locale content fails explicitly; there is no English fallback.
- Missing pricing rows retain the current localized live-quote presentation.
- Empty example-cost and lookup collections retain the current rendered behavior.
- Showcase playlist failure, starter fallback, ordering, and empty behavior remain owned by the existing showcase loader.
- A malformed icon ID or structural content mismatch fails tests/build rather than silently dropping UI.
- JSON-LD serialization remains centralized and escapes `<` exactly as it does now.

No new runtime recovery path is added as part of this structural refactor.

## Testing Strategy

### Characterization tests

- capture current EN/FR/ES semantic manifests before implementation;
- prove new output is identical with an empty showcase and with deterministic showcase fixtures;
- compare metadata and all JSON-LD payloads exactly;
- prove pricing rows and example costs are unchanged.

### Permanent content contracts

- all three locale modules exist;
- `getPayAsYouGoContent` selects exact locale only;
- every required string is non-empty;
- arrays and semantic IDs are structurally valid;
- no locale-selection closures or inline translation tuples remain outside `_content`;
- no numeric price ownership enters editorial content.

### Permanent architecture contracts

- the page remains a route orchestrator;
- the view imports and renders the four focused groups in the exact current order;
- section renderers contain no `AppLocale`, `copy.text`, `PAYG_COPY_BY_LOCALE`, pricing-hub imports, or JSON-LD builders;
- JSON-LD builders contain no locale copy maps;
- metadata comes from strict content;
- line caps pass;
- all Pay-as-you-go files stay below the 500-line audit threshold.

### Behavioral tests

- EN, FR, and ES render the same current customer-facing copy and hrefs;
- price placeholders and live-quote fallbacks remain localized;
- pricing rows, lookup cards, and example costs retain their current order;
- showcase videos and no-video states retain current behavior;
- FAQ, refund, and comparison tables preserve their structure.

### Final verification

Run:

- focused Pay-as-you-go content, page, pricing, JSON-LD, and showcase tests;
- `pnpm test:validate`;
- frontend TypeScript;
- frontend lint;
- public exposure lint;
- architecture audit;
- `git diff --check`;
- production build;
- built-route browser smokes for EN, FR, and ES.

Browser smokes verify HTTP 200, visible section order, representative localized text, pricing links, canonical, four hreflangs, JSON-LD scripts, and no application error overlay.

## Implementation Phases

1. Add current-output characterization and architecture RED tests.
2. Create the strict content types, locale documents, and exact-locale selector.
3. Cut metadata and JSON-LD copy over to strict content with exact parity.
4. Make `payg-page-data.ts` return render-ready pricing and quote data.
5. Extract shared primitives and the four grouped section modules.
6. Reduce `PayAsYouGoPageView.tsx` to composition only.
7. Cut showcase labels over to strict content.
8. Remove inline locale maps, tuple selectors, and temporary parity owners.
9. Run complete tests, build, architecture audit, and localized browser smokes.

Each phase ends in a focused, reviewable commit and preserves customer-visible behavior.

## Success Criteria

The lot is complete only when:

- all Pay-as-you-go editorial copy has one strict route-local content boundary;
- EN, FR, and ES are complete with no fallback;
- `PayAsYouGoPageView.tsx` is at most 100 lines;
- no permanent Pay-as-you-go source file is at least 500 lines;
- components contain no translation selection or pricing derivation;
- metadata and JSON-LD consume strict content;
- all current prices and formulas are unchanged;
- all current routes, SEO output, section order, links, copy, classes, and showcase behavior are unchanged;
- characterization, permanent contracts, full tests, build, and localized smokes pass;
- the tracked worktree is clean and the final branch review has no unresolved Critical or Important finding.
