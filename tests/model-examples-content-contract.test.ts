import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import {
  formatEmptyExamplesLabel,
  getModelExamplesUiCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const normalizationSource = readFileSync(
  path.join(process.cwd(), 'frontend', 'lib', 'models', 'i18n-normalization.ts'),
  'utf8',
);

function files(locale: AppLocale) {
  return readdirSync(path.join(CONTENT_ROOT, locale)).filter((name) => name.endsWith('.json')).sort();
}

function readDocument(locale: AppLocale, slug: string): { examples?: unknown } & Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8'),
  ) as { examples?: unknown } & Record<string, unknown>;
}

function structuralSignature(
  value: unknown,
  options: { nullableStringPaths: readonly string[] },
  currentPath = '',
): unknown {
  if (options.nullableStringPaths.includes(currentPath)) {
    assert.ok(value === null || typeof value === 'string', currentPath);
    return 'nullable-string';
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      items: value.map((item, index) => structuralSignature(item, options, `${currentPath}.${index}`)),
    };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [
          key,
          structuralSignature(nested, options, currentPath ? `${currentPath}.${key}` : key),
        ]),
    );
  }
  return value === null ? 'null' : typeof value;
}

function validExamplesFixture() {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'Fixture examples',
      intro: 'Current Fixture outputs.',
      defaultCtaLabel: 'View all Fixture examples',
      recreateLabel: null,
    },
    filters: [
      { id: 'all', label: 'All' },
      { id: 'product', label: 'Product / Ad' },
    ],
    proofItems: [
      { id: 'renders', icon: 'sparkles', title: 'Real renders', body: 'Review current outputs.' },
      { id: 'recreate', icon: 'zap', title: 'Recreate', body: 'Reuse the runtime setup.' },
      { id: 'audio', icon: 'audio', title: 'Audio', body: 'Check the current audio state.' },
      { id: 'continuity', icon: 'users', title: 'Continuity', body: 'Keep scenes consistent.' },
      { id: 'safety', icon: 'shield', title: 'Production-aware', body: 'Use current safeguards.' },
    ],
    fallbackItems: null,
  };
}

test('Examples parser rejects missing, identity mismatch, unknown fields, blanks and invalid relationships', () => {
  assert.throws(
    () => parseModelExamplesContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing examples content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), modelSlug: 'other' }, 'fixture-model', 'en'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), extra: true }, 'fixture-model', 'en'),
    /Invalid examples content/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), filters: [{ id: 'product', label: 'Product' }] }, 'fixture-model', 'en'),
    /first filter.*all/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), proofItems: validExamplesFixture().proofItems.slice(0, 4) }, 'fixture-model', 'en'),
    /proofItems/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), fallbackItems: [{ id: 'fallback', title: 'Fallback', category: 'Product', aspectRatio: '1:1', alt: 'Fallback image', tags: ['edit'] }] }, 'fixture-model', 'en'),
    /undeclared filter.*edit/i,
  );
});

test('generic Examples UI copy is complete and model-neutral', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getModelExamplesUiCopy(locale);
    assert.ok(copy.viewAllLabel.trim());
    assert.ok(copy.renderLabel.trim());
    assert.ok(copy.openLabel.trim());
    assert.ok(copy.noPreviewLabel.trim());
    assert.ok(formatEmptyExamplesLabel(copy, 'Fixture Model').includes('Fixture Model'));
    assert.doesNotMatch(JSON.stringify(copy), /sora|veo|kling|luma|seedance|nano banana/i);
  }
});

test('all 40 model documents expose strict Examples content in every locale', () => {
  const expected = listModelPageTemplateSlugs().map((slug) => `${slug}.json`).sort();
  assert.equal(expected.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expected);
    for (const fileName of expected) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelExamplesContent(readDocument(locale, slug).examples, slug, locale);
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

test('each model keeps identical EN FR ES Examples structure and semantic IDs', () => {
  for (const slug of listModelPageTemplateSlugs()) {
    const en = parseModelExamplesContent(readDocument('en', slug).examples, slug, 'en');
    for (const locale of ['fr', 'es'] as const) {
      const localized = parseModelExamplesContent(readDocument(locale, slug).examples, slug, locale);
      assert.deepEqual(
        structuralSignature(localized, {
          nullableStringPaths: ['section.defaultCtaLabel', 'section.recreateLabel'],
        }),
        structuralSignature(en, {
          nullableStringPaths: ['section.defaultCtaLabel', 'section.recreateLabel'],
        }),
      );
      assert.deepEqual(localized.filters.map(({ id }) => id), en.filters.map(({ id }) => id));
      assert.deepEqual(
        localized.proofItems.map(({ id, icon }) => [id, icon]),
        en.proofItems.map(({ id, icon }) => [id, icon]),
      );
      assert.deepEqual(
        localized.fallbackItems?.map(({ id, tags }) => [id, tags]) ?? null,
        en.fallbackItems?.map(({ id, tags }) => [id, tags]) ?? null,
      );
    }
  }
});

test('localized Examples selection never falls back to English', () => {
  assert.match(normalizationSource, /examples:\s*overlay\.examples/);
  assert.doesNotMatch(normalizationSource, /examples:\s*overlay\.examples\s*\?\?\s*base\.examples/);
});
