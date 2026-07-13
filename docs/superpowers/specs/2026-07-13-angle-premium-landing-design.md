# Angle premium landing page — design specification

## Scope

Rework the English `/tools/angle` landing page first. The page must explain the product in one glance, use a premium editorial visual system, and demonstrate changing an image viewpoint without relying on a dark dashboard-style hero. French and Spanish remain unchanged in this delivery; the component and content boundaries must keep later localization straightforward.

## Goals

- Make the first screen answer: “What does Angle do, and what can I do with it?”
- Replace the current static dark hero panel with a lightweight, draggable angle demonstration.
- Give every major page section an exclusive visual asset set; no image or generated render is reused in another section.
- Increase topical clarity for English search intent around AI camera-angle changes, product views, storyboards, and ad creative.
- Preserve the public CTA analytics contract and keep the experience performant and accessible.

## Non-goals

- No real generation, upload, authentication, or credit purchase inside the marketing hero.
- No WebGL, 3D model download, or physics engine.
- No French or Spanish visual/content changes in this phase.
- No rewrite of the authenticated `/app/tools/angle` workspace.

## Page composition

### 1. Angle Studio hero

The hero is an ivory, editorial “Angle Studio” stage. Its left column contains an explicit H1, a concise explanation, one primary CTA, and a short trust/support line. Its right column is a large, asymmetric presentation stage rather than a card.

The stage uses a high-quality product render and a CSS/SVG orbit treatment. Pointer or touch drag changes a normalized yaw value between 0° and 360°. The UI updates the active orbit marker, degree label, camera note, and selected image crop/angle preview. Keyboard controls offer previous/next angle actions. Without JavaScript, the stage renders the 45° preview and all explanatory copy.

Motion uses transform and opacity only, has a low-amplitude settle effect, and disables non-essential movement for `prefers-reduced-motion`.

### 2. Immediate proof

Directly after the hero, a before/after proof section shows a front product frame and a three-quarter Angle result. This set is exclusive to the proof section and is not reused in the hero. Captioning makes the action and outcome explicit.

### 3. Three intent sections

Product, storyboard, and ad-creative sections each have a distinct art direction and their own source/output pair. Each section explains the job to be done, the camera change, and the downstream use. The layout rhythm alternates so the page feels authored rather than templated.

### 4. Workspace and pipeline

The workspace section uses an exclusive polished workspace illustration. The pipeline section uses unique lightweight visual tokens rather than recycled thumbnails to explain `Source image → Angle → Image / Video`.

### 5. Closing conversion and FAQ

The final CTA presents a new, separate visual treatment and repeats the primary action. Existing FAQ content remains crawlable and receives English wording updates only where they improve camera-angle search intent.

## Visual system

- **Palette:** warm ivory and paper surfaces, graphite typography, restrained electric-blue interaction accents, and sparse deep-charcoal panels only where contrast is necessary.
- **Typography:** editorial display treatment for headlines; existing product sans-serif for interface labels, descriptions, and controls.
- **Components:** rounded but not bubbly surfaces, thin warm-gray separators, deliberate whitespace, soft focused shadows, clear hover/focus states, and consistent micro-labels.
- **Media:** every asset is assigned an `assetRole` and may be referenced by exactly one page section. Image generation prompts must specify the section role and must not request a prior asset or composition.

## Architecture

- Keep `AngleLandingSections.tsx` as section orchestration only.
- Extract the client-only interaction to a route-local `AngleHeroStudio.client.tsx` and keep static hero copy/SEO in a server-rendered hero section.
- Add a pure `angle-hero-studio.ts` module for the canonical angle stops, labels, and display state so the interaction can be tested without DOM rendering.
- Store English-only hero and section copy under the existing English tool-marketing content boundary. Do not alter French or Spanish messages in this phase.
- Extend `angle-landing-assets.ts` with typed, section-specific asset groups. The type and a contract test must enforce that paths cannot be shared across groups.

## SEO

- Maintain one descriptive H1 focused on changing camera angle with AI.
- Use section H2s for high-intent English concepts: product photography, storyboard coverage, ad creative, and image-to-video preparation.
- Preserve canonical URL, hreflang behavior, metadata, JSON-LD, CTA analytics attributes, and localized route imports.
- Add concise, unique English alt text that names the subject and camera outcome; no keyword-stuffed copy.

## Accessibility and resilience

- The interactive stage has labelled buttons, keyboard control, focus-visible styles, and a meaningful static state.
- Decorative orbit marks are hidden from assistive technology; source and output imagery have useful alt text.
- The page works with JavaScript disabled and at narrow mobile widths.
- All generated assets are optimized static images with explicit dimensions and responsive `sizes`.

## Verification

1. Add a failing architecture contract for the new client boundary, English-first content boundary, and asset-path uniqueness.
2. Add failing unit tests for canonical angle stops and wrap-around/keyboard selection behavior.
3. Implement the smallest code to satisfy those tests, then add interaction tests for pointer and reduced-motion behavior.
4. Run focused tests, the Angle landing architecture test, frontend lint, `git diff --check`, and an English local browser smoke test.
5. Capture full-page before/after screenshots and inspect desktop and mobile layouts.

## Acceptance criteria

- The English hero communicates the product and visible outcome before scrolling.
- The drag interaction is premium, smooth, accessible, and does not use WebGL.
- No visual asset path appears in more than one major page-section asset group.
- English changes leave French and Spanish message content untouched.
- Existing CTA analytics, public SEO routing, and static fallback remain intact.
