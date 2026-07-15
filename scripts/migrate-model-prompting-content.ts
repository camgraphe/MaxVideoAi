import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { AppLocale } from '../frontend/i18n/locales';
import {
  mergeEngineLocalizedContent,
  type EngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization';
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

async function readEngineOverlay(modelSlug: string, locale: AppLocale): Promise<EngineOverlay> {
  return JSON.parse(
    await fs.readFile(path.join(CONTENT_ROOT, locale, `${modelSlug}.json`), 'utf8'),
  ) as EngineOverlay;
}

async function loadLocalizedContent(
  modelSlug: string,
  locale: AppLocale,
): Promise<EngineLocalizedContent> {
  const base = await readEngineOverlay(modelSlug, 'en');
  const overlay = locale === 'en' ? base : await readEngineOverlay(modelSlug, locale);
  return mergeEngineLocalizedContent(base, overlay);
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
      const localized = await loadLocalizedContent(modelSlug, locale);
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
