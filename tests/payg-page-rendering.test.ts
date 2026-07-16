import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import type { AppLocale } from '../frontend/i18n/locales.ts';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider.tsx';
import { PayAsYouGoPageView } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import type { PayAsYouGoShowcaseVideo } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts';
import { extractPaygSemanticHtml } from './helpers/payg-page-parity.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const locales = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
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
  },
  fr: {
    hero: 'Générateur de vidéos IA sans abonnement',
    pricing: 'Comparez le prix par modèle',
    primaryCta: 'Obtenir un devis vidéo',
    pricingHref: '/fr/pricing#video-pricing',
    modelHref: '/fr/modeles/seedance-2-0',
  },
  es: {
    hero: 'Generador de video con IA de pago por uso',
    pricing: 'Compara el precio por modelo',
    primaryCta: 'Ver cotización del video',
    pricingHref: '/es/pricing#video-pricing',
    modelHref: '/es/modelos/seedance-2-0',
  },
} as const;

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
    assert.ok(semantic.headings.includes(expected.hero));
    assert.ok(semantic.headings.includes(expected.pricing));
    assert.ok(semantic.links.some((link) => link.href === '/app' && link.text === expected.primaryCta));
    assert.ok(semantic.links.some((link) => link.href === expected.pricingHref));
    assert.ok(semantic.links.some((link) => link.href === expected.modelHref));
    assert.equal(semantic.sectionOpenings.length, 13);
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
    assert.equal(semantic.sectionOpenings.length, 14);
    assert.equal(semantic.showcasePresent, true);
    assert.ok(semantic.headings.includes(showcaseVideo.title));
    assert.ok(semantic.links.some((link) => link.href === showcaseVideo.href));
    assert.ok(semantic.mediaLabels.some((label) => label.includes(showcaseVideo.title)));
  });
}
