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

function allLegacyProjections() {
  return listModelPageTemplateSlugs().sort().flatMap((slug) =>
    LOCALES.map((locale) => {
      const localized = mergeEngineLocalizedContent(readDocument('en', slug), readDocument(locale, slug));
      const copy = buildSoraCopy(localized, slug, locale);
      return {
        slug,
        locale,
        content: buildLegacyModelExamplesContent({
          modelSlug: slug,
          locale,
          copy,
          imageFallbackActive: LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS.has(slug),
        }),
      };
    }),
  );
}

test('legacy Examples projector remains a parity fixture outside active rendering ownership', () => {
  assert.ok(existsSync(legacyPath));
  assert.match(legacySource, /export function buildLegacyModelExamplesContent/);
  assert.doesNotMatch(sectionSource, /buildLegacyModelExamplesContent|model-page-examples-legacy/);
  assert.doesNotMatch(
    sectionSource,
    /function getDecisionExampleProofItems|function getDecisionExampleFilters|function buildImageFallbackExampleItems/,
  );
});

test('active Examples wrapper receives only the strict view model', () => {
  assert.match(sectionSource, /viewModel:\s*ModelExamplesViewModel/);
  assert.doesNotMatch(sectionSource, /defaultCtaLabel|viewAllLabel|SoraCopy|AppLocale/);
});

test('all 40 by 3 legacy projections satisfy the strict normalized contract', () => {
  const projections = allLegacyProjections();
  assert.equal(projections.length, 120);
  for (const projection of projections) {
    assert.deepEqual(
      parseModelExamplesContent(projection.content, projection.slug, projection.locale),
      projection.content,
    );
  }
});

test('stored Examples content is exact legacy parity with zero corrections', () => {
  for (const projection of allLegacyProjections()) {
    const stored = parseModelExamplesContent(
      readDocument(projection.locale, projection.slug).examples,
      projection.slug,
      projection.locale,
    );
    assert.deepEqual(stored, projection.content, `${projection.slug}/${projection.locale}`);
  }
});
