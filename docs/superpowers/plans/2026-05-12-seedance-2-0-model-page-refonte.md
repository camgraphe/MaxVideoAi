# Seedance 2.0 Model Page Refonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable model decision hero template and activate it first for `/models/seedance-2-0`.

**Architecture:** Keep the new template route-local to the model detail route. Add pure decision-data builders under `_lib`, small server components under `_components`, and wire them from `MarketingModelPageLayout.tsx` while keeping `ModelHeroSection.tsx` as the fallback for every other model.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, `next-intl`, Node test runner, existing MaxVideoAI pricing/model helpers.

---

## File Structure

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
  - Owns localized Seedance 2.0 decision hero copy, decision card copy, feature strip data, link targets, and pricing scenario labels.
  - Exports `buildModelDecisionData(...)` and serializable types.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`
  - Converts existing pricing-page presets into model-page pricing scenario cards.
  - Imports `VIDEO_PRICE_PRESETS` and `getPresetQuote` from `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx`
  - Renders breadcrumb, two-column hero, CTA row, compact decision links, media card, and feature strip.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx`
  - Renders scenario total prices and max-duration card.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx`
  - Renders the three compact top decision cards.
- Do not modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MediaPreview.tsx`
  - Use existing `MediaPreview` props for the first implementation.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
  - Build optional decision data for `seedance-2-0`.
  - Render new decision top page when data exists, otherwise render existing `ModelHeroSection`.
  - Keep schema rendering and lower sections stable.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
  - Apply Seedance 2.0-specific metadata title/description while preserving existing localized fallback behavior.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx`
  - Make cards cleaner, use concise alt text, add compact metadata labels, and avoid long prompt-stuffed visible labels.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx`
  - Accept `decisionReferenceWorkflows` and render a small Seedance-specific reference workflow block above existing tabs.
- Modify: `tests/model-page-layout-architecture.test.ts`
  - Lock the new decision template boundary.
- Create: `tests/model-page-decision-data.test.ts`
  - Verify Seedance 2.0 data, localized copies, pricing scenario behavior, and no accidental activation for Fast.

## Task 1: Lock Decision Data And Pricing Contracts

**Files:**
- Create: `tests/model-page-decision-data.test.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`

- [ ] **Step 1: Write the failing decision data test**

Create `tests/model-page-decision-data.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  buildModelDecisionData,
  buildModelDecisionPricingScenarios,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';

const seedance = listFalEngines().find((entry) => entry.modelSlug === 'seedance-2-0');
const fast = listFalEngines().find((entry) => entry.modelSlug === 'seedance-2-0-fast');

test('Seedance 2.0 decision data is localized and decision-oriented', () => {
  assert.ok(seedance, 'Seedance 2.0 engine should exist');

  const en = buildModelDecisionData({ engine: seedance, locale: 'en' });
  const fr = buildModelDecisionData({ engine: seedance, locale: 'fr' });
  const es = buildModelDecisionData({ engine: seedance, locale: 'es' });

  assert.ok(en, 'Seedance 2.0 should opt into decision hero');
  assert.ok(fr, 'French Seedance 2.0 should opt into decision hero');
  assert.ok(es, 'Spanish Seedance 2.0 should opt into decision hero');

  assert.equal(en.hero.title, 'Seedance 2.0');
  assert.match(en.hero.subtitle, /Native audio/);
  assert.match(en.hero.subtitle, /multi-shot continuity/);
  assert.match(en.hero.subtitle, /reference-guided video/);
  assert.ok(en.hero.paragraph.split(/\s+/).length <= 55, 'hero paragraph should stay short');
  assert.equal(en.hero.primaryCta.label, 'Generate with Seedance 2.0');
  assert.equal(en.hero.primaryCta.href, '/app?engine=seedance-2-0');
  assert.equal(en.hero.secondaryCta.label, 'View examples');
  assert.deepEqual(en.hero.quickLinks.map((link) => link.label), [
    'Compare vs Fast',
    'View pricing',
    'Prompt examples',
  ]);
  assert.equal(en.features.length, 6);
  assert.deepEqual(en.decisionCards.map((card) => card.title), [
    'Seedance 2.0 or Fast?',
    'Upgrading from Seedance 1.5?',
    'Need prompt examples?',
  ]);
  assert.match(en.meta.title, /Seedance 2\.0: Pricing, Native Audio & Examples/);
  assert.match(en.meta.description, /Compare Seedance 2\.0 vs Fast/);
  assert.doesNotMatch(fr.hero.subtitle, /Native audio/);
  assert.doesNotMatch(es.hero.subtitle, /Native audio/);
});

test('Seedance 2.0 Fast does not reuse the Seedance 2.0 decision template', () => {
  assert.ok(fast, 'Seedance 2.0 Fast engine should exist');
  assert.equal(buildModelDecisionData({ engine: fast, locale: 'en' }), null);
});

test('Seedance 2.0 pricing scenarios use pricing-page preset quotes', () => {
  assert.ok(seedance, 'Seedance 2.0 engine should exist');
  const scenarios = buildModelDecisionPricingScenarios(seedance, 'en');

  assert.deepEqual(scenarios.map((scenario) => scenario.id), [
    '5s-720p',
    '8s-1080p',
    '10s-1080p',
    '10s-1080p-audio',
    'max-duration',
  ]);
  assert.equal(scenarios[0].price, '$1.97');
  assert.equal(scenarios[1].price, '$7.08');
  assert.equal(scenarios[2].price, '$8.84');
  assert.equal(scenarios[3].price, '$8.84');
  assert.equal(scenarios[4].price, '15s');
  assert.match(scenarios[4].note, /1080p/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts
```

Expected: FAIL because `model-page-decision-data.ts` does not exist.

- [ ] **Step 3: Implement pricing helper**

Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`:

```ts
import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import {
  VIDEO_PRICE_PRESETS,
  getPresetQuote,
  type VideoPricePresetId,
} from '../../../pricing/_lib/pricingHubData';

export type ModelDecisionPricingScenario = {
  id: VideoPricePresetId | 'max-duration';
  label: string;
  price: string;
  note: string;
  featured?: boolean;
};

const SCENARIO_NOTES: Record<
  AppLocale,
  Record<VideoPricePresetId, { label: string; note: string; featured?: boolean }>
> = {
  en: {
    '5s-720p': { label: '5s · 720p', note: 'Best for quick drafts' },
    '8s-1080p': { label: '8s · 1080p', note: 'Standard quality' },
    '10s-1080p': { label: '10s · 1080p', note: 'Most common comparison', featured: true },
    '10s-1080p-audio': { label: '10s · 1080p + audio', note: 'With native audio' },
    '4k-route': { label: '4K output', note: 'Dedicated route' },
  },
  fr: {
    '5s-720p': { label: '5 s · 720p', note: 'Idéal pour les brouillons rapides' },
    '8s-1080p': { label: '8 s · 1080p', note: 'Qualité standard' },
    '10s-1080p': { label: '10 s · 1080p', note: 'Comparaison la plus courante', featured: true },
    '10s-1080p-audio': { label: '10 s · 1080p + audio', note: 'Avec audio natif' },
    '4k-route': { label: 'Sortie 4K', note: 'Route dédiée' },
  },
  es: {
    '5s-720p': { label: '5 s · 720p', note: 'Ideal para borradores rápidos' },
    '8s-1080p': { label: '8 s · 1080p', note: 'Calidad estándar' },
    '10s-1080p': { label: '10 s · 1080p', note: 'Comparación más común', featured: true },
    '10s-1080p-audio': { label: '10 s · 1080p + audio', note: 'Con audio nativo' },
    '4k-route': { label: 'Salida 4K', note: 'Ruta dedicada' },
  },
};

const MAX_DURATION_COPY: Record<AppLocale, { label: string; price: string; note: string }> = {
  en: { label: 'Max duration', price: '15s', note: 'Up to 1080p' },
  fr: { label: 'Durée max', price: '15 s', note: "Jusqu'en 1080p" },
  es: { label: 'Duración máxima', price: '15 s', note: 'Hasta 1080p' },
};

const DECISION_PRESET_IDS: VideoPricePresetId[] = [
  '5s-720p',
  '8s-1080p',
  '10s-1080p',
  '10s-1080p-audio',
];

export function buildModelDecisionPricingScenarios(
  engine: FalEngineEntry,
  locale: AppLocale
): ModelDecisionPricingScenario[] {
  const presetById = new Map(VIDEO_PRICE_PRESETS.map((preset) => [preset.id, preset]));
  const scenarioCopy = SCENARIO_NOTES[locale] ?? SCENARIO_NOTES.en;
  const scenarios = DECISION_PRESET_IDS.flatMap((id) => {
    const preset = presetById.get(id);
    const copy = scenarioCopy[id];
    if (!preset || !copy) return [];
    const quote = getPresetQuote(engine, preset, locale);
    return [
      {
        id,
        label: copy.label,
        price: quote.display ?? 'Live price',
        note: copy.note,
        featured: copy.featured,
      },
    ];
  });
  const maxCopy = MAX_DURATION_COPY[locale] ?? MAX_DURATION_COPY.en;
  return [...scenarios, { id: 'max-duration', ...maxCopy }];
}
```

- [ ] **Step 4: Implement decision data**

Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`:

```ts
import type { AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { FalEngineEntry } from '@/config/falEngines';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';
import {
  buildModelDecisionPricingScenarios as buildPricingScenarios,
  type ModelDecisionPricingScenario,
} from './model-page-decision-pricing';

export type ModelDecisionLink = {
  label: string;
  href: LocalizedLinkHref;
};

export type ModelDecisionFeature = {
  title: string;
  body: string;
  tone: 'audio' | 'continuity' | 'reference' | 'quality' | 'duration' | 'price';
};

export type ModelDecisionCard = {
  title: string;
  body: string;
  cta: ModelDecisionLink;
};

export type ModelDecisionData = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    paragraph: string;
    primaryCta: ModelDecisionLink;
    secondaryCta: ModelDecisionLink;
    quickLinks: ModelDecisionLink[];
  };
  media: {
    caption: string;
    description: string;
    renderLabel: string;
    badges: string[];
    altContext: string;
  };
  features: ModelDecisionFeature[];
  pricing: {
    title: string;
    subtitle: string;
    cta: ModelDecisionLink;
    footnote: string;
    scenarios: ModelDecisionPricingScenario[];
  };
  decisionCards: ModelDecisionCard[];
  meta: {
    title: string;
    description: string;
  };
};

const PRICING_SLUG_MAP = buildSlugMap('pricing');

function pricingHref(locale: AppLocale): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const pricingSlug = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en ?? 'pricing';
  return `${prefix}/${pricingSlug}#seedance-2-0-pricing`.replace(/\/{2,}/g, '/');
}

function compareHref(locale: AppLocale, left: string, right: string, orderSlug = left): string {
  const compareBase = COMPARE_BASE_PATH_MAP[locale] ?? COMPARE_BASE_PATH_MAP.en ?? 'ai-video-engines';
  return buildCanonicalComparePath({
    compareBase,
    pairSlug: [left, right].sort().join('-vs-'),
    orderSlug,
  });
}

const COPY: Record<AppLocale, Omit<ModelDecisionData, 'pricing'> & {
  pricingCopy: Omit<ModelDecisionData['pricing'], 'scenarios' | 'cta'> & { ctaLabel: string };
}> = {
  en: {
    hero: {
      eyebrow: 'BYTEDANCE CURRENT-GEN MODEL',
      title: 'Seedance 2.0',
      subtitle:
        'Native audio, multi-shot continuity, and reference-guided video for polished ads, launches and cinematic branded content.',
      paragraph:
        'Use Seedance 2.0 when you need the current Seedance production route: stronger continuity than older versions, native audio in the same generation flow, and multimodal references for text-to-video or image-to-video work.',
      primaryCta: { label: 'Generate with Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'View examples', href: { pathname: '/examples', query: { engine: 'seedance-2-0' } } },
      quickLinks: [
        { label: 'Compare vs Fast', href: compareHref('en', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'View pricing', href: pricingHref('en') },
        { label: 'Prompt examples', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Seedance 2.0 example',
      description: 'Native-audio cinematic sequence',
      renderLabel: 'View render',
      badges: ['Audio on', '12s', '16:9'],
      altContext: 'cinematic rooftop running scene',
    },
    features: [
      { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', tone: 'audio' },
      { title: 'Multi-shot continuity', body: 'Keep characters, style and scene continuity across short sequences.', tone: 'continuity' },
      { title: 'Reference-guided', body: 'Use supported references to guide the output.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Crisp output for most production needs.', tone: 'quality' },
      { title: 'Max 15s', body: 'Up to 15 seconds per generation.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 or Fast?',
        body: 'Use Seedance 2.0 for final-quality, native-audio, multi-shot work. Use Fast for cheaper draft passes and timing tests.',
        cta: { label: 'Compare Seedance 2.0 vs Fast', href: compareHref('en', 'seedance-2-0', 'seedance-2-0-fast') },
      },
      {
        title: 'Upgrading from Seedance 1.5?',
        body: 'Seedance 2.0 is the current route for stronger multi-shot continuity, native audio and broader reference workflows.',
        cta: { label: 'Compare 1.5 vs 2.0', href: compareHref('en', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0') },
      },
      {
        title: 'Need prompt examples?',
        body: 'Start with text-to-video, image-to-video, reference-guided and multi-shot prompt templates.',
        cta: { label: 'Open Prompt Lab', href: '#image-to-video' },
      },
    ],
    pricingCopy: {
      title: 'Seedance 2.0 pricing at a glance',
      subtitle: 'Preset total prices - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
    },
    meta: {
      title: 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI',
      description:
        'Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODELE BYTEDANCE DE GENERATION ACTUELLE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio natif, continuite multi-plans et video guidee par reference pour des publicites, lancements et contenus de marque cinematographiques.',
      paragraph:
        "Utilisez Seedance 2.0 quand vous voulez la route Seedance de production actuelle : meilleure continuite que les versions precedentes, audio natif dans le meme flux et references multimodales pour le texte-vers-video ou l'image-vers-video.",
      primaryCta: { label: 'Generer avec Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Voir les exemples', href: { pathname: '/examples', query: { engine: 'seedance-2-0' } } },
      quickLinks: [
        { label: 'Comparer vs Fast', href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr') },
        { label: 'Exemples de prompts', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Exemple Seedance 2.0',
      description: 'Sequence cinematographique avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio on', '12 s', '16:9'],
      altContext: 'scene cinematographique de course sur un toit',
    },
    features: [
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX generes en synchronisation.', tone: 'audio' },
      { title: 'Continuite multi-plans', body: 'Gardez les personnages, le style et la scene coherents.', tone: 'continuity' },
      { title: 'Guide par references', body: 'Utilisez les references prises en charge pour guider le rendu.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Sortie nette pour la plupart des besoins de production.', tone: 'quality' },
      { title: 'Max 15 s', body: "Jusqu'a 15 secondes par generation.", tone: 'duration' },
      { title: 'Paiement a l’usage', body: 'Voyez le prix exact avant de generer.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 ou Fast ?',
        body: 'Utilisez Seedance 2.0 pour les rendus finaux, audio natif et multi-plans. Utilisez Fast pour les brouillons moins chers et les tests de rythme.',
        cta: { label: 'Comparer Seedance 2.0 vs Fast', href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast') },
      },
      {
        title: 'Vous venez de Seedance 1.5 ?',
        body: 'Seedance 2.0 est la route actuelle pour une meilleure continuite multi-plans, audio natif et des workflows de reference plus larges.',
        cta: { label: 'Comparer 1.5 vs 2.0', href: compareHref('fr', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0') },
      },
      {
        title: 'Besoin d’exemples de prompts ?',
        body: 'Commencez avec des modeles texte-vers-video, image-vers-video, references et multi-plans.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#image-to-video' },
      },
    ],
    pricingCopy: {
      title: 'Tarifs Seedance 2.0 en un coup d’oeil',
      subtitle: 'Prix totaux par scenario - voyez le prix exact dans l’app avant de generer.',
      footnote: 'Tous les prix sont des prix affiches MaxVideoAI en credits USD pour des scenarios predefinis.',
      ctaLabel: 'Voir tous les tarifs',
    },
    meta: {
      title: 'Seedance 2.0 : tarifs, audio natif et exemples | MaxVideoAI',
      description:
        'Explorez les tarifs Seedance 2.0, les exemples, l’audio natif, la video multi-plans et les workflows guides par reference. Comparez Seedance 2.0 vs Fast et les anciennes versions.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO ACTUAL DE BYTEDANCE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio nativo, continuidad multi-shot y video guiado por referencias para anuncios, lanzamientos y contenido de marca cinematografico.',
      paragraph:
        'Usa Seedance 2.0 cuando necesites la ruta Seedance de produccion actual: mas continuidad que versiones anteriores, audio nativo en el mismo flujo y referencias multimodales para texto a video o imagen a video.',
      primaryCta: { label: 'Generar con Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Ver ejemplos', href: { pathname: '/examples', query: { engine: 'seedance-2-0' } } },
      quickLinks: [
        { label: 'Comparar vs Fast', href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Ver precios', href: pricingHref('es') },
        { label: 'Ejemplos de prompts', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Ejemplo Seedance 2.0',
      description: 'Secuencia cinematografica con audio nativo',
      renderLabel: 'Ver render',
      badges: ['Audio on', '12 s', '16:9'],
      altContext: 'escena cinematografica de carrera en una azotea',
    },
    features: [
      { title: 'Audio nativo', body: 'Dialogo, ambiente y SFX generados en sincronizacion.', tone: 'audio' },
      { title: 'Continuidad multi-shot', body: 'Mantiene personajes, estilo y escena coherentes.', tone: 'continuity' },
      { title: 'Guiado por referencias', body: 'Usa referencias compatibles para guiar el resultado.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Salida nitida para la mayoria de necesidades de produccion.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Hasta 15 segundos por generacion.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 o Fast?',
        body: 'Usa Seedance 2.0 para trabajo final con audio nativo y multi-shot. Usa Fast para borradores mas baratos y pruebas de ritmo.',
        cta: { label: 'Comparar Seedance 2.0 vs Fast', href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast') },
      },
      {
        title: 'Vienes de Seedance 1.5?',
        body: 'Seedance 2.0 es la ruta actual para mas continuidad multi-shot, audio nativo y flujos con referencias mas amplios.',
        cta: { label: 'Comparar 1.5 vs 2.0', href: compareHref('es', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0') },
      },
      {
        title: 'Necesitas prompts?',
        body: 'Empieza con plantillas de texto a video, imagen a video, referencias y multi-shot.',
        cta: { label: 'Abrir Prompt Lab', href: '#image-to-video' },
      },
    ],
    pricingCopy: {
      title: 'Precios de Seedance 2.0 de un vistazo',
      subtitle: 'Precios totales por escenario - ve el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en creditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
    },
    meta: {
      title: 'Seedance 2.0: precios, audio nativo y ejemplos | MaxVideoAI',
      description:
        'Explora precios de Seedance 2.0, ejemplos, audio nativo, video multi-shot y flujos guiados por referencias. Compara Seedance 2.0 vs Fast y versiones anteriores.',
    },
  },
};

export function buildModelDecisionPricingScenarios(engine: FalEngineEntry, locale: AppLocale) {
  return buildPricingScenarios(engine, locale);
}

export function buildModelDecisionData({
  engine,
  locale,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
}): ModelDecisionData | null {
  if (engine.modelSlug !== 'seedance-2-0') return null;
  const copy = COPY[locale] ?? COPY.en;
  return {
    ...copy,
    pricing: {
      ...copy.pricingCopy,
      cta: { label: copy.pricingCopy.ctaLabel, href: pricingHref(locale) },
      scenarios: buildPricingScenarios(engine, locale),
    },
  };
}
```

- [ ] **Step 5: Run test and typecheck enough to catch import mistakes**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts
```

Expected: PASS.

Run:

```bash
npm --prefix frontend run lint -- --file 'app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts'
```

Expected: PASS. If the project lint command rejects the `--file` flag, run `npm --prefix frontend run lint` and expect PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/model-page-decision-data.test.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-decision-data.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-decision-pricing.ts
git commit -m "feat: add Seedance decision page data"
```

## Task 2: Build Decision Hero, Pricing, And Cards Components

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MediaPreview.tsx` only if the hero cannot be rendered cleanly without new props.

- [ ] **Step 1: Write architecture test for component boundaries**

Modify `tests/model-page-layout-architecture.test.ts` by adding:

```ts
const decisionDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts');
const decisionPricingPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts');
const decisionHeroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx');
const decisionPricingCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx');
const decisionCardsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx');

test('model decision template keeps hero, pricing, and cards split', () => {
  for (const path of [decisionDataPath, decisionPricingPath, decisionHeroPath, decisionPricingCardPath, decisionCardsPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const decisionDataSource = readSource(decisionDataPath);
  const decisionPricingSource = readSource(decisionPricingPath);
  const decisionHeroSource = readSource(decisionHeroPath);
  const decisionPricingCardSource = readSource(decisionPricingCardPath);
  const decisionCardsSource = readSource(decisionCardsPath);

  assert.match(layoutSource, /buildModelDecisionData/, 'layout should delegate decision data selection');
  assert.match(layoutSource, /ModelDecisionHeroSection/, 'layout should render the decision hero when available');
  assert.match(layoutSource, /ModelDecisionPricingCard/, 'layout should render decision pricing when available');
  assert.match(layoutSource, /ModelDecisionCardsSection/, 'layout should render decision cards when available');
  assert.match(decisionDataSource, /seedance-2-0/, 'decision data should own first Seedance activation');
  assert.match(decisionPricingSource, /getPresetQuote/, 'decision pricing should reuse pricing-page preset quotes');
  assert.match(decisionPricingSource, /VIDEO_PRICE_PRESETS/, 'decision pricing should reuse pricing-page presets');
  assert.match(decisionHeroSource, /grid.*lg:grid-cols/, 'decision hero should own two-column layout');
  assert.match(decisionHeroSource, /ModelHeroMedia|MediaPreview|Image/, 'decision hero should render media in the hero');
  assert.match(decisionPricingCardSource, /Seedance 2\.0 pricing at a glance|pricing\.title/, 'pricing card should own pricing markup');
  assert.match(decisionCardsSource, /decisionCards\.map/, 'decision cards component should own decision card markup');
  assert.doesNotMatch(layoutSource, /Seedance 2\.0 or Fast\?/, 'layout must not own decision-card copy');
});
```

- [ ] **Step 2: Run architecture test and verify it fails**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-layout-architecture.test.ts
```

Expected: FAIL because component files do not exist.

- [ ] **Step 3: Create pricing card component**

Create `ModelDecisionPricingCard.tsx`:

```tsx
import { Link } from '@/i18n/navigation';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';

export function ModelDecisionPricingCard({ pricing }: { pricing: ModelDecisionData['pricing'] }) {
  return (
    <section className="rounded-[22px] border border-hairline bg-surface px-5 py-5 shadow-card sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">{pricing.title}</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{pricing.subtitle}</p>
        </div>
        <Link
          href={pricing.cta.href}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:border-brand/35 hover:text-brand"
        >
          {pricing.cta.label}
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {pricing.scenarios.map((scenario) => (
          <article
            key={scenario.id}
            className={[
              'rounded-[14px] border bg-surface px-4 py-4',
              scenario.featured ? 'border-emerald-300 shadow-card' : 'border-hairline',
            ].join(' ')}
          >
            <p className="text-sm font-semibold text-text-secondary">{scenario.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-text-primary">{scenario.price}</p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{scenario.note}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-text-muted">{pricing.footnote}</p>
    </section>
  );
}
```

- [ ] **Step 4: Create decision cards component**

Create `ModelDecisionCardsSection.tsx`:

```tsx
import { ArrowRight, GitCompareArrows, Lightbulb, WandSparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';

const ICONS = [GitCompareArrows, WandSparkles, Lightbulb] as const;

export function ModelDecisionCardsSection({ cards }: { cards: ModelDecisionData['decisionCards'] }) {
  if (!cards.length) return null;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card, index) => {
        const Icon = ICONS[index] ?? Lightbulb;
        return (
          <article key={card.title} className="rounded-[18px] border border-hairline bg-surface p-5 shadow-card">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-alt text-brand">
              <UIIcon icon={Icon} size={18} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-primary">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
            <Link href={card.cta.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
              <span>{card.cta.label}</span>
              <UIIcon icon={ArrowRight} size={14} />
            </Link>
          </article>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 5: Create decision hero component**

Create `ModelDecisionHeroSection.tsx`:

```tsx
import { ArrowRight, BadgeDollarSign, Clock3, Film, GitCompareArrows, ImageIcon, Layers3, PlayCircle, Volume2 } from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';
import type { FeaturedMedia } from '../_lib/model-page-media';
import type { ModelDecisionData, ModelDecisionFeature } from '../_lib/model-page-decision-data';
import { MediaPreview } from './MediaPreview';

const FEATURE_ICONS: Record<ModelDecisionFeature['tone'], typeof Volume2> = {
  audio: Volume2,
  continuity: Layers3,
  reference: ImageIcon,
  quality: Film,
  duration: Clock3,
  price: BadgeDollarSign,
};

const QUICK_LINK_ICONS = [GitCompareArrows, BadgeDollarSign, PlayCircle] as const;

export function ModelDecisionHeroSection({
  decision,
  modelsPathname,
  backLabel,
  localizeModelsPath,
  resolvedBreadcrumb,
  breadcrumbModelLabel,
  heroMedia,
  locale,
  audioBadgeLabel,
  mediaAltContext,
}: {
  decision: ModelDecisionData;
  modelsPathname: string;
  backLabel: string;
  localizeModelsPath: (targetSlug?: string) => string;
  resolvedBreadcrumb: { models: string };
  breadcrumbModelLabel: string;
  heroMedia: FeaturedMedia;
  locale: AppLocale;
  audioBadgeLabel: string;
  mediaAltContext: string;
}) {
  return (
    <div className="stack-gap">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <BackLink href={modelsPathname} label={backLabel} className="font-semibold text-text-secondary hover:text-text-primary" />
        <span aria-hidden>/</span>
        <Link href={localizeModelsPath()} className="font-semibold text-text-secondary hover:text-text-primary">
          {resolvedBreadcrumb.models}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-text-muted">{breadcrumbModelLabel}</span>
      </nav>

      <section className="rounded-[28px] border border-hairline bg-gradient-to-br from-surface via-surface to-brand/5 p-5 shadow-card sm:p-7 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(420px,1.16fr)] lg:items-center">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand">
              {decision.hero.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal text-text-primary sm:text-6xl">
              {decision.hero.title}
            </h1>
            <p className="mt-4 text-xl font-semibold leading-tight text-text-primary sm:text-2xl">
              {decision.hero.subtitle}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
              {decision.hero.paragraph}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={decision.hero.primaryCta.href} size="lg" className="bg-[#071126] text-white shadow-card hover:bg-[#101a33]" linkComponent={Link}>
                {decision.hero.primaryCta.label}
              </ButtonLink>
              <ButtonLink href={decision.hero.secondaryCta.href as LocalizedLinkHref} variant="outline" size="lg" linkComponent={Link}>
                {decision.hero.secondaryCta.label}
              </ButtonLink>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {decision.hero.quickLinks.map((link, index) => {
                const Icon = QUICK_LINK_ICONS[index] ?? ArrowRight;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-text-secondary transition hover:bg-surface hover:text-brand"
                  >
                    <UIIcon icon={Icon} size={15} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-hairline bg-surface p-2 shadow-card">
            <MediaPreview
              media={heroMedia}
              label={decision.media.caption}
              locale={locale}
              audioBadgeLabel={audioBadgeLabel}
              renderLinkLabel={decision.media.renderLabel}
              hidePrompt
              metaLines={[
                { label: decision.media.caption, value: decision.media.description },
                { label: 'Format', value: decision.media.badges.filter((badge) => badge !== 'Audio on').join(' · ') },
              ]}
              altContext={mediaAltContext || decision.media.altContext}
              showPlayButton={false}
              priority
              fetchPriority="high"
            />
          </div>
        </div>

        <div className="mt-7 grid gap-3 rounded-[22px] border border-hairline bg-surface/90 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
          {decision.features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.tone];
            return (
              <article key={feature.title} className="rounded-[16px] px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <UIIcon icon={Icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{feature.title}</p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">{feature.body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Run architecture test**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-layout-architecture.test.ts
```

Expected: FAIL only because `MarketingModelPageLayout.tsx` is not wired yet.

- [ ] **Step 7: Commit**

```bash
git add tests/model-page-layout-architecture.test.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/ModelDecisionHeroSection.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/ModelDecisionPricingCard.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/ModelDecisionCardsSection.tsx
git commit -m "feat: add model decision hero components"
```

## Task 3: Wire Seedance 2.0 Decision Top Page

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`

- [ ] **Step 1: Wire components into layout**

Modify imports in `MarketingModelPageLayout.tsx`:

```tsx
import { buildModelDecisionData } from '../_lib/model-page-decision-data';
import { ModelDecisionHeroSection } from './ModelDecisionHeroSection';
import { ModelDecisionPricingCard } from './ModelDecisionPricingCard';
import { ModelDecisionCardsSection } from './ModelDecisionCardsSection';
```

Add after `const statusLabels = resolveSpecStatusLabels(locale);`:

```tsx
const decisionData = buildModelDecisionData({ engine, locale });
```

Replace the existing unconditional `<ModelHeroSection ... />` render with:

```tsx
{decisionData ? (
  <>
    <ModelDecisionHeroSection
      decision={decisionData}
      modelsPathname={modelsPathname}
      backLabel={backLabel}
      localizeModelsPath={localizeModelsPath}
      resolvedBreadcrumb={resolvedBreadcrumb}
      breadcrumbModelLabel={breadcrumbModelLabel}
      heroMedia={heroMedia}
      locale={locale}
      audioBadgeLabel={audioBadgeLabel}
      mediaAltContext={mediaAltContexts.hero}
    />
    <ModelDecisionPricingCard pricing={decisionData.pricing} />
    <ModelDecisionCardsSection cards={decisionData.decisionCards} />
  </>
) : (
  <ModelHeroSection
    modelsPathname={modelsPathname}
    backLabel={backLabel}
    localizeModelsPath={localizeModelsPath}
    resolvedBreadcrumb={resolvedBreadcrumb}
    breadcrumbModelLabel={breadcrumbModelLabel}
    heroEyebrow={heroEyebrow}
    heroTitle={heroTitle}
    heroSubtitle={heroSubtitle}
    heroSupportLine={heroSupportLine}
    heroSpecChips={heroSpecChips}
    heroBadge={heroBadge}
    heroLimitsLine={heroLimitsLine}
    showHeroDescriptions={showHeroDescriptions}
    heroDesc1={heroDesc1}
    heroDesc2={heroDesc2}
    resolvedPrimaryCta={resolvedPrimaryCta}
    normalizedPrimaryCtaHref={normalizedPrimaryCtaHref}
    secondaryCta={secondaryCta}
    localizedSecondaryCtaHref={localizedSecondaryCtaHref}
    heroQuickLinks={heroQuickLinks}
    pricingLinkHref={pricingLinkHref}
    pricingLinkLabel={pricingLinkLabel}
    heroTrustLine={heroTrustLine}
    isEsLocale={isEsLocale}
    howToLatamTitle={howToLatamTitle}
    howToLatamSteps={howToLatamSteps}
    heroMedia={heroMedia}
    locale={locale}
    audioBadgeLabel={audioBadgeLabel}
    heroMetaLines={heroMetaLines}
    mediaAltContexts={mediaAltContexts}
    bestUseCaseItems={bestUseCaseItems}
    bestUseCases={bestUseCases}
    bestUseCasesTitle={copy.bestUseCasesTitle}
    whyTitle={copy.whyTitle}
    heroHighlights={heroHighlights}
  />
)}
```

- [ ] **Step 2: Prevent duplicate old pricing callout above early pricing**

Change:

```tsx
<ModelPricingCallout callout={pricingCallout} />
```

to:

```tsx
{decisionData ? null : <ModelPricingCallout callout={pricingCallout} />}
```

This keeps the old compact callout for non-migrated model pages and avoids duplicate pricing CTAs for Seedance 2.0.

- [ ] **Step 3: Update Seedance metadata path**

In `page.tsx`, import:

```ts
import { buildModelDecisionData } from './_lib/model-page-decision-data';
```

Inside `generateMetadata`, after localized content is resolved, add:

```ts
const decisionData = buildModelDecisionData({ engine, locale });
```

Change title and description selection:

```ts
const title = decisionData?.meta.title ?? localized.seo.title ?? fallbackTitle;
const description =
  decisionData?.meta.description ??
  localized.seo.description ??
  engine.seo.description ??
  'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts tests/model-page-layout-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/MarketingModelPageLayout.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/page.tsx
git commit -m "feat: wire Seedance decision hero"
```

## Task 4: Improve Examples, Prompt Lab, And Alt Text Lightly

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`

- [ ] **Step 1: Add concise example metadata labels**

In `ModelExamplesSection.tsx`, add helper:

```tsx
function buildExampleMeta(video: ExampleGalleryVideo, locale: AppLocale) {
  const parts = [
    typeof video.durationSec === 'number' ? `${video.durationSec}s` : null,
    video.aspectRatio ?? null,
    video.hasAudio ? (locale === 'fr' ? 'Audio on' : locale === 'es' ? 'Audio on' : 'Audio on') : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
}
```

Change card metadata:

```tsx
<p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
  {video.engineLabel} · {video.durationSec}s
</p>
```

to:

```tsx
<p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
  {buildExampleMeta(video, locale) || video.engineLabel}
</p>
```

Add a second link when `video.href` exists:

```tsx
<TextLink href={video.href} className="text-[11px]" linkComponent={Link}>
  {locale === 'fr' ? 'Voir le rendu' : locale === 'es' ? 'Ver render' : 'View render'}
</TextLink>
```

- [ ] **Step 2: Keep alt text concise**

In `MarketingModelPageLayout.tsx`, change the `galleryPreviewAlts` mapping to use a shorter label for Seedance 2.0:

```tsx
const galleryPreviewAlts = dedupeAltsInList(
  galleryVideos.slice(0, 6).map((video, index) => ({
    id: video.id,
    alt:
      engine.modelSlug === 'seedance-2-0'
        ? getImageAlt({
            kind: 'renderThumb',
            engine: video.engineLabel,
            label: `${heroTitle} example`,
            prompt: `${heroTitle} example`,
            locale,
          })
        : getImageAlt({
            kind: 'renderThumb',
            engine: video.engineLabel,
            label: video.promptFull ?? video.prompt,
            prompt: video.promptFull ?? video.prompt,
            locale,
          }),
    tag: inferRenderTag(video.promptFull ?? video.prompt, locale),
    index,
    locale,
  }))
);
```

- [ ] **Step 3: Add Seedance reference workflow block above Prompt Lab**

In `ModelPromptingSection.tsx`, add prop:

```ts
decisionReferenceWorkflows?: Array<{ title: string; body: string }>;
```

Render before `SoraPromptingTabs`:

```tsx
{decisionReferenceWorkflows?.length ? (
  <div className="grid gap-3 md:grid-cols-2">
    {decisionReferenceWorkflows.map((item) => (
      <article key={item.title} className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card">
        <h2 className="text-base font-semibold text-text-primary">{item.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
      </article>
    ))}
  </div>
) : null}
```

Add `referenceWorkflows` to `ModelDecisionData` and keep the copy localized in `model-page-decision-data.ts`:

```ts
referenceWorkflows: Array<{ title: string; body: string }>;
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts tests/model-page-layout-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/ModelExamplesSection.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/ModelPromptingSection.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_components/MarketingModelPageLayout.tsx frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-decision-data.ts tests/model-page-decision-data.test.ts
git commit -m "feat: refine Seedance examples and prompts"
```

## Task 5: Full Validation And Browser Smoke Test

**Files:**
- Modify only if validation finds defects.

- [ ] **Step 1: Run focused architecture and pricing tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts tests/model-page-layout-architecture.test.ts tests/pricing-page-architecture.test.ts tests/seedance-2-pricing.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint and exposure checks**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm --prefix frontend run dev
```

Expected: server starts on the configured Next.js port. If the default port is occupied, use the printed alternate URL.

- [ ] **Step 4: Browser smoke test**

Open these routes:

```txt
http://localhost:3000/models/seedance-2-0
http://localhost:3000/fr/modeles/seedance-2-0
http://localhost:3000/es/modelos/seedance-2-0
```

Check:

- hero is two-column on desktop
- video card is in the hero
- feature strip sits directly under hero
- pricing card appears before long technical sections
- no hero link soup
- decision cards render
- pricing link reaches `#seedance-2-0-pricing`
- comparison link resolves
- Prompt Lab anchor scrolls to prompting section
- no obvious text overlap on mobile
- no broken hero media

- [ ] **Step 5: Commit validation fixes**

If validation finds defects in files touched by this plan, return to the owning task, apply the targeted fix, rerun that task's focused tests, and commit the corrected files with the task's commit pattern. Do not create an empty commit.

## Self-Review

Spec coverage:

- Hero, media card, feature strip, pricing card, decision cards: Tasks 1-3.
- Shared pricing helper requirement: Task 1 uses pricing-page `VIDEO_PRICE_PRESETS` and `getPresetQuote`.
- Metadata: Task 3.
- Examples and Prompt Lab improvements: Task 4.
- Cannibalization: Task 1 asserts Fast does not activate the Seedance 2.0 template; data copy keeps distinct intent.
- Localized EN/FR/ES strings: Task 1 test checks EN/FR/ES data exists.
- Canonical/hreflang/JSON-LD preservation: Task 3 avoids changing metadata URL builders and schema builders; Task 5 verifies.

Placeholder scan:

- No placeholder markers are intentionally left in implementation steps.
- The only conditional implementation note is the MediaPreview extension, which is bounded to a specific file and is not required if the new hero component can render through existing props.

Type consistency:

- `ModelDecisionData`, `ModelDecisionPricingScenario`, `buildModelDecisionData`, and `buildModelDecisionPricingScenarios` are introduced before component wiring.
- Pricing scenario ids match `VideoPricePresetId` plus `max-duration`.
- Components consume `ModelDecisionData` directly to avoid duplicated prop shape definitions.
