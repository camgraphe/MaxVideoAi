import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { AppLocale } from '../frontend/i18n/locales';
import type { EngineLocalizedContent } from '../frontend/lib/models/i18n';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { buildSoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import {
  buildLegacyModelPromptingContent,
  resolveLegacyPromptingModelName,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy';
import { isPublishedModelPage } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-publication';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import {
  APPROVED_PROMPTING_CORRECTIONS,
  applyApprovedPromptingCorrections,
} from './model-prompting-corrections';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const WRITE = process.argv.includes('--write');
const REMOVE_LEGACY = process.argv.includes('--remove-legacy');
const PROMPTING_CUSTOM_KEYS = [
  'promptingTitle',
  'promptingIntro',
  'promptingTip',
  'promptingGuideLabel',
  'promptingGuideUrl',
  'promptingTabs',
  'promptingGlobalPrinciples',
  'promptingEngineWhy',
  'promptingTabNotes',
  'demoTitle',
  'demoPromptLabel',
  'demoPrompt',
  'demoNotes',
] as const;

type ModelDocument = Record<string, unknown> & {
  custom?: Record<string, unknown>;
  prompting?: unknown;
};

function validateArguments(): void {
  const supported = new Set(['--write', '--remove-legacy']);
  const unknown = process.argv.slice(2).filter((argument) => !supported.has(argument));
  if (unknown.length) throw new Error(`Unsupported argument(s): ${unknown.join(', ')}`);
  if (REMOVE_LEGACY && !WRITE) throw new Error('--remove-legacy requires --write');
}

async function readLocalizedContent(modelSlug: string, locale: AppLocale): Promise<EngineLocalizedContent> {
  const readOverlay = async (overlayLocale: AppLocale) =>
    JSON.parse(
      await fs.readFile(path.join(CONTENT_ROOT, overlayLocale, `${modelSlug}.json`), 'utf8'),
    ) as Partial<EngineLocalizedContent>;
  const base = await readOverlay('en');
  const overlay = locale === 'en' ? base : await readOverlay(locale);

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
    prompting: overlay.prompting,
    decision: overlay.decision,
  };
}

function removeLegacyPromptingKeys(document: ModelDocument): number {
  if (!document.custom) return 0;
  let removed = 0;
  for (const key of PROMPTING_CUSTOM_KEYS) {
    if (Object.hasOwn(document.custom, key)) {
      delete document.custom[key];
      removed += 1;
    }
  }
  return removed;
}

async function main(): Promise<void> {
  validateArguments();
  const engines = listFalEngines().filter(isPublishedModelPage);
  const modelSlugs = listModelPageTemplateSlugs().sort();
  if (engines.length !== modelSlugs.length) {
    throw new Error(`Expected ${modelSlugs.length} published engines, received ${engines.length}`);
  }

  let projections = 0;
  let pending = 0;
  let corrections = 0;
  let updatedDocuments = 0;
  let removedLegacyKeys = 0;

  for (const locale of LOCALES) {
    for (const modelSlug of modelSlugs) {
      const filePath = path.join(CONTENT_ROOT, locale, `${modelSlug}.json`);
      const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as ModelDocument;
      const engine = engines.find((candidate) => candidate.modelSlug === modelSlug);
      if (!engine) throw new Error(`Missing engine for ${modelSlug}`);
      const localized = await readLocalizedContent(modelSlug, locale);
      const copy = buildSoraCopy(localized, modelSlug, locale);
      const projected = buildLegacyModelPromptingContent({
        copy,
        engineId: engine.id,
        isImageEngine: (() => {
          const modes = engine.engine.modes ?? [];
          const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
          const hasImageMode = modes.some((mode) => mode.endsWith('i'));
          return hasImageMode && !hasVideoMode;
        })(),
        locale,
        modelName: resolveLegacyPromptingModelName({ copy, engine, localized }),
        modelSlug,
      });
      const corrected = applyApprovedPromptingCorrections(projected, modelSlug, locale);
      const pairCorrectionCount = APPROVED_PROMPTING_CORRECTIONS.filter(
        (correction) => correction.slug === modelSlug && correction.locale === locale,
      ).length;
      if (pairCorrectionCount === 0 && !isDeepStrictEqual(corrected, projected)) {
        throw new Error(`Unexpected unapproved correction for ${modelSlug}/${locale}`);
      }
      corrections += pairCorrectionCount;
      const prompting = parseModelPromptingContent(corrected, modelSlug, locale, `${filePath}#prompting`);
      if (!isDeepStrictEqual(document.prompting, prompting)) pending += 1;
      document.prompting = prompting;
      if (REMOVE_LEGACY) removedLegacyKeys += removeLegacyPromptingKeys(document);
      if (WRITE) {
        await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
        updatedDocuments += 1;
      }
      projections += 1;
    }
  }

  if (corrections !== APPROVED_PROMPTING_CORRECTIONS.length) {
    throw new Error(
      `Expected ${APPROVED_PROMPTING_CORRECTIONS.length} approved corrections, applied ${corrections}`,
    );
  }
  console.info(
    [
      `mode=${WRITE ? (REMOVE_LEGACY ? 'remove-legacy-write' : 'write') : 'dry-run'}`,
      `projections=${projections}`,
      `pending=${pending}`,
      `corrections=${corrections}`,
      `updated=${updatedDocuments}`,
      `removedLegacyKeys=${removedLegacyKeys}`,
    ].join(' '),
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
