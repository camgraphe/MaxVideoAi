# Model Page Template Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the new Seedance 2.0 decision page into the reusable model-page template, then migrate the highest-value model pages without SEO cannibalization or localization regressions.

**Architecture:** Keep `page.tsx` as the route orchestrator and keep the template experience inside the existing route-local `_components/` and `_lib/` folders. Extract the Seedance-specific decisions into typed template configs, while shared components render a common `ModelPageTemplateData` contract. Engine config and pricing helpers remain the source of truth for capabilities, specs, and prices; localized content supplies positioning copy and editorial prioritization.

**Tech Stack:** Next.js App Router, React Server Components, route-local client components, TypeScript, localized JSON content under `content/models/{locale}/`, Node test runner with `tsx`, existing pricing/spec/schema helpers.

---

## File Structure

Create:
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts`  
  Owns the reusable template data contracts.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`  
  Resolves a model slug to a template config and blocks non-migrated models from accidentally using the decision template.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0.ts`  
  Seedance 2.0 production-route template config.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0-fast.ts`  
  Seedance Fast draft-route template config, added only after the registry is stable.
- `tests/model-page-template-registry.test.ts`  
  Locks routing, pricing, cannibalization, and localization behavior for migrated template pages.

Modify:
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`  
  Convert from Seedance-only builder to generic template data builder.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`  
  Accept pricing scenario presets from template config instead of owning a Seedance-only preset list.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-toc.ts`  
  Keep TOC generated from actual rendered sections.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`  
  Rename internal decision concepts toward template concepts only if the diff stays small.
- `content/models/en/*.json`, `content/models/fr/*.json`, `content/models/es/*.json`  
  Add template-facing copy only for migrated models.
- `tests/model-page-decision-data.test.ts`  
  Keep Seedance 2.0 regression tests; move cross-model tests into the new registry test.
- `tests/model-page-layout-architecture.test.ts`  
  Lock the route/component boundary after extraction.

Do not modify:
- canonical route builders unless a test proves a regression;
- sitemap generation unless migrated pages are missing;
- pricing algorithms outside the existing shared pricing path.

---

### Task 1: Add The Template Contract

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts`
- Test: `tests/model-page-template-registry.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add this test file:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts';

test('model page template config separates SEO intent from shared layout slots', () => {
  const config: ModelPageTemplateConfig = {
    slug: 'example-engine',
    intent: 'production',
    hero: {
      eyebrow: 'CURRENT-GEN MODEL',
      subtitleHighlightTerms: ['Native audio'],
      primaryCtaHref: '/app?engine=example-engine',
      secondaryCtaHref: '/examples/example-engine',
      quickLinks: [{ labelKey: 'compareFast', href: '/ai-video-engines/example-vs-fast', icon: 'compare' }],
    },
    pricing: {
      anchorHref: '/pricing#example-engine-pricing',
      presets: [{ id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'commonProductionCheck' }],
    },
    sections: {
      examples: true,
      prompting: true,
      tips: true,
      compare: true,
      specs: true,
      safety: true,
      faq: true,
    },
  };

  assert.equal(config.intent, 'production');
  assert.equal(config.pricing.presets[0]?.seconds, 10);
  assert.equal(config.sections.prompting, true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because `model-page-template-types.ts` does not exist.

- [ ] **Step 3: Create the template contract**

Create `model-page-template-types.ts`:

```ts
import type { Locale } from '@/i18n/locales';

export type ModelPageTemplateIntent = 'production' | 'draft' | 'reference-prep' | 'specialized';

export type ModelPageTemplateIcon =
  | 'app'
  | 'audio'
  | 'compare'
  | 'examples'
  | 'image'
  | 'pricing'
  | 'prompt'
  | 'speed'
  | 'video';

export type ModelPagePricingPreset = {
  id: string;
  seconds?: number;
  resolution?: '480p' | '720p' | '1080p';
  labelKey: string;
  noteKey?: string;
  highlightKey?: string;
  fixedValueKey?: string;
};

export type ModelPageTemplateQuickLink = {
  labelKey: string;
  href: string;
  icon: ModelPageTemplateIcon;
};

export type ModelPageTemplateConfig = {
  slug: string;
  intent: ModelPageTemplateIntent;
  hero: {
    eyebrow: string;
    subtitleHighlightTerms: string[];
    primaryCtaHref: string;
    secondaryCtaHref: string;
    quickLinks: ModelPageTemplateQuickLink[];
  };
  pricing: {
    anchorHref: string;
    presets: ModelPagePricingPreset[];
  };
  sections: {
    examples: boolean;
    prompting: boolean;
    tips: boolean;
    compare: boolean;
    specs: boolean;
    safety: boolean;
    faq: boolean;
  };
};

export type LocalizedModelTemplateConfig = ModelPageTemplateConfig & {
  locale: Locale;
};
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/model-page-template-registry.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts'
git commit -m "Add model page template contract"
```

---

### Task 2: Move Seedance 2.0 Into A Template Config

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
- Test: `tests/model-page-template-registry.test.ts`

- [ ] **Step 1: Add registry tests**

Append to `tests/model-page-template-registry.test.ts`:

```ts
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

test('template registry enables Seedance 2.0 and leaves Fast on legacy page until migrated', () => {
  const seedance = getModelPageTemplateConfig('seedance-2-0');
  const fast = getModelPageTemplateConfig('seedance-2-0-fast');

  assert.ok(seedance);
  assert.equal(seedance.intent, 'production');
  assert.equal(seedance.hero.primaryCtaHref, '/app?engine=seedance-2-0');
  assert.equal(seedance.pricing.anchorHref, '/pricing#seedance-2-0-pricing');
  assert.deepEqual(
    seedance.pricing.presets.map((preset) => preset.id),
    ['5s-480p', '8s-720p', '10s-1080p', 'audio-included', 'max-duration']
  );
  assert.equal(fast, null);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Create Seedance template config**

Create `model-page-templates/seedance-2-0.ts`:

```ts
import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance20TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-0',
  intent: 'production',
  hero: {
    eyebrow: 'BYTEDANCE CURRENT-GEN MODEL',
    subtitleHighlightTerms: ['Native audio', 'multi-shot continuity', 'reference-guided video'],
    primaryCtaHref: '/app?engine=seedance-2-0',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#seedance-2-0-pricing',
        icon: 'pricing',
      },
      {
        labelKey: 'promptExamples',
        href: '#prompting',
        icon: 'prompt',
      },
    ],
  },
  pricing: {
    anchorHref: '/pricing#seedance-2-0-pricing',
    presets: [
      { id: '5s-480p', seconds: 5, resolution: '480p', labelKey: 'entryDraft' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview' },
      { id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'commonProductionCheck', highlightKey: 'mostPopular' },
      { id: 'audio-included', fixedValueKey: 'audioExtraValue', labelKey: 'audio', noteKey: 'nativeAudioIncluded' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo1080p' },
    ],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
```

- [ ] **Step 4: Create the registry**

Create `model-page-template-registry.ts`:

```ts
import type { ModelPageTemplateConfig } from './model-page-template-types';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.keys(MODEL_PAGE_TEMPLATE_REGISTRY);
}
```

- [ ] **Step 5: Replace the hardcoded Seedance guard**

Modify `model-page-decision-data.ts` so the initial route guard becomes:

```ts
import { getModelPageTemplateConfig } from './model-page-template-registry';

export function buildModelDecisionData(input: BuildModelDecisionDataInput): ModelDecisionData | null {
  const template = getModelPageTemplateConfig(input.engine.id);

  if (!template) {
    return null;
  }

  // Keep the existing Seedance data composition in this pass.
  // Replace direct slug checks with template.slug where the current function needs the model id.
}
```

Remove the direct condition:

```ts
if (modelSlug !== 'seedance-2-0') {
  return null;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-decision-data.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/model-page-template-registry.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts'
git commit -m "Move Seedance model page into template registry"
```

---

### Task 3: Generalize Pricing Scenarios

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
- Test: `tests/model-page-decision-data.test.ts`
- Test: `tests/model-page-template-registry.test.ts`

- [ ] **Step 1: Add a test proving pricing presets come from config**

Append to `tests/model-page-template-registry.test.ts`:

```ts
test('Seedance template pricing presets are declarative and do not hardcode provider prices', () => {
  const seedance = getModelPageTemplateConfig('seedance-2-0');

  assert.ok(seedance);
  assert.equal(seedance.pricing.presets.some((preset) => preset.fixedValueKey === 'audioExtraValue'), true);
  assert.equal(seedance.pricing.presets.some((preset) => preset.seconds === 15 && preset.resolution === '1080p'), false);
});
```

- [ ] **Step 2: Run the test**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: PASS once Task 2 is done.

- [ ] **Step 3: Change pricing builder signature**

Modify `model-page-decision-pricing.ts` so the pricing builder accepts presets:

```ts
import type { ModelPagePricingPreset } from './model-page-template-types';

export function buildModelDecisionPricingScenarios(
  engine: FalEngine,
  locale: Locale,
  presets: ModelPagePricingPreset[]
): ModelDecisionPricingScenario[] {
  return presets.map((preset) => buildScenarioFromPreset(engine, locale, preset));
}
```

Add this helper in the same file:

```ts
function buildScenarioFromPreset(
  engine: FalEngine,
  locale: Locale,
  preset: ModelPagePricingPreset
): ModelDecisionPricingScenario {
  if (preset.fixedValueKey === 'audioExtraValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: getPricingLabel(locale, 'audioExtraValue'),
      note: getPricingLabel(locale, preset.noteKey ?? 'nativeAudioIncluded'),
    };
  }

  if (preset.fixedValueKey === 'maxDurationValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: getPricingLabel(locale, 'maxDurationValue'),
      note: getPricingLabel(locale, preset.noteKey ?? 'upTo1080p'),
    };
  }

  const quote = getPresetQuote(engine, {
    seconds: preset.seconds ?? 10,
    resolution: preset.resolution ?? '1080p',
  });

  return {
    id: preset.id,
    label: getPricingLabel(locale, preset.labelKey),
    value: quote.displayPrice,
    note: quote.subtitle,
    highlight: preset.highlightKey ? getPricingLabel(locale, preset.highlightKey) : undefined,
  };
}
```

- [ ] **Step 4: Pass template presets from decision data**

In `model-page-decision-data.ts`, replace:

```ts
const pricingScenarios = buildModelDecisionPricingScenarios(engine, locale);
```

with:

```ts
const pricingScenarios = buildModelDecisionPricingScenarios(engine, locale, template.pricing.presets);
```

- [ ] **Step 5: Run pricing tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-decision-data.test.ts tests/model-page-template-registry.test.ts
```

Expected: PASS and Seedance still shows `$0.88`, `$3.15`, `$8.84`, `$0 extra`, `15s`.

- [ ] **Step 6: Commit**

```bash
git add tests/model-page-decision-data.test.ts tests/model-page-template-registry.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts'
git commit -m "Generalize model page pricing presets"
```

---

### Task 4: Rename Shared Decision Internals To Template Internals

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
- Test: `tests/model-page-layout-architecture.test.ts`

- [ ] **Step 1: Add architecture expectations for template naming**

Update `tests/model-page-layout-architecture.test.ts` by changing the section name from:

```ts
test('model page layout delegates Seedance decision page ownership', () => {
```

to:

```ts
test('model page layout delegates template page ownership', () => {
```

Add this assertion near the existing layout assertions:

```ts
assert.match(layoutSource, /templateData\s*\?/, 'layout should conditionally use the template page experience');
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-layout-architecture.test.ts
```

Expected: FAIL while the layout still uses `decisionData`.

- [ ] **Step 3: Rename local variables only**

In `MarketingModelPageLayout.tsx`, rename local variables:

```ts
const decisionData = buildModelDecisionData(...)
```

to:

```ts
const templateData = buildModelDecisionData(...)
```

Then replace layout usage from `decisionData` to `templateData`. Do not rename exported components in this task.

- [ ] **Step 4: Keep exported component names stable**

Do not rename:

```ts
ModelDecisionHeroSection
ModelDecisionPricingCard
ModelDecisionPromptingSection
```

Those public component names can be renamed in a later cosmetic-only PR after all migrated model pages are stable.

- [ ] **Step 5: Run tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-layout-architecture.test.ts tests/model-page-decision-data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/model-page-layout-architecture.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx'
git commit -m "Clarify model page template ownership"
```

---

### Task 5: Add Content Readiness Checks For Migrated Models

**Files:**
- Create: `tests/model-page-template-content.test.ts`
- Modify: `content/models/en/seedance-2-0.json`
- Modify: `content/models/fr/seedance-2-0.json`
- Modify: `content/models/es/seedance-2-0.json`

- [ ] **Step 1: Add content test**

Create `tests/model-page-template-content.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readModelContent(locale: 'en' | 'fr' | 'es', slug: string) {
  return JSON.parse(readFileSync(join(root, `content/models/${locale}/${slug}.json`), 'utf8')) as Record<string, unknown>;
}

test('Seedance localized content has native copy and decision metadata', () => {
  const en = readModelContent('en', 'seedance-2-0');
  const fr = readModelContent('fr', 'seedance-2-0');
  const es = readModelContent('es', 'seedance-2-0');

  assert.equal(en.title, 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI');
  assert.match(String(fr.title), /tarifs, audio natif et exemples/);
  assert.match(String(es.title), /precios, audio nativo y ejemplos/);
  assert.doesNotMatch(JSON.stringify(fr), /workflow|render(?!ing)/i);
  assert.doesNotMatch(JSON.stringify(es), /workflow|render(?!izado)/i);
});
```

- [ ] **Step 2: Run the test**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-content.test.ts
```

Expected: PASS with the current Seedance localized content. If it fails on a legitimate localized term, replace only that assertion with a term-specific check that catches the actual regression risk.

- [ ] **Step 3: Commit**

```bash
git add tests/model-page-template-content.test.ts content/models/en/seedance-2-0.json content/models/fr/seedance-2-0.json content/models/es/seedance-2-0.json
git commit -m "Add model page localized content checks"
```

---

### Task 6: Migrate Seedance 2.0 Fast As The Draft Variant

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0-fast.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `content/models/en/seedance-2-0-fast.json`
- Modify: `content/models/fr/seedance-2-0-fast.json`
- Modify: `content/models/es/seedance-2-0-fast.json`
- Test: `tests/model-page-template-registry.test.ts`
- Test: `tests/model-page-template-content.test.ts`

- [ ] **Step 1: Add cannibalization test**

Append to `tests/model-page-template-registry.test.ts`:

```ts
test('Seedance 2.0 Fast template keeps draft intent distinct from Seedance 2.0 production intent', () => {
  const standard = getModelPageTemplateConfig('seedance-2-0');
  const fast = getModelPageTemplateConfig('seedance-2-0-fast');

  assert.ok(standard);
  assert.ok(fast);
  assert.equal(standard.intent, 'production');
  assert.equal(fast.intent, 'draft');
  assert.notEqual(standard.hero.primaryCtaHref, fast.hero.primaryCtaHref);
  assert.notDeepEqual(standard.hero.subtitleHighlightTerms, fast.hero.subtitleHighlightTerms);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because Fast is not registered yet.

- [ ] **Step 3: Create Fast template config**

Create `model-page-templates/seedance-2-0-fast.ts`:

```ts
import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance20FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-0-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'BYTEDANCE FAST DRAFT ROUTE',
    subtitleHighlightTerms: ['faster draft passes', 'timing tests', 'lower-cost iterations'],
    primaryCtaHref: '/app?engine=seedance-2-0-fast',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareStandard',
        href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#seedance-2-0-fast-pricing',
        icon: 'pricing',
      },
      {
        labelKey: 'promptExamples',
        href: '#prompting',
        icon: 'prompt',
      },
    ],
  },
  pricing: {
    anchorHref: '/pricing#seedance-2-0-fast-pricing',
    presets: [
      { id: '5s-480p', seconds: 5, resolution: '480p', labelKey: 'entryDraft' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview' },
      { id: '10s-720p', seconds: 10, resolution: '720p', labelKey: 'timingTest' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'checkLiveQuote' },
    ],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
```

- [ ] **Step 4: Register Fast**

Modify `model-page-template-registry.ts`:

```ts
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
};
```

- [ ] **Step 5: Update Fast localized metadata**

Use this intent, not Seedance 2.0 production copy:

EN title:

```txt
Seedance 2.0 Fast: Pricing, Drafts & Examples | MaxVideoAI
```

EN meta:

```txt
Explore Seedance 2.0 Fast for quicker draft passes, timing tests and lower-cost Seedance AI video iterations. Compare Fast vs Seedance 2.0.
```

FR title:

```txt
Seedance 2.0 Fast : tarifs, brouillons et exemples | MaxVideoAI
```

ES LatAm title:

```txt
Seedance 2.0 Fast: precios, borradores y ejemplos | MaxVideoAI
```

- [ ] **Step 6: Run tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-decision-data.test.ts
```

Expected: PASS and Fast has draft intent.

- [ ] **Step 7: Browser smoke test**

Run the dev server if needed:

```bash
npm --prefix frontend run dev -- --port 3000
```

Open:

```txt
http://localhost:3000/models/seedance-2-0-fast
http://localhost:3000/fr/modeles/seedance-2-0-fast
http://localhost:3000/es/modelos/seedance-2-0-fast
```

Expected:
- Fast hero says draft/iteration/timing, not production/native-audio final-quality framing.
- Pricing card uses Fast route pricing helper output.
- Canonical remains self-referential.

- [ ] **Step 8: Commit**

```bash
git add tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts content/models/en/seedance-2-0-fast.json content/models/fr/seedance-2-0-fast.json content/models/es/seedance-2-0-fast.json 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0-fast.ts'
git commit -m "Migrate Seedance Fast to model page template"
```

---

### Task 7: Migrate LTX 2.3 Fast As A Fast Draft Variant

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/ltx-2-3-fast.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `content/models/en/ltx-2-3-fast.json`
- Modify: `content/models/fr/ltx-2-3-fast.json`
- Modify: `content/models/es/ltx-2-3-fast.json`
- Test: `tests/model-page-template-registry.test.ts`

- [ ] **Step 1: Add LTX registry test**

Append:

```ts
test('LTX 2.3 Fast template is positioned as a lower-cost draft model', () => {
  const ltx = getModelPageTemplateConfig('ltx-2-3-fast');

  assert.ok(ltx);
  assert.equal(ltx.intent, 'draft');
  assert.equal(ltx.hero.primaryCtaHref, '/app?engine=ltx-2-3-fast');
  assert.match(ltx.pricing.anchorHref, /ltx-2-3-fast-pricing/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because LTX is not registered.

- [ ] **Step 3: Create LTX template config**

Create `model-page-templates/ltx-2-3-fast.ts`:

```ts
import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx23FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-3-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'LOW-COST FAST VIDEO MODEL',
    subtitleHighlightTerms: ['fast drafts', 'prompt testing', 'lower-cost iterations'],
    primaryCtaHref: '/app?engine=ltx-2-3-fast',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      {
        labelKey: 'compareSeedance',
        href: '/ai-video-engines/seedance-2-0-vs-ltx-2-3-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#ltx-2-3-fast-pricing',
        icon: 'pricing',
      },
      {
        labelKey: 'promptExamples',
        href: '#prompting',
        icon: 'prompt',
      },
    ],
  },
  pricing: {
    anchorHref: '/pricing#ltx-2-3-fast-pricing',
    presets: [
      { id: '5s-480p', seconds: 5, resolution: '480p', labelKey: 'entryDraft' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview' },
      { id: '10s-720p', seconds: 10, resolution: '720p', labelKey: 'timingTest' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'checkLiveQuote' },
    ],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
```

- [ ] **Step 4: Register LTX**

Add to registry:

```ts
import { ltx23FastTemplateConfig } from './model-page-templates/ltx-2-3-fast';

[ltx23FastTemplateConfig.slug]: ltx23FastTemplateConfig,
```

- [ ] **Step 5: Update localized LTX copy**

Keep the primary intent around lower-cost drafts and prompt testing. Do not mention Seedance native-audio production as LTX’s own core framing.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts
npm --prefix frontend run lint -- --quiet
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts content/models/en/ltx-2-3-fast.json content/models/fr/ltx-2-3-fast.json content/models/es/ltx-2-3-fast.json 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/ltx-2-3-fast.ts'
git commit -m "Migrate LTX Fast to model page template"
```

---

### Task 8: Migrate Production Models In Priority Order

**Files:**
- Create one config per model under `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/`
- Modify matching `content/models/{en,fr,es}/{slug}.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Test: `tests/model-page-template-registry.test.ts`
- Test: `tests/model-page-template-content.test.ts`

Priority order:
1. `veo-3-1`
2. `kling-3-pro`
3. `seedream-5-0-lite`

- [ ] **Step 1: Add parametrized registry test**

Append:

```ts
test('priority production and reference-prep models have distinct template intent', () => {
  const expectations = [
    ['veo-3-1', 'production'],
    ['kling-3-pro', 'production'],
    ['seedream-5-0-lite', 'reference-prep'],
  ] as const;

  for (const [slug, intent] of expectations) {
    const config = getModelPageTemplateConfig(slug);
    assert.ok(config, `${slug} should be migrated to the template`);
    assert.equal(config.intent, intent);
    assert.equal(config.hero.primaryCtaHref, `/app?engine=${slug}`);
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because the three configs are not registered.

- [ ] **Step 3: Create `veo-3-1` production config**

Use these slots:

```ts
slug: 'veo-3-1'
intent: 'production'
eyebrow: 'GOOGLE PREMIUM VIDEO MODEL'
subtitleHighlightTerms: ['premium video quality', 'cinematic motion', 'production prompts']
primaryCtaHref: '/app?engine=veo-3-1'
secondaryCtaHref: '/examples/veo'
pricing.anchorHref: '/pricing#veo-3-1-pricing'
```

- [ ] **Step 4: Create `kling-3-pro` production config**

Use these slots:

```ts
slug: 'kling-3-pro'
intent: 'production'
eyebrow: 'KLING PRO VIDEO MODEL'
subtitleHighlightTerms: ['shot control', 'storyboard-style sequences', 'production video']
primaryCtaHref: '/app?engine=kling-3-pro'
secondaryCtaHref: '/examples/kling'
pricing.anchorHref: '/pricing#kling-3-pro-pricing'
```

- [ ] **Step 5: Create `seedream-5-0-lite` reference-prep config**

Use these slots:

```ts
slug: 'seedream-5-0-lite'
intent: 'reference-prep'
eyebrow: 'REFERENCE IMAGE PREP MODEL'
subtitleHighlightTerms: ['clean still references', 'product frames', 'image-to-video prep']
primaryCtaHref: '/app?engine=seedream-5-0-lite'
secondaryCtaHref: '/examples/seedream'
pricing.anchorHref: '/pricing#seedream-5-0-lite-pricing'
```

The page must say “Prepare references with Seedream”, not “Seedance vs Seedream”.

- [ ] **Step 6: Register each config**

Add imports and entries in `model-page-template-registry.ts`:

```ts
import { veo31TemplateConfig } from './model-page-templates/veo-3-1';
import { kling3ProTemplateConfig } from './model-page-templates/kling-3-pro';
import { seedream50LiteTemplateConfig } from './model-page-templates/seedream-5-0-lite';
```

Add entries:

```ts
[veo31TemplateConfig.slug]: veo31TemplateConfig,
[kling3ProTemplateConfig.slug]: kling3ProTemplateConfig,
[seedream50LiteTemplateConfig.slug]: seedream50LiteTemplateConfig,
```

- [ ] **Step 7: Localize content**

For each model and locale, update:
- `title`
- `description`
- hero subtitle/body if the JSON owns it
- FAQ entries that currently duplicate another model’s language

FR must read as native French, not translated English. ES must be neutral LatAm, avoiding Spain-only vocabulary.

- [ ] **Step 8: Run focused tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-decision-data.test.ts
```

Expected: PASS.

- [ ] **Step 9: Browser smoke test**

Open these URLs:

```txt
http://localhost:3000/models/veo-3-1
http://localhost:3000/models/kling-3-pro
http://localhost:3000/models/seedream-5-0-lite
http://localhost:3000/fr/modeles/veo-3-1
http://localhost:3000/es/modelos/veo-3-1
```

Expected:
- no broken images;
- no horizontal scrollbar at 390px and desktop;
- pricing card pulls display prices from helper;
- Seedream is framed as reference prep;
- canonical and hreflang remain correct.

- [ ] **Step 10: Commit**

```bash
git add tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts content/models/en/veo-3-1.json content/models/fr/veo-3-1.json content/models/es/veo-3-1.json content/models/en/kling-3-pro.json content/models/fr/kling-3-pro.json content/models/es/kling-3-pro.json content/models/en/seedream-5-0-lite.json content/models/fr/seedream-5-0-lite.json content/models/es/seedream-5-0-lite.json 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates'
git commit -m "Migrate priority model pages to template"
```

---

### Task 9: Lock SEO And Schema Invariants

**Files:**
- Modify: `tests/model-seo-signals.test.ts`
- Modify: `tests/schema-sitemap-architecture.test.ts`
- Modify: `tests/model-page-decision-data.test.ts`

- [ ] **Step 1: Add title/meta distinctness tests**

Add a test that asserts no migrated pair has identical title/meta:

```ts
test('migrated model pages keep distinct SEO title and meta copy', () => {
  const pairs = [
    ['seedance-2-0', 'seedance-2-0-fast'],
    ['seedance-2-0', 'ltx-2-3-fast'],
    ['seedance-2-0', 'veo-3-1'],
    ['seedance-2-0', 'kling-3-pro'],
  ] as const;

  for (const [left, right] of pairs) {
    const leftContent = readModelContent('en', left);
    const rightContent = readModelContent('en', right);
    assert.notEqual(leftContent.title, rightContent.title);
    assert.notEqual(leftContent.description, rightContent.description);
  }
});
```

- [ ] **Step 2: Add schema price guard**

Keep this invariant from the Seedance work:

```ts
assert.ok(product && !('offers' in product), 'variable pay-as-you-go model schema should not emit a price: 0 offer');
```

Apply it to every migrated template model.

- [ ] **Step 3: Run SEO tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-seo-signals.test.ts tests/schema-sitemap-architecture.test.ts tests/model-page-decision-data.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/model-seo-signals.test.ts tests/schema-sitemap-architecture.test.ts tests/model-page-decision-data.test.ts
git commit -m "Lock model page SEO invariants"
```

---

### Task 10: Final Verification And Migration Checklist

**Files:**
- Modify: `docs/engineering/page-architecture.md`
- Modify: `docs/engineering/project-structure.md`

- [ ] **Step 1: Document the model page template rule**

Add a short section to `docs/engineering/page-architecture.md`:

```md
## Model Page Template

The localized model route keeps `page.tsx` as an orchestrator. Reusable model-page experiences are driven by route-local template configs under:

`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/`

Template configs define page intent, hero links, pricing presets, and enabled sections. They must not hardcode provider prices. Pricing scenarios must flow through the shared pricing helper, and public capabilities must match the active MaxVideoAI engine config.

Before migrating a model to the template, add tests for:
- title/meta distinctness from close competitors;
- pricing helper usage;
- real section anchors;
- no placeholder media URLs;
- localized EN/FR/ES copy;
- canonical and hreflang stability.
```

- [ ] **Step 2: Run full focused verification**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-decision-data.test.ts tests/model-page-layout-architecture.test.ts tests/model-seo-signals.test.ts tests/schema-sitemap-architecture.test.ts
npm --prefix frontend run lint -- --quiet
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Browser smoke matrix**

Check desktop and mobile:

```txt
http://localhost:3000/models/seedance-2-0
http://localhost:3000/models/seedance-2-0-fast
http://localhost:3000/models/ltx-2-3-fast
http://localhost:3000/fr/modeles/seedance-2-0
http://localhost:3000/es/modelos/seedance-2-0
```

Expected:
- no horizontal scrollbar;
- sticky page nav sits directly below main nav;
- hero H1 stays on one line on desktop;
- CTA labels do not wrap on desktop;
- prompt links navigate to `#prompting`;
- examples and demo videos have valid media/fallbacks;
- dark mode badge and icons remain readable.

- [ ] **Step 4: Commit docs**

```bash
git add docs/engineering/page-architecture.md docs/engineering/project-structure.md
git commit -m "Document model page template migration"
```

---

## Rollout Rule

Migrate one intent family at a time:

1. Production models: `seedance-2-0`, `veo-3-1`, `kling-3-pro`.
2. Draft models: `seedance-2-0-fast`, `ltx-2-3-fast`.
3. Reference-prep models: `seedream-5-0-lite`.
4. Remaining models ordered by GSC impressions and commercial value.

Each migrated model needs its own title, meta, hero copy, FAQ, pricing anchors, and comparison framing. Shared layout is good; shared SEO intent is not.

## Self-Review

Spec coverage:
- Template extraction is covered by Tasks 1-4.
- Migration order is covered by Tasks 6-8.
- SEO/cannibalization/schema risks are covered by Tasks 6 and 9.
- Localized EN/FR/ES quality is covered by Tasks 5, 6, 8, and browser smoke checks.
- Pricing helper usage is covered by Task 3.
- Production verification is covered by Task 10.

Placeholder scan:
- No task uses open-ended placeholders. Model-specific slots are explicitly listed for the first migration wave.

Type consistency:
- `ModelPageTemplateConfig`, `ModelPagePricingPreset`, and `getModelPageTemplateConfig` are introduced before later tasks use them.
