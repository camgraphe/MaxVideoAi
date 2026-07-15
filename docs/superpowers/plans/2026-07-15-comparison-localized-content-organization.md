# Comparison Localized Content Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the known French and Spanish comparison-content gaps, then replace three giant locale maps with 47 strict per-comparison JSON documents without changing routes, prices, product facts, or any previously rendered copy.

**Architecture:** Keep `getComparePageOverride(locale, slug)` as the stable synchronous route-facing API. Store one canonical comparison per `content/comparisons/<slug>.json`, with adjacent `en`, `fr`, and `es` projections; the existing facade becomes the direct server-only filesystem loader and strict validator, with no registry, cache, fallback, compatibility bridge, or generic content framework.

**Tech Stack:** TypeScript, Next.js 15 App Router, Node filesystem APIs, Zod 3.23, JSON content documents, Node test runner through `tsx --test`.

## Global Constraints

- Implement the approved design in `docs/superpowers/specs/2026-07-15-comparison-localized-content-organization-design.md`.
- Start from the current `main` worktree and preserve unrelated user changes.
- Do not change a route, slug, redirect, canonical, hreflang, sitemap rule, robots rule, publication rule, price, model fact, score, spec, showdown, media item, or existing internal link.
- Phase A may add only the enumerated missing FR/ES metadata fields and the missing FR/ES quick verdict for `seedance-2-0-vs-seedance-2-0-fast`.
- Phase A titles must contain 35–80 characters; descriptions must contain 120–180 characters.
- French copy must read naturally in French; Spanish copy must remain neutral LATAM Spanish and avoid `vídeo`, `vídeos`, `móvil`, `móviles`, `ordenador`, `ordenadores`, `monedero`, `monederos`, and `vosotros`.
- Phase B must preserve all 141 completed slug-locale projections exactly, including field presence, strings, arrays, order, links, and optional-field absence.
- Keep `getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined` synchronous and observable behavior stable.
- A valid missing file returns `undefined`; a present malformed or incomplete file throws; an enriched file never falls back to English.
- Keep exactly one source of truth in the final branch: 47 files under `content/comparisons/`.
- Do not retain `compare-page-overrides-en.ts`, `compare-page-overrides-fr.ts`, `compare-page-overrides-es.ts`, a migration converter, or an old/new comparison bridge.
- Tests must discover final JSON files dynamically; do not create a second permanent manual list of all 47 slugs or duplicate all editorial prose in a fixture.
- Add `../content/comparisons/**/*` to the existing `CONTENT_GLOBS` in `frontend/next.config.js`.
- Do not add a CMS, database table, generated manifest, registry, cache, fallback adapter, compatibility shim, or generic content framework.
- Do not modify route components, comparison routing, comparison publication config, localized slug config, pricing sources, model registries, sitemap policy, or schema builders.
- Model-page decision-copy organization remains a separate follow-up project.

## Target File Map

- `content/comparisons/<slug>.json` — the only final enriched comparison-content source; one identity and all three locales per document.
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts` — stable synchronous route-facing loader plus strict document validation.
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts` — `ComparePageOverride` and `ComparePageContentDocument` types only.
- `frontend/next.config.js` — Vercel output tracing for comparison JSON content.
- `tests/comparison-content-contract.test.ts` — dynamic document, loader, validation, link, missing-file, and path-safety contracts.
- Existing comparison tests — consume `getComparePageOverride` instead of obsolete locale maps.
- `tests/compare-page-architecture.test.ts` — final ownership, tracing, route isolation, and obsolete-file absence contracts.
- `docs/engineering/page-architecture.md` — durable comparison content ownership rule.
- `docs/engineering/refactor-roadmap.md` — completed audit item and refreshed live candidates.
- Temporary only during migration: `tests/comparison-content-migration-proof.test.ts` and `scripts/migrate-comparison-overrides-to-json.ts`; both are absent from the final branch.

---

### Task 1: Complete the bounded French and Spanish editorial parity phase

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts:86-733`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts:86-733`
- Modify: `tests/comparison-enrichment-locales.test.ts`
- Test: `tests/comparison-enrichment-locales.test.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Test: `tests/luma-mini-seo-comparisons.test.ts`
- Test: `tests/happy-horse-compare-page.test.ts`

**Interfaces:**
- Consumes: the existing `ComparePageOverride` type and the three locale maps.
- Produces: 47 structurally aligned EN/FR/ES entries; exact Phase A content becomes the baseline serialized in Task 2.

- [ ] **Step 1: Add the failing localized parity contract**

Add this constant after `TARGET_COMPARISONS` in `tests/comparison-enrichment-locales.test.ts`:

```ts
const PARITY_COMPLETION_SLUGS = [
  'seedance-2-0-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
  'luma-ray-3-2-vs-veo-3-1-fast',
  'happy-horse-1-1-vs-kling-o3-pro',
  'happy-horse-1-1-vs-veo-3-1-fast',
  'happy-horse-1-1-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
  'happy-horse-1-1-vs-ltx-2-3-pro',
  'veo-3-1-fast-vs-veo-3-1-lite',
] as const;
```

Add this helper after `collectText`:

```ts
function collectStructuralFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectStructuralFieldPaths(item, `${prefix}[]`)))].sort();
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...collectStructuralFieldPaths(nested, path)];
    })
    .sort();
}
```

Add these tests before the existing link-resolution test:

```ts
test('the bounded FR and ES metadata gaps are complete and independently localized', () => {
  for (const slug of PARITY_COMPLETION_SLUGS) {
    const english = getEntry('en', slug);
    for (const locale of ['fr', 'es'] as const) {
      const localized = getEntry(locale, slug);
      const title = localized.meta?.title ?? '';
      const description = localized.meta?.description ?? '';

      assert.ok(title.length >= 35 && title.length <= 80, `${locale} title length for ${slug}: ${title.length}`);
      assert.ok(
        description.length >= 120 && description.length <= 180,
        `${locale} description length for ${slug}: ${description.length}`,
      );
      assert.equal(localized.meta?.titleBranding, english.meta?.titleBranding, `${locale} branding for ${slug}`);
      assert.notEqual(title, english.meta?.title, `${locale} title should not copy English for ${slug}`);
      assert.notEqual(description, english.meta?.description, `${locale} description should not copy English for ${slug}`);
    }
  }
});

test('all 47 completed comparison entries have equivalent EN, FR and ES field presence', () => {
  const englishSlugs = Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort();
  assert.equal(englishSlugs.length, 47);
  assert.deepEqual(Object.keys(FR_COMPARE_PAGE_OVERRIDES).sort(), englishSlugs);
  assert.deepEqual(Object.keys(ES_COMPARE_PAGE_OVERRIDES).sort(), englishSlugs);

  for (const slug of englishSlugs) {
    const englishPaths = collectStructuralFieldPaths(getEntry('en', slug));
    assert.deepEqual(collectStructuralFieldPaths(getEntry('fr', slug)), englishPaths, `FR structure for ${slug}`);
    assert.deepEqual(collectStructuralFieldPaths(getEntry('es', slug)), englishPaths, `ES structure for ${slug}`);
  }
});

test('Seedance 2.0 standard versus Fast has localized quick verdicts without fallback', () => {
  const slug = 'seedance-2-0-vs-seedance-2-0-fast';
  const english = getEntry('en', slug).quickVerdict;
  const french = getEntry('fr', slug).quickVerdict;
  const spanish = getEntry('es', slug).quickVerdict;

  assert.ok(french && french.body.length >= 120);
  assert.ok(spanish && spanish.body.length >= 120);
  assert.notEqual(french.title, english?.title);
  assert.notEqual(french.body, english?.body);
  assert.notEqual(spanish.title, english?.title);
  assert.notEqual(spanish.body, english?.body);
});
```

- [ ] **Step 2: Run the new contract and confirm the known failure set**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-enrichment-locales.test.ts
```

Expected: FAIL on missing `meta.title` for the 13 listed FR/ES entries; after the first failure is fixed, the structure and missing quick-verdict assertions continue to expose only the enumerated gaps.

- [ ] **Step 3: Add the exact French metadata and quick verdict**

In `compare-page-overrides-fr.ts`, add the matching `meta` literal to each existing slug object. These keys identify existing entries; do not create a separate runtime constant:

```ts
const FRENCH_META_TO_MERGE = {
  'seedance-2-0-vs-seedance-2-0-fast': {
    meta: {
      title: 'Seedance 2.0 vs Fast : qualité, vitesse, prix et usages',
      description: 'Comparez Seedance 2.0 et Fast avec des prompts identiques, des vidéos côte à côte, les prix, la vitesse, les écarts de qualité et les usages de chaque modèle.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-seedance-2-0': {
    meta: {
      title: 'Seedance 2.0 vs Mini : qualité, coût par lot et usages',
      description: 'Comparez Seedance 2.0 et Seedance 2.0 Mini selon les notes, les caractéristiques, les écarts de coût et les cas où Mini convient aux variantes vidéo en lot.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast': {
    meta: {
      title: 'Seedance 2.0 Fast vs Mini : vitesse, coût par lot et usages',
      description: 'Comparez Seedance 2.0 Fast et Seedance 2.0 Mini pour la vitesse des brouillons, le coût par lot, les caractéristiques, les notes et les flux marketing à grande échelle.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast': {
    meta: {
      title: 'LTX 2.3 Fast vs Seedance 2.0 Mini : valeur, caractéristiques et usages',
      description: 'Comparez LTX 2.3 Fast et Seedance 2.0 Mini pour les brouillons rapides, les variantes en lot, les caractéristiques, les notes et les flux de vidéo marketing.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast': {
    meta: {
      title: 'Seedance 2.0 Mini vs Veo 3.1 Fast : coût, audio et usages',
      description: 'Comparez Seedance 2.0 Mini et Veo 3.1 Fast selon leurs notes, leur position tarifaire, leur flux audio et leur place dans une production marketing.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2': {
    meta: {
      title: 'Seedance 2.0 Mini vs Luma Ray 3.2 : coût, montage et usages',
      description: 'Comparez Seedance 2.0 Mini et Luma Ray 3.2 pour le coût par lot, l’audio, le montage vidéo, le recadrage, les notes et les meilleurs usages marketing.',
      titleBranding: 'none',
    },
  },
  'luma-ray-3-2-vs-veo-3-1-fast': {
    meta: {
      title: 'Luma Ray 3.2 vs Veo 3.1 Fast : cinéma, audio et usages',
      description: 'Comparez Luma Ray 3.2 et Veo 3.1 Fast pour le mouvement cinématographique, le contrôle vidéo-à-vidéo, le recadrage, l’audio natif, la vitesse et les usages.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-kling-o3-pro': {
    meta: {
      title: 'Happy Horse 1.1 vs Kling O3 Pro : audio, références et usages',
      description: 'Comparez Happy Horse 1.1 et Kling O3 Pro pour l’audio natif, la synchronisation labiale, le contrôle par références, la vidéo-à-vidéo, les notes et les usages.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-veo-3-1-fast': {
    meta: {
      title: 'Happy Horse 1.1 vs Veo 3.1 Fast : audio, vitesse et usages',
      description: 'Comparez Happy Horse 1.1 et Veo 3.1 Fast pour l’audio natif, la synchronisation labiale, les brouillons rapides, la haute résolution, les notes et les usages.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-seedance-2-0-fast': {
    meta: {
      title: 'Happy Horse 1.1 vs Seedance 2.0 Fast : audio, brouillons et usages',
      description: 'Comparez Happy Horse 1.1 et Seedance 2.0 Fast pour l’audio natif, la synchronisation labiale, les brouillons rapides, la maîtrise des coûts, les notes et les usages.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1': {
    meta: {
      title: 'Seedance 2.0 Mini vs Happy Horse 1.1 : coût, audio et usages',
      description: 'Comparez Seedance 2.0 Mini et Happy Horse 1.1 pour le coût des vidéos en lot, l’audio natif, la synchronisation labiale, les références, les notes et les flux marketing.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-ltx-2-3-pro': {
    meta: {
      title: 'Happy Horse 1.1 vs LTX 2.3 Pro : audio, 4K, montage et usages',
      description: 'Comparez Happy Horse 1.1 et LTX 2.3 Pro pour l’audio natif, la synchronisation labiale, la 4K, les plans longs, le montage, les notes et les meilleurs usages.',
      titleBranding: 'none',
    },
  },
  'veo-3-1-fast-vs-veo-3-1-lite': {
    meta: {
      title: 'Veo 3.1 Lite vs Fast : prix, qualité et usages',
      description: 'Comparez Veo 3.1 Lite et Fast selon le prix, la qualité de sortie, le contrôle audio, la souplesse du flux de travail et les cas où chaque version vaut le choix.',
      titleBranding: 'none',
    },
  },
} as const;
```

Also add this literal inside the existing French `seedance-2-0-vs-seedance-2-0-fast` entry:

```ts
quickVerdict: {
  title: 'Verdict rapide',
  body: 'Le choix entre Seedance 2.0 et Seedance 2.0 Fast oppose surtout qualité finale et vitesse d’itération. Seedance 2.0 convient mieux aux plans finaux en 1080p ou 4K, à une cohérence renforcée, aux projets guidés par des références, à l’audio natif et à une finition soignée. Seedance 2.0 Fast est préférable pour des brouillons 480p ou 720p moins coûteux, les essais de prompts, les contrôles de rythme et l’exploration rapide, avant de produire la meilleure idée avec Seedance 2.0.',
},
```

Do not leave `FRENCH_META_TO_MERGE` in the source; it is a precise patch inventory for the 13 existing entry literals.

- [ ] **Step 4: Add the exact neutral-LATAM Spanish metadata and quick verdict**

In `compare-page-overrides-es.ts`, add the matching `meta` literal to each existing slug object. These keys identify existing entries; do not create a separate runtime constant:

```ts
const SPANISH_META_TO_MERGE = {
  'seedance-2-0-vs-seedance-2-0-fast': {
    meta: {
      title: 'Seedance 2.0 vs Fast: calidad, velocidad, precio y usos',
      description: 'Compara Seedance 2.0 y Fast con prompts idénticos, videos lado a lado, precios, velocidad, diferencias de calidad y los mejores usos de cada modelo.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-seedance-2-0': {
    meta: {
      title: 'Seedance 2.0 vs Mini: calidad, costo por lote y usos',
      description: 'Compara Seedance 2.0 y Seedance 2.0 Mini según sus calificaciones, especificaciones, diferencias de costo y cuándo usar Mini para variantes de video por lote.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast': {
    meta: {
      title: 'Seedance 2.0 Fast vs Mini: velocidad, costo por lote y usos',
      description: 'Compara Seedance 2.0 Fast y Seedance 2.0 Mini por velocidad de borrador, costo por lote, especificaciones, calificaciones y flujos de marketing a gran escala.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast': {
    meta: {
      title: 'LTX 2.3 Fast vs Seedance 2.0 Mini: valor, especificaciones y usos',
      description: 'Compara LTX 2.3 Fast y Seedance 2.0 Mini para borradores rápidos, variantes por lote, especificaciones, calificaciones y flujos de video para marketing.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast': {
    meta: {
      title: 'Seedance 2.0 Mini vs Veo 3.1 Fast: costo, audio y usos',
      description: 'Compara Seedance 2.0 Mini y Veo 3.1 Fast según sus calificaciones, posición de costo, flujo de audio y lugar dentro de una producción de marketing.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2': {
    meta: {
      title: 'Seedance 2.0 Mini vs Luma Ray 3.2: costo, edición y usos',
      description: 'Compara Seedance 2.0 Mini y Luma Ray 3.2 por costo por lote, audio, edición de video, reencuadre, calificaciones y mejores usos de marketing.',
      titleBranding: 'none',
    },
  },
  'luma-ray-3-2-vs-veo-3-1-fast': {
    meta: {
      title: 'Luma Ray 3.2 vs Veo 3.1 Fast: cine, audio y usos',
      description: 'Compara Luma Ray 3.2 y Veo 3.1 Fast por movimiento cinematográfico, control de video a video, reencuadre, audio nativo, velocidad y mejores usos.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-kling-o3-pro': {
    meta: {
      title: 'Happy Horse 1.1 vs Kling O3 Pro: audio, referencias y usos',
      description: 'Compara Happy Horse 1.1 y Kling O3 Pro por audio nativo, sincronización labial, control con referencias, video a video, calificaciones y mejores usos.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-veo-3-1-fast': {
    meta: {
      title: 'Happy Horse 1.1 vs Veo 3.1 Fast: audio, velocidad y usos',
      description: 'Compara Happy Horse 1.1 y Veo 3.1 Fast por audio nativo, sincronización labial, borradores rápidos, alta resolución, calificaciones y mejores usos.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-seedance-2-0-fast': {
    meta: {
      title: 'Happy Horse 1.1 vs Seedance 2.0 Fast: audio, borradores y usos',
      description: 'Compara Happy Horse 1.1 y Seedance 2.0 Fast por audio nativo, sincronización labial, borradores rápidos, control de costos, calificaciones y mejores usos.',
      titleBranding: 'none',
    },
  },
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1': {
    meta: {
      title: 'Seedance 2.0 Mini vs Happy Horse 1.1: costo, audio y usos',
      description: 'Compara Seedance 2.0 Mini y Happy Horse 1.1 por costo de video por lote, audio nativo, sincronización labial, referencias, calificaciones y flujos de marketing.',
      titleBranding: 'none',
    },
  },
  'happy-horse-1-1-vs-ltx-2-3-pro': {
    meta: {
      title: 'Happy Horse 1.1 vs LTX 2.3 Pro: audio, 4K, edición y usos',
      description: 'Compara Happy Horse 1.1 y LTX 2.3 Pro por audio nativo, sincronización labial, entrega en 4K, clips largos, controles de edición, calificaciones y mejores usos.',
      titleBranding: 'none',
    },
  },
  'veo-3-1-fast-vs-veo-3-1-lite': {
    meta: {
      title: 'Veo 3.1 Lite vs Fast: precio, calidad y usos',
      description: 'Compara Veo 3.1 Lite y Fast por precio, calidad de salida, control de audio, flexibilidad del flujo y cuándo conviene elegir cada versión.',
      titleBranding: 'none',
    },
  },
} as const;
```

Also add this literal inside the existing Spanish `seedance-2-0-vs-seedance-2-0-fast` entry:

```ts
quickVerdict: {
  title: 'Veredicto rápido',
  body: 'Elegir entre Seedance 2.0 y Seedance 2.0 Fast es, ante todo, decidir entre calidad final y velocidad de iteración. Seedance 2.0 funciona mejor para tomas finales en 1080p o 4K, mayor consistencia, trabajos guiados por referencias, audio nativo y resultados pulidos. Seedance 2.0 Fast conviene para borradores más económicos en 480p o 720p, pruebas de prompts, revisiones de ritmo y exploración creativa rápida antes de llevar la mejor idea a Seedance 2.0.',
},
```

Do not leave `SPANISH_META_TO_MERGE` in the source; it is a precise patch inventory for the 13 existing entry literals.

- [ ] **Step 5: Run the Phase A editorial and architecture checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/comparison-enrichment-locales.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/luma-mini-seo-comparisons.test.ts \
  tests/happy-horse-compare-page.test.ts
```

Expected: PASS with 47 equal key sets, exact structural parity, valid localized metadata lengths, no English quick-verdict fallback, and no Spain-specific vocabulary.

- [ ] **Step 6: Verify that Phase A changed only the bounded content and its contract**

Run:

```bash
git diff --name-only
git diff --check
git diff -- frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides-fr.ts \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides-es.ts \
  tests/comparison-enrichment-locales.test.ts
```

Expected: only the two localized source files and the parity test have changed; the content diff contains 26 `meta` additions and two quick-verdict additions, with no changes to existing fields.

- [ ] **Step 7: Commit the independently reviewable Phase A delta**

```bash
git add \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides-fr.ts \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides-es.ts \
  tests/comparison-enrichment-locales.test.ts
git commit -m "content: complete localized comparison parity"
```

---

### Task 2: Generate one JSON document per comparison and prove exact post-parity equality

**Files:**
- Create: `content/comparisons/*.json` — exactly 47 files
- Create temporarily: `tests/comparison-content-migration-proof.test.ts`
- Create and delete before commit: `scripts/migrate-comparison-overrides-to-json.ts`
- Test: `tests/comparison-content-migration-proof.test.ts`

**Interfaces:**
- Consumes: the completed `EN_COMPARE_PAGE_OVERRIDES`, `FR_COMPARE_PAGE_OVERRIDES`, and `ES_COMPARE_PAGE_OVERRIDES` maps from Task 1.
- Produces: 47 JSON documents shaped as `{ slug, en, fr, es }` and a temporary 141-projection deep-equality proof consumed by Task 3.

- [ ] **Step 1: Add the failing mechanical migration proof**

Create `tests/comparison-content-migration-proof.test.ts` with this complete content:

```ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import type { ComparePageContentDocument, ComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';

type Locale = 'en' | 'fr' | 'es';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'comparisons');
const SOURCE_BY_LOCALE: Record<Locale, Record<string, ComparePageOverride>> = {
  en: EN_COMPARE_PAGE_OVERRIDES,
  fr: FR_COMPARE_PAGE_OVERRIDES,
  es: ES_COMPARE_PAGE_OVERRIDES,
};

function loadDocument(slug: string): ComparePageContentDocument {
  return JSON.parse(readFileSync(path.join(CONTENT_DIR, `${slug}.json`), 'utf8')) as ComparePageContentDocument;
}

test('the generated content inventory exactly matches the three completed source maps', () => {
  const slugs = Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort();
  assert.equal(slugs.length, 47);
  assert.deepEqual(Object.keys(FR_COMPARE_PAGE_OVERRIDES).sort(), slugs);
  assert.deepEqual(Object.keys(ES_COMPARE_PAGE_OVERRIDES).sort(), slugs);
  assert.deepEqual(
    readdirSync(CONTENT_DIR).filter((name) => name.endsWith('.json')).sort(),
    slugs.map((slug) => `${slug}.json`),
  );
});

test('all 141 generated locale projections are deeply equal to the post-parity maps', () => {
  for (const slug of Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort()) {
    const document = loadDocument(slug);
    assert.equal(document.slug, slug);
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.deepEqual(document[locale], SOURCE_BY_LOCALE[locale][slug], `${locale} projection for ${slug}`);
    }
  }
});
```

Also add this type to `compare-page-overrides-types.ts` after `ComparePageOverride`:

```ts
export type ComparePageContentDocument = {
  slug: string;
  en: ComparePageOverride;
  fr: ComparePageOverride;
  es: ComparePageOverride;
};
```

- [ ] **Step 2: Run the migration proof before generating files**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-content-migration-proof.test.ts
```

Expected: FAIL because `content/comparisons` does not exist yet.

- [ ] **Step 3: Create the one-off deterministic converter**

Create `scripts/migrate-comparison-overrides-to-json.ts` with this complete content:

```ts
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import type { ComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';

const outputDirectory = path.join(process.cwd(), 'content', 'comparisons');
const slugs = Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort();

assert.equal(slugs.length, 47, `expected 47 English comparisons, got ${slugs.length}`);
assert.deepEqual(Object.keys(FR_COMPARE_PAGE_OVERRIDES).sort(), slugs, 'French slug keys differ from English');
assert.deepEqual(Object.keys(ES_COMPARE_PAGE_OVERRIDES).sort(), slugs, 'Spanish slug keys differ from English');

mkdirSync(outputDirectory, { recursive: true });

for (const slug of slugs) {
  const document: ComparePageContentDocument = {
    slug,
    en: EN_COMPARE_PAGE_OVERRIDES[slug],
    fr: FR_COMPARE_PAGE_OVERRIDES[slug],
    es: ES_COMPARE_PAGE_OVERRIDES[slug],
  };
  writeFileSync(path.join(outputDirectory, `${slug}.json`), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

process.stdout.write(`Wrote ${slugs.length} comparison documents to ${outputDirectory}\n`);
```

- [ ] **Step 4: Generate the documents and remove the converter**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-comparison-overrides-to-json.ts
```

Expected: `Wrote 47 comparison documents to .../content/comparisons`.

Delete `scripts/migrate-comparison-overrides-to-json.ts` with `apply_patch` immediately after generation. Confirm the temporary converter is absent:

```bash
test ! -e scripts/migrate-comparison-overrides-to-json.ts
find content/comparisons -maxdepth 1 -type f -name '*.json' | wc -l
```

Expected: the first command exits 0 and the count is exactly `47`.

- [ ] **Step 5: Run the full 141-projection proof**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-content-migration-proof.test.ts
```

Expected: PASS; 47 filenames and all 141 locale objects are deeply equal to the Task 1 maps.

- [ ] **Step 6: Commit the mechanically generated representation and temporary proof**

```bash
git add content/comparisons \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides-types.ts \
  tests/comparison-content-migration-proof.test.ts
git commit -m "content: organize comparisons by canonical slug"
```

---

### Task 3: Switch the stable API to a strict direct JSON loader

**Files:**
- Create: `tests/comparison-content-contract.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts`
- Modify: `frontend/next.config.js:24-32`
- Modify temporarily: `tests/comparison-content-migration-proof.test.ts`
- Test: `tests/comparison-content-contract.test.ts`
- Test: `tests/comparison-content-migration-proof.test.ts`
- Test: `tests/comparison-indexation-wave-1.test.ts`
- Test: `tests/compare-page-pricing-display.test.ts`

**Interfaces:**
- Consumes: `ComparePageContentDocument`, `ComparePageOverride`, `CONTENT_ROOT`, Zod 3.23, and the 47 documents from Task 2.
- Produces: `parseComparePageContentDocument(raw: string, expectedSlug: string, source?: string): ComparePageContentDocument` for validation tests and the unchanged `getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined` for routes.

- [ ] **Step 1: Add the failing dynamic content and loader contract**

Create `tests/comparison-content-contract.test.ts` with this complete content:

```ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getComparePageOverride,
  parseComparePageContentDocument,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import type { ComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'comparisons');
const LOCALES = ['en', 'fr', 'es'] as const;

function contentFiles(): string[] {
  return readdirSync(CONTENT_DIR).filter((name) => name.endsWith('.json')).sort();
}

function loadDocument(fileName: string): ComparePageContentDocument {
  const slug = fileName.slice(0, -'.json'.length);
  return parseComparePageContentDocument(
    readFileSync(path.join(CONTENT_DIR, fileName), 'utf8'),
    slug,
    fileName,
  );
}

test('comparison documents are dynamically discovered with unique matching identities and three locales', () => {
  const files = contentFiles();
  assert.equal(files.length, 47);
  const identities = new Set<string>();

  for (const fileName of files) {
    const document = loadDocument(fileName);
    assert.equal(document.slug, fileName.slice(0, -'.json'.length));
    assert.deepEqual(Object.keys(document).sort(), ['en', 'es', 'fr', 'slug']);
    assert.equal(identities.has(document.slug), false, `duplicate comparison identity ${document.slug}`);
    identities.add(document.slug);
  }
});

test('the stable loader returns every exact requested locale projection', () => {
  for (const fileName of contentFiles()) {
    const document = loadDocument(fileName);
    for (const locale of LOCALES) {
      assert.deepEqual(getComparePageOverride(locale, document.slug), document[locale], `${locale} ${document.slug}`);
    }
  }
});

test('a valid comparison slug without enriched content preserves generic rendering', () => {
  assert.equal(getComparePageOverride('en', 'generic-left-vs-generic-right'), undefined);
  assert.equal(getComparePageOverride('fr', 'generic-left-vs-generic-right'), undefined);
  assert.equal(getComparePageOverride('es', 'generic-left-vs-generic-right'), undefined);
});

test('present malformed, incomplete, unknown-field and identity-mismatched documents fail loudly', () => {
  const slug = 'fixture-left-vs-fixture-right';
  const valid = {
    slug,
    en: {},
    fr: {},
    es: {},
  };

  assert.throws(() => parseComparePageContentDocument('{', slug, 'malformed.json'), /Invalid JSON.*malformed\.json/);
  assert.throws(
    () => parseComparePageContentDocument(JSON.stringify({ slug, en: {}, fr: {} }), slug, 'missing-es.json'),
    /Invalid document.*missing-es\.json.*es/s,
  );
  assert.throws(
    () => parseComparePageContentDocument(JSON.stringify({ ...valid, extra: true }), slug, 'unknown.json'),
    /Invalid document.*unknown\.json/s,
  );
  assert.throws(
    () => parseComparePageContentDocument(JSON.stringify({ ...valid, slug: 'other-left-vs-other-right' }), slug, 'identity.json'),
    /identity.*identity\.json/s,
  );
});

test('path-unsafe requests and structurally divergent locales are rejected', () => {
  assert.throws(() => getComparePageOverride('en', '../secrets'), /path-safe comparison slug/);
  assert.throws(() => getComparePageOverride('en', 'left-vs-right.json'), /path-safe comparison slug/);

  const slug = 'fixture-left-vs-fixture-right';
  assert.throws(
    () => parseComparePageContentDocument(
      JSON.stringify({
        slug,
        en: { meta: { title: 'English' } },
        fr: {},
        es: {},
      }),
      slug,
      'structure.json',
    ),
    /structural parity.*structure\.json/s,
  );
});

test('all comparison-content links use locale-neutral supported public route families', () => {
  for (const fileName of contentFiles()) {
    const document = loadDocument(fileName);
    for (const locale of LOCALES) {
      for (const link of document[locale].primaryLinks ?? []) {
        assert.match(link.href, /^\/(models|examples|ai-video-engines)\//, `${locale} unsupported href ${link.href}`);
        assert.doesNotMatch(link.href, /^\/(fr|es)\//, `${locale} hard-coded locale prefix ${link.href}`);
      }
    }
  }
});
```

- [ ] **Step 2: Run the new contract against the old facade**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-content-contract.test.ts
```

Expected: FAIL because `parseComparePageContentDocument` is not exported and the old facade still imports three maps.

- [ ] **Step 3: Replace the old facade with the complete strict loader**

Replace all content in `compare-page-overrides.ts` with:

```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';
import { CONTENT_ROOT } from '@/lib/i18n/paths';
import type { ComparePageContentDocument, ComparePageOverride } from './compare-page-overrides-types';
export type { ComparePageOverride } from './compare-page-overrides-types';

const COMPARISON_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-vs-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPARISON_CONTENT_ROOT = path.join(CONTENT_ROOT, 'comparisons');
const nonEmptyString = z.string().min(1);
const internalHref = nonEmptyString.regex(/^\/(?:models|examples|ai-video-engines)\//);

const metaSchema = z.object({
  title: nonEmptyString.optional(),
  description: nonEmptyString.optional(),
  titleBranding: z.enum(['auto', 'none']).optional(),
}).strict();

const quickVerdictSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
}).strict();

const topCardSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
}).strict();

const primaryLinkSchema = z.object({
  href: internalHref,
  label: nonEmptyString,
}).strict();

const faqItemSchema = z.object({
  question: nonEmptyString,
  answer: z.union([nonEmptyString, z.array(nonEmptyString).min(1)]),
}).strict();

const faqSchema = z.object({
  title: nonEmptyString.optional(),
  subtitle: nonEmptyString.optional(),
  items: z.array(faqItemSchema),
}).strict();

const comparePageOverrideSchema: z.ZodType<ComparePageOverride> = z.object({
  meta: metaSchema.optional(),
  heroIntro: nonEmptyString.optional(),
  quickVerdict: quickVerdictSchema.optional(),
  topCards: z.array(topCardSchema).optional(),
  primaryLinksTitle: nonEmptyString.optional(),
  primaryLinks: z.array(primaryLinkSchema).optional(),
  faq: faqSchema.optional(),
}).strict();

const comparePageContentSchema: z.ZodType<ComparePageContentDocument> = z.object({
  slug: nonEmptyString.regex(COMPARISON_SLUG_PATTERN),
  en: comparePageOverrideSchema,
  fr: comparePageOverrideSchema,
  es: comparePageOverrideSchema,
}).strict();

function assertPathSafeComparisonSlug(slug: string): void {
  if (!COMPARISON_SLUG_PATTERN.test(slug)) {
    throw new Error(`[comparison-content] Expected a path-safe comparison slug, received ${JSON.stringify(slug)}`);
  }
}

function collectStructuralFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectStructuralFieldPaths(item, `${prefix}[]`)))].sort();
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      return [fieldPath, ...collectStructuralFieldPaths(nested, fieldPath)];
    })
    .sort();
}

function assertStructuralParity(document: ComparePageContentDocument, source: string): void {
  const englishPaths = collectStructuralFieldPaths(document.en);
  for (const locale of ['fr', 'es'] as const) {
    const localizedPaths = collectStructuralFieldPaths(document[locale]);
    if (JSON.stringify(localizedPaths) !== JSON.stringify(englishPaths)) {
      throw new Error(
        `[comparison-content] Failed structural parity for ${locale} in ${source}: ` +
          `expected ${JSON.stringify(englishPaths)}, received ${JSON.stringify(localizedPaths)}`,
      );
    }
  }
}

export function parseComparePageContentDocument(
  raw: string,
  expectedSlug: string,
  source = `${expectedSlug}.json`,
): ComparePageContentDocument {
  assertPathSafeComparisonSlug(expectedSlug);

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[comparison-content] Invalid JSON in ${source}: ${message}`, { cause: error });
  }

  const result = comparePageContentSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[comparison-content] Invalid document ${source}: ${issues}`);
  }
  if (result.data.slug !== expectedSlug) {
    throw new Error(
      `[comparison-content] Comparison identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.slug}`,
    );
  }

  assertStructuralParity(result.data, source);
  return result.data;
}

export function getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined {
  assertPathSafeComparisonSlug(slug);
  const filePath = path.join(COMPARISON_CONTENT_ROOT, `${slug}.json`);
  if (!existsSync(filePath)) {
    return undefined;
  }
  return parseComparePageContentDocument(readFileSync(filePath, 'utf8'), slug, filePath)[locale];
}
```

Do not add memoization or fallback. The explicit file read on each call keeps the loader direct and makes content changes visible without a second invalidation owner.

- [ ] **Step 4: Add comparison JSON to Next output tracing**

Add this exact entry to `CONTENT_GLOBS` in `frontend/next.config.js` immediately after `../content/models/**/*`:

```js
  '../content/comparisons/**/*',
```

- [ ] **Step 5: Extend the temporary proof through the route-facing API**

Add this import to `tests/comparison-content-migration-proof.test.ts`:

```ts
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
```

Add this test after the existing 141-projection proof:

```ts
test('the route-facing loader returns the exact post-parity source projection', () => {
  for (const slug of Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort()) {
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.deepEqual(getComparePageOverride(locale, slug), SOURCE_BY_LOCALE[locale][slug], `${locale} route data for ${slug}`);
    }
  }
});
```

- [ ] **Step 6: Run strict loader, migration, route, and metadata checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/comparison-content-contract.test.ts \
  tests/comparison-content-migration-proof.test.ts \
  tests/comparison-enrichment-locales.test.ts \
  tests/comparison-indexation-wave-1.test.ts \
  tests/compare-page-pricing-display.test.ts
```

Expected: PASS; malformed fixtures throw, a valid missing slug returns `undefined`, all 141 loader results equal the completed maps, and existing routes still receive the same objects.

- [ ] **Step 7: Commit the runtime cutover while the proof sources still exist**

```bash
git add \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-overrides.ts \
  frontend/next.config.js \
  tests/comparison-content-contract.test.ts \
  tests/comparison-content-migration-proof.test.ts
git commit -m "refactor: load comparison content by canonical slug"
```

---

### Task 4: Remove obsolete locale maps and migrate every test to the stable loader

**Files:**
- Delete: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- Delete: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- Delete: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Delete: `tests/comparison-content-migration-proof.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts`
- Modify: `tests/comparison-high-impression-ctr-wave-3.test.ts`
- Modify: `tests/gemini-omni-marketing-surfaces.test.ts`
- Modify: `tests/compare-page-architecture.test.ts`
- Modify: `tests/luma-mini-seo-comparisons.test.ts`
- Modify: `tests/comparison-ctr-migration-wave-2.test.ts`
- Modify: `tests/happy-horse-compare-page.test.ts`
- Modify: `tests/comparison-enrichment-locales.test.ts`
- Modify: `scripts/generate-comparison-indexation-matrix.ts`
- Test: `tests/comparison-indexation-wave-1.test.ts`
- Test: all modified comparison tests

**Interfaces:**
- Consumes: the strict `getComparePageOverride` API proven in Task 3.
- Produces: a final single-source architecture in which no production or test import references a locale-specific map.

- [ ] **Step 1: Add the failing final architecture assertions before deleting sources**

In `tests/compare-page-architecture.test.ts`, change the filesystem import to:

```ts
import { existsSync, readFileSync } from 'node:fs';
```

Replace the old English-map import with:

```ts
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
```

Remove the three eager `overrideEnSource`, `overrideFrSource`, and `overrideEsSource` reads. Add these constants beside `overrideTypesSource`:

```ts
const obsoleteOverridePaths = [
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts',
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts',
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts',
];
const nextConfigSource = readFileSync('frontend/next.config.js', 'utf8');
```

Replace the old override assertions inside `comparison detail helper facade delegates routing, pricing, specs, and localized overrides` with:

```ts
  assert.match(overrideSource, /export function getComparePageOverride/);
  assert.match(overrideSource, /parseComparePageContentDocument/);
  assert.match(overrideSource, /readFileSync/);
  assert.match(overrideSource, /CONTENT_ROOT/);
  assert.doesNotMatch(overrideSource, /compare-page-overrides-(en|fr|es)/);
  assert.match(overrideTypesSource, /export type ComparePageOverride/);
  assert.match(overrideTypesSource, /export type ComparePageContentDocument/);
```

Add this independent architecture test:

```ts
test('comparison content has one JSON source and is traced without route imports', () => {
  for (const obsoletePath of obsoleteOverridePaths) {
    assert.equal(existsSync(obsoletePath), false, `${obsoletePath} should be deleted`);
  }
  assert.match(nextConfigSource, /\.\.\/content\/comparisons\/\*\*\/\*/);
  assert.doesNotMatch(pageSource, /content\/comparisons|\.json['"]/);
  assert.doesNotMatch(metadataSource, /content\/comparisons|\.json['"]/);
  assert.match(pageSource, /from '\.\/_lib\/compare-page-overrides'/);
  assert.match(metadataSource, /from '\.\/compare-page-overrides'/);
});
```

Replace every remaining `EN_COMPARE_PAGE_OVERRIDES[slug]` expression in this test with `getComparePageOverride('en', slug)`.

- [ ] **Step 2: Run the architecture test while obsolete files still exist**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
```

Expected: FAIL because all three obsolete paths still exist.

- [ ] **Step 3: Migrate map-based helper tests to the stable API**

In each of these three files:

- `tests/comparison-high-impression-ctr-wave-3.test.ts`
- `tests/comparison-ctr-migration-wave-2.test.ts`
- `tests/comparison-enrichment-locales.test.ts`

replace the three locale-map imports with:

```ts
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
```

Delete `OverrideMap` and `OVERRIDES_BY_LOCALE`, then use this complete helper:

```ts
function getEntry(locale: Locale, slug: string): ComparePageOverride {
  const entry = getComparePageOverride(locale, slug);
  assert.ok(entry, `missing ${locale.toUpperCase()} override for ${slug}`);
  return entry;
}
```

Preserve the more specific existing assertion message in the wave-2 and wave-3 files if desired; do not change their test logic.

Delete the temporary `collectStructuralFieldPaths` helper and the
`all 47 completed comparison entries have equivalent EN, FR and ES field presence`
test from `comparison-enrichment-locales.test.ts`. Task 3 has made
`tests/comparison-content-contract.test.ts` the permanent dynamic parity contract,
so retaining the temporary oracle would duplicate the production validation algorithm.
Keep the bounded 13-slug metadata and Seedance quick-verdict editorial assertions.

- [ ] **Step 4: Migrate the remaining direct-map assertions**

In `tests/gemini-omni-marketing-surfaces.test.ts`, replace the three map imports with the stable loader import and use:

```ts
const englishComparison = getComparePageOverride('en', PRIMARY_COMPARE_SLUG);
const frenchComparison = getComparePageOverride('fr', PRIMARY_COMPARE_SLUG);
const spanishComparison = getComparePageOverride('es', PRIMARY_COMPARE_SLUG);
assert.ok(englishComparison, 'missing EN Omni vs Veo override');
assert.ok(frenchComparison, 'missing FR Omni vs Veo override');
assert.ok(spanishComparison, 'missing ES Omni vs Veo override');
assert.match(englishComparison.heroIntro ?? '', /scorecard\/specs page/);
assert.match(englishComparison.quickVerdict?.body ?? '', /first\/last-frame|extend/i);
```

In `tests/luma-mini-seo-comparisons.test.ts`, replace the three map imports with the stable loader import, then use:

```ts
for (const slug of TARGET_COMPARISONS) {
  const english = getComparePageOverride('en', slug);
  assert.ok(english, `missing EN override for ${slug}`);
  assert.ok(getComparePageOverride('fr', slug), `missing FR override for ${slug}`);
  assert.ok(getComparePageOverride('es', slug), `missing ES override for ${slug}`);
  assert.ok((english.faq?.items.length ?? 0) >= 3, `EN FAQ should cover ${slug}`);
}
assert.match(getComparePageOverride('en', 'dreamina-seedance-2-0-mini-vs-luma-ray-3-2')?.heroIntro ?? '', /scorecard-only/);
assert.match(getComparePageOverride('en', 'luma-ray-3-2-vs-veo-3-1-fast')?.heroIntro ?? '', /source-video control/);
```

In `tests/happy-horse-compare-page.test.ts`, replace the three map imports with the stable loader import, then use:

```ts
for (const slug of HAPPY_HORSE_COMPARISON_SLUGS) {
  const english = getComparePageOverride('en', slug);
  assert.ok(english, `missing EN override for ${slug}`);
  assert.ok(getComparePageOverride('fr', slug), `missing FR override for ${slug}`);
  assert.ok(getComparePageOverride('es', slug), `missing ES override for ${slug}`);
  assert.ok(english.heroIntro?.includes('Happy Horse'), `EN hero should mention Happy Horse for ${slug}`);
  assert.ok((english.faq?.items.length ?? 0) >= 3, `EN FAQ should cover ${slug}`);
}
assert.match(getComparePageOverride('en', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
assert.match(getComparePageOverride('fr', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
assert.match(getComparePageOverride('es', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
```

In `scripts/generate-comparison-indexation-matrix.ts`, replace the three locale-map imports with:

```ts
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
```

Replace the `localizedOverrideSlugs` object inside `generateComparisonIndexationArtifacts` with:

```ts
  const localizedOverrideSlugs = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      new Set(publishedSlugs.filter((slug) => getComparePageOverride(locale, slug) !== undefined)),
    ]),
  ) as Record<ComparisonLocale, ReadonlySet<string>>;
```

This preserves the existing meaning of `hasLocalizedOverride` while making the stable loader the only content owner used by the indexation evidence generator.

- [ ] **Step 5: Delete old maps, obsolete map types, and the temporary proof**

Delete these four files with `apply_patch`:

```text
frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts
frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts
frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts
tests/comparison-content-migration-proof.test.ts
```

Remove the now-unused `AppLocale` import and these two obsolete aliases from `compare-page-overrides-types.ts`:

```ts
export type ComparePageOverridesBySlug = Record<string, ComparePageOverride>;
export type ComparePageOverridesByLocale = Partial<Record<AppLocale, ComparePageOverridesBySlug>>;
```

- [ ] **Step 6: Prove there are no old imports or duplicate sources left**

Run:

```bash
rg -n "from .*compare-page-overrides-(en|fr|es)|EN_COMPARE_PAGE_OVERRIDES|FR_COMPARE_PAGE_OVERRIDES|ES_COMPARE_PAGE_OVERRIDES|ComparePageOverridesBySlug|ComparePageOverridesByLocale" frontend tests scripts content
test ! -e tests/comparison-content-migration-proof.test.ts
test ! -e scripts/migrate-comparison-overrides-to-json.ts
```

Expected: `rg` exits 1 with no matches; both `test` commands exit 0.

- [ ] **Step 7: Run every migrated comparison suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/comparison-content-contract.test.ts \
  tests/comparison-high-impression-ctr-wave-3.test.ts \
  tests/comparison-ctr-migration-wave-2.test.ts \
  tests/comparison-enrichment-locales.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/luma-mini-seo-comparisons.test.ts \
  tests/happy-horse-compare-page.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/comparison-indexation-wave-1.test.ts
```

Expected: PASS with no old-map imports and all existing copy/fact/link assertions unchanged.

- [ ] **Step 8: Commit the single-source final architecture**

```bash
git add -A frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib \
  tests/comparison-high-impression-ctr-wave-3.test.ts \
  tests/comparison-ctr-migration-wave-2.test.ts \
  tests/comparison-enrichment-locales.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/luma-mini-seo-comparisons.test.ts \
  tests/happy-horse-compare-page.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/comparison-content-migration-proof.test.ts \
  scripts/generate-comparison-indexation-matrix.ts
git commit -m "refactor: remove locale comparison maps"
```

---

### Task 5: Document the ownership rule and run final preservation gates

**Files:**
- Modify: `docs/engineering/page-architecture.md`
- Modify: `docs/engineering/refactor-roadmap.md`
- Test: full repository validation and representative built routes

**Interfaces:**
- Consumes: the final loader, 47 documents, dynamic contracts, and single-source architecture from Task 4.
- Produces: durable contributor guidance and final evidence that public routes, SEO infrastructure, pricing, and existing comparison behavior remain unchanged outside Phase A.

- [ ] **Step 1: Document comparison content ownership**

Add this section before `## Refactor Checklist` in `docs/engineering/page-architecture.md`:

````markdown
## Localized Comparison Content

Enriched comparison editorial content is owned by `content/comparisons/<canonical-slug>.json`.
Each document contains one `slug` plus complete `en`, `fr`, and `es` projections. Keep those
locale projections structurally aligned and edit them together; do not add locale-specific
TypeScript maps, an English fallback, a generated registry, or direct JSON imports in routes.

Routes and metadata builders consume only:

```ts
getComparePageOverride(locale, canonicalSlug)
```

Comparisons without a content document intentionally use the generic renderer. New or edited
documents must pass `tests/comparison-content-contract.test.ts`, including identity, schema,
locale parity, link, path-safety, and output-tracing contracts.
````

- [ ] **Step 2: Refresh the live cleanup roadmap**

Add this bullet to `## Recently Completed` in `docs/engineering/refactor-roadmap.md`:

```markdown
- Localized comparison content: 47 per-slug JSON documents now own adjacent EN/FR/ES projections behind the unchanged route-facing loader; strict parity and validation contracts replace the three giant locale maps.
```

Remove these three rows from `## Current High-Signal Candidates`:

```markdown
| `compare-page-overrides-en.ts` | 2840 | localized content organization |
| `compare-page-overrides-es.ts` | 2757 | localized content organization |
| `compare-page-overrides-fr.ts` | 2757 | localized content organization |
```

Change cleanup sequence item 2 to:

```markdown
2. Treat comparison content organization as complete; model decision copy remains the next independent content-organization project and requires its own parity and migration proof.
```

- [ ] **Step 3: Run the focused comparison, SEO, schema, routing, and pricing-display suites**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/comparison-content-contract.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/comparison-*.test.ts \
  tests/luma-mini-seo-comparisons.test.ts \
  tests/happy-horse-compare-page.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/ai-video-engines-route-architecture.test.ts \
  tests/compare-page-pricing-display.test.ts
```

Expected: PASS with zero failures. The shell may pass a test twice when an explicit path also matches the glob; the runner must still report zero failures.

- [ ] **Step 4: Run the full static and architecture gates**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm architecture:audit -- --min-lines 500
git diff --check
```

Expected:

- full Node suite PASS with zero failures and at least the current 2,179-test baseline;
- ESLint PASS;
- public exposure lint PASS;
- TypeScript PASS;
- architecture audit no longer lists the three deleted locale maps;
- `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Run a production build and representative EN/FR/ES smoke checks**

Run:

```bash
pnpm --prefix frontend run build
pnpm --prefix frontend run start -- -p 3100
```

Expected: production build PASS; the server listens on port 3100. From a second terminal, run:

```bash
curl -fsS http://localhost:3100/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast | rg -q 'Seedance 2.0'
curl -fsS http://localhost:3100/fr/comparatif/seedance-2-0-vs-seedance-2-0-fast | rg -q 'Seedance 2.0'
curl -fsS http://localhost:3100/es/comparativa/seedance-2-0-vs-seedance-2-0-fast | rg -q 'Seedance 2.0'
curl -fsS http://localhost:3100/ai-video-engines/kling-3-pro-vs-veo-3-1 | rg -q 'Kling 3|Veo 3.1'
```

Expected: all four requests exit 0. The final URL is a published comparison without an enriched document and proves that the generic renderer still works. Stop the local server after the checks.

- [ ] **Step 6: Audit the final diff against the preservation boundary**

Run:

```bash
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- \
  frontend/config \
  frontend/lib/compare-hub \
  frontend/lib/sitemap \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/page.tsx \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-routing.ts \
  frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-metadata.ts \
  packages/pricing
```

Expected: the scoped diff is empty. The only authored prose differences are the 26 localized `meta` objects and two localized quick verdicts from Task 1; all other comparison prose appears only as mechanical relocation.

- [ ] **Step 7: Commit the durable documentation and verification record**

```bash
git add docs/engineering/page-architecture.md docs/engineering/refactor-roadmap.md
git commit -m "docs: record comparison content ownership"
```

Final repository checks:

```bash
git status --short
find content/comparisons -maxdepth 1 -type f -name '*.json' | wc -l
rg -n "from .*compare-page-overrides-(en|fr|es)|EN_COMPARE_PAGE_OVERRIDES|FR_COMPARE_PAGE_OVERRIDES|ES_COMPARE_PAGE_OVERRIDES|comparison-content-migration-proof|migrate-comparison-overrides-to-json" frontend tests scripts content
```

Expected: clean status, exactly `47` JSON files, and `rg` exits 1 with no obsolete-source or temporary-migration references.
