import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import type { AppLocale } from '../frontend/i18n/locales.ts';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider.tsx';
import { buildMetadataUrls, SITE_BASE_URL } from '../frontend/lib/metadataUrls.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';
import { PayAsYouGoPageView } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import {
  buildPayAsYouGoPageData,
  PAYG_PAGE_PATH,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import {
  buildPayAsYouGoBreadcrumbJsonLd,
  buildPayAsYouGoServiceJsonLd,
  buildPayAsYouGoWebApplicationJsonLd,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts';
import type { PayAsYouGoShowcaseVideo } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts';
import { generateMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const locales = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const homeByLocale = {
  en: { name: 'Home', url: SITE_BASE_URL },
  fr: { name: 'Accueil', url: `${SITE_BASE_URL}/fr` },
  es: { name: 'Inicio', url: `${SITE_BASE_URL}/es` },
} as const;
const emptySectionOpenings = [
  '<header class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section id="compare-price-per-model" class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="bg-surface">',
] as const;
const emptySectionHeadingCounts = [1, 6, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1] as const;
const approvedHeadingsPerSection = [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;
const showcaseVideo: PayAsYouGoShowcaseVideo = {
  id: 'parity-video',
  engineId: 'kling-3-pro',
  engineLabel: 'Kling 3 Pro',
  priceLabel: '$1.23',
  durationLabel: '8s',
  title: 'Permanent deterministic showcase title',
  useCase: 'Permanent deterministic showcase use case.',
  videoUrl: '/payg-rendering.mp4',
  href: '/video/parity-video?from=%2Fpay-as-you-go-ai-video-generator',
};

const representative = {
  en: {
    headings: [
      'Pay-as-you-go AI Video Generator',
      'Quick answers before you spend credits',
      'Recommended testing order for pay-as-you-go AI video',
      'What pay-as-you-go means',
      'Why no subscription matters',
      'Who uses pay-as-you-go AI video credits?',
      'Pay-as-you-go vs subscription',
      'How pay-as-you-go credits work',
      'What changes the live quote',
      'Compare price per model',
      'Check prices for popular AI video models',
      'Example costs',
      'What happens if a generation fails?',
      'FAQ',
    ],
    heroIntro: 'Generate AI videos from text, images, or video with pay-as-you-go credits. Compare Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse and other models, see the price before each generation, and only spend credits on completed renders.',
    naturalQuestion: 'Where can I test AI video models without subscription?',
    pricingIntro: 'These examples help you estimate cost quickly. Use the pricing page for the full model-by-model matrix, then open the app for the exact live quote before rendering.',
    refundText: 'You review the price before launching a generation.',
    faqQuestion: 'Do I need a subscription to generate AI videos?',
    primaryCta: 'Get a video quote',
    pricingHref: '/pricing#video-pricing',
    modelHref: '/models/seedance-2-0',
    comparisonHref: '/ai-video-engines/seedance-2-0-vs-veo-3-1',
    lookupHref: '/pricing#seedance-2-0-pricing',
    showcase: {
      title: 'Example videos with model and price context',
      intro: 'A short strip from public MaxVideoAI renders, showing the model, duration, and recorded render price when available.',
      cta: 'Test your prompt with a live quote',
      mediaPhrase: 'example video generated with',
    },
  },
  fr: {
    headings: [
      'Générateur de vidéos IA sans abonnement',
      'L’essentiel avant d’utiliser vos crédits',
      'Ordre recommandé pour tester la vidéo IA sans abonnement',
      'Comment fonctionne le paiement à l’usage',
      'Pourquoi l’absence d’abonnement compte',
      'Qui utilise des crédits vidéo IA prépayés ?',
      'Paiement à l’usage ou abonnement',
      'Comment fonctionne le paiement à l’usage',
      'Ce qui fait varier le devis en direct',
      'Comparez le prix par modèle',
      'Consultez les prix des modèles de vidéo IA populaires',
      'Exemples de coûts',
      'Que se passe-t-il si une génération échoue ?',
      'FAQ',
    ],
    heroIntro: 'Générez des vidéos IA à partir de texte, d’images ou de vidéo avec des crédits prépayés et un paiement à l’usage. Comparez Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse et d’autres modèles, consultez le prix avant chaque génération et ne payez que les rendus terminés.',
    naturalQuestion: 'Où tester des modèles de vidéo IA sans abonnement ?',
    pricingIntro: 'Ces exemples permettent d’estimer rapidement le coût. Utilisez la page des tarifs pour la matrice complète par modèle, puis ouvrez l’application pour obtenir le devis exact avant de générer.',
    refundText: 'Vous examinez le prix avant de lancer une génération.',
    faqQuestion: 'Ai-je besoin d’un abonnement pour générer des vidéos IA ?',
    primaryCta: 'Obtenir un devis vidéo',
    pricingHref: '/fr/pricing#video-pricing',
    modelHref: '/fr/modeles/seedance-2-0',
    comparisonHref: '/fr/comparatif/seedance-2-0-vs-veo-3-1',
    lookupHref: '/fr/pricing#seedance-2-0-pricing',
    showcase: {
      title: 'Vidéos d’exemple avec modèle et prix',
      intro: 'Une courte sélection de rendus publics MaxVideoAI montrant le modèle, la durée et le prix enregistré lorsqu’il est disponible.',
      cta: 'Testez votre prompt avec un devis en temps réel',
      mediaPhrase: 'vidéo d’exemple générée avec',
    },
  },
  es: {
    headings: [
      'Generador de video con IA de pago por uso',
      'Lo esencial antes de usar tus créditos',
      'Orden recomendado para probar video con IA de pago por uso',
      'Qué significa pagar por uso',
      'Por qué importa no tener suscripción',
      '¿Quién usa créditos de video con IA de pago por uso?',
      'Pago por uso vs. suscripción',
      'Cómo funcionan los créditos de pago por uso',
      'Qué cambia la cotización en tiempo real',
      'Compara el precio por modelo',
      'Consulta precios de modelos de video con IA populares',
      'Costos de ejemplo',
      '¿Qué ocurre si falla una generación?',
      'FAQ',
    ],
    heroIntro: 'Genera videos con IA a partir de texto, imágenes o video con créditos de pago por uso. Compara Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse y otros modelos, consulta el precio antes de cada generación y paga solo por renders completados.',
    naturalQuestion: '¿Dónde puedo probar modelos de video con IA sin suscripción?',
    pricingIntro: 'Estos ejemplos ayudan a estimar el costo rápidamente. Usa la página de precios para consultar la matriz completa por modelo y abre la app para ver la cotización exacta antes de generar.',
    refundText: 'Revisas el precio antes de iniciar una generación.',
    faqQuestion: '¿Necesito una suscripción para generar videos con IA?',
    primaryCta: 'Ver cotización del video',
    pricingHref: '/es/pricing#video-pricing',
    modelHref: '/es/modelos/seedance-2-0',
    comparisonHref: '/es/comparativa/seedance-2-0-vs-veo-3-1',
    lookupHref: '/es/pricing#seedance-2-0-pricing',
    showcase: {
      title: 'Videos de ejemplo con modelo y precio',
      intro: 'Una selección breve de renders públicos de MaxVideoAI que muestra el modelo, la duración y el precio registrado cuando está disponible.',
      cta: 'Prueba tu prompt con una cotización en tiempo real',
      mediaPhrase: 'video de ejemplo generado con',
    },
  },
} as const;

function values(pattern: RegExp, html: string, group = 1): string[] {
  return [...html.matchAll(pattern)].map((match) => match[group] ?? '');
}

function text(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractApprovedTopLevelHeadings(html: string, showcasePresent: boolean): string[] {
  const headingGroups = [...html.matchAll(/<(header|section)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((match) => values(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g, match[2] ?? '').map(text));
  const expectedCounts = showcasePresent
    ? [emptySectionHeadingCounts[0], 1, ...emptySectionHeadingCounts.slice(1)]
    : [...emptySectionHeadingCounts];
  assert.deepEqual(
    headingGroups.map((group) => group.length),
    expectedCounts,
    'each outer PAYG section must retain its exact h1/h2 structure',
  );
  const projection = showcasePresent
    ? [approvedHeadingsPerSection[0], 1, ...approvedHeadingsPerSection.slice(1)]
    : [...approvedHeadingsPerSection];
  return headingGroups.flatMap((group, index) => group.slice(0, projection[index]));
}

function extractPaygSemanticHtml(html: string) {
  const showcasePresent = html.includes(showcaseVideo.id);
  return {
    sectionOpenings: values(/<(header|section)([^>]*)>/g, html, 0),
    headings: values(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g, html).map(text),
    topLevelHeadings: extractApprovedTopLevelHeadings(html, showcasePresent),
    textNodes: values(/>([^<>]+)</g, html).map(text).filter(Boolean),
    links: [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
      href: match[1],
      text: text(match[2]),
    })),
    mediaLabels: values(/(?:aria-label|alt)="([^"]*)"/g, html),
    showcasePresent,
  };
}

function render(locale: AppLocale, videos: PayAsYouGoShowcaseVideo[]) {
  const content = getPayAsYouGoContent(locale);
  const data = buildPayAsYouGoPageData({ locale, content });
  const markup = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale, dictionary: {}, fallback: {} },
      React.createElement(PayAsYouGoPageView, {
        data,
        showcaseCopy: content.showcase.section,
        showcaseVideos: videos,
      }),
    ),
  );
  return { semantic: extractPaygSemanticHtml(markup) };
}

function assertExactHeadingSequence(headings: readonly string[], expected: readonly string[]) {
  assert.deepEqual(headings, expected, 'top-level headings must match the approved sequence exactly');
}

test('top-level heading contract rejects inserted and changed headings', () => {
  assert.throws(() => assertExactHeadingSequence(
    ['First approved heading', 'Inserted heading', 'Second approved heading'],
    ['First approved heading', 'Second approved heading'],
  ));
  assert.throws(() => assertExactHeadingSequence(
    ['First approved heading', 'Changed heading'],
    ['First approved heading', 'Second approved heading'],
  ));
});

for (const locale of locales) {
  test(`${locale} renders exact localized section order, strings, and hrefs`, () => {
    const { semantic } = render(locale, []);
    const expected = representative[locale];
    assertExactHeadingSequence(semantic.topLevelHeadings, expected.headings);
    assert.equal(semantic.topLevelHeadings.length, 14);
    assert.deepEqual(semantic.sectionOpenings, emptySectionOpenings);
    assert.ok(semantic.textNodes.includes(expected.heroIntro));
    assert.ok(semantic.headings.includes(expected.naturalQuestion));
    assert.ok(semantic.textNodes.includes(expected.pricingIntro));
    assert.ok(semantic.textNodes.includes(expected.refundText));
    assert.ok(semantic.headings.includes(expected.faqQuestion));
    assert.ok(semantic.links.some((link) => link.href === '/app' && link.text === expected.primaryCta));
    assert.ok(semantic.links.some((link) => link.href === expected.pricingHref));
    assert.ok(semantic.links.some((link) => link.href === expected.modelHref));
    assert.ok(semantic.links.some((link) => link.href === expected.comparisonHref));
    assert.ok(semantic.links.some((link) => link.href === expected.lookupHref));
    assert.equal(semantic.showcasePresent, false);
    assert.ok(!semantic.headings.includes(expected.showcase.title));
  });

  test(`${locale} deterministically renders the showcase in its approved position`, () => {
    const { semantic } = render(locale, [showcaseVideo]);
    const expected = representative[locale];
    assertExactHeadingSequence(semantic.topLevelHeadings, [
      expected.headings[0],
      expected.showcase.title,
      ...expected.headings.slice(1),
    ]);
    assertExactHeadingSequence(
      [semantic.topLevelHeadings[0], ...semantic.topLevelHeadings.slice(2)],
      expected.headings,
    );
    assert.deepEqual(semantic.sectionOpenings, [
      emptySectionOpenings[0],
      '<section class="border-b border-hairline bg-bg">',
      ...emptySectionOpenings.slice(1),
    ]);
    assert.equal(semantic.showcasePresent, true);
    assert.ok(semantic.headings.includes(showcaseVideo.title));
    assert.ok(semantic.textNodes.includes(expected.showcase.intro));
    assert.ok(semantic.links.some((link) => link.href === showcaseVideo.href));
    assert.ok(semantic.links.some(
      (link) => link.href === '/app' && link.text === expected.showcase.cta,
    ));
    assert.ok(semantic.mediaLabels.includes(
      `${showcaseVideo.title}, ${expected.showcase.mediaPhrase} ${showcaseVideo.engineLabel}, ${showcaseVideo.priceLabel}, ${showcaseVideo.durationLabel}`,
    ));
  });

  test(`${locale} metadata remains an exact projection of route content`, async () => {
    const content = getPayAsYouGoContent(locale);
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    const expected = buildSeoMetadata({
      locale,
      title: content.metadata.title,
      description: content.metadata.description,
      englishPath: PAYG_PAGE_PATH,
      image: '/og/price-before.png',
      imageAlt: content.metadata.imageAlt,
      keywords: content.metadata.keywords,
    });

    assert.deepEqual(metadata, expected);
    assert.deepEqual(metadata.keywords, content.metadata.keywords);
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.equal((images[0] as { alt?: string }).alt, content.metadata.imageAlt);
  });

  test(`${locale} JSON-LD builders retain the exact current schema structures`, () => {
    const content = getPayAsYouGoContent(locale);
    const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
    const home = homeByLocale[locale];
    const breadcrumb = buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy: content.jsonLd });
    const service = buildPayAsYouGoServiceJsonLd({ canonical, copy: content.jsonLd });
    const webApplication = buildPayAsYouGoWebApplicationJsonLd({ canonical, copy: content.jsonLd });

    assert.deepEqual(breadcrumb, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: home.name, item: home.url },
        { '@type': 'ListItem', position: 2, name: content.jsonLd.breadcrumbName, item: canonical },
      ],
    });
    assert.deepEqual(service, {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: content.jsonLd.service.name,
      description: content.jsonLd.service.description,
      url: canonical,
      serviceType: content.jsonLd.service.serviceType,
      category: content.jsonLd.service.category,
      areaServed: 'Worldwide',
      provider: {
        '@type': 'Organization',
        name: 'MaxVideoAI',
        url: SITE_BASE_URL,
        logo: `${SITE_BASE_URL}/favicon-512.png`,
      },
      offers: {
        '@type': 'Offer',
        price: '10.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        description: content.jsonLd.service.offer,
        url: canonical,
      },
    });
    assert.deepEqual(webApplication, {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'MaxVideoAI',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: canonical,
      description: content.jsonLd.webApplication.description,
      offers: {
        '@type': 'Offer',
        price: '10.00',
        priceCurrency: 'USD',
        description: content.jsonLd.webApplication.offer,
        url: canonical,
      },
      featureList: content.jsonLd.webApplication.features,
    });
  });
}
