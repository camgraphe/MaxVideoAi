# Model Decision Content Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all localized model decision copy into the existing `content/models/{en,fr,es}/<slug>.json` documents, give all nine image models the decision layout, and remove the two TypeScript copy maps without changing existing routes, SEO, or applied prices.

**Architecture:** `getEngineLocalized` remains the only production filesystem reader and exposes the exact requested locale's raw top-level `decision` value. A route-local strict Zod parser validates identity, shape, and localized hrefs; `buildModelDecisionData` combines that parsed copy with unchanged live pricing scenarios. The existing 38-model output is migrated by exact projection, while `nano-banana-lite` and `seedream-5-0-pro` receive deterministic localized blocks built only from their current JSON content.

**Tech Stack:** Next.js 15 App Router, TypeScript, Node.js filesystem APIs, Zod 3, Node test runner through `tsx`, pnpm.

## Global Constraints

- Work in `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/kling-image-dimension-validation` on local branch `main`.
- Baseline commit is `e65586bd`; baseline focused model suite is 80/80 and full suite is 2193/2193.
- Preserve every field, string, array order, and href in the current 114 decision projections.
- Preserve current metadata, canonical/hreflang output, app destinations, and applied prices for `nano-banana-lite` and `seedream-5-0-pro`.
- Do not edit numeric pricing, pricing policy, product amounts, route maps, sitemap policy, model registry, or generated model projections.
- Do not add English fallback, a second model-content loader, a runtime content registry, a cache, or a compatibility map.
- Keep `ModelDecisionPromptingSection.tsx` and `ModelExamplesSection.tsx` out of scope.
- Use RED-GREEN-REFACTOR for every production change and capture the expected RED output in each task report.
- Preserve unrelated worktree changes if any appear during execution.

---

## File Ownership Map

### New permanent files

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts`: strict schema, parsed type, identity check, localized href validation.
- `tests/helpers/model-decision-content.ts`: test-only localized JSON reader and decision-data builder adapter.
- `tests/model-decision-content-contract.test.ts`: permanent 40 × 3 inventory, parser, structural-parity, href, ownership, and no-fallback contract.
- `tests/model-image-decision-parity.test.ts`: permanent nine-image-model behavior and two-new-model metadata invariants.

### Temporary migration files

- `scripts/migrate-model-decision-content.ts`: materializes current map output and deterministic new image content into the existing JSON files; deleted in Task 5.
- `tests/model-decision-content-migration-proof.test.ts`: compares all 114 old and new projections; deleted with the old maps in Task 5.

### Modified permanent owners

- `content/models/{en,fr,es}/*.json`: add one top-level `decision` object to all 120 documents.
- `frontend/lib/models/i18n.ts`: expose raw requested-locale `decision` without base fallback.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`: parse supplied decision content and continue building live pricing.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`: pass metadata's `localized.decision` to the builder.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`: pass rendered page content's `localizedContent.decision` to the builder.
- `frontend/scripts/scaffold-model-page.ts`: retarget cloned `decision.modelSlug` to a newly scaffolded model.
- `scripts/model-setup.mjs`: document the decision-content review gate in launch packets.
- Model tests named in Tasks 3–5: consume JSON-backed decision input and lock the new boundary.
- `docs/engineering/page-architecture.md`, `docs/engineering/model-registry.md`, and `docs/engineering/refactor-roadmap.md`: document ownership and the next independent JSX cleanup.

### Deleted files

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts`
- the two temporary migration files listed above

---

### Task 1: Materialize the 114 existing decision projections exactly

**Files:**
- Create: `scripts/migrate-model-decision-content.ts`
- Create: `tests/model-decision-content-migration-proof.test.ts`
- Modify: 114 existing files under `content/models/{en,fr,es}/`

**Interfaces:**
- Consumes: `COPY_BY_MODEL_SLUG` and `getModelDecisionCopy(modelSlug, locale)` from the current TypeScript copy owner.
- Produces: top-level JSON value `{ modelSlug, ...getModelDecisionCopy(...) }` for the current 38 slugs in all three locales.

- [ ] **Step 1: Reconfirm the baseline and clean state**

Run:

```bash
git status --short --branch
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-decision-data.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-registry-validation.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts
```

Expected: clean worktree on `main`; 80 tests pass.

- [ ] **Step 2: Write the failing exact-projection proof**

Create `tests/model-decision-content-migration-proof.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  COPY_BY_MODEL_SLUG,
  getModelDecisionCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');

test('all 114 existing model decision projections are exact in localized JSON', () => {
  const slugs = Object.keys(COPY_BY_MODEL_SLUG).sort();
  assert.equal(slugs.length, 38);
  let projectionCount = 0;

  for (const slug of slugs) {
    for (const locale of LOCALES) {
      const oldProjection = getModelDecisionCopy(slug, locale);
      assert.ok(oldProjection, `${slug}/${locale} old projection`);
      const document = JSON.parse(
        readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8'),
      ) as { decision?: unknown };

      assert.deepEqual(
        document.decision,
        { modelSlug: slug, ...oldProjection },
        `${slug}/${locale} exact decision projection`,
      );
      projectionCount += 1;
    }
  }

  assert.equal(projectionCount, 114);
});
```

- [ ] **Step 3: Run the proof and capture RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-decision-content-migration-proof.test.ts
```

Expected: FAIL because the first localized document has no top-level `decision` field.

- [ ] **Step 4: Add the temporary exact converter**

Create `scripts/migrate-model-decision-content.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  COPY_BY_MODEL_SLUG,
  getModelDecisionCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const write = process.argv.includes('--write');

async function migrateExistingProjection(slug: string, locale: AppLocale): Promise<boolean> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  const copy = getModelDecisionCopy(slug, locale);
  if (!copy) throw new Error(`Missing old decision projection for ${slug}/${locale}`);
  const expected = { modelSlug: slug, ...copy };

  if (document.decision !== undefined) {
    if (JSON.stringify(document.decision) !== JSON.stringify(expected)) {
      throw new Error(`Existing decision content differs for ${slug}/${locale}`);
    }
    return false;
  }

  if (write) {
    document.decision = expected;
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return true;
}

async function main() {
  const slugs = Object.keys(COPY_BY_MODEL_SLUG).sort();
  if (slugs.length !== 38) throw new Error(`Expected 38 old copy slugs, received ${slugs.length}`);
  let pending = 0;

  for (const slug of slugs) {
    for (const locale of LOCALES) {
      if (await migrateExistingProjection(slug, locale)) pending += 1;
    }
  }

  console.log(`${write ? 'wrote' : 'would write'} ${pending} existing decision projections`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
```

- [ ] **Step 5: Preview and write the migration**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-decision-content.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-decision-content.ts --write
```

Expected: preview and write each report 114 pending projections; only the `decision` field is appended to the 114 existing JSON documents.

- [ ] **Step 6: Run GREEN and inspect data-only boundaries**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-decision-content-migration-proof.test.ts
git diff --check
git diff --name-only | rg -v '^(content/models/(en|fr|es)/.*\.json|scripts/migrate-model-decision-content\.ts|tests/model-decision-content-migration-proof\.test\.ts)$'
```

Expected: 1/1 passes; `git diff --check` passes; final `rg` prints nothing.

- [ ] **Step 7: Commit Task 1**

```bash
git add content/models scripts/migrate-model-decision-content.ts tests/model-decision-content-migration-proof.test.ts
git commit -m "content: materialize model decision copy"
```

---

### Task 2: Add deterministic decision content for the two image exceptions

**Files:**
- Create: `tests/model-image-decision-parity.test.ts`
- Modify: `scripts/migrate-model-decision-content.ts`
- Modify: `content/models/{en,fr,es}/nano-banana-lite.json`
- Modify: `content/models/{en,fr,es}/seedream-5-0-pro.json`

**Interfaces:**
- Consumes: the current localized `seo`, `overview`, `pricingNotes`, `hero`, and template-config facts in each of the six JSON documents.
- Produces: non-null decision blocks for all nine image models, while the two new blocks keep `decision.meta` exactly equal to their existing `seo` object.

- [ ] **Step 1: Write the failing image parity contract**

Create `tests/model-image-decision-parity.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REGISTRY = JSON.parse(
  readFileSync(path.join(process.cwd(), 'frontend', 'config', 'model-registry.json'), 'utf8'),
) as { models: Array<{ slug: string; category: string }> };
const LOCALES = ['en', 'fr', 'es'] as const;
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const NEW_DECISION_SLUGS = ['nano-banana-lite', 'seedream-5-0-pro'] as const;

function readDocument(locale: (typeof LOCALES)[number], slug: string) {
  return JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as {
    seo?: { title?: string; description?: string };
    decision?: { modelSlug?: string; meta?: { title?: string; description?: string } };
  };
}

test('all nine image models own localized decision content', () => {
  const imageSlugs = REGISTRY.models
    .filter((model) => model.category === 'image')
    .map((model) => model.slug)
    .sort();
  assert.equal(imageSlugs.length, 9);

  for (const slug of imageSlugs) {
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      assert.ok(document.decision, `${slug}/${locale} decision content`);
      assert.equal(document.decision.modelSlug, slug);
    }
  }
});

test('new image decision metadata exactly preserves current localized SEO', () => {
  for (const slug of NEW_DECISION_SLUGS) {
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      assert.deepEqual(document.decision?.meta, document.seo, `${slug}/${locale} metadata`);
    }
  }
});
```

- [ ] **Step 2: Run the contract and capture RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-image-decision-parity.test.ts
```

Expected: FAIL only for `nano-banana-lite` and `seedream-5-0-pro`, which remain the six missing projections after Task 1.

- [ ] **Step 3: Extend the temporary converter with a deterministic new-image builder**

Add these exact helpers above `main()` in `scripts/migrate-model-decision-content.ts`:

```ts
type NewImageLocale = (typeof LOCALES)[number];
type NewImageOverlay = {
  marketingName: string;
  seo: { title: string; description: string };
  overview: string;
  pricingNotes: string;
  hero: {
    title: string;
    intro: string;
    badge: string;
    ctaPrimary: { label: string; href: string };
    secondaryLinks: Array<{ label: string; href: string }>;
  };
};

const NEW_IMAGE_PROFILES = {
  'nano-banana-lite': {
    en: { eyebrow: 'GOOGLE FAST IMAGE MODEL', highlights: ['fast, efficient 1K', 'local image edits', 'quick visual exploration'] },
    fr: { eyebrow: 'MODÈLE IMAGE GOOGLE RAPIDE', highlights: ['plus rapide pour les images 1K', 'edits locaux', 'explorations rapides'] },
    es: { eyebrow: 'MODELO DE IMAGEN RÁPIDO DE GOOGLE', highlights: ['más rápido para imágenes 1K', 'ediciones locales', 'exploración rápida'] },
  },
  'seedream-5-0-pro': {
    en: { eyebrow: 'PROFESSIONAL BYTEDANCE IMAGE MODEL', highlights: ['professional ByteDance image route', 'dense infographics', 'polished reference frames'] },
    fr: { eyebrow: 'MODÈLE IMAGE BYTEDANCE PROFESSIONNEL', highlights: ['route image professionnelle ByteDance', 'infographies denses', 'frames propres'] },
    es: { eyebrow: 'MODELO DE IMAGEN PROFESIONAL DE BYTEDANCE', highlights: ['ruta profesional de imagen ByteDance', 'infografías densas', 'fotogramas pulidos'] },
  },
} as const;

const IMAGE_LABELS = {
  en: {
    openWorkspace: 'Open image workspace', viewPricing: 'View pricing', promptExamples: 'Prompt examples',
    viewImage: 'View image', capabilities: 'Capabilities', workflow: 'Workflow', output: 'Output', livePrice: 'Live price',
    promptCardTitle: 'Need prompt examples?', promptCardBody: 'Open the Prompt Lab for a structured starting point.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Output setup', priceCheck: 'Price check',
    fullPricing: 'View full pricing', pricingSuffix: 'pricing at a glance', exampleSuffix: 'example',
  },
  fr: {
    openWorkspace: 'Ouvrir l’espace image', viewPricing: 'Voir les tarifs', promptExamples: 'Exemples de prompts',
    viewImage: 'Voir l’image', capabilities: 'Capacités', workflow: 'Workflow', output: 'Sortie', livePrice: 'Prix en direct',
    promptCardTitle: 'Besoin d’exemples de prompts ?', promptCardBody: 'Ouvrez le Prompt Lab pour partir d’une structure claire.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Réglages de sortie', priceCheck: 'Vérification du prix',
    fullPricing: 'Voir tous les tarifs', pricingSuffix: 'tarifs en bref', exampleSuffix: 'exemple',
  },
  es: {
    openWorkspace: 'Abrir el espacio de imágenes', viewPricing: 'Ver precios', promptExamples: 'Ejemplos de prompts',
    viewImage: 'Ver imagen', capabilities: 'Capacidades', workflow: 'Flujo', output: 'Salida', livePrice: 'Precio en vivo',
    promptCardTitle: '¿Necesitas ejemplos de prompts?', promptCardBody: 'Abre el Prompt Lab para empezar con una estructura clara.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Ajustes de salida', priceCheck: 'Revisión del precio',
    fullPricing: 'Ver todos los precios', pricingSuffix: 'precios de un vistazo', exampleSuffix: 'ejemplo',
  },
} as const;

function localizeModelHref(locale: NewImageLocale, href: string): string {
  if (!href.startsWith('/models/')) return href;
  const suffix = href.slice('/models'.length);
  if (locale === 'fr') return `/fr/modeles${suffix}`;
  if (locale === 'es') return `/es/modelos${suffix}`;
  return href;
}

function pricingHref(locale: NewImageLocale, slug: string): string {
  if (locale === 'fr') return `/fr/tarifs#${slug}-pricing`;
  if (locale === 'es') return `/es/precios#${slug}-pricing`;
  return `/pricing#${slug}-pricing`;
}

function buildNewImageDecision(slug: keyof typeof NEW_IMAGE_PROFILES, locale: NewImageLocale, overlay: NewImageOverlay) {
  const profile = NEW_IMAGE_PROFILES[slug][locale];
  const labels = IMAGE_LABELS[locale];
  const secondaryLinks = overlay.hero.secondaryLinks.map((link) => ({ ...link, href: localizeModelHref(locale, link.href) }));
  if (secondaryLinks.length < 2) throw new Error(`${slug}/${locale} needs two existing secondary links`);
  for (const highlight of profile.highlights) {
    if (!overlay.overview.toLocaleLowerCase(locale).includes(highlight.toLocaleLowerCase(locale))) {
      throw new Error(`${slug}/${locale} subtitle does not contain ${highlight}`);
    }
  }

  return {
    modelSlug: slug,
    hero: {
      eyebrow: profile.eyebrow,
      title: overlay.hero.title,
      subtitle: overlay.overview,
      subtitleHighlights: [...profile.highlights],
      paragraph: overlay.hero.intro,
      primaryCta: overlay.hero.ctaPrimary,
      secondaryCta: secondaryLinks[0],
      quickLinks: [
        { label: labels.openWorkspace, href: overlay.hero.ctaPrimary.href },
        { label: labels.viewPricing, href: pricingHref(locale, slug) },
        { label: labels.promptExamples, href: '#prompting' },
        secondaryLinks[1],
      ],
    },
    media: {
      caption: `${overlay.marketingName} ${labels.exampleSuffix}`,
      description: overlay.hero.intro,
      renderLabel: labels.viewImage,
      badges: overlay.hero.badge.split('·').map((value) => value.trim()).filter(Boolean),
      altContext: overlay.hero.title,
    },
    features: [
      { title: labels.capabilities, body: overlay.overview, tone: 'quality' },
      { title: labels.workflow, body: overlay.hero.intro, tone: 'reference' },
      { title: labels.output, body: overlay.hero.badge, tone: 'duration' },
      { title: labels.livePrice, body: overlay.pricingNotes, tone: 'price' },
    ],
    decisionCards: [
      { title: secondaryLinks[0].label, body: overlay.overview, cta: secondaryLinks[0] },
      { title: secondaryLinks[1].label, body: overlay.hero.intro, cta: secondaryLinks[1] },
      { title: labels.promptCardTitle, body: labels.promptCardBody, cta: { label: labels.promptExamples, href: '#prompting' } },
    ],
    referenceWorkflows: [
      { title: labels.textToImage, body: overlay.hero.intro },
      { title: labels.imageToImage, body: overlay.overview },
      { title: labels.delivery, body: overlay.hero.badge },
      { title: labels.priceCheck, body: overlay.pricingNotes },
    ],
    pricingCopy: {
      title: `${overlay.marketingName} ${labels.pricingSuffix}`,
      subtitle: overlay.pricingNotes,
      footnote: overlay.pricingNotes,
      ctaLabel: labels.fullPricing,
      ctaHref: pricingHref(locale, slug),
    },
    meta: overlay.seo,
  };
}

async function migrateNewImageProjection(slug: keyof typeof NEW_IMAGE_PROFILES, locale: NewImageLocale): Promise<boolean> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown> & NewImageOverlay;
  const expected = buildNewImageDecision(slug, locale, document);
  if (document.decision !== undefined) {
    if (JSON.stringify(document.decision) !== JSON.stringify(expected)) {
      throw new Error(`Existing new image decision differs for ${slug}/${locale}`);
    }
    return false;
  }
  if (write) {
    document.decision = expected;
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return true;
}
```

Then add this loop before the final `console.log` in `main()`:

```ts
  for (const slug of Object.keys(NEW_IMAGE_PROFILES).sort() as Array<keyof typeof NEW_IMAGE_PROFILES>) {
    for (const locale of LOCALES) {
      if (await migrateNewImageProjection(slug, locale)) pending += 1;
    }
  }
```

Replace the old log line with the aggregate label now that the script handles both groups:

```ts
console.log(`${write ? 'wrote' : 'would write'} ${pending} decision projections`);
```

- [ ] **Step 4: Preview, write, and verify the six new projections**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-decision-content.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-decision-content.ts --write
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-image-decision-parity.test.ts \
  tests/model-decision-content-migration-proof.test.ts
```

Expected: preview and write report six pending projections; both test files pass; the 114 old projections remain exact.

- [ ] **Step 5: Inspect the intentional behavior boundary**

Run:

```bash
git diff e65586bd -- frontend/config frontend/server/pricing-admin frontend/app/'(localized)'/'[locale]'/'(marketing)'/pricing frontend/app/sitemap-models.xml
git diff --check
```

Expected: no diff in the protected config/pricing/sitemap paths; whitespace check passes.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/migrate-model-decision-content.ts tests/model-image-decision-parity.test.ts \
  content/models/en/nano-banana-lite.json content/models/fr/nano-banana-lite.json content/models/es/nano-banana-lite.json \
  content/models/en/seedream-5-0-pro.json content/models/fr/seedream-5-0-pro.json content/models/es/seedream-5-0-pro.json
git commit -m "content: align image model decision pages"
```

---

### Task 3: Add the strict parser and permanent 120-document contract

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts`
- Create: `tests/model-decision-content-contract.test.ts`
- Modify: `frontend/lib/models/i18n.ts`

**Interfaces:**
- Produces: `parseModelDecisionContent(input, expectedSlug, locale, source): ModelDecisionContent`.
- Produces: `EngineLocalizedContent.decision?: unknown`, selected from the exact requested overlay with no `base.decision` fallback.
- Consumed later by: `buildModelDecisionData` in Task 4.

- [ ] **Step 1: Write parser and inventory tests before the module exists**

Create `tests/model-decision-content-contract.test.ts` with these required cases:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const I18N_SOURCE = readFileSync(path.join(process.cwd(), 'frontend', 'lib', 'models', 'i18n.ts'), 'utf8');

function files(locale: AppLocale) {
  return readdirSync(path.join(CONTENT_ROOT, locale)).filter((name) => name.endsWith('.json')).sort();
}

function rawDecision(locale: AppLocale, slug: string): unknown {
  const document = JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as { decision?: unknown };
  return document.decision;
}

function signature(value: unknown): unknown {
  if (Array.isArray(value)) return { kind: 'array', length: value.length, items: value.map(signature) };
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, signature(nested)]));
  }
  return typeof value;
}

test('all 40 model documents expose strict decision content in every locale', () => {
  const expectedFiles = listModelPageTemplateSlugs().sort().map((slug) => `${slug}.json`);
  assert.equal(expectedFiles.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expectedFiles, `${locale} model inventory`);
    for (const fileName of expectedFiles) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelDecisionContent(rawDecision(locale, slug), slug, locale, `${locale}/${fileName}#decision`);
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

test('each model keeps identical EN FR ES decision structure', () => {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    const english = signature(rawDecision('en', slug));
    assert.deepEqual(signature(rawDecision('fr', slug)), english, `${slug}/fr structure`);
    assert.deepEqual(signature(rawDecision('es', slug)), english, `${slug}/es structure`);
  }
});

test('localized model decision selection never falls back to English', () => {
  assert.match(I18N_SOURCE, /decision:\s*overlay\.decision/);
  assert.doesNotMatch(I18N_SOURCE, /decision:\s*overlay\.decision\s*\?\?\s*base\.decision/);
});

test('old decision maps are not direct JSON consumers and tracing already includes model content', () => {
  const nextConfig = readFileSync(path.join(process.cwd(), 'frontend', 'next.config.js'), 'utf8');
  assert.match(nextConfig, /\.\.\/content\/models\/\*\*\/\*/);
  assert.equal(existsSync(path.join(process.cwd(), 'content', 'model-decisions')), false);
});
```

Add this complete fixture and parser contract below the inventory tests:

```ts
function validFixture() {
  return {
    modelSlug: 'fixture-model',
    hero: {
      eyebrow: 'Fixture eyebrow',
      title: 'Fixture title',
      subtitle: 'Fixture subtitle',
      subtitleHighlights: ['Fixture'],
      paragraph: 'Fixture paragraph',
      primaryCta: { label: 'Open fixture', href: '/app/image?engine=fixture-model' },
      secondaryCta: { label: 'Prompt examples', href: '#prompting' },
      quickLinks: [{ label: 'Specs', href: '#specs' }],
    },
    media: {
      caption: 'Fixture caption',
      description: 'Fixture description',
      renderLabel: 'View fixture',
      badges: ['Fixture badge'],
      altContext: 'Fixture alt context',
    },
    features: [{ title: 'Fixture feature', body: 'Fixture feature body', tone: 'quality' }],
    decisionCards: [{
      title: 'Fixture card',
      body: 'Fixture card body',
      cta: { label: 'Prompt examples', href: '#prompting' },
    }],
    referenceWorkflows: [{ title: 'Fixture workflow', body: 'Fixture workflow body' }],
    pricingCopy: {
      title: 'Fixture pricing',
      subtitle: 'Fixture pricing subtitle',
      footnote: 'Fixture pricing footnote',
      ctaLabel: 'View pricing',
      ctaHref: '#specs',
    },
    meta: { title: 'Fixture metadata', description: 'Fixture metadata description' },
  };
}

test('strict parser rejects missing, mismatched, unknown, and blank decision content', () => {
  assert.throws(
    () => parseModelDecisionContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing decision content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), modelSlug: 'other-model' }, 'fixture-model', 'en', 'identity.json'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), extra: true }, 'fixture-model', 'en', 'unknown.json'),
    /Invalid decision content.*unknown\.json/s,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), hero: { ...validFixture().hero, title: '   ' } }, 'fixture-model', 'en', 'empty.json'),
    /Expected a non-empty string/,
  );
});

test('strict parser accepts only shared or current-locale href families', () => {
  const accepted: Record<AppLocale, readonly string[]> = {
    en: ['/models/x', '/examples/x', '/ai-video-engines/x?order=x', '/pricing#x'],
    fr: ['/fr/modeles/x', '/fr/galerie/x', '/fr/comparatif/x-vs-y?order=x', '/fr/tarifs#x'],
    es: ['/es/modelos/x', '/es/galeria/x', '/es/comparativa/x-vs-y?order=x', '/es/precios#x'],
  };
  const rejected: Record<AppLocale, readonly string[]> = {
    en: ['/fr/modeles/x', '/es/modelos/x'],
    fr: ['/models/x', '/es/modelos/x'],
    es: ['/models/x', '/fr/modeles/x'],
  };

  for (const locale of LOCALES) {
    for (const href of ['/app/image?engine=fixture-model', '#prompting', '#specs', ...accepted[locale]]) {
      const fixture = validFixture();
      fixture.hero.primaryCta.href = href;
      assert.doesNotThrow(() => parseModelDecisionContent(fixture, 'fixture-model', locale, `${locale}-accepted.json`));
    }
    for (const href of rejected[locale]) {
      const fixture = validFixture();
      fixture.hero.primaryCta.href = href;
      assert.throws(
        () => parseModelDecisionContent(fixture, 'fixture-model', locale, `${locale}-rejected.json`),
        new RegExp(`Invalid ${locale} href`),
      );
    }
  }
});
```

- [ ] **Step 2: Run the contract and capture RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-decision-content-contract.test.ts
```

Expected: module-not-found failure for `model-page-decision-content.ts`. This is the required RED before production parser code.

- [ ] **Step 3: Implement the strict route-local parser**

Create `model-page-decision-content.ts` with this schema and public interface:

```ts
import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';

const MODEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const modelSlugSchema = z.string().regex(MODEL_SLUG_PATTERN, 'Expected a canonical model slug');
const linkSchema = z.object({ label: nonEmptyString, href: nonEmptyString }).strict();

const decisionSchema = z.object({
  modelSlug: modelSlugSchema,
  hero: z.object({
    eyebrow: nonEmptyString,
    title: nonEmptyString,
    subtitle: nonEmptyString,
    subtitleHighlights: z.array(nonEmptyString).min(1),
    paragraph: nonEmptyString,
    primaryCta: linkSchema,
    secondaryCta: linkSchema,
    quickLinks: z.array(linkSchema).min(1),
  }).strict(),
  media: z.object({
    caption: nonEmptyString,
    description: nonEmptyString,
    renderLabel: nonEmptyString,
    badges: z.array(nonEmptyString).min(1),
    altContext: nonEmptyString,
  }).strict(),
  features: z.array(z.object({
    title: nonEmptyString,
    body: nonEmptyString,
    tone: z.enum(['audio', 'continuity', 'reference', 'quality', 'duration', 'price']),
  }).strict()).min(1),
  decisionCards: z.array(z.object({ title: nonEmptyString, body: nonEmptyString, cta: linkSchema }).strict()).min(1),
  referenceWorkflows: z.array(z.object({ title: nonEmptyString, body: nonEmptyString }).strict()).min(1),
  pricingCopy: z.object({
    title: nonEmptyString,
    subtitle: nonEmptyString,
    footnote: nonEmptyString,
    ctaLabel: nonEmptyString,
    ctaHref: nonEmptyString,
    maxDurationNote: nonEmptyString.optional(),
  }).strict(),
  meta: z.object({ title: nonEmptyString, description: nonEmptyString }).strict(),
}).strict();

export type ModelDecisionContent = z.infer<typeof decisionSchema>;

const SHARED_HREFS = [/^#(?:prompting|specs)$/, /^\/app(?:\/image)?\?engine=[A-Za-z0-9_-]+$/];
const LOCALIZED_HREFS: Record<AppLocale, readonly RegExp[]> = {
  en: [/^\/(?:(?:models|examples)(?:\/[^\s?#]+)?|ai-video-engines\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|pricing(?:#[^\s]+)?)$/],
  fr: [/^\/fr\/(?:(?:modeles|galerie)(?:\/[^\s?#]+)?|comparatif\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|tarifs(?:#[^\s]+)?)$/],
  es: [/^\/es\/(?:(?:modelos|galeria)(?:\/[^\s?#]+)?|comparativa\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|precios(?:#[^\s]+)?)$/],
};

function links(content: ModelDecisionContent) {
  return [
    ['hero.primaryCta.href', content.hero.primaryCta.href],
    ['hero.secondaryCta.href', content.hero.secondaryCta.href],
    ...content.hero.quickLinks.map((link, index) => [`hero.quickLinks.${index}.href`, link.href] as const),
    ...content.decisionCards.map((card, index) => [`decisionCards.${index}.cta.href`, card.cta.href] as const),
    ['pricingCopy.ctaHref', content.pricingCopy.ctaHref],
  ] as const;
}

export function parseModelDecisionContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `${locale}/${expectedSlug}.json#decision`,
): ModelDecisionContent {
  if (input === undefined) throw new Error(`[model-decision-content] Missing decision content for ${expectedSlug}/${locale} in ${source}`);
  const result = decisionSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-decision-content] Invalid decision content in ${source}: ${issues}`);
  }
  if (result.data.modelSlug !== expectedSlug) {
    throw new Error(`[model-decision-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.modelSlug}`);
  }
  for (const [field, href] of links(result.data)) {
    if (![...SHARED_HREFS, ...LOCALIZED_HREFS[locale]].some((pattern) => pattern.test(href))) {
      throw new Error(`[model-decision-content] Invalid ${locale} href in ${source} at ${field}: ${JSON.stringify(href)}`);
    }
  }
  return result.data;
}
```

Do not use `z.string().trim()` because it mutates migrated strings and would invalidate exact projection proof.

- [ ] **Step 4: Expose exact-locale decision data through the existing loader**

In `frontend/lib/models/i18n.ts`, add `decision?: unknown` as the final field of both the existing `EngineOverlay` and exported `EngineLocalizedContent` object types. Do not replace the existing fields:

```ts
decision?: unknown;
```

Add this exact projection to the `getEngineLocalized` return value:

```ts
decision: overlay.decision,
```

Do not use `overlay.decision ?? base.decision`.

- [ ] **Step 5: Complete fixture cases and run GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-decision-content-contract.test.ts \
  tests/model-decision-content-migration-proof.test.ts \
  tests/model-image-decision-parity.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: all three contract files pass; TypeScript and whitespace checks pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add frontend/lib/models/i18n.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts' \
  tests/model-decision-content-contract.test.ts
git commit -m "refactor: validate localized model decision content"
```

---

### Task 4: Cut runtime and tests over to JSON-backed decision content

**Files:**
- Create: `tests/helpers/model-decision-content.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/model-page-decision-data.test.ts`
- Modify: `tests/model-page-template-content.test.ts`
- Modify: `tests/kling-o3-model-pages.test.ts`
- Modify: `tests/gemini-omni-marketing-surfaces.test.ts`
- Modify: `tests/model-image-decision-parity.test.ts`

**Interfaces:**
- Changes: `buildModelDecisionData({ engine, locale, decisionContent })` requires the raw selected-locale input.
- Uses: `parseModelDecisionContent(decisionContent, engine.modelSlug, locale, source)`.
- Preserves: `ModelDecisionData | null` return type and live pricing scenario behavior.

- [ ] **Step 1: Write the failing architecture boundary**

Update `tests/model-page-layout-architecture.test.ts` so the decision-data test requires:

```ts
assert.match(decisionDataSource, /parseModelDecisionContent/);
assert.match(decisionDataSource, /decisionContent:\s*unknown/);
assert.match(modelPageSource, /decisionContent:\s*localized\.decision/);
assert.match(layoutSource, /decisionContent:\s*localizedContent\.decision/);
```

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-page-layout-architecture.test.ts
```

Expected: FAIL because runtime consumers still call the TypeScript copy map.

- [ ] **Step 2: Add the test-only JSON adapter**

Create `tests/helpers/model-decision-content.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FalEngineEntry } from '../../frontend/src/config/falEngines.ts';
import type { AppLocale } from '../../frontend/i18n/locales.ts';
import { buildModelDecisionData } from '../../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';

export function readModelDecisionInput(modelSlug: string, locale: AppLocale): unknown {
  const document = JSON.parse(
    readFileSync(path.join(process.cwd(), 'content', 'models', locale, `${modelSlug}.json`), 'utf8'),
  ) as { decision?: unknown };
  return document.decision;
}

export function buildModelDecisionDataFromContent({ engine, locale }: { engine: FalEngineEntry; locale: AppLocale }) {
  return buildModelDecisionData({
    engine,
    locale,
    decisionContent: readModelDecisionInput(engine.modelSlug, locale),
  });
}
```

- [ ] **Step 3: Change the decision-data builder**

In `model-page-decision-data.ts`, remove the `getModelDecisionCopy` import, import `parseModelDecisionContent`, and change the builder to:

```ts
export function buildModelDecisionData({
  engine,
  locale,
  decisionContent,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
  decisionContent: unknown;
}): ModelDecisionData | null {
  const template = getModelPageTemplateConfig(engine.modelSlug);
  if (!template) return null;

  const copy = parseModelDecisionContent(
    decisionContent,
    engine.modelSlug,
    locale,
    `content/models/${locale}/${engine.modelSlug}.json#decision`,
  );
  const scenarios = buildModelDecisionPricingScenarios(engine, locale, template.pricing.presets).map((scenario) =>
    scenario.id === 'max-duration' && copy.pricingCopy.maxDurationNote
      ? { ...scenario, note: copy.pricingCopy.maxDurationNote }
      : scenario,
  );

  return {
    hero: copy.hero,
    media: copy.media,
    features: copy.features,
    decisionCards: copy.decisionCards,
    referenceWorkflows: copy.referenceWorkflows,
    meta: copy.meta,
    pricing: {
      title: copy.pricingCopy.title,
      subtitle: copy.pricingCopy.subtitle,
      footnote: copy.pricingCopy.footnote,
      cta: { label: copy.pricingCopy.ctaLabel, href: copy.pricingCopy.ctaHref },
      scenarios,
    },
  };
}
```

- [ ] **Step 4: Pass selected content from metadata and layout consumers**

In `page.tsx`:

```ts
const decisionData = buildModelDecisionData({
  engine,
  locale,
  decisionContent: localized.decision,
});
```

In `MarketingModelPageLayout.tsx`:

```ts
const templateData = buildModelDecisionData({
  engine,
  locale,
  decisionContent: localizedContent.decision,
});
```

- [ ] **Step 5: Migrate every test caller mechanically**

In `tests/model-page-decision-data.test.ts`, `tests/model-page-template-content.test.ts`, `tests/kling-o3-model-pages.test.ts`, and `tests/gemini-omni-marketing-surfaces.test.ts`, import `buildModelDecisionDataFromContent` and replace calls of:

```ts
buildModelDecisionData({ engine, locale })
```

with:

```ts
buildModelDecisionDataFromContent({ engine, locale })
```

Keep direct `buildModelDecisionData` imports only where the test needs its return type or explicitly exercises missing/malformed input. Add one direct test:

```ts
assert.throws(
  () => buildModelDecisionData({ engine: getEngine('seedance-2-0'), locale: 'fr', decisionContent: undefined }),
  /Missing decision content.*seedance-2-0\/fr/,
);
```

- [ ] **Step 6: Extend image parity to the real builder**

Add to `tests/model-image-decision-parity.test.ts`:

```ts
for (const slug of imageSlugs) {
  const engine = listFalEngines().find((candidate) => candidate.modelSlug === slug);
  assert.ok(engine, `${slug} engine`);
  for (const locale of LOCALES) {
    assert.ok(buildModelDecisionDataFromContent({ engine, locale }), `${slug}/${locale} decision data`);
  }
}
```

For `nano-banana-lite` and `seedream-5-0-pro`, also assert the builder's `meta` equals the raw localized document's `seo`, and its pricing scenario IDs equal the IDs in the unchanged template config.

- [ ] **Step 7: Run GREEN and exact migration proof**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/model-page-template-content.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/model-image-decision-parity.test.ts \
  tests/model-decision-content-contract.test.ts \
  tests/model-decision-content-migration-proof.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: all focused tests pass; the 114 old/new content projections remain exact; TypeScript and whitespace checks pass.

- [ ] **Step 8: Commit Task 4**

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]' \
  tests/helpers/model-decision-content.ts \
  tests/model-page-layout-architecture.test.ts tests/model-page-decision-data.test.ts \
  tests/model-page-template-content.test.ts tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts tests/model-image-decision-parity.test.ts
git commit -m "refactor: load model decisions from localized content"
```

---

### Task 5: Delete obsolete maps and lock future model scaffolding

**Files:**
- Delete: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts`
- Delete: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts`
- Delete: `scripts/migrate-model-decision-content.ts`
- Delete: `tests/model-decision-content-migration-proof.test.ts`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/model-decision-content-contract.test.ts`
- Modify: `frontend/scripts/scaffold-model-page.ts`
- Modify: `scripts/model-setup.mjs`
- Modify: `tests/model-setup-cli.test.ts`

**Interfaces:**
- Preserves: permanent `parseModelDecisionContent` and JSON-backed `buildModelDecisionData` interfaces.
- Removes: all TypeScript copy registries, migration-only imports, and compatibility paths.
- Adds: scaffold invariant that cloned `decision.modelSlug` equals the target slug.

- [ ] **Step 1: Write the failing obsolete-owner architecture contract**

At the path constants in `tests/model-page-layout-architecture.test.ts`, replace `templateCopyPath` with `oldTemplateCopyPath`, then add `oldAdditionalCopyPath` and `decisionContentPath`. Remove `templateCopyPath` from the required-existing-path array, remove the `templateCopySource` read, and remove the four assertions that require `COPY_BY_MODEL_SLUG`, `getModelDecisionCopy`, model-specific copy, or copy href helpers. Add this replacement boundary:

```ts
const oldTemplateCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts');
const oldAdditionalCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts');
const decisionContentPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts');

assert.equal(existsSync(oldTemplateCopyPath), false);
assert.equal(existsSync(oldAdditionalCopyPath), false);
assert.ok(existsSync(decisionContentPath));
assert.doesNotMatch(decisionDataSource, /getModelDecisionCopy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY/);
assert.ok(lineCount(readSource(decisionContentPath)) <= 220);
```

Add a production-source scan in `tests/model-decision-content-contract.test.ts` that recursively reads TypeScript files under `frontend/app/(localized)/[locale]/(marketing)/models/[slug]` and rejects imports of `model-page-template-copy`, `COPY_BY_MODEL_SLUG`, `ADDITIONAL_TEMPLATE_COPY`, and direct JSON imports matching `content/models/.+\.json`. The test itself may name the deleted owners to assert their absence; the scan target must exclude `tests/`.

Use this exact helper and test; the existing `readdirSync` import already supports `withFileTypes` inference:

```ts
const MODEL_ROUTE_ROOT = path.join(
  process.cwd(),
  'frontend',
  'app',
  '(localized)',
  '[locale]',
  '(marketing)',
  'models',
  '[slug]',
);

function typeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test('production model route has no obsolete copy owner or direct localized JSON import', () => {
  const source = typeScriptFiles(MODEL_ROUTE_ROOT)
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /model-page-template-copy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*content\/models\/[^'"]+\.json['"]/);
});
```

Run the architecture tests and expect RED because both obsolete copy files still exist. The temporary proof is intentionally kept until Step 2 so it can protect the cutover through Task 4.

- [ ] **Step 2: Delete old and temporary owners**

Delete exactly the four files in the Task 5 delete list. Do not retain a facade or re-export.

- [ ] **Step 3: Retarget cloned decision identity in the model scaffold**

After `transformed.marketingName = options.targetName` in `frontend/scripts/scaffold-model-page.ts`, add:

```ts
const decision = transformed.decision;
if (decision && typeof decision === 'object' && !Array.isArray(decision)) {
  transformed.decision = {
    ...(decision as Record<string, unknown>),
    modelSlug: options.targetSlug,
  };
}
```

In `scripts/model-setup.mjs`, add this exact launch-packet checklist item after the three locale rewrite items:

```js
'4. Verify every localized `decision` block, its `modelSlug`, href locale, and metadata before enabling the model page.',
```

Renumber the following checklist entries sequentially.

- [ ] **Step 4: Lock scaffold behavior in the existing CLI contract**

In `tests/model-setup-cli.test.ts`, add `readFileSync` to the existing `node:fs` import, create `scaffoldSource` and `setupSource` constants from `frontend/scripts/scaffold-model-page.ts` and `scripts/model-setup.mjs`, then assert:

```ts
assert.match(scaffoldSource, /transformed\.decision/);
assert.match(scaffoldSource, /modelSlug:\s*options\.targetSlug/);
assert.match(setupSource, /Verify every localized `decision` block/);
```

- [ ] **Step 5: Run GREEN and repository scans**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-layout-architecture.test.ts \
  tests/model-decision-content-contract.test.ts \
  tests/model-image-decision-parity.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/model-page-template-content.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/model-setup-cli.test.ts
rg -n "model-page-template-copy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY|migrate-model-decision-content|model-decision-content-migration-proof" frontend scripts
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: tests, TypeScript, and whitespace pass; `rg` exits 1 with no production or script matches. Permanent tests may still name deleted files to assert their absence.

- [ ] **Step 6: Commit Task 5**

```bash
git add -A -- \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts' \
  frontend/scripts/scaffold-model-page.ts scripts/model-setup.mjs scripts/migrate-model-decision-content.ts \
  tests/model-decision-content-migration-proof.test.ts tests/model-page-layout-architecture.test.ts \
  tests/model-decision-content-contract.test.ts tests/model-setup-cli.test.ts
git commit -m "refactor: remove model decision copy maps"
```

---

### Task 6: Document ownership and run production verification

**Files:**
- Modify: `docs/engineering/page-architecture.md`
- Modify: `docs/engineering/model-registry.md`
- Modify: `docs/engineering/refactor-roadmap.md`

**Interfaces:**
- Documents: one localized model content owner, strict parser boundary, live pricing separation, scaffold requirements, and the next independent component cleanup.
- Verifies: the complete branch range from `e65586bd` to final HEAD.

- [ ] **Step 1: Document the final ownership rule**

Add a “Localized Model Decision Content” section to `docs/engineering/page-architecture.md` stating:

```text
content/models/{locale}/{slug}.json is the only localized editorial owner for model pages.
Every template-configured model requires a strict top-level decision block in en, fr, and es.
getEngineLocalized selects decision only from the requested locale; it never falls back to English.
model-page-decision-content.ts validates copy and hrefs; model-page-decision-data.ts adds live pricing scenarios.
Do not add TypeScript copy maps, a second filesystem loader, direct JSON imports, or numeric prices to decision content.
```

Update `docs/engineering/model-registry.md` so the new-model checklist requires reviewing all three `decision` blocks and their exact `modelSlug` before publication.

Update `docs/engineering/refactor-roadmap.md`:

- record model decision content organization as completed;
- remove both old copy files from current candidates;
- set `ModelDecisionPromptingSection.tsx` as the next independent model-page cleanup;
- keep pricing hub and generation routes behind their existing higher-risk guards.

- [ ] **Step 2: Run the focused final model suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-decision-content-contract.test.ts \
  tests/model-image-decision-parity.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-registry-validation.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/model-setup-cli.test.ts
```

Expected: every focused test passes with zero skipped failures.

- [ ] **Step 3: Run all static and full-suite gates**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm model:registry:check
npm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: 0 test failures; lint, exposure, TypeScript, registry, audit, and whitespace checks pass. The architecture audit no longer lists either model decision copy file.

- [ ] **Step 4: Build the production app**

If disk is constrained, remove only the generated `frontend/.next` directory before building. Then run:

```bash
pnpm --prefix frontend run build
```

Expected: production build and postbuild sitemap complete successfully; output tracing contains `content/models` documents.

- [ ] **Step 5: Smoke-test localized production routes**

Start the built app:

```bash
pnpm --prefix frontend run start -p 3100
```

From another terminal, require HTTP 200 for:

```bash
curl -fsS http://localhost:3100/models/seedance-2-0 >/tmp/model-seedance-en.html
curl -fsS http://localhost:3100/fr/modeles/nano-banana-lite >/tmp/model-nano-lite-fr.html
curl -fsS http://localhost:3100/es/modelos/seedream-5-0-pro >/tmp/model-seedream-pro-es.html
curl -fsS http://localhost:3100/models/nano-banana-lite >/tmp/model-nano-lite-en.html
curl -fsS http://localhost:3100/fr/modeles/seedream-5-0-pro >/tmp/model-seedream-pro-fr.html
curl -fsS http://localhost:3100/es/modelos/nano-banana-lite >/tmp/model-nano-lite-es.html
```

Verify each new image page includes its decision hero, pricing section, localized canonical, and EN/FR/ES/x-default hreflang. Stop the server after the checks.

- [ ] **Step 6: Prove protected boundaries and final inventories**

Run:

```bash
git diff --exit-code e65586bd..HEAD -- \
  frontend/config/model-registry.json frontend/config/model-runtime.json frontend/config/engine-catalog.json \
  frontend/config/model-roster.json frontend/app/sitemap-models.xml \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/pricing frontend/server/pricing-admin
find content/models/en -maxdepth 1 -name '*.json' | wc -l
find content/models/fr -maxdepth 1 -name '*.json' | wc -l
find content/models/es -maxdepth 1 -name '*.json' | wc -l
rg -n "model-page-template-copy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY|migrate-model-decision-content|model-decision-content-migration-proof" frontend scripts
```

Expected: protected diff is empty; counts are 40/40/40; obsolete scan exits 1; only the three Task 6 documentation files are pending.

- [ ] **Step 7: Commit Task 6**

```bash
git add docs/engineering/page-architecture.md docs/engineering/model-registry.md docs/engineering/refactor-roadmap.md
git commit -m "docs: record model decision content ownership"
git status --short
```

Expected: commit succeeds and `git status --short` prints nothing.

---

## Final Review Gate

After all six tasks:

1. Generate one review package for `e65586bd..HEAD`.
2. Request a fresh whole-branch review against the design and this plan.
3. Fix every Critical and Important finding before delivery; evaluate Minor findings explicitly.
4. Re-run `pnpm test:validate`, build, and the six production smokes after any production-affecting fix.
5. Do not push until the reviewer reports the branch ready and the user chooses the delivery option.
