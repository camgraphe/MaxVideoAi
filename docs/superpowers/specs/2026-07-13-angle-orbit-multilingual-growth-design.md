# Angle Orbit Atelier — multilingual design and search-growth specification

## Objective

Redesign the complete public Angle landing experience in English, French, and Spanish around a premium “Orbit Atelier” demonstration. The redesign must make the product understandable before the first scroll, broaden the page’s qualified search footprint, and preserve the CTR already earned by the existing URLs.

The experience remains a marketing demonstration. It does not upload a user image or start a paid generation from the hero.

## Search Console baseline

The design is based on the trailing three-month Search Console snapshot reviewed on 13 July 2026:

| Surface | Clicks | Impressions | CTR | Average position |
| --- | ---: | ---: | ---: | ---: |
| `/tools/angle` | 273 | 4,949 | 5.5% | 9.3 |
| `/es/herramientas/angle` | 73 | 1,226 | 6.0% | 7.3 |

Representative English queries include:

| Query | Clicks | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `change camera angle ai` | 11 | 91 | 12.1% | 7.9 |
| `camera angle change ai` | 11 | 81 | 13.6% | 10.9 |
| `video camera angle change ai` | 10 | 155 | 6.5% | 7.2 |

The diagnosis is reach and ranking depth, not a broken search snippet. The redesign must expand relevant, visible content and strengthen internal relevance without sacrificing the existing CTR.

### Measurement hypothesis

- Primary: increase non-brand impressions and move the measured camera-angle query cluster toward the top seven positions over the first six to eight weeks.
- Guardrail: keep page CTR at or above 4.5% while the query footprint broadens.
- Secondary: improve clicks and CTA engagement for product-view, storyboard, ad-creative, and image-to-video intent.
- Do not create new indexable use-case URLs until follow-up GSC data proves a distinct intent can support its own substantial page.

## Locale and URL strategy

Ship the same premium component structure in all three supported locales:

- English: `/tools/angle`
- French: `/fr/outils/angle`
- Spanish: `/es/herramientas/angle`

All new dictionary keys, headings, alt text, metadata, controls, accessibility labels, and questions ship together in `en.json`, `fr.json`, and `es.json`. Translation must preserve natural search language rather than mirror English syntax word for word.

The three pages share the same visual asset library. Within a page, an asset may belong to only one section. Cross-locale reuse is intentional and keeps the same visual proof attached to equivalent localized claims.

## Search intent map

### English

- Primary: change camera angle with AI; AI camera angle generator.
- Supporting: camera angle change AI; multiple angles from one image; product photo angle; storyboard camera angle; video camera angle change; image-to-video first frame.

### French

- Primary: changer l’angle d’une image avec l’IA; générateur d’angles de caméra IA.
- Supporting: modifier la perspective d’une photo; créer plusieurs angles depuis une image; angle produit; cadrage storyboard; première image pour image-to-video.

### Spanish

- Primary: cambiar el ángulo de cámara con IA; generador de ángulos de cámara IA.
- Supporting: cambiar la perspectiva de una imagen; crear varios ángulos desde una foto; vista de producto; encuadre de storyboard; fotograma inicial para image-to-video.

Each page uses one primary phrase in its title, H1, introduction, and one natural supporting passage. Repetition elsewhere uses semantic variations and task language, not exact-match stuffing.

## Information architecture

The page targets 700–1,000 words of useful visible content per locale, excluding navigation and footer.

### 1. Orbit Atelier hero

The hero uses a warm ivory gallery surface, graphite typography, restrained electric-blue interaction cues, and one large photoreal cinema-camera subject. The product occupies approximately 65–75% of the visual stage.

The copy includes one server-rendered H1, a direct explanation, one primary CTA to `/app/tools/angle`, and a short trust line. The right-side stage is open and asymmetric; it is not presented as a dark dashboard card.

The interaction moves between four genuine image states produced from one source:

- front / source,
- three-quarter / 45°,
- profile / 90°,
- slightly elevated three-quarter.

Drag, swipe, previous/next buttons, and arrow keys select discrete real outputs. The interface must never imply a continuous generated 3D model. A live label names the selected camera view. Without JavaScript, the 45° image and all explanatory copy remain visible.

### 2. Immediate proof

A separate source/output pair demonstrates a clear `0° → 45°` camera change. Captions explain what changed and what stayed consistent. This proof uses a different subject from the hero.

### 3. How Angle works

Three steps explain upload, viewpoint controls, and output selection. Rotation, tilt, and zoom are described only to the extent supported by the authenticated tool. This section is fully server rendered and uses small interface illustrations rather than recycled photography.

### 4. Product photography

A dedicated source/output pair demonstrates a commercial product view. Copy covers product pages, campaign hero images, and pre-visualization without claiming perfect geometry preservation.

### 5. Storyboard coverage

A dedicated cinematic source/output pair demonstrates how a changed viewpoint can help compare coverage before locking a shot or first frame.

### 6. Ad creative

A dedicated campaign source/output pair demonstrates a more dimensional composition for an existing offer or subject.

### 7. Video camera angle and image-to-video preparation

A dedicated pair owns the measured `video camera angle change ai` opportunity. The copy explains that Angle creates a stronger still or first frame before image-to-video; it does not claim to change the camera angle inside an existing video.

### 8. Real workspace

A fresh screenshot of the authenticated Angle workspace shows the actual source panel, angle picker, rotation, tilt, zoom, and output review. Callouts are localized and stay outside the screenshot so the same image works across locales.

### 9. Limits, visible questions, and closing CTA

A compact limits block states that results depend on source quality, occlusion, and viewpoint distance. Visible questions answer cost, supported inputs, camera controls, consistency, and image-to-video use.

The closing CTA uses typography, orbit tokens, and CSS surfaces rather than repeating a page image.

## Visual direction

- Palette: warm ivory, paper white, graphite, cool metallic grays, and a measured electric-blue accent.
- Typography: premium editorial display treatment for large headings and the existing product sans-serif for controls and body copy. The implementation must use project-approved fonts and avoid introducing a blocking font dependency.
- Components: thin warm-gray separators, spacious editorial rhythm, controlled corner radii, precise focus states, and shadows that define depth without making every section a card.
- Motion: short transform/opacity transitions, subtle parallax on the active hero image, no looping decorative motion, and full `prefers-reduced-motion` support.
- Mobile: preserve a large product image, simplify the orbit track, expose the previous/next controls, and avoid horizontal overflow.

## Visual production plan

The final library contains 15 section-scoped assets:

| Group | ImageGen sources | Angle outputs | Other | Total |
| --- | ---: | ---: | ---: | ---: |
| Hero cinema camera | 1 | 3 | 0 | 4 |
| Immediate proof | 1 | 1 | 0 | 2 |
| Product photography | 1 | 1 | 0 | 2 |
| Storyboard | 1 | 1 | 0 | 2 |
| Ad creative | 1 | 1 | 0 | 2 |
| Image-to-video preparation | 1 | 1 | 0 | 2 |
| Real workspace | 0 | 0 | 1 screenshot | 1 |
| **Total** | **6** | **8** | **1** | **15** |

### Source generation requirements

- Photorealistic editorial photography, not cheap CGI or generic 3D renders.
- No logos, text, watermarks, UI labels, or impossible materials.
- The subject fills 60–75% of the frame and remains fully legible at landing-card size.
- Each section uses a distinct subject, palette, composition, and lighting setup.
- Hero camera: compact professional cinema camera with credible black anodized aluminum, optical glass, fasteners, and control surfaces on an ivory sculptural plinth.

### Angle output requirements

- Generate every claimed viewpoint with the logged-in MaxVideoAI Angle tool.
- Reject outputs with insufficient viewpoint change, identity drift, broken geometry, text artifacts, or a subject smaller than 45% of the frame.
- Keep a generation log containing source role, engine, rotation, tilt, zoom, output URL, accepted/rejected state, and rejection reason.
- Cropping may improve presentation but cannot turn one group’s image into another section’s asset.

### Asset governance

The asset registry assigns each path to one group. A contract test flattens the registry and fails when a path appears twice. Non-decorative assets receive unique localized alt text; decorative orbit/UI marks use empty alt text or presentation roles.

## SEO implementation

### On-page requirements

- One H1 per locale, aligned with the primary intent.
- Logical H2 sequence matching the information architecture; no skipped heading levels.
- Title length target: 30–60 characters.
- Meta description target: 120–160 characters with a natural locale-specific primary phrase and a clear benefit.
- Three to five useful internal links from the Angle page to Image, image-to-video/model guidance, tools, and examples with descriptive localized anchors.
- Add contextual inbound links to Angle from existing pages that already discuss first-frame preparation, product views, storyboards, or image-to-video. Do not create new thin pages.
- Descriptive image filenames, dimensions, responsive `sizes`, priority only for the active hero image, and lazy loading below the fold.

### Technical SEO

- Preserve the current canonical URLs and reciprocal hreflang output for EN, FR, and ES.
- Preserve index/follow behavior, Open Graph, Twitter cards, localized metadata resolution, sitemap inclusion, and stable route imports.
- Keep BreadcrumbList and service/application structured data with claims matching the visible product.
- Remove HowTo structured data from the Angle page because HowTo rich results are deprecated.
- Keep the visible question section but remove FAQPage structured data because FAQ rich results are restricted and are not appropriate for this SaaS page.
- The hero’s meaningful content and default visual state must be present in server-rendered HTML.

## Component architecture

- `AngleLandingView.tsx` remains the SEO and structured-data owner.
- `AngleLandingSections.tsx` stays a thin sequence orchestrator.
- The hero’s static shell remains server rendered.
- `AngleOrbitStudio.client.tsx` owns only drag, keyboard selection, preload state, and reduced-motion behavior.
- `angle-orbit-state.ts` owns pure view selection and wrap-around logic.
- Section-specific server components own proof, workflow, use cases, workspace, questions, and conversion.
- `angle-landing-assets.ts` exposes the typed exclusive asset registry.
- All presentation copy and accessibility labels remain in the three locale dictionaries.
- Each file stays below the project’s 500-line architecture threshold.

## Performance and resilience

- The default 45° hero image is the only premium asset loaded with priority.
- Remaining hero views preload after initial render or first interaction.
- Below-fold images use lazy loading and responsive sizes.
- Asset warning threshold is 200 KB; anything above 500 KB is rejected.
- The orbit uses transforms and opacity only and adds no WebGL or 3D runtime.
- If an alternate image fails to load, keep the last successful view, disable the failed stop, and preserve labelled navigation.
- Respect reduced motion and retain a useful static state with JavaScript disabled.

## Verification

### Automated

- Pure tests for discrete drag selection, keyboard navigation, wrap-around, failed-stop fallback, and reduced-motion state.
- Architecture tests for server/client boundaries, CTA analytics, file size limits, and unique asset paths.
- Locale parity tests for every new copy, alt, control, metadata, and question key.
- SEO tests for one H1, canonical/hreflang preservation, localized title/description constraints, stable sitemap assumptions, and permitted JSON-LD only.
- Image audit for file type, dimensions, file size, alt coverage, priority, lazy loading, and responsive sizes.

### Browser

- Full-page desktop screenshots before and after.
- Mobile screenshots for the three localized routes.
- Interaction checks for pointer, touch-equivalent drag, keyboard, failed image, reduced motion, and no-JavaScript fallback.
- Smoke checks for CTA destinations, analytics attributes, internal links, canonical, hreflang, and structured data.

## Rollout

1. Record the GSC baseline above in launch evidence.
2. Ship EN, FR, and ES together so hreflang siblings stay structurally equivalent.
3. Request indexing only for the existing three canonical URLs; do not create variants.
4. Review GSC after two weeks for coverage/canonical anomalies, then at four to six weeks for queries, impressions, clicks, CTR, and average position.
5. Iterate titles or internal links only from observed data; do not rewrite the whole page before the first meaningful post-launch window.

## Acceptance criteria

- The product is understandable from the first viewport in all three locales.
- The hero uses four genuine photoreal Angle views and never presents itself as a generated 3D model.
- The complete page meets the premium visual direction at desktop and mobile widths.
- Every section uses its assigned visual assets and no path is reused within the page.
- All three locale dictionaries and routes ship together with matching structure and natural localized copy.
- Existing canonical URLs, hreflang, indexability, CTA destinations, and analytics remain intact.
- Deprecated/restricted HowTo and FAQ structured data are absent from the Angle page while visible workflow and question content remain.
- Focused tests, lint, SEO checks, image audit, and browser smoke tests pass before completion.
