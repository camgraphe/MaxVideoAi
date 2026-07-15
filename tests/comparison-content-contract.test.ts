import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getComparePageOverride,
  parseComparePageContentDocument,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { isPublishedComparisonSlug } from '../frontend/lib/compare-hub/data.ts';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';
import type { ComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'comparisons');
const MESSAGES_DIR = path.join(process.cwd(), 'frontend', 'messages');
const LOCALES = ['en', 'fr', 'es'] as const;
const EXPECTED_GENERIC_METADATA_FALLBACK_SLUGS = [
  'kling-2-6-pro-vs-ltx-2',
  'kling-2-6-pro-vs-seedance-2-0',
  'kling-3-4k-vs-kling-3-pro',
  'kling-3-pro-vs-seedance-2-0',
  'kling-3-pro-vs-sora-2',
  'kling-3-pro-vs-sora-2-pro',
  'kling-3-pro-vs-veo-3-1',
  'kling-3-pro-vs-wan-2-6',
  'kling-3-standard-vs-ltx-2',
  'kling-3-standard-vs-veo-3-1',
  'ltx-2-3-fast-vs-ltx-2-3-pro',
  'ltx-2-3-fast-vs-seedance-2-0-fast',
  'ltx-2-3-pro-vs-seedance-2-0',
  'ltx-2-3-pro-vs-veo-3-1',
  'ltx-2-fast-vs-wan-2-5',
  'ltx-2-fast-vs-wan-2-6',
  'ltx-2-vs-seedance-2-0',
  'ltx-2-vs-veo-3-1',
  'ltx-2-vs-veo-3-1-fast',
  'seedance-1-5-pro-vs-veo-3-1',
  'seedance-2-0-fast-vs-veo-3-1-fast',
  'seedance-2-0-vs-sora-2',
  'seedance-2-0-vs-veo-3-1',
  'sora-2-vs-sora-2-pro',
  'wan-2-5-vs-wan-2-6',
] as const;
const SUPPORTED_HREF_BY_LOCALE = {
  en: /^\/(?:(?:models|examples|ai-video-engines)\/|pricing(?:#|$))/,
  fr: /^\/(?:(?:models|examples|ai-video-engines)\/|pricing(?:#|$)|fr\/(?:modeles|exemples|comparatif)\/|fr\/tarifs(?:#|$))/,
  es: /^\/(?:(?:models|examples|ai-video-engines)\/|pricing(?:#|$)|es\/(?:modelos|ejemplos|comparativa)\/|es\/precios(?:#|$))/,
} as const;
const FORBIDDEN_LOCALE_PREFIX_BY_LOCALE = {
  en: /^\/(?:fr|es)(?:\/|$)/,
  fr: /^\/es(?:\/|$)/,
  es: /^\/fr(?:\/|$)/,
} as const;
const SUPPORTED_HREF_FIXTURES_BY_LOCALE = {
  en: ['/models/fixture', '/examples/fixture', '/ai-video-engines/fixture', '/pricing', '/pricing#fixture'],
  fr: [
    '/models/fixture',
    '/examples/fixture',
    '/ai-video-engines/fixture',
    '/pricing',
    '/pricing#fixture',
    '/fr/modeles/fixture',
    '/fr/exemples/fixture',
    '/fr/comparatif/fixture',
    '/fr/tarifs',
    '/fr/tarifs#fixture',
  ],
  es: [
    '/models/fixture',
    '/examples/fixture',
    '/ai-video-engines/fixture',
    '/pricing',
    '/pricing#fixture',
    '/es/modelos/fixture',
    '/es/ejemplos/fixture',
    '/es/comparativa/fixture',
    '/es/precios',
    '/es/precios#fixture',
  ],
} as const;

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

function loadGenericMetadataFallbacks(locale: (typeof LOCALES)[number]): Record<string, {
  title?: unknown;
  description?: unknown;
}> {
  const messages = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    comparePage?: {
      meta?: {
        slugOverrides?: Record<string, { title?: unknown; description?: unknown }>;
      };
    };
  };
  return messages.comparePage?.meta?.slugOverrides ?? {};
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

test('comparison documents never duplicate message metadata overrides', () => {
  const documentSlugs = new Set(contentFiles().map((fileName) => fileName.slice(0, -'.json'.length)));

  for (const locale of LOCALES) {
    const messages = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
      comparePage?: { meta?: { slugOverrides?: Record<string, unknown> } };
    };
    const duplicateSlugs = Object.keys(messages.comparePage?.meta?.slugOverrides ?? {})
      .filter((slug) => documentSlugs.has(slug))
      .sort();

    assert.deepEqual(duplicateSlugs, [], `${locale} comparison metadata must have exactly one owner`);
  }
});

test('all 25 generic metadata fallbacks remain complete, published and document-free in every locale', () => {
  const documentSlugs = new Set(contentFiles().map((fileName) => fileName.slice(0, -'.json'.length)));
  const expectedSlugs = [...EXPECTED_GENERIC_METADATA_FALLBACK_SLUGS];
  assert.ok(expectedSlugs.length > 0, 'the independent generic metadata fallback inventory must not be empty');

  for (const locale of LOCALES) {
    const fallbacks = loadGenericMetadataFallbacks(locale);
    assert.deepEqual(Object.keys(fallbacks).sort(), expectedSlugs, `${locale} generic fallback inventory`);

    for (const slug of expectedSlugs) {
      const fallback = fallbacks[slug];
      assert.ok(
        typeof fallback?.title === 'string' && fallback.title.trim().length > 0,
        `${locale} title for ${slug}`,
      );
      assert.ok(
        typeof fallback.description === 'string' && fallback.description.trim().length > 0,
        `${locale} description for ${slug}`,
      );
      assert.ok(isPublishedComparisonSlug(slug), `${slug} must remain published`);
      assert.equal(documentSlugs.has(slug), false, `${slug} must not have a comparison content document`);
      assert.equal(getComparePageOverride(locale, slug), undefined, `${locale} ${slug} must use generic content`);
    }
  }
});

test('the real metadata builder projects a localized generic fallback with canonical hreflang', () => {
  const slug = 'kling-3-pro-vs-veo-3-1';
  assert.equal(getComparePageOverride('fr', slug), undefined);
  const fallback = loadGenericMetadataFallbacks('fr')[slug];
  assert.ok(typeof fallback?.title === 'string');
  assert.ok(typeof fallback.description === 'string');

  const metadata = buildSeoMetadata({
    locale: 'fr',
    title: fallback.title,
    description: fallback.description,
    englishPath: `/ai-video-engines/${slug}`,
    availableLocales: getIndexableComparisonLocales(slug),
  });

  assert.deepEqual(metadata.title, {
    absolute: 'Kling 3 Pro vs Veo 3.1 | Comparatif de modèles vidéo IA |…',
  });
  assert.equal(
    metadata.description,
    'Comparez Kling 3 Pro vs Veo 3.1 sur MaxVideoAI avec des prompts identiques : caractéristiques, prix, contrôle de scène, comportement de l’audio natif et…',
  );
  assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com/fr/comparatif/${slug}`);
  assert.deepEqual(metadata.alternates?.languages, {
    en: `https://maxvideoai.com/ai-video-engines/${slug}`,
    fr: `https://maxvideoai.com/fr/comparatif/${slug}`,
    es: `https://maxvideoai.com/es/comparativa/${slug}`,
    'x-default': `https://maxvideoai.com/ai-video-engines/${slug}`,
  });
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

test('locale-aware link validation accepts supported families and rejects crossed or unsupported families', () => {
  const slug = 'fixture-left-vs-fixture-right';
  const withHref = (locale: 'en' | 'fr' | 'es', href: string) => JSON.stringify({
    slug,
    en: { primaryLinks: [{ href: locale === 'en' ? href : '/models/fixture', label: 'Fixture' }] },
    fr: { primaryLinks: [{ href: locale === 'fr' ? href : '/models/fixture', label: 'Fixture' }] },
    es: { primaryLinks: [{ href: locale === 'es' ? href : '/models/fixture', label: 'Fixture' }] },
  });

  for (const locale of LOCALES) {
    for (const href of SUPPORTED_HREF_FIXTURES_BY_LOCALE[locale]) {
      assert.doesNotThrow(
        () => parseComparePageContentDocument(withHref(locale, href), slug, `${locale}-allowed.json`),
        `${locale} should accept ${href}`,
      );
    }
  }

  assert.throws(
    () => parseComparePageContentDocument(withHref('en', '/fr/modeles/fixture'), slug, 'en-crossed.json'),
    /Invalid href.*en-crossed\.json.*en\.primaryLinks\.0\.href/s,
  );
  assert.throws(
    () => parseComparePageContentDocument(withHref('fr', '/es/modelos/fixture'), slug, 'fr-crossed.json'),
    /Invalid href.*fr-crossed\.json.*fr\.primaryLinks\.0\.href/s,
  );
  assert.throws(
    () => parseComparePageContentDocument(withHref('es', '/fr/modeles/fixture'), slug, 'es-crossed.json'),
    /Invalid href.*es-crossed\.json.*es\.primaryLinks\.0\.href/s,
  );
  assert.throws(
    () => parseComparePageContentDocument(withHref('en', '/tools/fixture'), slug, 'unsupported.json'),
    /Invalid href.*unsupported\.json.*en\.primaryLinks\.0\.href/s,
  );
});

test('all comparison-content links use supported public route families without crossed locale prefixes', () => {
  for (const fileName of contentFiles()) {
    const document = loadDocument(fileName);
    for (const locale of LOCALES) {
      for (const link of document[locale].primaryLinks ?? []) {
        assert.match(link.href, SUPPORTED_HREF_BY_LOCALE[locale], `${locale} unsupported href ${link.href}`);
        assert.doesNotMatch(
          link.href,
          FORBIDDEN_LOCALE_PREFIX_BY_LOCALE[locale],
          `${locale} crossed locale prefix ${link.href}`,
        );
      }
    }
  }
});
