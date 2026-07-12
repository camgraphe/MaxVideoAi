import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { routing } from '../frontend/i18n/routing';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page.tsx';
const defaultRoutePath = 'frontend/app/editorial-standards/page.tsx';
const copyPath = 'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy.ts';
const schemaPath = 'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-schema.ts';
const viewPath = 'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx';

test('Editorial Standards owns focused localized route files', () => {
  for (const path of [routePath, defaultRoutePath, copyPath, schemaPath, viewPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }
});

test('Editorial Standards routing owns approved localized slugs', () => {
  assert.deepEqual(routing.pathnames['/editorial-standards'], {
    en: '/editorial-standards',
    fr: '/normes-editoriales',
    es: '/estandares-editoriales',
  });
  assert.match(readFileSync('frontend/next-sitemap.config.js', 'utf8'), /['"]\/editorial-standards['"]/);
});

test('Editorial Standards publishes complete localized policy content', async () => {
  const copyModule = await import('../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy') as unknown as {
    getEditorialStandardsCopy(locale: 'en' | 'fr' | 'es'): {
      sections: Array<{ id: string; body: string }>;
    };
  };

  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = copyModule.getEditorialStandardsCopy(locale);
    assert.equal(copy.sections.length, 6);
    assert.equal(
      copy.sections.map((section) => section.id).join(','),
      'authorship,sources,process,corrections,benchmarks,disclosure',
    );
    assert.match(copy.sections.at(-1)?.body ?? '', /sells|commercialise|comercializa/i);
  }
});

test('Editorial Standards metadata is reciprocal in every locale', async () => {
  const pageModule = await import('../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page') as unknown as {
    generateMetadata(input: { params: Promise<{ locale: 'en' | 'fr' | 'es' }> }): Promise<{
      alternates?: { canonical?: string; languages?: Record<string, string> };
      openGraph?: { locale?: string };
    }>;
  };
  const cases = [
    ['en', 'https://maxvideoai.com/editorial-standards', 'en_US'],
    ['fr', 'https://maxvideoai.com/fr/normes-editoriales', 'fr_FR'],
    ['es', 'https://maxvideoai.com/es/estandares-editoriales', 'es_419'],
  ] as const;
  const expectedLanguages = {
    en: 'https://maxvideoai.com/editorial-standards',
    fr: 'https://maxvideoai.com/fr/normes-editoriales',
    es: 'https://maxvideoai.com/es/estandares-editoriales',
    'x-default': 'https://maxvideoai.com/editorial-standards',
  };

  for (const [locale, canonical, ogLocale] of cases) {
    const metadata = await pageModule.generateMetadata({ params: Promise.resolve({ locale }) });
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.deepEqual(metadata.alternates?.languages, expectedLanguages);
    assert.equal(metadata.openGraph?.locale, ogLocale);
  }
});

test('Editorial Standards route stays a server orchestrator with limited schema', async () => {
  const route = readFileSync(routePath, 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  assert.match(route, /EditorialStandardsView/);
  assert.match(route, /buildEditorialStandardsWebPageJsonLd/);
  assert.match(route, /getEditorialProfile/);
  assert.ok(route.split('\n').length <= 110);
  assert.doesNotMatch(view, /['"]use client['"]/);
  assert.doesNotMatch(`${route}\n${view}`, /Dataset|ClaimReview|independently reviewed|certified laboratory/i);

  const copyModule = await import('../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy') as unknown as {
    getEditorialStandardsCopy(locale: 'en'): unknown;
  };
  const schemaModule = await import('../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-schema') as unknown as {
    buildEditorialStandardsWebPageJsonLd(input: { canonicalUrl: string; copy: unknown; inLanguage: string }): { '@type': string };
    buildEditorialStandardsBreadcrumbJsonLd(input: { canonicalUrl: string; copy: unknown }): { '@type': string };
  };
  const copy = copyModule.getEditorialStandardsCopy('en');
  assert.equal(schemaModule.buildEditorialStandardsWebPageJsonLd({ canonicalUrl: 'https://maxvideoai.com/editorial-standards', copy, inLanguage: 'en-US' })['@type'], 'WebPage');
  assert.equal(schemaModule.buildEditorialStandardsBreadcrumbJsonLd({ canonicalUrl: 'https://maxvideoai.com/editorial-standards', copy })['@type'], 'BreadcrumbList');
});
