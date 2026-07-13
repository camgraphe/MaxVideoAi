# Angle Premium English Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a premium, SEO-safe English-only `/tools/angle` landing page with a lightweight draggable Angle Studio hero and section-exclusive visual assets.

**Architecture:** Keep the existing `AngleLandingView` as the server-side SEO owner. Pass the route locale through the stable page wrapper and select a premium English section composition only for `en`; French and Spanish continue using the current composition and dictionaries. Put drag state in a pure module, render it in one client-only hero component, and keep page composition, SEO content, and static fallbacks server-rendered.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Tailwind utilities, `next/image`, Node test runner via `tsx`, ImageGen, MaxVideoAI Angle.

## Global Constraints

- Deliver only the English premium experience; do not modify `frontend/messages/fr.json` or `frontend/messages/es.json`.
- Preserve `/tools/angle`, canonical metadata, hreflang, JSON-LD, FAQ schema, and all existing `tool_cta_click` analytics attributes.
- Do not use WebGL, Three.js, a 3D model, or a generation request inside the marketing hero.
- The hero interaction must work with pointer, touch, keyboard, and `prefers-reduced-motion`; static server-rendered content is the fallback.
- Every image asset path is assigned to exactly one major page section. No asset path may be reused across hero, proof, use cases, workspace, pipeline, or closing CTA groups.
- Generate new source images with ImageGen and create the corresponding viewpoint images with the Angle tool. Use generated assets only for their assigned section role.
- Keep all landing files under 500 lines and preserve root `AGENTS.md` page/component boundaries.

---

## File structure

- Modify: `frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx` — pass `locale` to the stable landing wrapper.
- Modify: `frontend/src/components/tools/AngleLandingPage.tsx` — pass locale into the server landing view without changing route imports.
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingView.tsx` — retain all JSON-LD/FAQ work and select legacy or English-premium sections.
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingSections.tsx` — export the current localized section composition as the legacy branch.
- Create: `frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx` — English premium server-side page composition.
- Create: `frontend/src/components/tools/angle/landing/AngleHeroStudio.client.tsx` — pointer, keyboard, and reduced-motion interaction only.
- Create: `frontend/src/components/tools/angle/landing/angle-hero-studio.ts` — pure angle-stop state transitions.
- Create: `frontend/src/components/tools/angle/landing/angle-premium-content.ts` — typed English presentation copy and unique section labels/alt text.
- Modify: `frontend/src/components/tools/angle/landing/angle-landing-assets.ts` — typed, exclusive premium asset groups.
- Modify: `frontend/messages/en.json` — English metadata, H1-supporting copy, headings, and FAQ language only.
- Create: `frontend/public/assets/tools/angle-premium-*` — new, section-exclusive optimized image assets.
- Modify: `tests/tool-marketing-landing-architecture.test.ts` — route, server boundary, English rollout, CTA, and unique-asset contract assertions.
- Create: `tests/angle-hero-studio.test.ts` — pure interaction state tests.

## Task 1: Lock the English-only routing and SEO boundary

**Files:**
- Modify: `tests/tool-marketing-landing-architecture.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx`
- Modify: `frontend/src/components/tools/AngleLandingPage.tsx`
- Modify: `frontend/src/components/tools/angle/landing/AngleLandingView.tsx`
- Create: `frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx`

**Interfaces:**
- Consumes: `AppLocale`, `AngleLandingContent`, and the existing `AngleLandingSections` composition.
- Produces: `AngleLandingView({ content, locale })`, which always renders JSON-LD and chooses `AnglePremiumLandingSections` only when `locale === 'en'`.

- [ ] **Step 1: Write the failing architecture test**

Add this test after the current Angle examples test:

```ts
test('angle premium composition is English-only while SEO stays server-owned', () => {
  const routeSource = readFileSync(angleRoutePath, 'utf8');
  const wrapperSource = readFileSync(angleWrapperPath, 'utf8');
  const premiumSectionsPath = join(root, 'frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx');
  const premiumSectionsSource = readFileSync(premiumSectionsPath, 'utf8');

  assert.match(routeSource, /<AngleLandingPage content=\{dictionary\.toolMarketing\.angle\} locale=\{params\.locale\} \/>/);
  assert.match(wrapperSource, /locale: AppLocale/);
  assert.match(angleViewSource, /locale === 'en' \? <AnglePremiumLandingSections/);
  assert.match(angleViewSource, /FAQSchema/);
  assert.match(angleViewSource, /buildToolBreadcrumbJsonLd/);
  assert.match(premiumSectionsSource, /data-analytics-event="tool_cta_click"/);
  assert.doesNotMatch(premiumSectionsSource, /FAQSchema|buildToolBreadcrumbJsonLd|dangerouslySetInnerHTML/);
});
```

- [ ] **Step 2: Run the architecture test to verify it fails**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because `AnglePremiumLandingSections.tsx` does not exist and `locale` is not passed through.

- [ ] **Step 3: Implement the minimal server boundary**

Use these signatures:

```tsx
// AngleLandingPage.tsx
import type { AppLocale } from '@/i18n/locales';

export function AngleLandingPage({ content, locale }: { content: AngleLandingContent; locale: AppLocale }) {
  return <AngleLandingView content={content} locale={locale} />;
}

// AngleLandingView.tsx
export function AngleLandingView({ content, locale }: { content: AngleLandingContent; locale: AppLocale }) {
  // keep canonicalUrl, breadcrumbJsonLd, serviceJsonLd, howToJsonLd, FAQSchema, and all three JSON-LD scripts unchanged
  return (
    <div className="angle-page">
      {locale === 'en' ? <AnglePremiumLandingSections content={content} /> : <AngleLandingSections content={content} />}
      <FAQSchema questions={[...content.faq.items]} />
      {/* existing three JSON-LD scripts */}
    </div>
  );
}
```

In the route, use `<AngleLandingPage content={dictionary.toolMarketing.angle} locale={params.locale} />`. Create `AnglePremiumLandingSections.tsx` with this initial server component:

```tsx
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import type { AngleLandingContent } from './angle-landing-assets';

export function AnglePremiumLandingSections({ content }: { content: AngleLandingContent }) {
  return (
    <section data-angle-premium="true" className="section">
      <h1>{content.hero.title}</h1>
      <ButtonLink
        href="/app/tools/angle"
        linkComponent={Link}
        data-analytics-event="tool_cta_click"
        data-analytics-cta-name="angle_try_tool_hero"
        data-analytics-cta-location="tool_angle_hero"
        data-analytics-tool-name="angle"
        data-analytics-tool-surface="public"
        data-analytics-target-family="app_tools"
      >
        {content.hero.primaryCta}
      </ButtonLink>
    </section>
  );
}
```

- [ ] **Step 4: Run the architecture test to verify it passes**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: PASS, including the new English-only composition test.

- [ ] **Step 5: Commit the routing boundary**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx' frontend/src/components/tools/AngleLandingPage.tsx frontend/src/components/tools/angle/landing/AngleLandingView.tsx frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: gate premium angle landing to english"
```

## Task 2: Build and test the pure Angle Studio state model

**Files:**
- Create: `tests/angle-hero-studio.test.ts`
- Create: `frontend/src/components/tools/angle/landing/angle-hero-studio.ts`

**Interfaces:**
- Produces: `ANGLE_STUDIO_STOPS`, `getNearestAngleStop`, `getNextAngleStop`, and `getAngleFromDrag`.
- Consumed by: `AngleHeroStudio.client.tsx` in Task 4.

- [ ] **Step 1: Write the failing state tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ANGLE_STUDIO_STOPS, getAngleFromDrag, getNearestAngleStop, getNextAngleStop } from '../frontend/src/components/tools/angle/landing/angle-hero-studio';

test('Angle Studio exposes premium camera stops in one full orbit', () => {
  assert.deepEqual(ANGLE_STUDIO_STOPS.map((stop) => stop.degrees), [0, 45, 90, 135, 180, 225, 270, 315]);
});

test('Angle Studio wraps keyboard selection across the first and last stop', () => {
  assert.equal(getNextAngleStop(315, 'next').degrees, 0);
  assert.equal(getNextAngleStop(0, 'previous').degrees, 315);
});

test('Angle Studio snaps a drag position to the nearest available camera angle', () => {
  assert.equal(getNearestAngleStop(getAngleFromDrag(50, 280)).degrees, 45);
  assert.equal(getNearestAngleStop(getAngleFromDrag(-40, 280)).degrees, 315);
});
```

- [ ] **Step 2: Run the state tests to verify they fail**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-hero-studio.test.ts`

Expected: FAIL because `angle-hero-studio.ts` does not exist.

- [ ] **Step 3: Implement the tested state module**

```ts
export const ANGLE_STUDIO_STOPS = [0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => ({
  degrees,
  label: `${degrees}°`,
  cameraLabel: degrees === 0 ? 'Front view' : degrees === 45 ? 'Three-quarter view' : `${degrees}° camera view`,
}));

export function getAngleFromDrag(deltaX: number, width: number) {
  return ((deltaX / Math.max(width, 1)) * 360 + 360) % 360;
}

export function getNearestAngleStop(angle: number) {
  return ANGLE_STUDIO_STOPS.reduce((nearest, stop) => {
    const distance = Math.abs(((stop.degrees - angle + 540) % 360) - 180);
    const nearestDistance = Math.abs(((nearest.degrees - angle + 540) % 360) - 180);
    return distance < nearestDistance ? stop : nearest;
  });
}

export function getNextAngleStop(current: number, direction: 'next' | 'previous') {
  const index = ANGLE_STUDIO_STOPS.findIndex((stop) => stop.degrees === getNearestAngleStop(current).degrees);
  const offset = direction === 'next' ? 1 : -1;
  return ANGLE_STUDIO_STOPS[(index + offset + ANGLE_STUDIO_STOPS.length) % ANGLE_STUDIO_STOPS.length];
}
```

- [ ] **Step 4: Run the state tests to verify they pass**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-hero-studio.test.ts`

Expected: PASS with three tests.

- [ ] **Step 5: Commit the interaction model**

```bash
git add tests/angle-hero-studio.test.ts frontend/src/components/tools/angle/landing/angle-hero-studio.ts
git commit -m "feat: add angle studio interaction model"
```

## Task 3: Produce the exclusive visual asset library

**Files:**
- Create: `frontend/public/assets/tools/angle-premium-hero-source.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-hero-45.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-proof-source.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-proof-45.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-product-source.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-product-45.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-story-source.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-story-45.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-ad-source.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-ad-45.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-workspace.jpeg`
- Create: `frontend/public/assets/tools/angle-premium-cta.jpeg`
- Modify: `frontend/src/components/tools/angle/landing/angle-landing-assets.ts`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Produces: `ANGLE_PREMIUM_ASSET_GROUPS`, an immutable object with groups `hero`, `proof`, `product`, `storyboard`, `adCreative`, `workspace`, and `closingCta`.
- Consumed by: `AngleHeroStudio.client.tsx` and `AnglePremiumLandingSections.tsx`.

- [ ] **Step 1: Write the failing unique-asset contract**

```ts
test('premium Angle asset groups use a path only once', () => {
  const assetsSource = readFileSync(angleAssetsPath, 'utf8');
  assert.match(assetsSource, /export const ANGLE_PREMIUM_ASSET_GROUPS/);
  const paths = [...assetsSource.matchAll(/'\/assets\/tools\/angle-premium-[^']+'/g)].map(([path]) => path);
  assert.equal(paths.length, 12, 'premium landing should expose twelve section-scoped image paths');
  assert.equal(new Set(paths).size, paths.length, 'a premium Angle image path may belong to one section only');
});
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because the premium asset registry and its twelve paths do not exist.

- [ ] **Step 3: Generate source visuals with ImageGen**

Generate each source image at 4:3, photorealistic, logo-free, text-free, and with its section role in the prompt:

```text
hero: Premium matte-black headphones on a sculptural ivory plinth, large centered product, warm gallery light, generous but controlled negative space for an orbit UI, landscape 4:3.
proof: Stainless travel tumbler on a pale stone surface, straight-on catalog camera, product fills 65 percent of frame, clean daylight studio, landscape 4:3.
product: Cobalt-blue running shoe on a suspended clear stand, straight-on premium commerce image, crisp shadow, warm gray studio, landscape 4:3.
storyboard: Two filmmakers at a windswept coastal overlook, eye-level two-shot, practical jacket texture, cinematic natural light, landscape 4:3.
ad: Fragrance bottle with sculptural glass cap in a saturated deep-red art-direction set, straight-on campaign photograph, landscape 4:3.
workspace: A refined fictional AI camera-angle workspace on a desktop display, ivory canvas, graphite controls, blue orbit control, no readable brand text, landscape 16:9.
closing CTA: Architectural chrome chair seen from a dramatic three-quarter angle, charcoal and ivory gallery setting, spare premium composition, landscape 16:9.
```

Save each ImageGen source to its assigned `frontend/public/assets/tools/angle-premium-*.jpeg` path. Keep the hero source distinct from the proof and product source images.

- [ ] **Step 4: Generate five angle outputs with the Angle tool**

For hero, proof, product, storyboard, and ad source images: upload the corresponding new source once, set rotation to `45°`, tilt to `3°`, and choose a close-but-complete crop. Save the result only to that source’s matching `*-45.jpeg` path. Confirm the subject identity and scene remain stable while the visible viewpoint changes.

- [ ] **Step 5: Inspect and optimize every asset**

For each image, inspect its rendered pixels at desktop-card scale. Reject images with unreadable products, unintelligible camera shifts, duplicate composition, generated text, watermarking, or a subject smaller than 45% of its frame. Use `sips` to preserve 4:3 source/output pairs and 16:9 workspace/CTA frames. Do not crop an image from one group into another group.

- [ ] **Step 6: Add the typed registry**

```ts
export const ANGLE_PREMIUM_ASSET_GROUPS = {
  hero: { source: '/assets/tools/angle-premium-hero-source.jpeg', output: '/assets/tools/angle-premium-hero-45.jpeg' },
  proof: { source: '/assets/tools/angle-premium-proof-source.jpeg', output: '/assets/tools/angle-premium-proof-45.jpeg' },
  product: { source: '/assets/tools/angle-premium-product-source.jpeg', output: '/assets/tools/angle-premium-product-45.jpeg' },
  storyboard: { source: '/assets/tools/angle-premium-story-source.jpeg', output: '/assets/tools/angle-premium-story-45.jpeg' },
  adCreative: { source: '/assets/tools/angle-premium-ad-source.jpeg', output: '/assets/tools/angle-premium-ad-45.jpeg' },
  workspace: { image: '/assets/tools/angle-premium-workspace.jpeg' },
  closingCta: { image: '/assets/tools/angle-premium-cta.jpeg' },
} as const;
```

- [ ] **Step 7: Run the contract to verify it passes**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: PASS, with twelve unique premium asset paths.

- [ ] **Step 8: Commit the visual library**

```bash
git add frontend/public/assets/tools/angle-premium-*.jpeg frontend/src/components/tools/angle/landing/angle-landing-assets.ts tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: add exclusive angle landing visuals"
```

## Task 4: Implement the premium hero and section composition

**Files:**
- Create: `frontend/src/components/tools/angle/landing/angle-premium-content.ts`
- Create: `frontend/src/components/tools/angle/landing/AngleHeroStudio.client.tsx`
- Modify: `frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Consumes: `ANGLE_STUDIO_STOPS`, `getAngleFromDrag`, `getNearestAngleStop`, `getNextAngleStop`, `ANGLE_PREMIUM_ASSET_GROUPS`, `ButtonLink`, and `Link`.
- Produces: a server-rendered English section tree with one client island, `AngleHeroStudio`.

- [ ] **Step 1: Write the failing component-boundary contract**

```ts
test('premium Angle hero isolates browser interaction and keeps server sections crawlable', () => {
  const premiumPath = join(root, 'frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx');
  const studioPath = join(root, 'frontend/src/components/tools/angle/landing/AngleHeroStudio.client.tsx');
  const premiumSource = readFileSync(premiumPath, 'utf8');
  const studioSource = readFileSync(studioPath, 'utf8');

  assert.match(premiumSource, /AngleHeroStudio/);
  assert.match(premiumSource, /<h2/);
  assert.match(premiumSource, /data-analytics-cta-name="angle_try_tool_hero"/);
  assert.match(studioSource, /^'use client';/);
  assert.match(studioSource, /onPointerDown|onPointerMove|onKeyDown/);
  assert.match(studioSource, /prefers-reduced-motion/);
  assert.doesNotMatch(studioSource, /three|WebGL|canvas/i);
});
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because the premium hero client island does not exist.

- [ ] **Step 3: Add English-only presentation content**

Export a `PREMIUM_ANGLE_CONTENT` constant from `angle-premium-content.ts` with this exact semantic shape:

```ts
export const PREMIUM_ANGLE_CONTENT = {
  hero: {
    eyebrow: 'AI camera angle control',
    title: 'Choose the viewpoint that sells the idea.',
    body: 'Turn one trusted image into the product, story, or campaign angle your next frame needs.',
    cta: 'Try Angle with an image',
    support: 'Keep the subject. Change the camera.',
    orbitLabel: 'Drag to explore camera angles',
  },
  proof: { eyebrow: 'See the shift', title: 'The same image. A more useful point of view.' },
  useCases: [
    { key: 'product', title: 'Product photography with more dimension' },
    { key: 'storyboard', title: 'Storyboard coverage before the shot is locked' },
    { key: 'adCreative', title: 'Ad creative that earns a second look' },
  ],
  pipeline: { title: 'Keep the better frame moving', steps: ['Source image', 'Angle', 'Image or Video'] },
  closingCta: { title: 'A better angle can be the missing decision.', cta: 'Open Angle' },
} as const;
```

- [ ] **Step 4: Implement `AngleHeroStudio.client.tsx`**

Implement a `section` with a pointer-capturing stage, an `aria-live="polite"` camera label, previous/next labelled buttons, and static image markup. The interaction must follow this reducer-free state outline:

```tsx
const [activeDegrees, setActiveDegrees] = useState(45);
const dragStart = useRef<{ x: number; degrees: number } | null>(null);
const activeStop = getNearestAngleStop(activeDegrees);

function updateFromDrag(clientX: number, width: number) {
  if (!dragStart.current) return;
  setActiveDegrees(getNearestAngleStop(dragStart.current.degrees + getAngleFromDrag(clientX - dragStart.current.x, width)).degrees);
}

function selectAdjacent(direction: 'next' | 'previous') {
  setActiveDegrees(getNextAngleStop(activeDegrees, direction).degrees);
}
```

Use `ANGLE_PREMIUM_ASSET_GROUPS.hero.source` for the 0° state and `.hero.output` for all non-zero states. Only use transform/opacity transitions. When `matchMedia('(prefers-reduced-motion: reduce)')` matches, omit inertial transition classes.

- [ ] **Step 5: Compose all server sections**

`AnglePremiumLandingSections.tsx` must render, in order:

1. `AngleHeroStudio` inside the editorial hero.
2. Server-rendered proof pair using `ANGLE_PREMIUM_ASSET_GROUPS.proof`.
3. Three alternating use-case rows using only their matching `product`, `storyboard`, and `adCreative` groups.
4. One workspace section using `.workspace.image`.
5. A text-and-token pipeline section with no reused imagery.
6. A closing CTA using `.closingCta.image` and `data-analytics-cta-name="angle_try_tool_final"`.

Every `Image` must receive an English alt string from `PREMIUM_ANGLE_CONTENT`, `fill`, and a section-appropriate `sizes` value. Keep the hero CTA attributes unchanged from the existing hero.

- [ ] **Step 6: Run the contract to verify it passes**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts && npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-hero-studio.test.ts`

Expected: PASS for all tool-marketing and Angle Studio tests.

- [ ] **Step 7: Commit the premium composition**

```bash
git add frontend/src/components/tools/angle/landing/angle-premium-content.ts frontend/src/components/tools/angle/landing/AngleHeroStudio.client.tsx frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: build premium angle landing sections"
```

## Task 5: Apply English SEO copy and finish visual polish

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `tests/tool-marketing-landing-architecture.test.ts`

**Interfaces:**
- Consumes: existing `content.meta`, `content.howItWorks.steps`, and the premium component tree.
- Produces: stronger English semantic headings without altering metadata generation or non-English messages.

- [ ] **Step 1: Write the failing English-scope and SEO contract**

```ts
test('premium Angle rollout updates English SEO copy without changing localized dictionaries', () => {
  const english = JSON.parse(readFileSync(englishMessagesPath, 'utf8')) as { toolMarketing: { angle: { meta: { title: string; description: string; keywords: string[] } } } };
  const french = readFileSync(frenchMessagesPath, 'utf8');
  const spanish = readFileSync(spanishMessagesPath, 'utf8');

  assert.equal(english.toolMarketing.angle.meta.title, 'AI Camera Angle Generator | Create New Views from One Image');
  assert.equal(english.toolMarketing.angle.meta.description, 'Change a camera angle with AI from one image. Create product views, storyboard coverage, and ad-ready camera perspectives without rebuilding the scene.');
  assert.ok(english.toolMarketing.angle.meta.keywords.includes('change camera angle ai'));
  assert.doesNotMatch(french, /Choose the viewpoint that sells the idea/);
  assert.doesNotMatch(spanish, /Choose the viewpoint that sells the idea/);
});
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts`

Expected: FAIL because the current English title and description do not equal the new search-focused copy.

- [ ] **Step 3: Update English SEO copy only**

Set the English metadata fields to:

```json
{
  "title": "AI Camera Angle Generator | Create New Views from One Image",
  "description": "Change a camera angle with AI from one image. Create product views, storyboard coverage, and ad-ready camera perspectives without rebuilding the scene."
}
```

Keep the existing English keyword `change camera angle ai`, schema fields, FAQ questions, and metadata route behavior. Do not edit the French or Spanish message files.

- [ ] **Step 4: Add the premium visual tokens**

In `frontend/app/globals.css`, scope all new rules under `.angle-premium`. Define warm surface variables, graphite text, electric-blue focus rings, stage/orbit transforms, pointer cursor, focus-visible outlines, and a `@media (prefers-reduced-motion: reduce)` block that removes hero transitions. Do not override global heading styles or change another tool’s classes.

- [ ] **Step 5: Run focused quality checks**

Run: `npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts && npm --prefix frontend run lint && git diff --check`

Expected: All tests pass; lint may report only the two existing Studio hook dependency warnings and no errors.

- [ ] **Step 6: Commit English SEO and visual polish**

```bash
git add frontend/messages/en.json frontend/src/components/tools/angle/landing/AnglePremiumLandingSections.tsx frontend/app/globals.css tests/tool-marketing-landing-architecture.test.ts
git commit -m "feat: polish english angle search landing"
```

## Task 6: Verify the finished landing in the browser

**Files:**
- No production source changes required unless verification identifies a regression.

**Interfaces:**
- Consumes: the complete English landing page and existing localized route fallback.
- Produces: visual verification evidence and before/after screenshots.

- [ ] **Step 1: Start the frontend and verify route status**

Run: `npm --prefix frontend run dev`

Open: `http://localhost:3000/tools/angle`

Expected: HTTP 200, English premium composition, one H1, a visible hero CTA, and no duplicate section image.

- [ ] **Step 2: Verify interaction and accessibility**

At desktop width, drag the hero orbit from 0° to 45° and confirm the active degree label, camera note, and preview update. Use keyboard controls to advance from 315° to 0° and back from 0° to 315°. Repeat with reduced motion enabled and confirm there is no inertial animation while the state still changes.

- [ ] **Step 3: Verify locale fallback and SEO surface**

Open `http://localhost:3000/fr/outils/angle` and `http://localhost:3000/es/herramientas/angle`. Confirm they still render the pre-existing localized composition. Inspect the English page for canonical `https://maxvideoai.com/tools/angle`, existing hreflang output, FAQ JSON-LD, service JSON-LD, and HowTo JSON-LD.

- [ ] **Step 4: Capture before/after evidence**

Capture a full-page desktop screenshot of the prior landing from `/tmp/maxvideoai-angle-full-page.png` and a new full-page English screenshot at `/tmp/maxvideoai-angle-premium-full-page.png`. Capture a mobile viewport image at `/tmp/maxvideoai-angle-premium-mobile.png`. Inspect each image for type scale, no crop collisions, no repeated asset, and a legible hero interaction.

- [ ] **Step 5: Run final checks and commit verification fixes**

Run: `npm --prefix frontend run lint && npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts tests/angle-hero-studio.test.ts && git diff --check`

Expected: tests pass, no lint errors, and no whitespace errors. If visual verification requires code changes, add a focused regression test first, then commit the fix with `fix: refine premium angle landing`.
