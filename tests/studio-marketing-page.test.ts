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
  assert.match(view, /\/api\/studio\/marketing-entry\?starter=product-ad&lang=\$\{locale\}/);
  assert.match(view, /href=\{entryHref\} prefetch=\{false\}/);
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

test('Studio copy describes public account access, demonstration media and unavailable MP4 export in every locale', () => {
  const expectations = {
    en: { access: /public beta.*account/, cta: 'Open Studio', capture: /captured locally.*demonstration/, export: /MP4 export is not yet available/, allowance: /remaining percentage/, choice: /explicitly choose Luna/ },
    fr: { access: /bêta publique.*compte/, cta: 'Ouvrir Studio', capture: /capturée localement.*démonstration/, export: /export MP4 n’est pas encore disponible/, allowance: /pourcentage restant/, choice: /choisir explicitement Luna/ },
    es: { access: /beta pública.*cuenta/, cta: 'Abrir Studio', capture: /capturada localmente.*demostración/, export: /exportación MP4 aún no está disponible/, allowance: /porcentaje restante/, choice: /elegir Luna expresamente/ },
  };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getStudioMarketingCopy(locale);
    const expected = expectations[locale];
    assert.match(copy.accessNote, expected.access);
    assert.equal(copy.primaryCta, expected.cta);
    assert.match(copy.imageCaption, expected.capture);
    assert.match(copy.capabilities.items[2].body, expected.export);
    assert.match(copy.faq.items.find(item => item.question.includes('MP4'))?.answer ?? '', expected.export);
    const assistance = copy.faq.items.find(item => item.answer.includes('Sol'))?.answer ?? '';
    assert.match(assistance, expected.allowance);
    assert.match(assistance, expected.choice);
    assert.match(assistance, /budget|presupuesto/);
    assert.match(assistance, /token/);
    const source = JSON.stringify(copy);
    assert.doesNotMatch(source, /private preview|aperçu privé|vista previa privada|eligible|éligible|elegible|invitation|invitación|restricted|restreint|restringido/i);
    assert.doesNotMatch(source, /unlimited|illimité|ilimitad|\$\d|€\d|best model|meilleur modèle|mejor modelo/i);
    assert.doesNotMatch(source, /export quote|devis d’export|presupuesto de exportación/);
    assert.doesNotMatch(source, /advanced canvas|canvas avancé|lienzo avanzado/i);
    assert.ok(copy.faq.items.at(-1)?.answer.includes('MaxVideoAI'));
  }
});

test('English Studio has the explicit default-locale route used by unprefixed public URLs', () => {
  const wrapper = readFileSync('frontend/app/studio/page.tsx', 'utf8');
  assert.match(wrapper, /generateLocalizedMetadata\(\{ params: Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)/);
  assert.match(wrapper, /<DefaultMarketingLayout><StudioPage params=\{Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)\}/);
});
