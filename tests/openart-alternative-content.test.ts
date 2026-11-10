import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pageFolder = new URL('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/', import.meta.url);
const locales = ['en', 'fr', 'es'] as const;

test('OpenArt alternative has a localized server route and a short English wrapper', () => {
  const page = new URL('page.tsx', pageFolder);
  const english = new URL('../frontend/app/openart-alternative/page.tsx', import.meta.url);
  assert.ok(existsSync(page), 'localized OpenArt route is present');
  assert.ok(existsSync(english), 'English OpenArt wrapper is present');
  const route = readFileSync(page, 'utf8');
  assert.match(route, /serializeJsonLd\(buildOpenArtSchema/);
  assert.ok(route.split('\n').length < 150);
  assert.doesNotMatch(route, /^['"]use client['"]/m);
  assert.match(readFileSync(english, 'utf8'), /DefaultMarketingLayout/);
});

test('each locale covers funding, credit carryover, free chat, MCP access and film delivery', async () => {
  const { getOpenArtCopy } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_content');
  const { openArtSources } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_lib/evidence');
  const ids = openArtSources.map(({ id }) => id);
  const expectedRows = ['entry', 'funding', 'balance', 'chat', 'mcp', 'delivery'];

  for (const locale of locales) {
    const copy = getOpenArtCopy(locale);
    assert.match(copy.hero.title, /OpenArt/);
    assert.equal(copy.decision.options.length, 2);
    assert.deepEqual(Object.keys(copy.rows), expectedRows);
    assert.deepEqual(Object.keys(copy.sourceLabels), ids);
    assert.match(copy.rows.entry.openart, /40/);
    assert.match(copy.rows.mcp.openart, /Starter/);
    assert.match(copy.rows.delivery.openart, /Director/);
    assert.equal(copy.faq.items.length, 5);
  }
  assert.equal(new Set(locales.map((locale) => getOpenArtCopy(locale).hero.title)).size, locales.length);
});

test('OpenArt add-on eligibility and automatic renewal are visible in the comparison and guide', async () => {
  const { getOpenArtCopy } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_content');
  const { platformGuideCopy } = await import('../frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-platform-guide-copy');
  for (const locale of locales) {
    const copy = getOpenArtCopy(locale);
    const statements = [copy.rows.funding.openart, copy.faq.items[0].answer, platformGuideCopy[locale].matrix.rows.openart.web];
    for (const statement of statements) {
      assert.match(statement, /Plus.*Pro.*Wonder/, locale);
      assert.match(statement, /autom[aá]t/i, locale);
    }
  }
});

test('FAQ structured data exactly reflects the visible localized questions and answers', async () => {
  const { getOpenArtCopy } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_content');
  const { buildOpenArtSchema } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_lib/schema');
  const { openArtSources } = await import('../frontend/app/(localized)/[locale]/(marketing)/openart-alternative/_lib/evidence');
  for (const locale of locales) {
    const copy = getOpenArtCopy(locale);
    const canonical = `https://maxvideoai.com${locale === 'en' ? '' : `/${locale}`}/openart-alternative`;
    const [page, faq] = buildOpenArtSchema(copy, locale, canonical)['@graph'];
    assert.equal(page.url, canonical);
    assert.equal(page.inLanguage, locale);
    assert.deepEqual(page.citation, openArtSources.map(({ url }) => url));
    assert.deepEqual(faq.mainEntity.map(({ name, acceptedAnswer }) => ({ question: name, answer: acceptedAnswer.text })), copy.faq.items);
  }
});
