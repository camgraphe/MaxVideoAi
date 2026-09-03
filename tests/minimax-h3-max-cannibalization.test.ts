import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const LOCALES = ['en', 'fr', 'es'] as const;

function read(locale: string, slug: string) {
  return JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8')) as {
    seo: { title: string; description: string };
    decision: { hero: { title: string; quickLinks: Array<{ href: string }> }; [key: string]: unknown };
  };
}

function modelPath(locale: string, slug: string) {
  return locale === 'en' ? `/models/${slug}` : locale === 'fr' ? `/fr/modeles/${slug}` : `/es/modelos/${slug}`;
}

function hrefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hrefs);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) => key === 'href' && typeof nested === 'string' ? [nested] : hrefs(nested));
}

test('H3 and H3 Max retain distinct search intent and one reciprocal model link', () => {
  for (const locale of LOCALES) {
    const h3 = read(locale, 'minimax-h3');
    const max = read(locale, 'minimax-h3-max');
    assert.notEqual(h3.seo.title, max.seo.title);
    assert.notEqual(h3.seo.description, max.seo.description);
    assert.equal(/H3 Max/i.test(h3.decision.hero.title), false);
    assert.match(max.decision.hero.title, /H3 Max/i);
    assert.equal(hrefs(h3.decision).filter((href) => href === modelPath(locale, 'minimax-h3-max')).length, 1);
    assert.equal(hrefs(max.decision).filter((href) => href === modelPath(locale, 'minimax-h3')).length, 1);
    assert.match(JSON.stringify(h3), /4K/);
    assert.doesNotMatch(JSON.stringify(max), /up to 4K|jusqu.en 4K|hasta 4K/i);
  }
});

test('H3 Max public copy and templates expose no internal fallback provider', () => {
  const paths = [
    ...LOCALES.map((locale) => `content/models/${locale}/minimax-h3-max.json`),
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/minimax-h3-max.ts',
  ];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /fal\.ai|\bFal\b|minimax\/h3-max/i, path);
  }
});
