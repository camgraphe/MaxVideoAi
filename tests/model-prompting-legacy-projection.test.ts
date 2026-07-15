import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization.ts';
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

function readStoredPrompting(modelSlug: string, locale: (typeof LOCALES)[number]): unknown {
  const document = JSON.parse(
    readFileSync(join(PROJECT_ROOT, 'content', 'models', locale, `${modelSlug}.json`), 'utf8'),
  ) as { prompting?: unknown };
  return document.prompting;
}

function changedLeafPaths(before: unknown, after: unknown, prefix: readonly string[] = []): string[] {
  if (isDeepStrictEqual(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    return before.flatMap((entry, index) => changedLeafPaths(entry, after[index], [...prefix, String(index)]));
  }
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort();
    return keys.flatMap((key) => changedLeafPaths(beforeRecord[key], afterRecord[key], [...prefix, key]));
  }
  return [prefix.join('.')];
}

function readEngineOverlay(modelSlug: string, locale: (typeof LOCALES)[number]): EngineOverlay {
  return JSON.parse(
    readFileSync(join(PROJECT_ROOT, 'content', 'models', locale, `${modelSlug}.json`), 'utf8'),
  ) as EngineOverlay;
}

test('legacy prompting characterization remains isolated from the live renderer', () => {
  assert.ok(existsSync(legacyPath));
  const legacySource = readFileSync(legacyPath, 'utf8');
  const componentSource = readFileSync(componentPath, 'utf8');

  assert.match(legacySource, /export function buildLegacyModelPromptingContent/);
  assert.doesNotMatch(componentSource, /buildLegacyModelPromptingContent/);
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
  const [
    { buildLegacyModelPromptingContent, resolveLegacyPromptingModelName },
    { APPROVED_PROMPTING_CORRECTIONS, applyApprovedPromptingCorrections },
  ] = await Promise.all([
      import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts'),
      import('../scripts/model-prompting-corrections.ts'),
    ]);
  const engines = listFalEngines().filter(isPublishedModelPage);
  assert.equal(engines.length, 40);
  assert.equal(APPROVED_PROMPTING_CORRECTIONS.length, 18);
  let projectionCount = 0;
  let correctionCount = 0;

  for (const engine of engines) {
    const modes = engine.engine.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    const hasImageMode = modes.some((mode) => mode.endsWith('i'));
    const isImageEngine = hasImageMode && !hasVideoMode;

    for (const locale of LOCALES) {
      const base = readEngineOverlay(engine.modelSlug, 'en');
      const overlay = locale === 'en' ? base : readEngineOverlay(engine.modelSlug, locale);
      const localized = mergeEngineLocalizedContent(base, overlay);
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
      const pairCorrectionCount = APPROVED_PROMPTING_CORRECTIONS.filter(
        (correction) => correction.slug === engine.modelSlug && correction.locale === locale,
      ).length;
      const expectedChangedPaths = APPROVED_PROMPTING_CORRECTIONS.filter(
        (correction) => correction.slug === engine.modelSlug && correction.locale === locale,
      )
        .map((correction) => correction.path)
        .sort();
      assert.deepEqual(
        changedLeafPaths(projection, corrected).sort(),
        expectedChangedPaths,
        `${engine.modelSlug}/${locale} corrected paths`,
      );
      correctionCount += pairCorrectionCount;
      const parsed = parseModelPromptingContent(
        corrected,
        engine.modelSlug,
        locale,
        `legacy projection ${engine.modelSlug}/${locale}`,
      );
      const stored = parseModelPromptingContent(
        readStoredPrompting(engine.modelSlug, locale),
        engine.modelSlug,
        locale,
        `stored prompting ${engine.modelSlug}/${locale}`,
      );

      assert.deepEqual(projection, beforeCorrection, `${engine.modelSlug}/${locale} correction must be immutable`);
      assert.deepEqual(stored, parsed, `${engine.modelSlug}/${locale} stored prompting parity`);
      assert.equal(parsed.modelSlug, engine.modelSlug, `${engine.modelSlug}/${locale} identity`);
      assert.equal(parsed.demo === null, isImageEngine, `${engine.modelSlug}/${locale} demo presence`);
      assert.equal(parsed.imageExamples === null, !isImageEngine, `${engine.modelSlug}/${locale} image examples presence`);
      projectionCount += 1;
    }
  }

  assert.equal(projectionCount, 120);
  assert.equal(correctionCount, 18);
});
