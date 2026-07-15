import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import type { EngineLocalizedContent } from '../frontend/lib/models/i18n.ts';
import { buildSoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { isPublishedModelPage } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-publication.ts';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = join(
  PROJECT_ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts',
);
const componentPath = join(
  PROJECT_ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx',
);
const LOCALES = ['en', 'fr', 'es'] as const;

function readLocalizedContent(modelSlug: string, locale: (typeof LOCALES)[number]): EngineLocalizedContent {
  const readOverlay = (overlayLocale: (typeof LOCALES)[number]) =>
    JSON.parse(
      readFileSync(join(PROJECT_ROOT, 'content', 'models', overlayLocale, `${modelSlug}.json`), 'utf8'),
    ) as Partial<EngineLocalizedContent>;
  const base = readOverlay('en');
  const overlay = locale === 'en' ? base : readOverlay(locale);

  return {
    marketingName: overlay.marketingName ?? base.marketingName,
    versionLabel: overlay.versionLabel ?? base.versionLabel,
    overview: overlay.overview ?? base.overview,
    pricingNotes: overlay.pricingNotes ?? base.pricingNotes,
    seo: {
      title: overlay.seo?.title ?? base.seo?.title,
      description: overlay.seo?.description ?? base.seo?.description,
      image: overlay.seo?.image ?? base.seo?.image,
    },
    hero:
      base.hero || overlay.hero
        ? {
            title: overlay.hero?.title ?? base.hero?.title,
            intro: overlay.hero?.intro ?? base.hero?.intro,
            badge: overlay.hero?.badge ?? base.hero?.badge,
            ctaPrimary: overlay.hero?.ctaPrimary ?? base.hero?.ctaPrimary,
            secondaryLinks: overlay.hero?.secondaryLinks ?? base.hero?.secondaryLinks,
          }
        : undefined,
    bestUseCases: overlay.bestUseCases ?? base.bestUseCases,
    technicalOverviewTitle: overlay.technicalOverviewTitle ?? base.technicalOverviewTitle,
    technicalOverview: overlay.technicalOverview ?? base.technicalOverview,
    promptStructure: overlay.promptStructure ?? base.promptStructure,
    tips: overlay.tips ?? base.tips,
    compareLink: overlay.compareLink ?? base.compareLink,
    prompts: [],
    faqs: [],
    custom: overlay.custom ?? base.custom,
    decision: overlay.decision,
  };
}

test('legacy prompting decisions are isolated behind one temporary pure projector', () => {
  assert.ok(existsSync(legacyPath));
  const legacySource = readFileSync(legacyPath, 'utf8');
  const componentSource = readFileSync(componentPath, 'utf8');

  assert.match(legacySource, /export function buildLegacyModelPromptingContent/);
  assert.match(componentSource, /buildLegacyModelPromptingContent/);
  assert.doesNotMatch(
    componentSource,
    /function getKlingO3PromptingTabs|function getImagePromptExamples|function getRouteDemoSummary/,
  );
  assert.ok(
    componentSource.trimEnd().split('\n').length <= 300,
    'ModelDecisionPromptingSection.tsx must stay at or below 300 physical lines',
  );
});

test('all 40-by-3 legacy projections satisfy the strict prompting contract after approved corrections', async () => {
  const [{ buildLegacyModelPromptingContent, resolveLegacyPromptingModelName }, { applyApprovedPromptingCorrections }] =
    await Promise.all([
      import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts'),
      import('../scripts/model-prompting-corrections.ts'),
    ]);
  const engines = listFalEngines().filter(isPublishedModelPage);
  assert.equal(engines.length, 40);

  for (const engine of engines) {
    const modes = engine.engine.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    const hasImageMode = modes.some((mode) => mode.endsWith('i'));
    const isImageEngine = hasImageMode && !hasVideoMode;

    for (const locale of LOCALES) {
      const localized = readLocalizedContent(engine.modelSlug, locale);
      const copy = buildSoraCopy(localized, engine.modelSlug, locale);
      const projection = buildLegacyModelPromptingContent({
        copy,
        engineId: engine.id,
        isImageEngine,
        locale,
        modelName: resolveLegacyPromptingModelName({ copy, engine, localized }),
        modelSlug: engine.modelSlug,
      });
      const beforeCorrection = structuredClone(projection);
      const corrected = applyApprovedPromptingCorrections(projection, engine.modelSlug, locale);
      const parsed = parseModelPromptingContent(
        corrected,
        engine.modelSlug,
        locale,
        `legacy projection ${engine.modelSlug}/${locale}`,
      );

      assert.deepEqual(projection, beforeCorrection, `${engine.modelSlug}/${locale} correction must be immutable`);
      assert.equal(parsed.modelSlug, engine.modelSlug, `${engine.modelSlug}/${locale} identity`);
      assert.equal(parsed.demo === null, isImageEngine, `${engine.modelSlug}/${locale} demo presence`);
      assert.equal(parsed.imageExamples === null, !isImageEngine, `${engine.modelSlug}/${locale} image examples presence`);
    }
  }
});
