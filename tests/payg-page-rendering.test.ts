import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
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

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { ImageConfigContext } = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
const { imageConfigDefault } = requireFrontend('next/dist/shared/lib/image-config');
const imageConfig = { ...imageConfigDefault, ...requireFrontend('./next.config.js').images };

const locales = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const homeByLocale = {
  en: { name: 'Home', url: SITE_BASE_URL },
  fr: { name: 'Accueil', url: `${SITE_BASE_URL}/fr` },
  es: { name: 'Inicio', url: `${SITE_BASE_URL}/es` },
} as const;
const emptySectionOpenings = [
  '<header class="border-b border-hairline bg-bg">',
  '<section data-payg-workflow="" class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section id="compare-price-per-model" class="border-b border-hairline bg-bg">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-surface">',
  '<section class="border-b border-hairline bg-bg">',
  '<section class="bg-surface">',
] as const;
const emptySectionHeadingCounts = [1, 1, 6, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1] as const;
const approvedHeadingsPerSection = [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;
const showcaseVideo: PayAsYouGoShowcaseVideo = {
  id: 'parity-video',
  engineId: 'kling-3-pro',
  engineLabel: 'Kling 3 Pro',
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
      'How pay-as-you-go credits work',
      'Quick answers before you spend credits',
      'Choose a model for your next test',
      'What pay-as-you-go means',
      'Why no subscription matters',
      'Who uses pay-as-you-go AI video credits?',
      'Pay-as-you-go vs subscription',
      'Plan the model mix before generation',
      'What changes the live quote',
      'Compare price per model',
      'Check prices for popular AI video models',
      'Example costs',
      'What happens if a generation fails?',
      'FAQ',
    ],
    heroIntro: "Start with an idea or an image. Add credits from $10, choose a video model and see what your clip will cost before you generate.",
    naturalQuestion: 'Where can I test AI video models without subscription?',
    pricingIntro: 'These examples help you estimate cost quickly. Use the pricing page for the full model-by-model matrix, then open the app for the exact live quote before rendering.',
    refundText: 'You review the price before launching a generation.',
    faqQuestion: 'Do I need a subscription to generate AI videos?',
    primaryCta: 'Get a video quote',
    pricingHref: '/pricing#video-pricing',
    modelHref: '/models/seedance-2-0',
    comparisonHref: '/ai-video-engines/kling-v4-vs-seedance-2-5',
    lookupHref: '/pricing#seedance-2-0-pricing',
    showcase: {
      title: "Example videos with model and duration",
      intro: "Public examples with their model and duration. Open an example for its available generation details, then check a current quote for your own settings.",
      cta: 'Test your prompt with a live quote',
      mediaPhrase: 'example video generated with',
    },
  },
  fr: {
    headings: [
      'Générateur de vidéos IA sans abonnement',
      'Comment fonctionne le paiement à l’usage',
      'L’essentiel avant d’utiliser vos crédits',
      'Choisissez un modèle pour votre prochain essai',
      'Comment fonctionne le paiement à l’usage',
      'Pourquoi l’absence d’abonnement compte',
      'Qui utilise des crédits vidéo IA prépayés ?',
      'Paiement à l’usage ou abonnement',
      'Planifiez les modèles avant la génération',
      'Ce qui fait varier le devis en direct',
      'Comparez le prix par modèle',
      'Consultez les prix des modèles de vidéo IA populaires',
      'Exemples de coûts',
      'Que se passe-t-il si une génération échoue ?',
      'FAQ',
    ],
    heroIntro: "Partez d’une idée ou d’une image. Rechargez votre compte dès 10 $, choisissez un modèle vidéo et consultez le prix de votre clip avant de le générer.",
    naturalQuestion: 'Où tester des modèles de vidéo IA sans abonnement ?',
    pricingIntro: 'Ces exemples permettent d’estimer rapidement le coût. Utilisez la page des tarifs pour la matrice complète par modèle, puis ouvrez l’application pour obtenir le devis exact avant de générer.',
    refundText: 'Vous examinez le prix avant de lancer une génération.',
    faqQuestion: 'Ai-je besoin d’un abonnement pour générer des vidéos IA ?',
    primaryCta: 'Obtenir un devis vidéo',
    pricingHref: '/fr/tarifs#video-pricing',
    modelHref: '/fr/modeles/seedance-2-0',
    comparisonHref: '/fr/comparatif/kling-v4-vs-seedance-2-5',
    lookupHref: '/fr/tarifs#seedance-2-0-pricing',
    showcase: {
      title: "Vidéos d’exemple avec modèle et durée",
      intro: "Des exemples publics avec leur modèle et leur durée. Ouvrez un exemple pour consulter les détails de génération disponibles, puis demandez un devis actuel avec vos propres réglages.",
      cta: 'Testez votre prompt avec un devis en temps réel',
      mediaPhrase: 'vidéo d’exemple générée avec',
    },
  },
  es: {
    headings: [
      'Generador de video con IA de pago por uso',
      'Cómo funcionan los créditos de pago por uso',
      'Lo esencial antes de usar tus créditos',
      'Elige un modelo para tu próxima prueba',
      'Qué significa pagar por uso',
      'Por qué importa no tener suscripción',
      '¿Quién usa créditos de video con IA de pago por uso?',
      'Pago por uso vs. suscripción',
      'Planifica los modelos antes de generar',
      'Qué cambia la cotización en tiempo real',
      'Compara el precio por modelo',
      'Consulta precios de modelos de video con IA populares',
      'Costos de ejemplo',
      '¿Qué ocurre si falla una generación?',
      'FAQ',
    ],
    heroIntro: "Empieza con una idea o una imagen. Recarga desde 10 USD, elige un modelo de video y consulta el precio de tu clip antes de generarlo.",
    naturalQuestion: '¿Dónde puedo probar modelos de video con IA sin suscripción?',
    pricingIntro: 'Estos ejemplos ayudan a estimar el costo rápidamente. Usa la página de precios para consultar la matriz completa por modelo y abre la app para ver la cotización exacta antes de generar.',
    refundText: 'Revisas el precio antes de iniciar una generación.',
    faqQuestion: '¿Necesito una suscripción para generar videos con IA?',
    primaryCta: 'Ver cotización del video',
    pricingHref: '/es/precios#video-pricing',
    modelHref: '/es/modelos/seedance-2-0',
    comparisonHref: '/es/comparativa/kling-v4-vs-seedance-2-5',
    lookupHref: '/es/precios#seedance-2-0-pricing',
    showcase: {
      title: "Videos de ejemplo con modelo y duración",
      intro: "Ejemplos públicos con su modelo y duración. Abre un ejemplo para consultar los detalles disponibles y comprueba una cotización actual con tus propios ajustes.",
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

type HeadingLevel = 1 | 2;
type HeadingStructure = Readonly<{ level: HeadingLevel; text: string }>;

function extractHeadingStructure(html: string): HeadingStructure[] {
  return [...html.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)].map((match) => ({
    level: Number(match[1]) as HeadingLevel,
    text: text(match[2] ?? ''),
  }));
}

function extractApprovedTopLevelHeadings(
  html: string,
  showcasePresent: boolean,
): HeadingStructure[] {
  const headingGroups = [...html.matchAll(/<(header|section)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((match) => extractHeadingStructure(match[2] ?? ''));
  const expectedCounts = showcasePresent
    ? [...emptySectionHeadingCounts.slice(0, 2), 1, ...emptySectionHeadingCounts.slice(2)]
    : [...emptySectionHeadingCounts];
  assert.deepEqual(
    headingGroups.map((group) => group.length),
    expectedCounts,
    'each outer PAYG section must retain its exact h1/h2 structure',
  );
  const totalHeadingCount = expectedCounts.reduce((total, count) => total + count, 0);
  const expectedLevels: HeadingLevel[] = [
    1,
    ...Array.from({ length: totalHeadingCount - 1 }, () => 2 as const),
  ];
  assert.deepEqual(
    headingGroups.flat().map((heading) => heading.level),
    expectedLevels,
    'the hero must be the only h1 and every following PAYG heading must be h2',
  );
  const projection = showcasePresent
    ? [...approvedHeadingsPerSection.slice(0, 2), 1, ...approvedHeadingsPerSection.slice(2)]
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
    React.createElement(ImageConfigContext.Provider, { value: imageConfig },
      React.createElement(I18nProvider, { locale, dictionary: {}, fallback: {} },
        React.createElement(PayAsYouGoPageView, { data, showcaseCopy: content.showcase.section, showcaseVideos: videos }),
      ),
    ),
  );
  return { markup, data, semantic: extractPaygSemanticHtml(markup) };
}

function expectedHeadingStructure(texts: readonly string[]): HeadingStructure[] {
  return texts.map((headingText, index) => ({
    level: index === 0 ? 1 : 2,
    text: headingText,
  }));
}

function assertExactHeadingStructure(
  headings: readonly HeadingStructure[],
  expectedTexts: readonly string[],
) {
  assert.deepEqual(
    headings,
    expectedHeadingStructure(expectedTexts),
    'top-level heading levels and text must match the approved structure exactly',
  );
}

test('top-level heading contract rejects inserted and changed headings', () => {
  assert.throws(() => assertExactHeadingStructure(
    expectedHeadingStructure([
      'First approved heading',
      'Inserted heading',
      'Second approved heading',
    ]),
    ['First approved heading', 'Second approved heading'],
  ));
  assert.throws(() => assertExactHeadingStructure(
    expectedHeadingStructure(['First approved heading', 'Changed heading']),
    ['First approved heading', 'Second approved heading'],
  ));
});

test('top-level heading contract rejects a changed semantic level', () => {
  assert.throws(() => assertExactHeadingStructure(
    extractHeadingStructure('<h2>Hero heading</h2><h2>Section heading</h2>'),
    ['Hero heading', 'Section heading'],
  ));
});

for (const locale of locales) {
  test(`${locale} renders exact localized section order, strings, and hrefs`, () => {
    const { semantic, markup, data } = render(locale, []);
    const { window } = new JSDOM(markup);
    try {
      const doc = window.document;
      for (const [id, items] of [
        ['models', data.modelTesting.items],
        ['prices', data.priceLookups.items],
      ] as const) {
        const catalog = doc.querySelector<HTMLDetailsElement>(`details[data-payg-catalog="${id}"]`);
        assert.ok(catalog && !catalog.open);
        const links = [...catalog.querySelectorAll('a')];
        assert.deepEqual(links.map(link => link.querySelector('h3')?.textContent),
          items.map(item => item.title), 'Every model variant and priced scenario survives in the closed server-rendered catalog');
        assert.ok(links.every(link => link.hasAttribute('href')));
      }
      const film = doc.querySelector('header figure a');
      assert.ok(film?.getAttribute('href')?.includes('job_78cb3e71-cab5-48e2-9965-9f521ba51c0f'));
      assert.ok(film?.querySelector('img'));
      assert.equal(doc.querySelector('header video'), null, 'Watching the film is an explicit action');
      assert.ok(doc.querySelector('[data-payg-workflow] picture source[media]'));
    } finally {
      window.close();
    }
    const expected = representative[locale];
    assertExactHeadingStructure(semantic.topLevelHeadings, expected.headings);
    assert.equal(semantic.topLevelHeadings.length, 15);
    assert.deepEqual(semantic.sectionOpenings, emptySectionOpenings);
    const walletTerms = `${locale === 'en' ? '' : `/${locale}`}/legal/terms#wallet-credits`;
    assert.ok(semantic.links.some((link) => link.href === walletTerms), 'purchase terms must open in the reader’s locale');
    assert.ok(semantic.links.some((link) => link.href === '/return-policy#refund-review'), 'payment refunds link to the existing English review procedure');
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
    assertExactHeadingStructure(semantic.topLevelHeadings, [
      ...expected.headings.slice(0, 2),
      expected.showcase.title,
      ...expected.headings.slice(2),
    ]);
    assertExactHeadingStructure(
      [...semantic.topLevelHeadings.slice(0, 2), ...semantic.topLevelHeadings.slice(3)],
      expected.headings,
    );
    assert.deepEqual(semantic.sectionOpenings, [
      ...emptySectionOpenings.slice(0, 2),
      '<section class="border-b border-hairline bg-bg">',
      ...emptySectionOpenings.slice(2),
    ]);
    assert.equal(semantic.showcasePresent, true);
    assert.ok(semantic.headings.includes(showcaseVideo.title));
    assert.ok(semantic.textNodes.includes(expected.showcase.intro));
    assert.ok(semantic.links.some((link) => link.href === showcaseVideo.href));
    assert.ok(semantic.links.some(
      (link) => link.href === '/app' && link.text === expected.showcase.cta,
    ));
    assert.ok(semantic.mediaLabels.includes(
      `${showcaseVideo.title}, ${expected.showcase.mediaPhrase} ${showcaseVideo.engineLabel}, ${showcaseVideo.durationLabel}`,
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
      image: '/og/home-2026-09-25.png',
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
