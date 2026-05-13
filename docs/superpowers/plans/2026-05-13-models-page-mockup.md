# Models Page Decision Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `https://maxvideoai.com/models` into a decision-oriented SEO and conversion hub that matches the provided mockup while helping users choose by specs, pricing, limits, use case, examples, and comparison paths.

**Implementation status:** Completed on 2026-05-13. Static checks, architecture test, and Playwright desktop/mobile smoke checks passed against `http://localhost:3001/models`.

**Architecture:** Keep `frontend/app/(localized)/[locale]/(marketing)/models/page.tsx` as the tiny route wrapper and keep `ModelsCatalogPage.tsx` as orchestration only. Move new mockup sections into route-local `_components`, move derived decision data into route-local `_lib`, and preserve `/ai-video-engines` as the true side-by-side comparison surface to avoid SEO cannibalization.

**Tech Stack:** Next.js App Router, React Server Components for route composition, existing client `ModelsGallery`, `next-intl` dictionaries, Tailwind, lucide-react, existing catalog builders, existing architecture and SEO tests.

---

## Decision Role

`/models` should answer: "Which model should I inspect next, and what should I compare before spending credits?"

Keep page responsibilities distinct:

- `/models`: global model directory for specs, pricing, limits, filters, and routing to next actions.
- `/models/video`: video-only shortlist.
- `/models/image`: image-only shortlist.
- `/ai-video-engines`: side-by-side comparison hub and `vs` pages.
- `/examples`: visual proof, prompt examples, and reusable outputs.

Use the mockup as the visual direction, but optimize the content for the user-provided Search Console signals: low CTR on model/compare/example clusters, strong interest in pricing, max duration, examples, audio/lip sync, Seedance, Kling, Veo, and LTX.

## Priority Scope

P0:
- Change the page intent from plain catalog to "compare before you generate".
- Add recommended starting points, including LTX 2.3 Fast above the fold or immediately below it.
- Add use-case shortcuts for cinematic video, native audio/lip sync, fast drafts, image-to-video, prompt examples, max duration/limits, best value, and prompt control.
- Replace generic card CTAs with descriptive "View specs", "Compare", and "Examples" links.
- Add pricing and limits content above the FAQ.

P1:
- Add popular comparison links from the hub to high-intent `vs` pages.
- Make FAQ copy target max duration, pricing, audio/lip sync, prompt examples, and video vs image models.
- Add exact internal anchors: `#recommended`, `#models-grid`, `#popular-comparisons`, `#pricing-limits`, `#faq`.
- Make filter controls match the mockup and keep them usable on mobile.

P2:
- Add optional tabs beyond all/video/image only when backed by real data.
- Add a maintained "updated specs" timestamp only if a real source is available.

## File Structure

Create:
- `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`
  - Owns top picks, use-case shortcuts, recommended IDs, popular comparisons, pricing/limits items, FAQ fallback copy, and example family mapping.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogTopPicksPanel.tsx`
  - Renders the right-side "Recommended starting points" hero panel.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogUseCaseStrip.tsx`
  - Renders use-case shortcut cards.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogRecommendedSection.tsx`
  - Renders the four recommended AI video model cards.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPopularComparisons.tsx`
  - Renders searched comparison links.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPricingLimitsSection.tsx`
  - Renders pricing, duration, and output quality explanation.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogDecisionFaq.tsx`
  - Renders the rewritten FAQ while feeding existing FAQ JSON-LD.

Modify:
- `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
  - Compose new sections and remove bulky inline section JSX so the file stays below its 500-line contract.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogHero.tsx`
  - Rebuild hero as mockup-style left copy plus right recommendations panel.
- `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogGallerySection.tsx`
  - Add section heading and mockup filter/grid surface.
- `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`
  - Improve generated descriptions and add optional `compareHref` / `examplesHref` data for card links.
- `frontend/components/marketing/models-gallery/models-gallery-types.ts`
  - Add optional `compareHref`, `examplesHref`, and descriptive CTA labels to `ModelGalleryCard`.
- `frontend/components/marketing/ModelsGallery.tsx`
  - Pass card CTA copy and optional tabs through to cards and filters.
- `frontend/components/marketing/ModelsGalleryCard.tsx`
  - Render "View specs", "Compare", and "Examples" with descriptive `aria-label`s.
- `frontend/components/marketing/models-gallery/ModelsGalleryFilters.tsx`
  - Reorder controls to match the mockup.
- `frontend/components/marketing/models-gallery/models-gallery-copy.ts`
  - Add defaults for tabs, more filters, and descriptive card CTAs.
- `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`
  - Update metadata and localized `models.listing` copy.
- `tests/models-catalog-architecture.test.ts`
  - Lock new section boundaries and keep route orchestration thin.

## Task 1: Lock the Architecture Contract

**Files:**
- Modify: `tests/models-catalog-architecture.test.ts`

- [ ] **Step 1: Add paths for new decision modules**

Add near existing path constants:

```ts
const decisionDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts');
const topPicksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogTopPicksPanel.tsx');
const useCaseStripPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogUseCaseStrip.tsx');
const recommendedPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogRecommendedSection.tsx');
const popularComparisonsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPopularComparisons.tsx');
const pricingLimitsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPricingLimitsSection.tsx');
const decisionFaqPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogDecisionFaq.tsx');
```

Add sources:

```ts
const decisionDataSource = readFileSync(decisionDataPath, 'utf8');
const topPicksSource = readFileSync(topPicksPath, 'utf8');
const useCaseStripSource = readFileSync(useCaseStripPath, 'utf8');
const recommendedSource = readFileSync(recommendedPath, 'utf8');
const popularComparisonsSource = readFileSync(popularComparisonsPath, 'utf8');
const pricingLimitsSource = readFileSync(pricingLimitsPath, 'utf8');
const decisionFaqSource = readFileSync(decisionFaqPath, 'utf8');
```

- [ ] **Step 2: Assert files and imports exist**

Extend the first test:

```ts
assert.ok(existsSync(decisionDataPath), 'models catalog decision data should live in a route-local helper');
assert.ok(existsSync(topPicksPath), 'models catalog top picks panel should live in a route-local component');
assert.ok(existsSync(useCaseStripPath), 'models catalog use-case strip should live in a route-local component');
assert.ok(existsSync(recommendedPath), 'models catalog recommended section should live in a route-local component');
assert.ok(existsSync(popularComparisonsPath), 'models catalog popular comparisons should live in a route-local component');
assert.ok(existsSync(pricingLimitsPath), 'models catalog pricing and limits section should live in a route-local component');
assert.ok(existsSync(decisionFaqPath), 'models catalog decision FAQ should live in a route-local component');

assert.match(pageSource, /from '\.\/_lib\/models-catalog-decision-data'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogTopPicksPanel'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogUseCaseStrip'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogRecommendedSection'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogPopularComparisons'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogPricingLimitsSection'/);
assert.match(pageSource, /from '\.\/_components\/ModelsCatalogDecisionFaq'/);
```

- [ ] **Step 3: Assert focused contracts**

Add:

```ts
test('models catalog decision hub sections stay route-local and focused', () => {
  assert.match(decisionDataSource, /export function buildModelsCatalogDecisionData/);
  assert.match(topPicksSource, /export function ModelsCatalogTopPicksPanel/);
  assert.match(useCaseStripSource, /export function ModelsCatalogUseCaseStrip/);
  assert.match(recommendedSource, /export function ModelsCatalogRecommendedSection/);
  assert.match(popularComparisonsSource, /export function ModelsCatalogPopularComparisons/);
  assert.match(pricingLimitsSource, /export function ModelsCatalogPricingLimitsSection/);
  assert.match(decisionFaqSource, /export function ModelsCatalogDecisionFaq/);

  assert.match(decisionDataSource, /ltx-2-3-fast/, 'LTX 2.3 Fast should be promoted in decision data');
  assert.match(decisionDataSource, /seedance-2-0-vs-seedance-2-0-fast/, 'popular Seedance comparison should be linked');
  assert.match(decisionDataSource, /pricingLimits/, 'pricing and limits copy should be derived outside the page');
  assert.doesNotMatch(pageSource, /Recommended AI video models/, 'section copy should not bloat the route orchestrator');

  assert.ok(topPicksSource.split('\n').length <= 180, 'top picks panel should stay focused');
  assert.ok(useCaseStripSource.split('\n').length <= 200, 'use-case strip should stay focused');
  assert.ok(recommendedSource.split('\n').length <= 220, 'recommended section should stay focused');
  assert.ok(popularComparisonsSource.split('\n').length <= 180, 'popular comparisons should stay focused');
  assert.ok(pricingLimitsSource.split('\n').length <= 180, 'pricing limits section should stay focused');
  assert.ok(decisionFaqSource.split('\n').length <= 180, 'decision FAQ should stay focused');
});
```

- [ ] **Step 4: Run the failing architecture test**

Run:

```bash
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: FAIL because the new files and imports do not exist yet.

## Task 2: Update Metadata and Localized Copy

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`

- [ ] **Step 1: Update SEO metadata copy**

In `frontend/messages/en.json`, under `models.meta`, set:

```json
{
  "title": "AI Video & Image Models: Specs, Limits & Pricing | MaxVideoAI",
  "description": "Compare AI video and image models by price, max duration, resolution, audio support, input modes, and use case. Browse Seedance, Kling, Veo, Sora, LTX and more."
}
```

Use equivalent translated copy in `fr.json` and `es.json`, preserving keys.

- [ ] **Step 2: Add `models.listing.decision` copy**

Add this shape under `models.listing` in all locales:

```json
"decision": {
  "eyebrow": "AI video & image model directory",
  "heroTitle": "Compare AI models before you generate",
  "heroSubtitle": "Browse video, image, audio, and preparation models. Compare pricing, max duration, resolution, audio support, input modes, and strengths before choosing the right model.",
  "primaryCta": "Browse models",
  "secondaryCta": "Compare engines",
  "topPicksTitle": "Recommended starting points",
  "topPicksViewAll": "View all recommendations",
  "useCasesTitle": "Choose by what you want to create",
  "useCasesViewAll": "View all use cases",
  "recommendedTitle": "Recommended AI video models",
  "recommendedSubtitle": "Start with these models if you want strong quality, control, speed, or value before browsing the full catalog.",
  "allModelsTitle": "All AI models",
  "allModelsSubtitle": "Search and filter models by format, use case, price, duration, resolution, audio support, and input mode.",
  "popularComparisonsTitle": "Not sure which AI video model to choose?",
  "popularComparisonsSubtitle": "Compare the most searched model pairs side by side.",
  "pricingLimitsTitle": "Compare pricing, duration, and output limits",
  "pricingLimitsBody": "Video models are usually priced per second, while image models are priced per image or output size. Use the cards below to compare starting price, max duration, resolution, audio support, and input modes before generating.",
  "faqTitle": "AI model specs, pricing, and examples FAQ"
}
```

- [ ] **Step 3: Use decision hero copy in `ModelsCatalogPage.tsx`**

After `listingCopy` is built, add:

```ts
const decisionCopy = listingCopy.decision ?? {};
```

Use:

```ts
const heroTitle =
  scope === 'all'
    ? decisionCopy.heroTitle ?? listingCopy.hero?.title ?? content.hero?.title ?? scopeDefaults.heroTitle
    : scopeDefaults.heroTitle;

const heroSubhead =
  scope === 'all'
    ? decisionCopy.heroSubtitle ?? listingCopy.hero?.subtitle ?? content.hero?.subtitle ?? scopeDefaults.heroSubhead
    : scopeDefaults.heroSubhead;
```

- [ ] **Step 4: Run i18n validation**

Run:

```bash
npm --prefix frontend run i18n:check
```

Expected: PASS.

## Task 3: Build Decision Data

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
- Modify: `frontend/components/marketing/models-gallery/models-gallery-types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`

- [ ] **Step 1: Extend `ModelGalleryCard` with destination links**

In `models-gallery-types.ts`, add:

```ts
compareHref?: ModelsGalleryCompareHref | null;
examplesHref?: LocalizedLinkHref | null;
```

Keep both optional so image-only models and models without examples remain valid.

- [ ] **Step 2: Add examples family mapping in decision data**

Create `models-catalog-decision-data.ts` with:

```ts
import type { LucideIcon } from 'lucide-react';
import { BadgeDollarSign, Bolt, Camera, Clock3, Film, Gauge, ImageIcon, ListChecks, Mic2, ShieldCheck, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { ModelGalleryCard, ModelsGalleryCompareHref } from '@/components/marketing/ModelsGallery';

const EXAMPLE_FAMILY_BY_MODEL: Record<string, string> = {
  'seedance-2-0': 'seedance',
  'seedance-2-0-fast': 'seedance',
  'kling-3-pro': 'kling',
  'kling-3-standard': 'kling',
  'veo-3-1': 'veo',
  'veo-3-1-fast': 'veo',
  'veo-3-1-lite': 'veo',
  'ltx-2-3-fast': 'ltx',
  'ltx-2-3-pro': 'ltx',
  'ltx-2-fast': 'ltx',
  'sora-2': 'sora',
  'wan-2-6': 'wan',
  'pika-text-to-video': 'pika',
};

export type ModelsCatalogDecisionBadge = { label: string; icon: LucideIcon };
export type ModelsCatalogTopPick = { id: string; label: string; reason: string; detail: string; score: number | null; icon: LucideIcon; href: LocalizedLinkHref };
export type ModelsCatalogUseCase = { id: string; title: string; subtitle: string; best: string; href: LocalizedLinkHref | string; icon: LucideIcon };
export type ModelsCatalogPricingLimitItem = { title: string; body: string; icon: LucideIcon };
export type ModelsCatalogPopularComparison = { label: string; href: ModelsGalleryCompareHref };
export type ModelsCatalogDecisionData = {
  badges: ModelsCatalogDecisionBadge[];
  topPicks: ModelsCatalogTopPick[];
  useCases: ModelsCatalogUseCase[];
  recommendedCards: ModelGalleryCard[];
  popularComparisons: ModelsCatalogPopularComparison[];
  pricingLimits: ModelsCatalogPricingLimitItem[];
  faqItems: Array<{ question: string; answer: string }>;
};
```

- [ ] **Step 3: Add helper functions**

Add:

```ts
function cardMap(cards: ModelGalleryCard[]) {
  return new Map(cards.map((card) => [card.id, card]));
}

function pickCards(cards: ModelGalleryCard[], ids: readonly string[]) {
  const byId = cardMap(cards);
  return ids.map((id) => byId.get(id)).filter((card): card is ModelGalleryCard => Boolean(card));
}

function compareHref(left: string, right: string): ModelsGalleryCompareHref {
  const sorted = [left, right].sort();
  return {
    pathname: '/ai-video-engines/[slug]',
    params: { slug: `${sorted[0]}-vs-${sorted[1]}` },
    query: sorted[0] === left ? undefined : { order: left },
  };
}

export function buildModelExamplesHref(modelSlug: string): LocalizedLinkHref | null {
  const family = EXAMPLE_FAMILY_BY_MODEL[modelSlug];
  if (!family) return null;
  return { pathname: '/examples/[model]', params: { model: family } };
}
```

- [ ] **Step 4: Export decision data**

Add:

```ts
const TOP_PICK_IDS = ['seedance-2-0', 'kling-3-pro', 'seedance-2-0-fast', 'ltx-2-3-fast'] as const;
const RECOMMENDED_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'ltx-2-3-fast'] as const;

export function buildModelsCatalogDecisionData({
  activeLocale,
  cards,
}: {
  activeLocale: AppLocale;
  cards: ModelGalleryCard[];
}): ModelsCatalogDecisionData {
  const byId = cardMap(cards);
  const topPickIcons = [Mic2, SlidersHorizontal, Bolt, Gauge] as const;
  const topPickCopy: Record<string, { reason: string; detail: string }> = {
    'seedance-2-0': { reason: 'Best native audio', detail: 'Native audio, lip sync, realistic motion' },
    'kling-3-pro': { reason: 'Best control', detail: 'Cinematic sequences and prompt control' },
    'seedance-2-0-fast': { reason: 'Best fast drafts', detail: 'Quick iterations and lower-cost tests' },
    'ltx-2-3-fast': { reason: 'Best value / long clips', detail: 'Fast drafts, 20s max duration, low cost' },
  };

  return {
    badges: [
      { label: 'Price before render', icon: BadgeDollarSign },
      { label: 'Pay-as-you-go', icon: Gauge },
      { label: 'Updated specs', icon: ShieldCheck },
      { label: 'Video & image models', icon: Sparkles },
      { label: 'Audio & lip sync', icon: Mic2 },
    ],
    topPicks: TOP_PICK_IDS.map((id, index) => {
      const card = byId.get(id);
      return {
        id,
        label: card?.label ?? id,
        reason: topPickCopy[id].reason,
        detail: topPickCopy[id].detail,
        score: card?.overallScore ?? null,
        icon: topPickIcons[index] ?? Trophy,
        href: card?.href ?? { pathname: '/models/[slug]', params: { slug: id } },
      };
    }),
    useCases: [
      { id: 'cinematic-video', title: 'Cinematic video', subtitle: 'Film-like motion and scenes', best: 'Kling 3 Pro', href: '/ai-video-engines/best-for/cinematic-realism', icon: Film },
      { id: 'native-audio', title: 'Native audio & lip sync', subtitle: 'Dialogue and ambience', best: 'Seedance 2.0', href: '/ai-video-engines/best-for/lipsync-dialogue', icon: Mic2 },
      { id: 'fast-drafts', title: 'Fast drafts', subtitle: 'Quick iterations', best: 'Seedance 2.0 Fast', href: '/ai-video-engines/best-for/fast-drafts', icon: Bolt },
      { id: 'image-to-video', title: 'Image-to-video', subtitle: 'Bring images to life', best: 'Seedance 2.0', href: '/ai-video-engines/best-for/image-to-video', icon: ImageIcon },
      { id: 'prompt-examples', title: 'Prompt examples', subtitle: 'Reuse tested prompts', best: 'LTX, Kling, Veo', href: '/examples', icon: ListChecks },
      { id: 'max-duration', title: 'Max duration & limits', subtitle: 'Duration, resolution, formats', best: 'Compare specs', href: '#pricing-limits', icon: Clock3 },
      { id: 'best-value', title: 'Best value', subtitle: 'Lower-cost iteration', best: 'LTX 2.3 Fast', href: '/ai-video-engines/best-for/fast-drafts', icon: Gauge },
      { id: 'prompt-control', title: 'Prompt control', subtitle: 'Strong adherence', best: 'Kling 3 Pro', href: '/ai-video-engines/best-for/multi-shot-video', icon: SlidersHorizontal },
    ],
    recommendedCards: pickCards(cards, RECOMMENDED_IDS),
    popularComparisons: [
      { label: 'Seedance 2.0 vs Seedance 2.0 Fast', href: compareHref('seedance-2-0', 'seedance-2-0-fast') },
      { label: 'Kling 3 Pro vs Veo 3.1', href: compareHref('kling-3-pro', 'veo-3-1') },
      { label: 'LTX 2.3 Fast vs Seedance 2.0', href: compareHref('ltx-2-3-fast', 'seedance-2-0') },
      { label: 'Veo 3.1 Fast vs Veo 3.1 Lite', href: compareHref('veo-3-1-fast', 'veo-3-1-lite') },
      { label: 'Kling 3 Pro vs Kling 3 Standard', href: compareHref('kling-3-pro', 'kling-3-standard') },
    ],
    pricingLimits: [
      { title: 'Pricing', body: 'Compare per-second video pricing and per-image still pricing before rendering.', icon: BadgeDollarSign },
      { title: 'Duration', body: 'Check max video length before choosing a model for drafts or production clips.', icon: Clock3 },
      { title: 'Output quality', body: 'Compare 720p, 1080p, 4K, audio, input modes, and model-specific limits.', icon: Trophy },
    ],
    faqItems: buildDecisionFaqItems(activeLocale),
  };
}
```

Add `buildDecisionFaqItems` with the six FAQ entries from Task 9.

- [ ] **Step 5: Add card link derivation**

In `models-catalog-cards.ts`, import:

```ts
import { buildModelExamplesHref } from './models-catalog-decision-data';
```

Add to each returned card:

```ts
compareHref: compareDisabled ? null : {
  pathname: '/ai-video-engines/[slug]',
  params: { slug: `${engine.modelSlug}-vs-seedance-2-0`.split('-vs-').sort().join('-vs-') },
},
examplesHref: buildModelExamplesHref(engine.modelSlug),
```

If the model is `seedance-2-0`, use `kling-3-pro` as the default compare opponent to avoid self-comparison.

- [ ] **Step 6: Wire decision data in the route**

In `ModelsCatalogPage.tsx`:

```ts
import { buildModelsCatalogDecisionData } from './_lib/models-catalog-decision-data';

const decisionData = buildModelsCatalogDecisionData({
  activeLocale,
  cards: modelCards,
});
```

- [ ] **Step 7: Run focused checks**

Run:

```bash
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
npm --prefix frontend run lint
```

Expected: architecture test still fails until visual components exist; lint should pass for completed types/helpers.

## Task 4: Hero and Recommended Starting Points

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogTopPicksPanel.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogHero.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`

- [ ] **Step 1: Create the top-picks panel**

Use a non-personalized heading: "Recommended starting points", not "Top picks for you".

```tsx
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { ModelsCatalogTopPick } from '../_lib/models-catalog-decision-data';

export function ModelsCatalogTopPicksPanel({
  title,
  viewAllLabel,
  items,
}: {
  title: string;
  viewAllLabel: string;
  items: ModelsCatalogTopPick[];
}) {
  return (
    <aside className="rounded-[8px] border border-hairline bg-surface/92 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="flex items-center gap-3 rounded-[8px] border border-hairline bg-bg/80 p-3 transition hover:border-text-muted">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-brand">
              <UIIcon icon={item.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-text-muted">{item.reason}</span>
              <span className="block truncate text-sm font-semibold text-text-primary">{item.label}</span>
              <span className="block truncate text-xs text-text-secondary">{item.detail}</span>
            </span>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hairline bg-surface text-sm font-semibold text-text-primary">
              {item.score != null ? item.score.toFixed(1) : '-'}
            </span>
          </Link>
        ))}
      </div>
      <a href="#recommended" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary">
        {viewAllLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    </aside>
  );
}
```

- [ ] **Step 2: Rebuild `ModelsCatalogHero` layout**

Update props to include `eyebrow`, `badges`, top-pick props, and CTA labels. The visual order should be:

1. Eyebrow: `AI video & image model directory`.
2. H1: `Compare AI models before you generate`.
3. Subtitle with pricing, max duration, resolution, audio support, input modes, strengths.
4. CTA row: `Browse models` to `#models-grid`, `Compare engines` to `/ai-video-engines`.
5. Badges row: price before render, pay-as-you-go, updated specs, video & image models, audio & lip sync.
6. Right-side `ModelsCatalogTopPicksPanel`.

- [ ] **Step 3: Pass localized values from the route**

In `ModelsCatalogPage.tsx`:

```tsx
<ModelsCatalogHero
  activeLocale={activeLocale}
  badges={decisionData.badges}
  eyebrow={decisionCopy.eyebrow ?? 'AI video & image model directory'}
  heroAccentParts={heroAccentParts}
  heroBullets={heroBullets}
  heroSubhead={heroSubhead}
  heroTitleParts={heroTitleParts}
  primaryCtaLabel={decisionCopy.primaryCta ?? 'Browse models'}
  secondaryCtaLabel={decisionCopy.secondaryCta ?? 'Compare engines'}
  scopeTabs={scopeTabs}
  topPicks={decisionData.topPicks}
  topPicksTitle={decisionCopy.topPicksTitle ?? 'Recommended starting points'}
  topPicksViewAllLabel={decisionCopy.topPicksViewAll ?? 'View all recommendations'}
/>
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm --prefix frontend run lint
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: lint passes; architecture may still fail until all new components exist.

## Task 5: Use Cases and Recommended Models

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogUseCaseStrip.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogRecommendedSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`

- [ ] **Step 1: Create use-case strip**

Render eight cards from `decisionData.useCases`. Use compact cards and real links/anchors:

```tsx
export function ModelsCatalogUseCaseStrip({ title, viewAllLabel, items }: Props) {
  return (
    <section className="border-b border-hairline bg-bg py-6">
      <div className="container-page max-w-[1248px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <Link href="/ai-video-engines/best-for" className="text-xs font-semibold text-text-secondary hover:text-text-primary">
            {viewAllLabel}
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="rounded-[8px] border border-hairline bg-surface p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-brand">
                <UIIcon icon={item.icon} size={18} />
              </span>
              <span className="mt-3 block text-xs font-semibold text-text-primary">{item.title}</span>
              <span className="mt-1 block text-[11px] leading-snug text-text-secondary">{item.subtitle}</span>
              <span className="mt-2 block text-[10px] font-semibold text-text-muted">Best: {item.best}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create recommended section**

Render exactly these four when available: Seedance 2.0, Kling 3 Pro, Veo 3.1, LTX 2.3 Fast.

Each card must show:
- provider badge
- score
- model name
- one clean best-for description
- `From`, `Up to`, `Max res.`
- CTA row: `View specs`, `Compare`, `Examples`

- [ ] **Step 3: Use the specific recommended descriptions**

In `ModelsCatalogRecommendedSection.tsx`, override display descriptions by card ID:

```ts
const RECOMMENDED_DESCRIPTION_BY_ID: Record<string, string> = {
  'seedance-2-0': 'Best all-rounder for premium AI video with native audio, lip sync, and realistic motion.',
  'kling-3-pro': 'Best for controllable cinematic sequences, prompt adherence, and multi-shot video generation.',
  'veo-3-1': 'Best for high-quality ad-ready shots, strong prompt understanding, and reference-led workflows.',
  'ltx-2-3-fast': 'Best for fast, lower-cost drafts, prompt testing, and longer AI video iterations.',
};
```

- [ ] **Step 4: Wire sections after hero**

In `ModelsCatalogPage.tsx`, render:

```tsx
<ModelsCatalogUseCaseStrip
  title={decisionCopy.useCasesTitle ?? 'Choose by what you want to create'}
  viewAllLabel={decisionCopy.useCasesViewAll ?? 'View all use cases'}
  items={decisionData.useCases}
/>

<ModelsCatalogRecommendedSection
  title={decisionCopy.recommendedTitle ?? 'Recommended AI video models'}
  subtitle={decisionCopy.recommendedSubtitle ?? 'Start with these models if you want strong quality, control, speed, or value before browsing the full catalog.'}
  cards={decisionData.recommendedCards}
/>
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm --prefix frontend run lint
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: lint passes; architecture still may fail until remaining components exist.

## Task 6: Make Model Cards Decision-Oriented

**Files:**
- Modify: `frontend/components/marketing/ModelsGalleryCard.tsx`
- Modify: `frontend/components/marketing/ModelsGallery.tsx`
- Modify: `frontend/components/marketing/models-gallery/models-gallery-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] **Step 1: Replace generic card CTA copy**

In messages, change:

```json
"cardCtaLabel": "View specs"
```

Use localized equivalents in French and Spanish.

- [ ] **Step 2: Add card CTA labels to gallery copy defaults**

In `models-gallery-copy.ts`, add defaults:

```ts
cardActions: {
  viewSpecs: 'View specs',
  compare: 'Compare',
  examples: 'Examples',
  viewSpecsAria: 'View {engine} specs',
  compareAria: 'Compare {engine} with other AI video models',
  examplesAria: 'See {engine} prompt examples',
}
```

Add matching resolved copy fields in `ResolvedModelsGalleryCopy`.

- [ ] **Step 3: Render three action links**

In `ModelsGalleryCard.tsx`, replace the final action row with:

```tsx
<div className="mt-auto grid grid-cols-3 gap-2 pt-5">
  <Link href={card.href} aria-label={formatTemplate(cardActions.viewSpecsAria, { engine: card.label })}>
    {cardActions.viewSpecs}
  </Link>
  {card.compareHref ? (
    <Link href={card.compareHref} aria-label={formatTemplate(cardActions.compareAria, { engine: card.label })}>
      {cardActions.compare}
    </Link>
  ) : null}
  {card.examplesHref ? (
    <Link href={card.examplesHref} aria-label={formatTemplate(cardActions.examplesAria, { engine: card.label })}>
      {cardActions.examples}
    </Link>
  ) : null}
</div>
```

Keep compare-mode checkbox support available, but do not force users to enter compare mode before they can reach a comparison page.

- [ ] **Step 4: Improve weak generated descriptions**

In `models-catalog-cards.ts`, add overrides for high-priority models before `microDescription` is computed:

```ts
const DECISION_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'seedance-2-0': 'Best for premium multi-shot AI video with native audio, lip sync, and realistic motion.',
  'kling-3-pro': 'Best for controllable cinematic sequences, prompt adherence, image-to-video, and lip sync workflows.',
  'ltx-2-3-fast': 'Best for fast AI video drafts, low-cost prompt testing, and longer clips up to 20 seconds.',
  'pika-text-to-video': 'Best for stylized social clips and quick text-to-video tests. Check max duration, input modes, and pricing before launch.',
};
```

Use it:

```ts
const generatedDescription =
  DECISION_DESCRIPTION_OVERRIDES[engine.modelSlug] ??
  descriptionOverrides[engine.modelSlug] ??
  buildValueSentence(...);
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm --prefix frontend run lint
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: PASS for TypeScript/lint portions touched so far.

## Task 7: Filter Surface and Tabs

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogGallerySection.tsx`
- Modify: `frontend/components/marketing/ModelsGallery.tsx`
- Modify: `frontend/components/marketing/models-gallery/ModelsGalleryFilters.tsx`
- Modify: `frontend/components/marketing/models-gallery/models-gallery-types.ts`

- [ ] **Step 1: Add gallery heading and anchor**

Wrap the gallery with:

```tsx
<section id="models-grid" className="scroll-mt-24">
  <div className="container-page max-w-[1248px]">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>
    </div>
    <div className="rounded-[8px] border border-hairline bg-surface p-4 shadow-card sm:p-5">
      <ModelsGallery ... />
    </div>
  </div>
</section>
```

- [ ] **Step 2: Reorder filter controls**

Desktop order:
1. Search.
2. Format.
3. Use case, mapped to existing mode filter unless a real use-case filter is added.
4. Price.
5. Sort.
6. More filters button, revealing duration and age on small screens.

Keep all controls reachable on mobile. The bar can be sticky with:

```tsx
className="sticky top-16 z-20 ..."
```

Only use sticky if it does not overlap the global header in local browser QA.

- [ ] **Step 3: Add tabs with real destinations**

Add optional tabs to `ModelsGallery`:

```ts
tabs?: Array<{ id: string; label: string; href: string; active?: boolean }>;
```

For `/models`, pass:

```ts
[
  { id: 'all', label: scopeLabels.all, href: '/models', active: scope === 'all' },
  { id: 'video', label: scopeLabels.video, href: '/models/video', active: scope === 'video' },
  { id: 'image', label: scopeLabels.image, href: '/models/image', active: scope === 'image' },
  { id: 'pricing-limits', label: 'Pricing & limits', href: '#pricing-limits' },
]
```

Do not add "Audio & lip sync" or "Prompt examples" as tabs unless they filter real catalog data; those intents already exist in use-case cards.

- [ ] **Step 4: Run checks**

Run:

```bash
npm --prefix frontend run lint
```

Expected: PASS.

## Task 8: Popular Comparisons and Pricing Limits

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPopularComparisons.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogPricingLimitsSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`

- [ ] **Step 1: Create popular comparisons section**

Use `decisionData.popularComparisons`:

```tsx
export function ModelsCatalogPopularComparisons({ title, subtitle, comparisons }: Props) {
  return (
    <section id="popular-comparisons" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card">
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {comparisons.map((comparison) => (
          <Link key={comparison.label} href={comparison.href} className="rounded-[8px] border border-hairline bg-bg px-3 py-2 text-sm font-semibold text-text-primary hover:border-text-muted">
            {comparison.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create pricing and limits section**

Use `decisionData.pricingLimits`:

```tsx
export function ModelsCatalogPricingLimitsSection({ title, body, items }: Props) {
  return (
    <section id="pricing-limits" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card">
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{body}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="rounded-[8px] border border-hairline bg-bg p-4">
            ...
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Render below the grid**

In `ModelsCatalogPage.tsx`, after `ModelsCatalogGallerySection`:

```tsx
<ModelsCatalogPopularComparisons
  title={decisionCopy.popularComparisonsTitle ?? 'Not sure which AI video model to choose?'}
  subtitle={decisionCopy.popularComparisonsSubtitle ?? 'Compare the most searched model pairs side by side.'}
  comparisons={decisionData.popularComparisons}
/>

<ModelsCatalogPricingLimitsSection
  title={decisionCopy.pricingLimitsTitle ?? 'Compare pricing, duration, and output limits'}
  body={decisionCopy.pricingLimitsBody ?? 'Video models are usually priced per second, while image models are priced per image or output size.'}
  items={decisionData.pricingLimits}
/>
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm --prefix frontend run lint
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: architecture test passes once all required components and imports exist.

## Task 9: FAQ and Structured Data

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogDecisionFaq.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`

- [ ] **Step 1: Add FAQ entries**

`buildDecisionFaqItems` should return these English entries for `en`; provide equivalent French and Spanish copy:

```ts
[
  {
    question: 'Which AI video model should I start with?',
    answer: 'Start with Seedance 2.0 for native audio and realistic motion, Kling 3 Pro for cinematic control, Veo 3.1 for high-quality prompt adherence, and LTX 2.3 Fast for fast drafts and lower-cost iterations.',
  },
  {
    question: 'Which models support native audio or lip sync?',
    answer: 'Seedance, Kling, Veo, Sora, LTX and other models may support audio or lip sync depending on the exact version. Check each model card for Audio, Lip sync, T2V, I2V, V2V and First/Last support.',
  },
  {
    question: 'How is AI video pricing calculated?',
    answer: 'Most video models are priced per second of generated output. Image models are usually priced per image or by output size. Open each model page for exact pricing and limits.',
  },
  {
    question: 'What is the maximum duration for AI video models?',
    answer: 'Max duration varies by model. Some models are limited to 8-15 seconds, while others may support longer clips. Use the duration filter or compare cards to find the right model.',
  },
  {
    question: 'Where can I find prompt examples?',
    answer: 'Use the examples pages for model-specific prompts and outputs, including LTX, Kling, Seedance, Veo, Wan and Sora examples.',
  },
  {
    question: 'What is the difference between video models and image models?',
    answer: 'Video models generate motion clips from text, images, video references or first/last frames. Image models generate still images, edits, product visuals, and references that can be used before animation.',
  },
]
```

- [ ] **Step 2: Render FAQ**

Create `ModelsCatalogDecisionFaq` with accessible `details` rows and `id="faq"`.

- [ ] **Step 3: Feed FAQ JSON-LD from decision FAQ**

In `ModelsCatalogPage.tsx`, use:

```ts
const faqItems = scope === 'all' ? decisionData.faqItems : buildModelsFaqItems(...);
```

Keep existing `faqJsonLd` generation and `ModelsCatalogJsonLdScripts`.

- [ ] **Step 4: Run SEO checks**

Run:

```bash
npm --prefix frontend run seo:check
npm --prefix frontend run qa:models-locales
```

Expected: PASS.

## Task 10: Trim the Orchestrator and Verify

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`
- Modify: `tests/models-catalog-architecture.test.ts` only if line caps need tightening after extraction.

- [ ] **Step 1: Remove or move old bulky inline lower sections**

The existing outcome/reliability/CTA blocks should not sit above the new decision flow. Either:

- Move them below FAQ as compact SEO support sections, or
- Delete duplicated content if pricing/limits, popular comparisons, and FAQ now cover the same intent.

Keep schema data intact.

- [ ] **Step 2: Confirm route stays below contract cap**

Run:

```bash
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx'
```

Expected: under 500 lines, preferably closer to 300-380 after section extraction.

- [ ] **Step 3: Run final command checks**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm exec -- tsx --tsconfig frontend/tsconfig.json --test tests/models-catalog-architecture.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Browser smoke-test**

Start:

```bash
npm --prefix frontend run dev
```

Open:

```txt
http://localhost:3000/models
http://localhost:3000/fr/modeles
http://localhost:3000/es/modelos
```

Verify:
- Hero H1 and copy match the decision positioning.
- "Recommended starting points" includes Seedance 2.0, Kling 3 Pro, Seedance 2.0 Fast, and LTX 2.3 Fast.
- Recommended AI video models include Seedance 2.0, Kling 3 Pro, Veo 3.1, and LTX 2.3 Fast.
- Use-case cards include prompt examples and max duration/limits.
- Cards expose View specs, Compare, and Examples links with descriptive labels.
- Popular comparison links route to canonical `/ai-video-engines/[slug]` pages.
- Sticky/filter surface does not overlap the header or hide content on mobile.
- FAQ and JSON-LD still render.

## Self-Review

- Spec coverage: This plan incorporates the mockup, the SEO/conversion direction, LTX visibility, pricing/limits, prompt examples, popular comparisons, descriptive anchors, FAQ rewrite, and cannibalization boundaries.
- Architecture coverage: New visual sections live in route-local `_components`; derived decision data lives in route-local `_lib`; shared gallery changes remain in `frontend/components/marketing`.
- Test coverage: Architecture test is updated first, then lint, i18n, SEO, locale QA, exposure check, diff check, and browser smoke tests verify the implementation.
- Known risk: The Search Console export was described by the user in chat; the actual export file is not present in the workspace context, so implementation should treat the provided metrics as product input unless the file is later added.
