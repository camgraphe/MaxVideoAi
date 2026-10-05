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

test('Studio copy describes available creation, editing and individual downloads without a launch-status or film-export promise', () => {
  const expectations = {
    en: { access: /Sign in or create.*account/, cta: 'Open Studio', capture: 'Studio with example media.', downloads: /Download each image, video or audio creation/, timeline: /timeline.*adjust the cut/ },
    fr: { access: /Connectez-vous ou créez.*compte/, cta: 'Ouvrir Studio', capture: 'Studio avec des médias d’exemple.', downloads: /Téléchargez chaque image, vidéo ou création audio/, timeline: /timeline.*ajustez le montage/ },
    es: { access: /Inicia sesión o crea.*cuenta/, cta: 'Abrir Studio', capture: 'Studio con medios de ejemplo.', downloads: /Descarga cada imagen, vídeo o creación de audio/, timeline: /línea de tiempo.*ajusta el montaje/ },
  };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getStudioMarketingCopy(locale);
    const expected = expectations[locale];
    assert.match(copy.accessNote, expected.access);
    assert.equal(copy.primaryCta, expected.cta);
    assert.equal(copy.imageCaption, expected.capture);
    assert.match(copy.capabilities.items[2].body, expected.timeline);
    assert.match(copy.faq.items.find(item => expected.downloads.test(item.answer))?.answer ?? '', expected.downloads);
    const source = JSON.stringify(copy);
    assert.doesNotMatch(source, /beta|bêta|public preview|MP4|export|failed attempt|refund never|échec|remboursement|un fallo|reembolso/i);
    assert.doesNotMatch(source, /private preview|aperçu privé|vista previa privada|eligible|éligible|elegible|invitation|invitación|restricted|restreint|restringido/i);
    assert.doesNotMatch(source, /unlimited|illimité|ilimitad|\$\d|€\d|best model|meilleur modèle|mejor modelo/i);
    assert.doesNotMatch(source, /export quote|devis d’export|presupuesto de exportación/);
    assert.doesNotMatch(source, /advanced canvas|canvas avancé|lienzo avanzado/i);
    assert.ok(copy.faq.items.at(-1)?.answer.includes('MaxVideoAI'));
  }
  const view = readFileSync('frontend/app/(localized)/[locale]/(marketing)/studio/_components/StudioMarketingPage.tsx', 'utf8');
  assert.doesNotMatch(view, /betaNote|capabilitiesNote/);
});

test('public Studio assistance copy follows activated credits with bounded Luna availability and separate confirmed media pricing', () => {
  const expectations = {
    en: { credits: /monthly included credits first.*purchased credits/, purchase: /confirm each pack purchase.*MaxVideoAI balance.*cumulative/, account: /account.*new projects do not reset/, refill: /no automatic refill/i, luna: /choose Luna.*no extra assistance fee.*without a monthly quota.*request limits.*service availability/, quote: /Media generation is charged separately.*current exact quote.*explicitly confirm/ },
    fr: { credits: /crédits mensuels inclus.*avant.*crédits achetés/, purchase: /confirmez chaque achat de pack.*solde MaxVideoAI.*cumulables/, account: /compte.*nouveaux projets ne les réinitialisent/, refill: /aucune recharge automatique/i, luna: /choisir Luna.*sans frais d’assistance supplémentaires.*sans quota mensuel.*limites de requête.*disponibilité du service/, quote: /génération de médias est facturée séparément.*devis exact actuel.*confirmez explicitement/ },
    es: { credits: /créditos mensuales incluidos.*antes.*créditos comprados/, purchase: /confirmas cada compra de pack.*saldo MaxVideoAI.*acumulables/i, account: /cuenta.*proyectos nuevos no los restablecen/, refill: /ninguna recarga automática/i, luna: /elegir Luna.*sin coste adicional de asistencia.*sin cuota mensual.*límites de solicitud.*disponibilidad del servicio/, quote: /generación de medios se cobra por separado.*presupuesto exacto actual.*confirma expresamente/ },
  };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getStudioMarketingCopy(locale);
    const assistance = copy.faq.items.find(item => item.answer.includes('Sol'))?.answer ?? '';
    for (const contract of Object.values(expectations[locale])) assert.match(assistance, contract, locale);
    assert.match(copy.costNote, /Sol.*cr[eé]dit/);
    assert.doesNotMatch(`${copy.costNote} ${assistance}`, /allowance|pourcentage restant|porcentaje restante|quota inclus|cuota incluida|budget you authorize|budget que vous autorisez|presupuesto que autorizas/i);
    assert.doesNotMatch(assistance, /unlimited|illimité|ilimitad|\$\d|€\d/i);
  }
});

test('English Studio has the explicit default-locale route used by unprefixed public URLs', () => {
  const wrapper = readFileSync('frontend/app/studio/page.tsx', 'utf8');
  assert.match(wrapper, /generateLocalizedMetadata\(\{ params: Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)/);
  assert.match(wrapper, /<DefaultMarketingLayout><StudioPage params=\{Promise.resolve\(\{ locale: DEFAULT_LOCALE \}\)\}/);
});
