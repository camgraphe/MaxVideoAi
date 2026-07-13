# Angle Orbit Atelier Multilingual Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complete Angle marketing landing experience with a premium, accessible Orbit Atelier in English, French, and Spanish, backed by genuine ImageGen sources, Angle outputs, and GSC-informed search content.

**Architecture:** Keep `AngleLandingView.tsx` as the Server Component that owns canonical structured data and compose the visible page from three focused server section modules. Isolate drag, keyboard, image preload, and failed-image fallback in one client island backed by pure orbit-state functions. Share one typed, section-exclusive asset registry across all three locale dictionaries.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript 5.4, next-intl dictionaries, Tailwind CSS 3, CSS Modules, `next/image`, Node test runner through `tsx`, ImageGen, MaxVideoAI Angle, Chrome browser verification.

## Global Constraints

- Ship English, French, and Spanish together on `/tools/angle`, `/fr/outils/angle`, and `/es/herramientas/angle`.
- Preserve canonical URLs, reciprocal hreflang, index/follow behavior, sitemap inclusion, Open Graph/Twitter metadata, CTA destinations, and `tool_cta_click` analytics attributes.
- Keep BreadcrumbList and service/application structured data; remove HowTo and FAQPage structured data from this SaaS landing page while preserving visible workflow and question content.
- Use no WebGL, Three.js, 3D model, looping decorative animation, upload, credit charge, or generation request inside the public hero.
- Hero navigation moves between four genuine image states: source/front, 45° three-quarter, 90° profile, and slightly elevated three-quarter.
- Use one asset path in one page section only. The same section-scoped asset may be shared across locale siblings.
- Produce exactly 15 final visual assets: six ImageGen sources, eight genuine Angle outputs, and one fresh real workspace screenshot.
- Warn above 200 KB and reject above 500 KB per image; below-fold imagery is lazy and only the default 45° hero image receives priority.
- Keep every Angle landing TypeScript/TSX file below 500 lines and preserve current route imports.
- Preserve unrelated dirty worktree files.

---

## File map

- Modify: `frontend/messages/en.json` — English metadata, hero orbit labels, video-prep section, limits, and localized image alt text.
- Modify: `frontend/messages/fr.json` — French equivalents with identical key shape.
- Modify: `frontend/messages/es.json` — Spanish equivalents with identical key shape.
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingView.tsx` — retain Breadcrumb/Service JSON-LD and remove restricted/deprecated schema output.
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingSections.tsx` — become a thin page-sequence orchestrator.
- Create: `frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx` — breadcrumb, Orbit hero, proof, and workflow.
- Create: `frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx` — product, storyboard, ad, and video-prep sections.
- Create: `frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx` — workspace, benefits/limits, internal links, visible questions, and final CTA.
- Create: `frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx` — client-only interaction.
- Create: `frontend/src/components/tools/angle/landing/angle-orbit-state.ts` — pure view selection and fallback behavior.
- Create: `frontend/src/components/tools/angle/landing/AngleLanding.module.css` — scoped premium visual system and motion rules.
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingPrimitives.tsx` — retain only reusable visual primitives used by the new section modules.
- Modify: `frontend/src/components/tools/angle/landing/angle-landing-assets.ts` — expose the typed 15-asset registry.
- Delete: `frontend/src/components/tools/angle/landing/AngleLandingIntentExamplesSection.tsx` — replaced by focused use-case sections.
- Create: `frontend/public/assets/tools/angle-orbit-*.webp` — 15 optimized assets.
- Create: `docs/seo/angle-orbit-visual-generation-log.md` — source, Angle settings, accepted output, and rejection evidence.
- Create: `docs/seo/angle-orbit-launch-baseline-2026-07-13.md` — GSC baseline and post-launch checklist.
- Modify: `tests/tool-marketing-landing-architecture.test.ts` — architecture, schemas, locale shape, CTA, and file-size contracts.
- Create: `tests/angle-orbit-state.test.ts` — pure interaction behavior.
- Create: `tests/angle-orbit-assets.test.ts` — unique paths, file existence, format, dimensions, and size budgets.

## Task 1: Capture the baseline and lock the multilingual SEO contract

**Files:**
- Create: `docs/seo/angle-orbit-launch-baseline-2026-07-13.md`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingView.tsx`

**Interfaces:**
- Consumes: current GSC evidence, `content.meta`, `buildToolBreadcrumbJsonLd`, and `buildMarketingServiceJsonLd`.
- Produces: an Angle view that renders Breadcrumb/Service JSON-LD only and a committed measurement baseline.

- [ ] **Step 1: Capture the current full-page baseline before production changes**

Start the existing app with `npm --prefix frontend run dev`, open `http://localhost:3000/tools/angle`, and save a full-page desktop screenshot to `/tmp/maxvideoai-angle-before-orbit.png`. Record its path in the baseline document.

- [ ] **Step 2: Write the baseline document**

Create the file with this exact metric table and monitoring fields:

```md
# Angle Orbit launch baseline — 2026-07-13

Source: Google Search Console, Web search, trailing three months reviewed 2026-07-13.

| Surface | Clicks | Impressions | CTR | Average position |
| --- | ---: | ---: | ---: | ---: |
| `/tools/angle` | 273 | 4,949 | 5.5% | 9.3 |
| `/es/herramientas/angle` | 73 | 1,226 | 6.0% | 7.3 |

| Query | Clicks | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `change camera angle ai` | 11 | 91 | 12.1% | 7.9 |
| `camera angle change ai` | 11 | 81 | 13.6% | 10.9 |
| `video camera angle change ai` | 10 | 155 | 6.5% | 7.2 |

Guardrail: CTR >= 4.5% while query reach expands.
Primary review: non-brand impressions and camera-angle query positions at 4–6 weeks.
Baseline screenshot: `/tmp/maxvideoai-angle-before-orbit.png`.
```

- [ ] **Step 3: Write the failing structured-data and locale contract**

Add these assertions to `tests/tool-marketing-landing-architecture.test.ts`:

```ts
test('Angle keeps permitted SEO orchestration and drops restricted rich-result schemas', () => {
  assert.match(angleViewSource, /buildToolBreadcrumbJsonLd/);
  assert.match(angleViewSource, /buildMarketingServiceJsonLd/);
  assert.doesNotMatch(angleViewSource, /FAQSchema|buildToolHowToJsonLd|howToJsonLd/);
});

test('Angle premium content ships with matching keys in all three locales', () => {
  const dictionaries = [englishMessagesPath, frenchMessagesPath, spanishMessagesPath].map((path) =>
    JSON.parse(readFileSync(path, 'utf8')).toolMarketing.angle,
  );
  const keys = (value: unknown): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...keys(child).map((nested) => `${key}.${nested}`)]);
  };
  assert.deepEqual(keys(dictionaries[1]), keys(dictionaries[0]));
  assert.deepEqual(keys(dictionaries[2]), keys(dictionaries[0]));
});
```

In the existing `tool marketing landing views own SEO orchestration and delegate sections` test, keep the Breadcrumb assertion for all three tool views, but move the `FAQSchema` and `buildToolHowToJsonLd` assertions to Character Builder and Background Removal only. Angle must satisfy the new negative assertions above.

- [ ] **Step 4: Run the focused contract and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because `AngleLandingView.tsx` still imports `FAQSchema` and builds HowTo JSON-LD.

- [ ] **Step 5: Remove only the restricted/deprecated Angle schemas**

Keep `canonicalUrl`, Breadcrumb JSON-LD, and Service JSON-LD. Remove the `FAQSchema` import/render, `buildToolHowToJsonLd` import/call, and HowTo script. The resulting visible/SEO ownership stays:

```tsx
export function AngleLandingView({ content }: { content: AngleLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/angle';
  const breadcrumbJsonLd = buildToolBreadcrumbJsonLd({ breadcrumb: content.breadcrumb, canonicalUrl });
  const serviceJsonLd = buildMarketingServiceJsonLd({
    name: content.meta.schemaName,
    description: content.meta.schemaDescription,
    serviceType: content.meta.schemaName,
    category: content.meta.schemaFeatures[0],
    url: canonicalUrl,
  });

  return (
    <div className="angle-page">
      <AngleLandingSections content={content} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
    </div>
  );
}
```

- [ ] **Step 6: Run the contract and verify GREEN**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: PASS for permitted structured data and locale parity.

- [ ] **Step 7: Commit the SEO boundary**

```bash
git add docs/seo/angle-orbit-launch-baseline-2026-07-13.md frontend/src/components/tools/angle/landing/AngleLandingView.tsx tests/tool-marketing-landing-architecture.test.ts
git commit -m "fix: align angle structured data with search guidance"
```

## Task 2: Add the localized Orbit and video-prep content model

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Produces: `content.hero.orbit`, `content.videoPrep`, and localized SEO metadata with identical dictionary shape.
- Consumed by: lead/use-case components and `AngleOrbitStudio.client.tsx`.

- [ ] **Step 1: Write the failing copy and metadata test**

```ts
test('Angle metadata and Orbit labels are complete in every locale', () => {
  for (const messagePath of [englishMessagesPath, frenchMessagesPath, spanishMessagesPath]) {
    const angle = JSON.parse(readFileSync(messagePath, 'utf8')).toolMarketing.angle;
    assert.ok(angle.meta.title.length >= 30 && angle.meta.title.length <= 60, `${messagePath} title length`);
    assert.ok(angle.meta.description.length >= 120 && angle.meta.description.length <= 160, `${messagePath} description length`);
    assert.equal(angle.hero.orbit.views.length, 4);
    assert.ok(angle.hero.orbit.dragLabel && angle.hero.orbit.previousLabel && angle.hero.orbit.nextLabel && angle.hero.orbit.livePrefix);
    assert.ok(angle.videoPrep.title && angle.videoPrep.body && angle.videoPrep.sourceAlt && angle.videoPrep.outputAlt);
  }
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because `hero.orbit` and `videoPrep` do not exist.

- [ ] **Step 3: Update exact localized metadata and hero copy**

Use these exact title/description/H1 values:

```json
// en.json
"title": "AI Camera Angle Generator | New Views from One Image",
"description": "Change a camera angle with AI from one image. Create product views, storyboard coverage, ad perspectives, and stronger image-to-video first frames.",
"hero.title": "Change Camera Angle with AI from One Image"

// fr.json
"title": "Changer l’angle d’une image avec l’IA | MaxVideoAI",
"description": "Changez l’angle de caméra d’une image avec l’IA. Créez des vues produit, des cadrages storyboard et de meilleures premières images vidéo.",
"hero.title": "Changez l’angle de caméra d’une image avec l’IA"

// es.json
"title": "Cambiar el ángulo de una imagen con IA | MaxVideoAI",
"description": "Cambia el ángulo de cámara de una imagen con IA. Crea vistas de producto, encuadres de storyboard y mejores fotogramas para image-to-video.",
"hero.title": "Cambia el ángulo de cámara de una imagen con IA"
```

Retain existing keyword arrays and schema claims that remain visible on the page.

- [ ] **Step 4: Add the exact `hero.orbit` objects**

Add this shape beneath the existing hero support text in all three files:

```json
// English
"orbit": {
  "dragLabel": "Drag to explore real camera angles",
  "previousLabel": "Show previous camera angle",
  "nextLabel": "Show next camera angle",
  "livePrefix": "Selected camera view",
  "fallbackNote": "Four generated views from one source image",
  "views": [
    { "id": "front", "label": "Front view", "degreeLabel": "Source · 0°", "alt": "Front view of a compact cinema camera on an ivory studio plinth." },
    { "id": "threeQuarter", "label": "Three-quarter view", "degreeLabel": "Rotation · 45°", "alt": "Three-quarter camera angle generated from the same compact cinema camera image." },
    { "id": "profile", "label": "Profile view", "degreeLabel": "Rotation · 90°", "alt": "Profile camera angle generated from the same compact cinema camera image." },
    { "id": "elevated", "label": "Elevated view", "degreeLabel": "Elevated three-quarter", "alt": "Elevated three-quarter camera angle generated from the same compact cinema camera image." }
  ]
}
```

French labels: `Faites glisser pour explorer de vrais angles de caméra`, `Afficher l’angle précédent`, `Afficher l’angle suivant`, `Vue caméra sélectionnée`, `Quatre vues générées depuis une seule image`, and view labels `Vue de face`, `Vue trois-quarts`, `Vue de profil`, `Vue surélevée`.

Spanish labels: `Arrastra para explorar ángulos de cámara reales`, `Mostrar el ángulo anterior`, `Mostrar el ángulo siguiente`, `Vista de cámara seleccionada`, `Cuatro vistas generadas desde una sola imagen`, and view labels `Vista frontal`, `Vista de tres cuartos`, `Vista de perfil`, `Vista elevada`.

Translate the four alt strings naturally while preserving the compact cinema camera subject and the stated viewpoint.

- [ ] **Step 5: Add the exact `videoPrep` section**

```json
// English
"videoPrep": {
  "eyebrow": "Image-to-video preparation",
  "title": "Choose the video camera angle before motion starts",
  "body": "Angle changes the viewpoint of a still image. Use the selected result as a stronger first frame before you open an image-to-video workflow.",
  "sourceLabel": "Original first frame",
  "outputLabel": "Selected video angle",
  "sourceAlt": "Original cinematic first frame before changing the camera viewpoint.",
  "outputAlt": "Alternate camera viewpoint prepared as an image-to-video first frame."
}
```

French title/body: `Choisissez l’angle de caméra avant de lancer le mouvement` and `Angle modifie le point de vue d’une image fixe. Utilisez le résultat retenu comme première image avant d’ouvrir un workflow image-to-video.`

Spanish title/body: `Elige el ángulo de cámara antes de iniciar el movimiento` and `Angle cambia el punto de vista de una imagen fija. Usa el resultado elegido como primer fotograma antes de abrir un flujo image-to-video.`

Add natural localized eyebrow, labels, and alt strings with the same meaning and key shape.

- [ ] **Step 6: Run locale validation and focused tests**

Run: `npm --prefix frontend run i18n:check && npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: PASS with identical keys and four Orbit views in every locale.

- [ ] **Step 7: Commit localized content**

```bash
git add frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: localize angle orbit search content"
```

## Task 3: Build the pure Orbit state model test-first

**Files:**
- Create: `tests/angle-orbit-state.test.ts`
- Create: `frontend/src/components/tools/angle/landing/angle-orbit-state.ts`

**Interfaces:**
- Produces: `ANGLE_ORBIT_VIEW_IDS`, `advanceOrbitView`, `selectOrbitViewFromDrag`, and `resolveAvailableOrbitView`.
- Consumed by: `AngleOrbitStudio.client.tsx`.

- [ ] **Step 1: Write the failing state tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANGLE_ORBIT_VIEW_IDS,
  advanceOrbitView,
  resolveAvailableOrbitView,
  selectOrbitViewFromDrag,
} from '../frontend/src/components/tools/angle/landing/angle-orbit-state';

test('Orbit exposes four genuine discrete views', () => {
  assert.deepEqual(ANGLE_ORBIT_VIEW_IDS, ['front', 'threeQuarter', 'profile', 'elevated']);
});

test('Orbit keyboard navigation wraps in both directions', () => {
  assert.equal(advanceOrbitView('elevated', 'next'), 'front');
  assert.equal(advanceOrbitView('front', 'previous'), 'elevated');
});

test('Orbit drag changes one stop per 64 pixels', () => {
  assert.equal(selectOrbitViewFromDrag('threeQuarter', 70), 'profile');
  assert.equal(selectOrbitViewFromDrag('threeQuarter', -70), 'front');
  assert.equal(selectOrbitViewFromDrag('threeQuarter', 20), 'threeQuarter');
});

test('Orbit falls back to the nearest successful view after an image error', () => {
  assert.equal(resolveAvailableOrbitView('profile', new Set(['profile'])), 'threeQuarter');
  assert.equal(resolveAvailableOrbitView('front', new Set(['front', 'threeQuarter'])), 'elevated');
});
```

- [ ] **Step 2: Run the state tests and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-state.test.ts`

Expected: FAIL because `angle-orbit-state.ts` does not exist.

- [ ] **Step 3: Implement the pure state module**

```ts
export const ANGLE_ORBIT_VIEW_IDS = ['front', 'threeQuarter', 'profile', 'elevated'] as const;
export type AngleOrbitViewId = (typeof ANGLE_ORBIT_VIEW_IDS)[number];

export function advanceOrbitView(current: AngleOrbitViewId, direction: 'next' | 'previous'): AngleOrbitViewId {
  const index = ANGLE_ORBIT_VIEW_IDS.indexOf(current);
  const offset = direction === 'next' ? 1 : -1;
  return ANGLE_ORBIT_VIEW_IDS[(index + offset + ANGLE_ORBIT_VIEW_IDS.length) % ANGLE_ORBIT_VIEW_IDS.length];
}

export function selectOrbitViewFromDrag(start: AngleOrbitViewId, deltaX: number, threshold = 64): AngleOrbitViewId {
  if (Math.abs(deltaX) < threshold) return start;
  return advanceOrbitView(start, deltaX > 0 ? 'next' : 'previous');
}

export function resolveAvailableOrbitView(target: AngleOrbitViewId, failed: ReadonlySet<AngleOrbitViewId>): AngleOrbitViewId {
  if (!failed.has(target)) return target;
  let candidate = target;
  for (let step = 0; step < ANGLE_ORBIT_VIEW_IDS.length; step += 1) {
    candidate = advanceOrbitView(candidate, 'previous');
    if (!failed.has(candidate)) return candidate;
  }
  return 'threeQuarter';
}
```

- [ ] **Step 4: Run state tests and verify GREEN**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-state.test.ts`

Expected: PASS with four tests.

- [ ] **Step 5: Commit the state model**

```bash
git add tests/angle-orbit-state.test.ts frontend/src/components/tools/angle/landing/angle-orbit-state.ts
git commit -m "feat: add discrete angle orbit state"
```

## Task 4: Produce, audit, and register the 15 exclusive visuals

**Files:**
- Create: `frontend/public/assets/tools/angle-orbit-hero-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-hero-45.webp`
- Create: `frontend/public/assets/tools/angle-orbit-hero-90.webp`
- Create: `frontend/public/assets/tools/angle-orbit-hero-elevated.webp`
- Create: `frontend/public/assets/tools/angle-orbit-proof-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-proof-45.webp`
- Create: `frontend/public/assets/tools/angle-orbit-product-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-product-45.webp`
- Create: `frontend/public/assets/tools/angle-orbit-story-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-story-elevated.webp`
- Create: `frontend/public/assets/tools/angle-orbit-ad-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-ad-45.webp`
- Create: `frontend/public/assets/tools/angle-orbit-video-source.webp`
- Create: `frontend/public/assets/tools/angle-orbit-video-45.webp`
- Create: `frontend/public/assets/tools/angle-orbit-workspace.webp`
- Create: `docs/seo/angle-orbit-visual-generation-log.md`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx`
- Modify: `frontend/src/components/tools/angle/landing/angle-landing-assets.ts`
- Create: `tests/angle-orbit-assets.test.ts`

**Interfaces:**
- Produces: `ANGLE_ORBIT_ASSETS`, typed by section and view ID.
- Consumed by: all new landing sections and `AngleOrbitStudio.client.tsx`.

- [ ] **Step 1: Write the failing registry and file audit**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ANGLE_ORBIT_ASSETS } from '../frontend/src/components/tools/angle/landing/angle-landing-assets';

const root = process.cwd();
const flatten = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : Object.values(value as Record<string, unknown>).flatMap(flatten);

test('Angle Orbit owns exactly fifteen unique WebP assets', () => {
  const paths = flatten(ANGLE_ORBIT_ASSETS);
  assert.equal(paths.length, 15);
  assert.equal(new Set(paths).size, 15);
  for (const assetPath of paths) {
    assert.match(assetPath, /^\/assets\/tools\/angle-orbit-.+\.webp$/);
    const filePath = join(root, 'frontend/public', assetPath);
    assert.ok(existsSync(filePath), `${assetPath} should exist`);
    assert.ok(readFileSync(filePath).byteLength <= 500_000, `${assetPath} must stay below 500 KB`);
  }
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts`

Expected: FAIL because the registry and files do not exist.

- [ ] **Step 3: Generate six photoreal ImageGen sources**

Use these prompts as the section-specific base; append `landscape 4:3, no logo, no text, no watermark, subject occupies 65–75% of the frame, premium photoreal editorial photography, physically credible materials`:

```text
Hero: compact professional cinema camera in black anodized aluminum with realistic optical glass, fasteners and tactile controls, centered on a sculptural ivory plinth, warm museum-gallery light.
Proof: burnt-orange portable wireless speaker with woven fabric and machined metal controls, straight-on catalog camera, pale limestone studio.
Product: cobalt and off-white technical running shoe on a transparent low stand, straight-on commerce view, warm gray seamless studio.
Storyboard: solitary actor in a rust coat standing at the edge of a windswept coastal road, eye-level cinematic frame, overcast natural light.
Ad: faceted clear fragrance bottle with a deep red glass cap, straight-on campaign frame, saturated burgundy and cream set.
Video prep: dancer in a tailored yellow coat at an empty modern railway platform, eye-level cinematic first frame, cool morning light.
```

Save the accepted raw outputs outside `frontend/public` until their Angle derivatives are accepted.

- [ ] **Step 4: Produce eight genuine Angle outputs**

Use the logged-in Angle tool with these settings and record engine, actual rotation, tilt, zoom, URL, and result status:

```text
Hero 45: rotation 45°, tilt 3°, close complete crop.
Hero 90: rotation 90°, tilt 2°, close complete crop.
Hero elevated: rotation 45°, tilt 18°, close complete crop.
Proof: rotation 45°, tilt 3°.
Product: rotation 45°, tilt 3°.
Storyboard: rotation 35°, tilt 15°.
Ad: rotation 45°, tilt 2°.
Video prep: rotation 35°, tilt 5°.
```

Reject any result with a weak viewpoint change, identity drift, broken geometry, text artifact, or subject below 45% of frame. A retry receives a new row in the generation log rather than overwriting rejection evidence.

- [ ] **Step 5: Capture the real workspace screenshot**

Open `/app/tools/angle` with the accepted hero source loaded and the 45° result visible. Capture only the authenticated workspace content at 16:9 without account menus, email, wallet balance, or unrelated browser chrome.

- [ ] **Step 6: Convert accepted files to WebP and enforce dimensions**

Use the installed `sharp` package from the frontend runtime. Convert 4:3 assets to `1600 × 1200`, the workspace to `1600 × 900`, and quality `82`. Run `npm --prefix frontend run audit:images` and manually reject any image above 500 KB; target below 200 KB.

- [ ] **Step 7: Add the typed registry**

```ts
export const ANGLE_ORBIT_ASSETS = {
  hero: {
    front: '/assets/tools/angle-orbit-hero-source.webp',
    threeQuarter: '/assets/tools/angle-orbit-hero-45.webp',
    profile: '/assets/tools/angle-orbit-hero-90.webp',
    elevated: '/assets/tools/angle-orbit-hero-elevated.webp',
  },
  proof: {
    source: '/assets/tools/angle-orbit-proof-source.webp',
    output: '/assets/tools/angle-orbit-proof-45.webp',
  },
  product: {
    source: '/assets/tools/angle-orbit-product-source.webp',
    output: '/assets/tools/angle-orbit-product-45.webp',
  },
  storyboard: {
    source: '/assets/tools/angle-orbit-story-source.webp',
    output: '/assets/tools/angle-orbit-story-elevated.webp',
  },
  adCreative: {
    source: '/assets/tools/angle-orbit-ad-source.webp',
    output: '/assets/tools/angle-orbit-ad-45.webp',
  },
  videoPrep: {
    source: '/assets/tools/angle-orbit-video-source.webp',
    output: '/assets/tools/angle-orbit-video-45.webp',
  },
  workspace: '/assets/tools/angle-orbit-workspace.webp',
} as const;
```

Update the Angle route metadata image to `https://maxvideoai.com/assets/tools/angle-orbit-hero-45.webp` so Open Graph and Twitter cards use the accepted default hero view in every locale.

- [ ] **Step 8: Run the asset audit and verify GREEN**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts && npm --prefix frontend run audit:images`

Expected: 15 unique existing WebP paths, no file above 500 KB, and no critical image audit issue.

- [ ] **Step 9: Commit the visual library**

```bash
git add frontend/public/assets/tools/angle-orbit-*.webp 'frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx' frontend/src/components/tools/angle/landing/angle-landing-assets.ts tests/angle-orbit-assets.test.ts docs/seo/angle-orbit-visual-generation-log.md
git commit -m "feat: add genuine angle orbit visual library"
```

## Task 5: Implement the accessible Orbit hero

**Files:**
- Create: `frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx`
- Create: `frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx`
- Create: `frontend/src/components/tools/angle/landing/AngleLanding.module.css`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Consumes: `ANGLE_ORBIT_ASSETS.hero`, `AngleLandingContent['hero']['orbit']`, and the pure orbit-state functions.
- Produces: `AngleLandingHeroSection` and `AngleLandingProofWorkflowSections` server components with one client island.

- [ ] **Step 1: Write the failing hero-boundary contract**

```ts
test('Angle Orbit keeps static hero copy server-side and browser logic in one client island', () => {
  const leadPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx');
  const orbitPath = join(root, 'frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx');
  const lead = readFileSync(leadPath, 'utf8');
  const orbit = readFileSync(orbitPath, 'utf8');
  assert.match(lead, /export function AngleLandingHeroSection/);
  assert.match(lead, /<h1/);
  assert.match(lead, /data-analytics-cta-name="angle_try_tool_hero"/);
  assert.match(orbit, /^'use client';/);
  assert.match(orbit, /onPointerDown|onPointerMove|onPointerUp/);
  assert.match(orbit, /onKeyDown/);
  assert.match(orbit, /prefers-reduced-motion/);
  assert.doesNotMatch(orbit, /three|WebGL|canvas/i);
});
```

- [ ] **Step 2: Run the architecture test and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because the lead and Orbit files do not exist.

- [ ] **Step 3: Implement the Orbit client interaction**

Use initial view `threeQuarter`. Keep pointer start in a ref, call `setPointerCapture`, select one discrete view after the 64 px threshold, and commit the view on pointer up. ArrowLeft/ArrowRight call `advanceOrbitView`. Failed image IDs enter a `Set`, then `resolveAvailableOrbitView` picks the nearest successful view.

The rendered image contract is:

```tsx
<Image
  key={activeView}
  src={ANGLE_ORBIT_ASSETS.hero[activeView]}
  alt={viewContent.alt}
  fill
  priority={activeView === 'threeQuarter'}
  sizes="(max-width: 1024px) 100vw, 58vw"
  onError={() => markFailed(activeView)}
  className={reducedMotion ? styles.orbitImageReduced : styles.orbitImage}
/>
```

After mount, preload non-active hero paths with `window.requestIdleCallback` when available and `window.setTimeout` otherwise. Clean up the scheduled work on unmount. Render `aria-live="polite"` text as `${content.livePrefix}: ${viewContent.label}` and labelled previous/next buttons.

- [ ] **Step 4: Implement the server-rendered hero shell**

`AngleLandingHeroSection` owns breadcrumb, eyebrow, H1, body, CTA, support line, and the `AngleOrbitStudio` island. Use a single H1 and preserve all current CTA analytics attributes and `/app/tools/angle` destination.

`AngleLandingProofWorkflowSections` renders the exclusive proof pair and the existing three workflow steps. The proof uses `ANGLE_ORBIT_ASSETS.proof`; the workflow uses CSS/SVG interface marks and no photography.

- [ ] **Step 5: Implement scoped premium styles**

In `AngleLanding.module.css`, define only `.page`, `.hero`, `.heroStage`, `.orbitTrack`, `.orbitImage`, `.orbitImageReduced`, `.orbitControls`, `.proofGrid`, `.sectionRule`, and responsive variants. Use warm ivory/paper surfaces, graphite type, electric-blue focus rings, transforms/opacity only, and this reduced-motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  .orbitImage,
  .heroStage {
    animation: none;
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 6: Run focused tests and lint**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-state.test.ts tests/tool-marketing-landing-architecture.test.ts && npm --prefix frontend run lint`

Expected: all focused tests pass; lint has no new errors or warnings.

- [ ] **Step 7: Commit the Orbit hero**

```bash
git add frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx frontend/src/components/tools/angle/landing/AngleLanding.module.css tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: build premium angle orbit hero"
```

## Task 6: Recompose every page section at premium quality

**Files:**
- Create: `frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx`
- Create: `frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx`
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingSections.tsx`
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingPrimitives.tsx`
- Modify: `frontend/src/components/tools/angle/landing/AngleLanding.module.css`
- Delete: `frontend/src/components/tools/angle/landing/AngleLandingIntentExamplesSection.tsx`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Consumes: existing localized sections plus `ANGLE_ORBIT_ASSETS` and `content.videoPrep`.
- Produces: four use-case sections, real workspace, limits/benefits, localized links, visible questions, and CSS-only final CTA.

- [ ] **Step 1: Write the failing section architecture contract**

Replace the existing `angleIntentExamplesSectionPath` constant with `angleUseCaseSectionsPath`, point it to `AngleLandingUseCaseSections.tsx`, add the new lead/conversion files to `landingFiles`, and remove the deleted intent-example file from that list. Replace the old practical-examples test with the focused composition test below.

```ts
test('Angle landing composes focused premium section owners without repeated image modules', () => {
  const lead = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx'), 'utf8');
  const useCases = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx'), 'utf8');
  const conversion = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx'), 'utf8');
  assert.match(angleSectionsSource, /AngleLandingHeroSection/);
  assert.match(angleSectionsSource, /AngleLandingUseCaseSections/);
  assert.match(angleSectionsSource, /AngleLandingConversionSections/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.product/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.storyboard/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.adCreative/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.videoPrep/);
  assert.match(conversion, /ANGLE_ORBIT_ASSETS\.workspace/);
  assert.doesNotMatch(conversion, /ANGLE_ORBIT_ASSETS\.(hero|proof|product|storyboard|adCreative|videoPrep)/);
  for (const source of [lead, useCases, conversion, angleSectionsSource]) {
    assert.ok(source.split('\n').length <= 500);
  }
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because use-case and conversion section modules do not exist.

- [ ] **Step 3: Build the four alternating use-case rows**

In `AngleLandingUseCaseSections.tsx`, export one `AngleLandingUseCaseSections({ content })` component. Render product, storyboard, ad creative, and video-prep in that order. Each row contains one localized eyebrow, H2, body, source/output labels, its exclusive pair, and one downstream text link. Alternate media alignment by index without changing DOM heading order.

Use only these mappings:

```ts
const useCases = [
  { content: content.intentExamples.items[0], assets: ANGLE_ORBIT_ASSETS.product, href: '/app/image' },
  { content: content.useCases.story, assets: ANGLE_ORBIT_ASSETS.storyboard, href: '/app/tools/storyboard' },
  { content: content.intentExamples.items[2], assets: ANGLE_ORBIT_ASSETS.adCreative, href: '/examples' },
  { content: content.videoPrep, assets: ANGLE_ORBIT_ASSETS.videoPrep, href: '/ai-video-engines' },
] as const;
```

Every source/output `Image` uses `fill`, below-fold lazy loading, `sizes="(max-width: 1024px) 100vw, 48vw"`, and the matching localized alt string.

- [ ] **Step 4: Build conversion and trust sections**

In `AngleLandingConversionSections.tsx`:

- Render the real workspace screenshot once with `ANGLE_ORBIT_ASSETS.workspace`, localized alt, and external text callouts.
- Render existing benefits as a restrained border-separated list, not four repeated cards.
- Render a limits paragraph before questions using localized FAQ answers about source quality, consistency, and supported use.
- Render visible `<details>` questions without JSON-LD.
- Render related internal links with descriptive localized anchors.
- Render the final CTA with typography, orbit dots, and CSS only; preserve `angle_try_tool_final` analytics and do not render a page image.

- [ ] **Step 5: Replace the legacy orchestrator**

Make `AngleLandingSections.tsx` only compose:

```tsx
export function AngleLandingSections({ content }: { content: AngleLandingContent }) {
  return (
    <main className={styles.page}>
      <AngleLandingHeroSection content={content} />
      <AngleLandingProofWorkflowSections content={content} />
      <AngleLandingUseCaseSections content={content} />
      <AngleLandingConversionSections content={content} />
    </main>
  );
}
```

Remove now-unused legacy primitives and delete `AngleLandingIntentExamplesSection.tsx`. Do not remove shared primitives still imported by another Angle section.

- [ ] **Step 6: Finish page-level rhythm and responsive polish**

Extend the CSS Module with distinct section spacing, alternating editorial grids, warm separators, workspace framing, mobile stacking, long French/Spanish label handling, focus-visible states, and no horizontal overflow at 320 px.

- [ ] **Step 7: Run tests, locale checks, and lint**

Run: `npm --prefix frontend run i18n:check && npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts tests/angle-orbit-state.test.ts tests/angle-orbit-assets.test.ts && npm --prefix frontend run lint && git diff --check`

Expected: all tests pass, locale keys match, no new lint issue, and no whitespace error.

- [ ] **Step 8: Commit the full page composition**

```bash
git add frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx frontend/src/components/tools/angle/landing/AngleLandingSections.tsx frontend/src/components/tools/angle/landing/AngleLandingPrimitives.tsx frontend/src/components/tools/angle/landing/AngleLanding.module.css frontend/src/components/tools/angle/landing/AngleLandingIntentExamplesSection.tsx tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: redesign angle landing sections"
```

## Task 7: Strengthen internal linking without creating new URLs

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts`
- Test: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Consumes: existing `/tools/angle` links and localized anchor maps.
- Produces: descriptive inbound anchors from existing relevant surfaces; no new route.

- [ ] **Step 1: Write the failing inbound-link contract**

```ts
test('existing marketing surfaces link to Angle with descriptive localized intent', () => {
  const hub = readFileSync(join(root, 'frontend/src/components/tools/ToolsMarketingHubPage.tsx'), 'utf8');
  const prepLinks = readFileSync(join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts'), 'utf8');
  assert.match(hub, /\/tools\/angle/);
  assert.match(prepLinks, /Change the camera angle before video/);
  assert.match(prepLinks, /Changer l’angle de caméra avant la vidéo/);
  assert.match(prepLinks, /Cambiar el ángulo de cámara antes del video/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because the current model prep anchors say only “change the viewpoint”.

- [ ] **Step 3: Update only existing relevant anchors**

Replace the existing English/French/Spanish Angle prep labels with the exact phrases asserted above. Keep the href `/tools/angle`, surrounding model logic, and link count unchanged. The existing Tools Marketing Hub, pricing data, and blog preparation links already provide additional inbound paths; verify them without modifying their structure.

- [ ] **Step 4: Run the contract and verify GREEN**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: PASS with descriptive anchors in all three locales.

- [ ] **Step 5: Commit internal-link changes**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts' tests/tool-marketing-landing-architecture.test.ts
git commit -m "seo: strengthen localized angle links"
```

## Task 8: Verify SEO, performance, accessibility, and all three locales

**Files:**
- Modify only when a failing regression test is added first.

**Interfaces:**
- Consumes: complete Orbit landing implementation.
- Produces: browser evidence, final screenshots, and a clean focused test suite.

- [ ] **Step 1: Run the complete automated verification set**

Run:

```bash
npm --prefix frontend run i18n:check
npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts tests/angle-orbit-state.test.ts tests/angle-orbit-assets.test.ts
npm --prefix frontend run lint
npm --prefix frontend run seo:check
npm --prefix frontend run audit:images
git diff --check
```

Expected: all tests and SEO/image guards pass; lint contains no new error or warning. If `lint:exposure` remains blocked by unrelated pre-existing private-key fixtures, report it separately without modifying those files.

- [ ] **Step 2: Smoke-test all localized routes**

Start `npm --prefix frontend run dev` and open:

```text
http://localhost:3000/tools/angle
http://localhost:3000/fr/outils/angle
http://localhost:3000/es/herramientas/angle
```

For each route verify HTTP 200, one H1, localized copy/controls/alt text, hero CTA, four view labels, no duplicate section image, visible questions, and no hydration error. Use the rendered `<main>` text to confirm each locale exposes at least 700 useful words and remains within the 1,000-word editorial target after navigation/footer text is excluded.

- [ ] **Step 3: Verify Orbit behavior and resilience**

At desktop and mobile widths, verify drag threshold, swipe-equivalent pointer input, ArrowLeft/ArrowRight, previous/next buttons, wrap-around, `aria-live`, failed-image fallback, reduced motion, and a useful default 45° state with JavaScript disabled.

- [ ] **Step 4: Verify technical SEO output**

For all three routes verify self-canonical, reciprocal EN/FR/ES hreflang, index/follow, localized title and description, OG/Twitter image, BreadcrumbList and Service JSON-LD, and absence of FAQPage/HowTo JSON-LD. Confirm existing sitemap assumptions and stable route imports.

- [ ] **Step 5: Capture after screenshots**

Save:

```text
/tmp/maxvideoai-angle-orbit-en-desktop.png
/tmp/maxvideoai-angle-orbit-fr-mobile.png
/tmp/maxvideoai-angle-orbit-es-mobile.png
```

Inspect type scale, product prominence, long localized labels, image continuity, section rhythm, focus states, and absence of repeated assets. Compare the English full page with `/tmp/maxvideoai-angle-before-orbit.png`.

- [ ] **Step 6: Record the final commit state**

Run `git status --short` and confirm only user-owned unrelated files remain. If verification required fixes, write a failing regression test first, implement the minimal fix, rerun the focused checks, and commit with `fix: refine angle orbit landing`.
