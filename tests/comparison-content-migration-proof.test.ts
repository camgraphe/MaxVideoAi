import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
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
    slugs.map((slug) => `${slug}.json`).sort(),
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

test('the route-facing loader returns the exact post-parity source projection', () => {
  for (const slug of Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort()) {
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.deepEqual(getComparePageOverride(locale, slug), SOURCE_BY_LOCALE[locale][slug], `${locale} route data for ${slug}`);
    }
  }
});
