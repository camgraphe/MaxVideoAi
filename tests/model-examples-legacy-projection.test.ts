import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { mergeEngineLocalizedContent, type EngineOverlay } from '../frontend/lib/models/i18n-normalization.ts';
import { buildSoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import {
  buildLegacyModelExamplesContent,
  LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, 'content', 'models');
const legacyPath = path.join(
  ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts',
);
const sectionPath = path.join(
  ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx',
);
const legacySource = existsSync(legacyPath) ? readFileSync(legacyPath, 'utf8') : '';
const sectionSource = readFileSync(sectionPath, 'utf8');
const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

function readDocument(locale: AppLocale, slug: string): EngineOverlay {
  return JSON.parse(
    readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8'),
  ) as EngineOverlay;
}

test('legacy Examples editorial decisions are isolated behind one pure projector', () => {
  assert.ok(existsSync(legacyPath));
  assert.match(legacySource, /export function buildLegacyModelExamplesContent/);
  assert.match(sectionSource, /buildLegacyModelExamplesContent/);
  assert.doesNotMatch(
    sectionSource,
    /function getDecisionExampleProofItems|function getDecisionExampleFilters|function buildImageFallbackExampleItems/,
  );
});

test('active legacy decision renderer keeps the generic view-all label', () => {
  assert.match(sectionSource, /viewAllLabel=\{uiCopy\.viewAllLabel\}/);
  assert.doesNotMatch(
    sectionSource,
    /viewAllLabel=\{legacyContent\.section\.defaultCtaLabel/,
  );
});

test('all 40 by 3 legacy projections satisfy the strict normalized contract', () => {
  const slugs = listModelPageTemplateSlugs().sort();
  assert.equal(slugs.length, 40);

  let projectionCount = 0;
  for (const slug of slugs) {
    for (const locale of LOCALES) {
      const localized = mergeEngineLocalizedContent(readDocument('en', slug), readDocument(locale, slug));
      const copy = buildSoraCopy(localized, slug, locale);
      const projected = buildLegacyModelExamplesContent({
        modelSlug: slug,
        locale,
        copy,
        imageFallbackActive: LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS.has(slug),
      });
      assert.deepEqual(parseModelExamplesContent(projected, slug, locale), projected);
      projectionCount += 1;
    }
  }

  assert.equal(projectionCount, 120);
});
