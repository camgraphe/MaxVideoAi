# Seedance 2.0 Model Page Decision Template Design

Date: 2026-05-12
Branch: `codex/refonte-pages-models`

## Goal

Refactor the model page template using `/models/seedance-2-0` as the first test case.

The Seedance 2.0 page should stop reading like a centered technical model sheet and start working as a decision page. The first viewport must answer:

- what Seedance 2.0 is best for
- why it is the current main Seedance production route
- when to choose it instead of Seedance 2.0 Fast or Seedance 1.5 Pro
- what scenario pricing looks like before generation
- where to view examples, prompt guidance, pricing, and comparisons

The design must preserve public URLs, localized route behavior, canonical URLs, hreflang, sitemap assumptions, JSON-LD behavior, server rendering, and existing app generation links.

## Visual Direction

Use the provided light mockup as the base.

Match the MaxVideoAI homepage tone:

- light blue-gray page background
- white cards
- navy primary text
- slate secondary text
- subtle cyan, blue, violet, green, and orange accents
- soft borders
- minimal shadows
- rounded but not oversized cards
- dark navy primary CTA
- white bordered secondary CTA

Avoid:

- dark full-bleed cinematic hero
- oversized poster background
- centered wall of text
- link soup
- admin or leaderboard visual language
- heavy gradients

The page should feel like a premium AI SaaS product page and a useful model decision page.

## Scope

In scope for this batch:

- create a reusable model decision template pattern
- activate it first for `seedance-2-0`
- implement the new two-column hero
- place the hero media card inside the hero
- add a compact feature strip directly under the hero
- add a pricing-at-a-glance card directly after the feature strip
- add compact decision cards for Fast, Seedance 1.5, and prompt examples
- strengthen early interlinking to Seedance 2.0 Fast, pricing, examples, prompts, and comparisons
- update Seedance 2.0 metadata toward pricing, native audio, examples, and comparison intent
- preserve and lightly reorganize existing lower sections
- make Prompt Lab and examples more scannable where this can be done without a full page redesign
- fix broken `img src="image"` placeholders where they appear in the touched model-page surfaces
- update architecture tests when responsibilities move or new boundaries need locking

Out of scope for this batch:

- migrating every model page to the new template
- redesigning the full models catalog
- changing pricing algorithms
- changing comparison route behavior
- exposing raw BytePlus or ModelArk resource-pack economics
- copying BytePlus or ModelArk text verbatim
- making provider-family capability claims that are not supported by the current MaxVideoAI route
- canonicalizing Seedance 2.0 Fast to Seedance 2.0, or the reverse
- replacing all lower-page content from scratch

## Architecture

Keep the implementation route-local unless reuse is proven.

Component location:

`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/`

Route-local helper location:

`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/`

Preferred split:

- `ModelDecisionHeroSection.tsx`: breadcrumb, left hero copy, CTA row, compact decision links, right media card, and feature strip.
- `ModelDecisionPricingCard.tsx`: scenario pricing card.
- `ModelDecisionCardsSection.tsx`: top decision cards for Fast, Seedance 1.5, and Prompt Lab.
- `model-page-decision-data.ts`: pure data builder that returns optional decision-template data by model slug and locale.
- existing `MediaPreview.tsx` can be reused or extended if it can render the required hero-media treatment without breaking other usages.

`MarketingModelPageLayout.tsx` remains the route-level layout composer. It should ask a pure helper for decision-template data, render the new top page when data exists, and render the existing `ModelHeroSection.tsx` fallback when data does not exist.

The decision data helper must return plain data. It must not return JSX.

## Seedance 2.0 Hero

The first activation is `seedance-2-0`.

Hero structure:

- breadcrumb above the hero
- left column with eyebrow, H1, subtitle, paragraph, CTA row, and compact decision links
- right column with large rounded video preview card
- feature strip below the two-column hero
- pricing card below the feature strip
- decision cards near the top, after pricing or before the main content tabs

English hero copy:

- Eyebrow: `BYTEDANCE CURRENT-GEN MODEL`
- H1: `Seedance 2.0`
- Subtitle: `Native audio, multi-shot continuity, and reference-guided video for polished ads, launches and cinematic branded content.`
- Paragraph: `Use Seedance 2.0 when you need the current Seedance production route: stronger continuity than older versions, native audio in the same generation flow, and multimodal references for text-to-video or image-to-video work.`

The paragraph should stay under 55 words in English.

CTA and links:

- Primary CTA: `Generate with Seedance 2.0`
- Primary target: `/app?engine=seedance-2-0`
- Secondary CTA: `View examples`
- Secondary target: `/examples/seedance`, using existing localized examples helpers where applicable
- Compact hero links:
  - `Compare vs Fast` to the Seedance 2.0 vs Fast comparison
  - `View pricing` to the localized pricing path with `#seedance-2-0-pricing`
  - `Prompt examples` to the Prompt Lab section anchor

Do not render the hero links as a long inline link list. Use compact icon links or small decision affordances.

## Hero Media Card

The video preview must sit in a clean white or light hero card, not as a full page background.

Use the current Seedance 2.0 hero example if available.

Media card content:

- large rounded preview image or video
- overlay badge: `Audio on`
- overlay badge: `12s`
- overlay badge: `16:9`
- caption: `Seedance 2.0 example`
- description: `Native-audio cinematic sequence`
- CTA: `View render`

Do not show only `$0.40/s` in the media card. Replace price-per-second display with either:

- `12s · 16:9 · Audio on`
- `Live price shown before generation`

If a price appears in the media card, it must be a MaxVideoAI display total from the same helper used by the pricing page.

Image alt text should be concise. Use text like `Seedance 2.0 cinematic rooftop running scene`, not a full prompt.

## Feature Strip

Add a compact feature strip directly under the hero.

Feature items:

- Native audio: `Dialogue, ambience and SFX generated in sync.`
- Multi-shot continuity: `Keep characters, style and scene continuity across short sequences.`
- Reference-guided: `Use supported references to guide the output.`
- Max 1080p: `Crisp output for most production needs.`
- Max 15s: `Up to 15 seconds per generation.`
- Pay-as-you-go: `See exact live price before you generate.`

Capability source of truth:

- Use MaxVideoAI engine config and current route UI behavior as the source of truth.
- Do not overclaim reference types in the hero.
- If provider docs describe broader video or audio reference capabilities than the current MaxVideoAI route exposes, keep those claims out of the hero.

## Pricing-At-A-Glance Card

Add the pricing card immediately after the feature strip.

Title:

`Seedance 2.0 pricing at a glance`

Subtitle:

`Preset total prices — see the exact live price in the app before you generate.`

Scenario cards:

- `5s · 720p`: display helper total price, expected around `$1.97`, `Best for quick drafts`
- `8s · 1080p`: display helper total price, expected around `$7.08`, `Standard quality`
- `10s · 1080p`: display helper total price, expected around `$8.84`, `Most common comparison`
- `10s · 1080p + audio`: display helper total price, expected around `$8.84`, `With native audio`
- `Max duration`: display `15s` and `Up to 1080p`

Pricing rules:

- Scenario prices must come from the same shared pricing helper used by `/pricing`.
- Do not invent prices.
- Do not use raw provider pricing.
- Use MaxVideoAI display prices.
- Do not hardcode `Max 15s · 1080p` with the same price as `10s · 1080p` unless the pricing helper confirms that exact 15s price.
- If max-duration price cannot be computed reliably, show `Max duration · 15s` instead of a price.
- The app remains the source for exact live quote before generation.

CTA:

- Label: `View full pricing`
- English target: `/pricing#seedance-2-0-pricing`
- French and Spanish targets: localized pricing path with `#seedance-2-0-pricing`

## Top Decision Cards

Add three compact decision cards after the pricing card or before the main content tabs.

Card 1:

- Title: `Seedance 2.0 or Fast?`
- Body: `Use Seedance 2.0 for final-quality, native-audio, multi-shot work. Use Fast for cheaper draft passes and timing tests.`
- CTA: `Compare Seedance 2.0 vs Fast`

Card 2:

- Title: `Upgrading from Seedance 1.5?`
- Body: `Seedance 2.0 is the current route for stronger multi-shot continuity, native audio and broader reference workflows.`
- CTA: `Compare 1.5 vs 2.0`

Card 3:

- Title: `Need prompt examples?`
- Body: `Start with text-to-video, image-to-video, reference-guided and multi-shot prompt templates.`
- CTA: `Open Prompt Lab`

These cards target important Search Console opportunities:

- Seedance 2.0 vs Seedance 2.0 Fast
- Seedance 2.0 Fast vs normal
- Seedance 1.5 vs 2.0
- Seedance 2.0 prompt examples
- Seedance 2.0 pricing

## Lower-Page Content

Do not delete useful current content. Reorganize and clarify it.

Current section families to preserve:

- Specs
- Examples
- Prompting
- Tips
- Compare
- Safety
- FAQ

Preferred order after the new hero:

1. Examples
2. Pricing
3. Key capabilities
4. Prompt Lab
5. Best use cases
6. Compare
7. Specs
8. Safety
9. FAQ

If changing the full order is too risky in this pass, keep the current order but ensure the new hero, feature strip, pricing card, and decision cards carry the first user journey.

## Examples Section

Improve examples visually without turning this into a full gallery redesign.

Where simple, add labels or filters such as:

- Native audio
- Multi-shot
- Product / ad
- Action
- Vertical
- Reference-guided

Each example card should show concise operational metadata:

- thumbnail
- duration
- aspect ratio
- audio on/off
- short use-case label
- `Recreate this shot`
- `View render`

Do not expose long prompt text in card alt text or titles. Keep long prompts in a detail surface or modal.

Fix broken image placeholders such as `<img src="image">` in touched model page surfaces by using valid thumbnails or a clean fallback.

## Prompt Lab

Keep Prompt Lab, but make it more scannable.

Preferred tabs:

- Text
- Start/End
- References
- Timeline

Each tab should include:

- when to use it
- prompt structure
- copy template button if current component patterns support it
- example prompt
- two or three common mistakes

Add a reference roles mini-table only for reference types supported by the current Seedance 2.0 route. If some are provider-family capabilities but not current UI capabilities, phrase them cautiously or omit them from the main Prompt Lab.

Reference role framing:

- Image: identity, product, style, environment; avoid competing styles.
- Video: movement, camera rhythm, transition pacing; include only if supported by current route.
- Audio: mood, rhythm, ambience, short dialogue; include only if supported by current route.
- Text: story, action, camera, style; avoid vague multi-action prompts.

Common mistakes:

- Too many references fighting each other: assign one role per file.
- Drift across shots: add continuity anchors.
- Audio mismatch: shorten dialogue and tie SFX to visible actions.
- Abrupt cuts: add timestamps and transition verbs.
- Physics feels off: simplify the number of simultaneous actions.

## Reference Workflow Content

Use BytePlus and ModelArk tutorial ideas only as inspiration. Do not copy their text.

Explain reference workflows in MaxVideoAI terms:

- text prompt gives the scene brief
- image references guide identity, subject, style, or environment
- video references can guide action rhythm, camera motion, or timing only if supported by the active route
- audio references can guide mood, rhythm, ambience, or voice texture only if supported by the active route
- each reference should have one clear job

Potential workflow cards:

- Text-to-video: subject, action, camera, style, audio prompt.
- Image-to-video: start image locks character, product, composition, or environment.
- Start/end frame: end frame guides landing pose or final composition.
- Multi-reference workflow: assign identity, wardrobe, camera rhythm, background, and audio mood roles.
- Timeline / multi-shot: use timestamps and short beats for internal cuts or sequences.

If a capability exists in provider docs but not in MaxVideoAI's current route, keep it out of the hero and either omit it or place it in a cautious provider/model-family note.

## Specs Section

Keep specs, but distinguish:

- MaxVideoAI route specs
- provider/model-family notes

MaxVideoAI route specs should come from engine config:

- price
- supported modes
- max resolution
- max duration
- aspect ratios
- FPS
- output format
- audio output
- watermark
- route availability

Provider/model-family notes may mention broader multimodal reference concepts only with cautious wording. Avoid implying that the current MaxVideoAI UI exposes every provider capability.

## Provider Pricing Note

Do not expose raw BytePlus resource-pack economics as MaxVideoAI pricing.

It is acceptable to include a neutral note such as:

`Underlying provider costs may vary by route, input type and resolution. MaxVideoAI shows the final display price before generation.`

Do not mention provider resource-pack minimum purchases, deduction rules, or non-refundable pack terms on the MaxVideoAI model page unless a future business/legal requirement explicitly asks for it.

## Cannibalization Rules

Keep Seedance 2.0 and Seedance 2.0 Fast distinct.

Seedance 2.0 page intent:

- current main Seedance production route
- final-quality workflow
- native audio
- multi-shot continuity
- reference-guided work
- polished ads, launches, and cinematic branded content
- comparison with Fast and 1.5

Seedance 2.0 Fast page intent:

- faster draft route
- cheaper or quick iterations
- timing tests
- early creative exploration
- draft passes before finals
- comparison with standard Seedance 2.0

Do not make both pages use the same title, hero copy, H1 supporting text, FAQ wording, or meta description.

Internal linking rules for the Seedance 2.0 page:

- link to Seedance 2.0 Fast with anchor text like `Seedance 2.0 Fast for draft passes`
- link to comparison page with anchor text like `Compare Seedance 2.0 vs Fast`
- link to pricing row with anchor text like `Seedance 2.0 pricing`
- link to examples with anchor text like `Seedance 2.0 examples`

Canonical rules:

- `/models/seedance-2-0` canonicalizes to itself
- `/models/seedance-2-0-fast` canonicalizes to itself
- comparison pages canonicalize to themselves
- do not canonicalize Fast to Standard or Standard to Fast

FAQ distinction:

Seedance 2.0 FAQ should answer:

- What is Seedance 2.0 best for?
- Does Seedance 2.0 include native audio?
- How is Seedance 2.0 different from Seedance 2.0 Fast?
- When should I use Seedance 2.0 instead of Seedance 1.5 Pro?
- Is Seedance 2.0 good for multi-shot video?

Seedance 2.0 Fast FAQ should later answer:

- What is Seedance 2.0 Fast best for?
- Is Seedance 2.0 Fast cheaper or faster?
- When should I use Fast instead of Seedance 2.0?
- Is Fast good for draft passes?
- What do I lose compared with Seedance 2.0?

Do not copy the same FAQ across both pages.

## Interlinking

Add clean internal links, not link soup.

Hero links:

- `/app?engine=seedance-2-0`
- localized Seedance examples path
- localized comparison path for Seedance 2.0 vs Fast
- localized pricing path with `#seedance-2-0-pricing`
- Prompt Lab anchor

Decision card links:

- Compare Seedance 2.0 vs Fast
- Compare Seedance 1.5 vs 2.0
- Prompt Lab

Compare section links:

- Seedance 2.0 vs Fast
- Seedance 1.5 vs 2.0
- Seedance 2.0 vs LTX 2.3
- Seedance 2.0 vs Veo 3.1
- Seedance 2.0 vs Kling 3 Pro

Examples links:

- localized Seedance examples path
- recreate links to `/app?engine=seedance-2-0&from=<job_id>` when a job id exists

## Accessibility And SEO Structure

Use one H1 only:

- H1: `Seedance 2.0`

Preferred H2 structure:

- `Seedance 2.0 pricing at a glance`
- `Seedance 2.0 examples`
- `Key capabilities`
- `Prompt Lab - Seedance 2.0`
- `Seedance 2.0 vs Seedance 2.0 Fast`
- `Compare Seedance 2.0 with other AI video models`
- `Specs`
- `Safety`
- `FAQ`

Do not stuff full prompts into image alt text.

Schema:

- preserve existing schema behavior
- if FAQ schema is already generated from current FAQ entries, update entries consistently with the improved FAQ
- do not add redundant schema types without a clear existing pattern

## Metadata

Seedance 2.0 title:

`Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI`

Seedance 2.0 meta description:

`Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.`

Future Seedance 2.0 Fast metadata, if updated later:

- Title: `Seedance 2.0 Fast: Pricing, Drafts & Examples | MaxVideoAI`
- Meta: `Explore Seedance 2.0 Fast for quicker draft passes, timing tests and lower-cost Seedance AI video iterations. Compare Fast vs Seedance 2.0.`

The current batch only requires the Seedance 2.0 metadata update.

## Localization

The first implementation must include English, French, and Spanish copy for every new visible decision-template string used by Seedance 2.0.

The implementation must not introduce partial mixed-language UI on:

- `/models/seedance-2-0`
- `/fr/modeles/seedance-2-0`
- `/es/modelos/seedance-2-0`

Localized links must use existing route helpers such as localized slug maps, `MODELS_BASE_PATH_MAP`, compare route helpers, pricing slug maps, and examples route helpers.

## Testing And Verification

Focused checks:

- relevant model page architecture tests
- any new decision-template architecture test
- `npm --prefix frontend run lint`
- `npm run lint:exposure`
- `git diff --check`

Route smoke tests:

- `/models/seedance-2-0`
- `/fr/modeles/seedance-2-0`
- `/es/modelos/seedance-2-0`

Browser checks:

- desktop and mobile first viewport matches the light mockup direction
- video card is visible in hero
- feature strip appears directly under hero
- pricing card appears before long technical content
- no text overlap
- no broken hero media
- CTA links resolve
- pricing anchor resolves
- comparison links resolve
- Prompt Lab anchor resolves
- lower sections remain crawlable and usable

SEO checks:

- canonical remains self-referential
- hreflang alternates are preserved
- JSON-LD still renders
- only one H1 exists
- image alt text is concise
- FAQ schema, if present, matches visible FAQ content

## Acceptance Criteria

1. Seedance 2.0 hero uses a two-column light layout.
2. Hero visually matches the MaxVideoAI homepage tone.
3. H1 remains `Seedance 2.0`.
4. Hero subtitle mentions native audio, multi-shot continuity, and reference-guided video.
5. Hero paragraph is short and decision-oriented.
6. Video preview card appears in the hero, not far below.
7. Feature strip appears directly under the hero.
8. Pricing-at-a-glance card appears above the fold or just below the hero.
9. Pricing card uses scenario total prices from the shared pricing helper.
10. Pricing card links to the localized pricing page with `#seedance-2-0-pricing`.
11. Hero links include Compare vs Fast, View pricing, and Prompt examples.
12. Link soup is removed from the hero.
13. Decision cards address Seedance 2.0 vs Fast, Seedance 1.5 vs 2.0, and prompt examples.
14. Seedance 2.0 and Seedance 2.0 Fast maintain distinct search intent.
15. Fast is linked naturally, but Seedance 2.0 remains the production-route page.
16. Examples section remains and is visually cleaner.
17. Prompt Lab is preserved and made more scannable.
18. Specs distinguish MaxVideoAI route specs from provider/model-family notes.
19. Image alt text is concise and not prompt-stuffed.
20. Broken `img src="image"` placeholders are fixed where possible in touched surfaces.
21. Seedance 2.0 metadata matches the specified title and meta description.
22. Existing app generation links still work.
23. Existing examples and compare links still work.
24. Page remains server-rendered and crawlable.
25. No canonical, hreflang, sitemap, or JSON-LD regressions are introduced.

## Implementation Notes

Keep the first implementation incremental:

1. add route-local decision data types and localized Seedance 2.0 data
2. identify the shared pricing helper used by `/pricing` and compute scenario display prices through it
3. add the reusable decision hero, pricing card, and decision cards components
4. wire Seedance 2.0 into `MarketingModelPageLayout.tsx`
5. update Seedance 2.0 metadata through the existing metadata path
6. make targeted examples, Prompt Lab, specs, and alt-text improvements
7. add or update architecture tests to lock the new boundary
8. run focused validation and browser smoke tests

Do not broaden the migration to other models until Seedance 2.0 is visually and technically validated.
