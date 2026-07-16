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
    hero: 'Pay-as-you-go AI Video Generator',
    pricing: 'Compare price per model',
    primaryCta: 'Get a video quote',
    pricingHref: '/pricing#video-pricing',
    modelHref: '/models/seedance-2-0',
    comparisonHref: '/ai-video-engines/seedance-2-0-vs-veo-3-1',
    lookupHref: '/pricing#seedance-2-0-pricing',
  },
  fr: {
    hero: 'Générateur de vidéos IA sans abonnement',
    pricing: 'Comparez le prix par modèle',
    primaryCta: 'Obtenir un devis vidéo',
    pricingHref: '/fr/pricing#video-pricing',
    modelHref: '/fr/modeles/seedance-2-0',
    comparisonHref: '/fr/comparatif/seedance-2-0-vs-veo-3-1',
    lookupHref: '/fr/pricing#seedance-2-0-pricing',
  },
  es: {
    hero: 'Generador de video con IA de pago por uso',
    pricing: 'Compara el precio por modelo',
    primaryCta: 'Ver cotización del video',
    pricingHref: '/es/pricing#video-pricing',
    modelHref: '/es/modelos/seedance-2-0',
    comparisonHref: '/es/comparativa/seedance-2-0-vs-veo-3-1',
    lookupHref: '/es/pricing#seedance-2-0-pricing',
  },
} as const;

function values(pattern: RegExp, html: string, group = 1): string[] {
  return [...html.matchAll(pattern)].map((match) => match[group] ?? '');
}

function text(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPaygSemanticHtml(html: string) {
  return {
    sectionOpenings: values(/<(header|section)([^>]*)>/g, html, 0),
    headings: values(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g, html).map(text),
    textNodes: values(/>([^<>]+)</g, html).map(text).filter(Boolean),
    links: [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
      href: match[1],
      text: text(match[2]),
    })),
    mediaLabels: values(/(?:aria-label|alt)="([^"]*)"/g, html),
    showcasePresent: html.includes(showcaseVideo.id),
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
  return { content, data, semantic: extractPaygSemanticHtml(markup) };
}

function assertHeadingOrder(headings: string[], ordered: string[]) {
  let cursor = -1;
  for (const heading of ordered) {
    const next = headings.indexOf(heading, cursor + 1);
    assert.ok(next > cursor, `${heading} must appear after the previous section heading`);
    cursor = next;
  }
}

for (const locale of locales) {
  test(`${locale} renders exact localized section order, strings, and hrefs`, () => {
    const { data, semantic } = render(locale, []);
    const expected = representative[locale];
    assertHeadingOrder(semantic.headings, [
      data.hero.title,
      data.naturalQuestions.header.title,
      data.modelTesting.header.title,
      data.meaning.title,
      data.noSubscription.title,
      data.audienceFit.cards[0].title,
      data.subscriptionComparison.header.title,
      data.workflow.header.title,
      data.quoteFactors.header.title,
      data.pricing.header.title,
      data.priceLookups.header.title,
      data.exampleCosts.header.title,
      data.refundPolicy.header.title,
      data.faq.title,
    ]);
    assert.deepEqual(semantic.sectionOpenings, emptySectionOpenings);
    assert.ok(semantic.headings.includes(expected.hero));
    assert.ok(semantic.headings.includes(expected.pricing));
    assert.ok(semantic.textNodes.includes(data.hero.intro));
    assert.ok(semantic.headings.includes(data.naturalQuestions.items[0].question));
    assert.ok(semantic.textNodes.includes(data.refundPolicy.bullets[0].body));
    assert.ok(semantic.headings.includes(data.faq.items[0].question));
    assert.ok(semantic.links.some((link) => link.href === '/app' && link.text === expected.primaryCta));
    assert.ok(semantic.links.some((link) => link.href === expected.pricingHref));
    assert.ok(semantic.links.some((link) => link.href === expected.modelHref));
    assert.ok(semantic.links.some((link) => link.href === expected.comparisonHref));
    assert.ok(semantic.links.some((link) => link.href === expected.lookupHref));
    assert.equal(semantic.showcasePresent, false);
    assert.ok(!semantic.headings.includes(getPayAsYouGoContent(locale).showcase.section.title));
  });

  test(`${locale} deterministically renders the showcase in its approved position`, () => {
    const { content, data, semantic } = render(locale, [showcaseVideo]);
    assertHeadingOrder(semantic.headings, [
      data.hero.title,
      content.showcase.section.title,
      data.naturalQuestions.header.title,
    ]);
    assert.deepEqual(semantic.sectionOpenings, [
      emptySectionOpenings[0],
      '<section class="border-b border-hairline bg-bg">',
      ...emptySectionOpenings.slice(1),
    ]);
    assert.equal(semantic.showcasePresent, true);
    assert.ok(semantic.headings.includes(showcaseVideo.title));
    assert.ok(semantic.textNodes.includes(content.showcase.section.intro));
    assert.ok(semantic.links.some((link) => link.href === showcaseVideo.href));
    assert.ok(semantic.links.some(
      (link) => link.href === '/app' && link.text === content.showcase.section.cta,
    ));
    assert.ok(semantic.mediaLabels.includes(
      `${showcaseVideo.title}, ${content.showcase.section.mediaPhrase} ${showcaseVideo.engineLabel}, ${showcaseVideo.priceLabel}, ${showcaseVideo.durationLabel}`,
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
