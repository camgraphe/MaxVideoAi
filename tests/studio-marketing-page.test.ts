import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { routing } from '../frontend/i18n/routing';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata';
import { buildMetadataUrls } from '../frontend/lib/metadataUrls';
import { handleMarketingSlug } from '../frontend/lib/middleware/routing-marketing';
import { MARKETING_SITE_NAV_LINKS } from '../frontend/config/navigation';
import { getStudioMarketingCopy } from '../frontend/app/(localized)/[locale]/(marketing)/studio/_lib/studio-marketing-copy';
import { buildStudioMarketingSchema } from '../frontend/app/(localized)/[locale]/(marketing)/studio/_lib/studio-marketing-schema';

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`Studio ${locale} has its own public canonical, reciprocal alternates and matching visible FAQ`, () => {
    const copy = getStudioMarketingCopy(locale);
    const path = locale === 'en' ? '/studio' : `/${locale}/studio`;
    const urls = buildMetadataUrls(locale, undefined, { englishPath: '/studio' });
    const metadata = buildSeoMetadata({ locale, ...copy.meta, englishPath: '/studio' });
    assert.equal(new URL(urls.canonical).pathname, path);
    assert.equal(metadata.alternates?.canonical, urls.canonical);
    for (const target of ['en', 'fr', 'es'] as const) {
      assert.equal(new URL(urls.urls[target]!).pathname, target === 'en' ? '/studio' : `/${target}/studio`);
    }
    assert.equal(urls.languages['x-default'], urls.urls.en);
    const schema = buildStudioMarketingSchema(locale, copy);
    const faq = schema['@graph'].find(item => item['@type'] === 'FAQPage');
    assert.deepEqual(faq?.mainEntity?.map(item => [item.name, item.acceptedAnswer.text]), copy.faq.items.map(item => [item.question, item.answer]));
    assert.equal(schema['@graph'][0].url, urls.canonical);
    assert.doesNotMatch(JSON.stringify(schema), /"offers"|"price"|"aggregateRating"/);
    for (const entry of [...copy.workflow.steps, ...copy.capabilities.items]) {
      assert.ok(entry.title.length > 4 && entry.body.length > 30);
    }
    assert.deepEqual(routing.pathnames['/studio'][locale], '/studio');
  });
}

test('Studio is discoverable as a public page while app access keeps its existing entry handler', () => {
  assert.equal(MARKETING_SITE_NAV_LINKS.find(item => item.key === 'studio')?.href, '/studio');
  const view = readFileSync('frontend/app/(localized)/[locale]/(marketing)/studio/_components/StudioMarketingPage.tsx', 'utf8');
  assert.match(view, /href="\/api\/studio\/marketing-entry" prefetch=\{false\}/);
  assert.doesNotMatch(view, /<main|\/api\/(?:generate|studio\/chat)|fetch\(/);
  const page = readFileSync('frontend/app/(localized)/[locale]/(marketing)/studio/page.tsx', 'utf8');
  assert.ok(page.split('\n').length < 60);
  assert.match(page, /buildSeoMetadata.*englishPath: '\/studio'/);
  assert.match(page, /serializeJsonLd\(buildStudioMarketingSchema/);
  for (const path of ['/studio', '/fr/studio', '/es/studio']) {
    const request = new NextRequest(`https://maxvideoai.com${path}`);
    assert.equal(handleMarketingSlug(request, path), null);
  }
});

test('Studio copy keeps preview, exact-price and host-history boundaries in every locale', () => {
  assert.match(getStudioMarketingCopy('en').accessNote, /private preview.*account/);
  assert.match(getStudioMarketingCopy('fr').accessNote, /aperçu privé.*compte/);
  assert.match(getStudioMarketingCopy('es').accessNote, /vista previa privada.*cuenta/);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const source = JSON.stringify(getStudioMarketingCopy(locale));
    assert.doesNotMatch(source, /unlimited|illimité|ilimitad|\$\d|€\d|best model|meilleur modèle|mejor modelo/i);
    assert.ok(getStudioMarketingCopy(locale).faq.items.at(-1)?.answer.includes('MaxVideoAI'));
  }
});

test('English Studio has the explicit default-locale route used by unprefixed public URLs', () => {
  const wrapper = readFileSync('frontend/app/studio/page.tsx', 'utf8');
  assert.match(wrapper, /generateLocalizedMetadata\(\{ params: Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)/);
  assert.match(wrapper, /<DefaultMarketingLayout><StudioPage params=\{Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)\}/);
});
