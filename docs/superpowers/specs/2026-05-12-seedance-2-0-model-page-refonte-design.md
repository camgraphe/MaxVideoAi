# Seedance 2.0 Model Page Decision Hero Design

Date: 2026-05-12
Branch: `codex/refonte-pages-models`

## Goal

Refactor the model detail page hero into a reusable decision-oriented template, starting with `/models/seedance-2-0`.

The first shipped page should make the user understand, within the first viewport:

- what Seedance 2.0 is best for
- when to choose it over Seedance 2.0 Fast or older Seedance routes
- how pricing works in concrete scenarios
- where to view examples, prompts, and comparisons

The design should improve CTR and task completion without changing public URL structure, localized route behavior, JSON-LD, canonical URLs, or existing lower-page content contracts.

## Visual Direction

Use the provided light MaxVideoAI mockup as the visual base.

The page should feel close to the MaxVideoAI homepage:

- very light blue-gray page background
- white cards with soft borders and minimal shadows
- navy primary text and slate secondary text
- subtle cyan, blue, green, orange, and violet accents
- dark navy primary CTA
- white bordered secondary CTA
- no dark full-bleed cinematic hero

The video should appear inside a premium hero media card, not as the page background.

## Scope

In scope for this batch:

- create a reusable model decision hero template
- activate it for `seedance-2-0`
- keep the existing model detail sections below the new top page structure
- add Seedance 2.0 decision data for hero copy, quick links, feature strip, pricing scenarios, and comparison cards
- update Seedance 2.0 metadata copy toward pricing, native audio, examples, and comparison intent
- update architecture tests if responsibilities move or new boundaries need locking

Out of scope for this batch:

- migrating every model page to the new template
- redesigning the full models catalog
- changing pricing algorithms
- changing comparison page routing
- changing sitemap, canonical, hreflang, or localized slug behavior
- replacing existing examples, prompting, specs, tips, safety, or FAQ sections beyond placement around the new top page

## Architecture

The reusable template should live route-locally under:

`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/`

Route-only data builders should live under:

`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/`

Preferred split:

- `ModelDecisionHeroSection.tsx`: layout for breadcrumb, left hero copy, CTA row, quick links, right media card, and feature strip.
- `ModelDecisionPricingCard.tsx`: compact pricing-at-a-glance card.
- `ModelDecisionCardsSection.tsx`: optional decision cards such as vs Fast, upgrade from 1.5, pricing, and prompts.
- `model-page-decision-data.ts`: route-local pure builder that returns decision hero data by model slug and locale.

The existing `MarketingModelPageLayout.tsx` should remain the route-level layout composer. It can decide whether to render the decision template for the current model, but it should not own large copy tables or scenario arrays.

The existing `ModelHeroSection.tsx` should remain available as the fallback for model pages that are not yet migrated.

## First Model: Seedance 2.0

The first activation is `seedance-2-0`.

Recommended English hero copy:

- Eyebrow: `BYTEDANCE CURRENT-GEN MODEL`
- H1: `Seedance 2.0`
- Subtitle: `Native audio, multi-shot continuity, and reference-guided video for polished ads and cinematic branded content.`
- Paragraph: `Seedance 2.0 is the current Seedance production route on MaxVideoAI. Use it when you need stronger scene continuity than older versions, native audio inside the same generation flow, and multimodal references for text-to-video or image-to-video work.`

CTA and links:

- Primary CTA: `Generate with Seedance 2.0`
- Secondary CTA: `View examples`
- Quick links: `Compare vs Fast`, `View pricing`, `Prompt examples`

Feature strip:

- Native audio
- Multi-shot continuity
- Reference-guided
- Max 1080p
- Max 15s
- Pay-as-you-go

Pricing card:

- Title: `Seedance 2.0 pricing at a glance`
- Supporting text: `Preset total prices - see exact live price in the app before you generate.`
- Scenarios:
  - `5s · 720p` / `$1.97` / `Best for quick drafts`
  - `8s · 1080p` / `$7.08` / `Standard quality`
  - `10s · 1080p` / `$8.84` / `Best balance`
  - `10s · 1080p + audio` / `$8.84` / `With native audio`
  - `Max 15s · 1080p` / `$8.84` / `Longest allowed`
- English link target: `/pricing#seedance-2-0-pricing`
- French and Spanish links must use the localized pricing path with the same `seedance-2-0-pricing` anchor.

Decision cards:

- `Seedance 2.0 or Fast?`
  - Use Seedance 2.0 for final-quality, native-audio, multi-shot work.
  - Use Fast for cheaper draft passes and timing tests.
  - Link to the Seedance 2.0 vs Fast comparison.
- `Upgrading from Seedance 1.5?`
  - Position Seedance 2.0 as the current route for stronger continuity, native audio, and broader reference workflows.
  - Link to Seedance 1.5 vs 2.0.
- `Seedance 2.0 pricing`
  - Link early to the pricing row.
- `Seedance 2.0 prompt examples`
  - Link to examples or prompt-oriented content.

## Metadata

For Seedance 2.0, use the CTR-oriented metadata direction:

Title:

`Seedance 2.0 AI Video Model: Pricing, Native Audio & Examples | MaxVideoAI`

Description:

`Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.`

The metadata implementation must preserve localized behavior and existing fallback behavior for other models.

## Data Flow

`page.tsx` continues to resolve params, metadata, engine data, localized content, pricing overrides, media, examples, specs, and compare data.

`MarketingModelPageLayout.tsx` should:

- build existing common page data as it does today
- ask a pure helper for optional decision template data
- render the new decision top page when data exists
- render the existing hero fallback when data does not exist
- keep schema payload rendering centralized

The decision data helper should return plain serializable data. It should not return JSX.

## Localization

The first implementation must include English, French, and Spanish copy for every new visible decision-template string used by Seedance 2.0.

Visible strings introduced by the decision template should be localizable through the route-local data helper. The implementation should not introduce partial mixed-language UI on `/fr/modeles/seedance-2-0` or `/es/modelos/seedance-2-0`.

Localized links must use existing route helpers such as `buildSlugMap`, `MODELS_BASE_PATH_MAP`, compare route helpers, and pricing slug maps.

## SEO And Structured Data

Must preserve:

- canonical URL
- hreflang alternates
- localized route paths
- JSON-LD product and breadcrumb payloads
- static params behavior
- sitemap inclusion assumptions

The new top-page content should improve visible relevance for:

- Seedance 2.0 pricing
- Seedance 2.0 examples
- Seedance 2.0 vs Fast
- Seedance 1.5 vs 2.0
- native audio
- multi-shot continuity
- reference-guided workflows

## Testing And Verification

Focused checks:

- model page architecture tests affected by new files or imports
- `npm --prefix frontend run lint`
- `npm run lint:exposure`
- `git diff --check`

Route smoke tests:

- `/models/seedance-2-0`
- `/fr/modeles/seedance-2-0`
- `/es/modelos/seedance-2-0`

Manual page checks:

- first viewport matches the provided light mockup direction
- media card renders poster/video correctly
- CTA links resolve correctly
- pricing link reaches the pricing anchor
- comparison links point to the intended localized comparison routes
- TOC and lower sections remain usable
- no text overlap on mobile and desktop

## Implementation Notes

Keep the first implementation incremental:

1. add decision data types and Seedance 2.0 data
2. add the reusable decision hero, pricing card, and decision cards components
3. wire Seedance 2.0 into `MarketingModelPageLayout.tsx`
4. update metadata for Seedance 2.0 through the existing metadata path
5. add or update architecture tests to lock the new boundary
6. run focused validation and browser smoke tests

Do not broaden the migration to other models until Seedance 2.0 is visually and technically validated.
