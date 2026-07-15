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
