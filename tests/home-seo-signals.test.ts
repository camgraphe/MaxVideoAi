import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildLocalizedModelPath } from '../frontend/config/model-registry.ts';
import {
  DEFAULT_MODEL_BY_EXAMPLE_FAMILY,
} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts';
import { assembleHomepageExampleCards } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts';
import { buildModelsCatalogDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts';
import type { ModelGalleryCard } from '../frontend/components/marketing/ModelsGallery.tsx';
import type { RedesignContent } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types.ts';
import type { GalleryVideo } from '../frontend/server/videos.ts';
import { RealExamplesPreview } from '../frontend/components/marketing/home/HomeRealExamplesPreview.tsx';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider.tsx';

const homeSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
const homeJsonLdSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts', 'utf8');
const localeRuntimeSource = readFileSync('frontend/app/_components/LocaleRuntime.tsx', 'utf8');
const homeSectionsSource = [
  readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeHeroSection.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeShotTypeEngineSelector.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeRealExamplesPreview.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeStartupFameLink.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeConversionSections.tsx', 'utf8'),
].join('\n');
type HomeMessages = {
  home?: {
    meta?: { title?: string; description?: string };
    redesign?: {
      faq?: {
        items?: Array<{ question: string; answer: string }>;
      };
    };
    seoContent?: {
      generateWays?: {
        items?: Array<{ title?: string }>;
      };
    };
  };
};
const englishMessages = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')) as HomeMessages;
const frenchMessages = JSON.parse(readFileSync('frontend/messages/fr.json', 'utf8')) as HomeMessages;
const spanishMessages = JSON.parse(readFileSync('frontend/messages/es.json', 'utf8')) as HomeMessages;

test('homepage proof card stays on Seedance 2.0 while discovery surfaces lead with 2.5', () => {
  const requiredTargets = {
    en: '/models/seedance-2-5',
    fr: '/fr/modeles/seedance-2-5',
    es: '/es/modelos/seedance-2-5',
  } as const;
  const seedance25Card = {
    id: 'seedance-2-5',
    label: 'Seedance 2.5',
    href: { pathname: '/models/[slug]', params: { slug: 'seedance-2-5' } },
    overallScore: null,
  } as unknown as ModelGalleryCard;

  assert.equal(DEFAULT_MODEL_BY_EXAMPLE_FAMILY.seedance, 'seedance-2-0');
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(buildLocalizedModelPath(locale, 'seedance-2-5'), requiredTargets[locale]);
    const catalogue = buildModelsCatalogDecisionData({ activeLocale: locale, cards: [seedance25Card] });
    assert.equal(catalogue.topPicks[0]?.id, 'seedance-2-5');
  }

  const footerSource = readFileSync('frontend/components/marketing/MarketingFooter.tsx', 'utf8');
  const seedance25Index = footerSource.indexOf("{ slug: 'seedance-2-5'");
  const seedance20Index = footerSource.indexOf("{ slug: 'seedance-2-0'");
  assert.ok(seedance25Index >= 0, 'Footer should include Seedance 2.5');
  assert.ok(seedance25Index < seedance20Index, 'Footer should list Seedance 2.5 before Seedance 2.0');
});

test('localized homepage keeps the Seedance 2.0 proof and renders a separate Seedance 2.5 discovery CTA', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const onlySeedance25Video = {
    id: 'seedance-25-family-video',
    engineId: 'seedance-2-5',
    thumbUrl: 'https://media.maxvideoai.com/seedance-2-5-proof.webp',
    aspectRatio: '16:9',
    durationSec: 12,
    finalPriceCents: 1378,
    currency: 'USD',
  } as GalleryVideo;
  const messagesByLocale = {
    en: englishMessages,
    fr: frenchMessages,
    es: spanishMessages,
  } as const;
  const expectedDiscovery = {
    en: { label: 'Discover Seedance 2.5', href: '/models/seedance-2-5', proofHref: '/models/seedance-2-0' },
    fr: { label: 'Découvrir Seedance 2.5', href: '/fr/modeles/seedance-2-5', proofHref: '/fr/modeles/seedance-2-0' },
    es: { label: 'Descubrir Seedance 2.5', href: '/es/modelos/seedance-2-5', proofHref: '/es/modelos/seedance-2-0' },
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = (messagesByLocale[locale] as unknown as { home: { redesign: RedesignContent } }).home.redesign;
    const cards = assembleHomepageExampleCards({
      locale,
      content,
      globalCandidates: [],
      familyVideos: new Map([['seedance', [onlySeedance25Video]]]),
    });
    const card = cards.find((candidate) => candidate.id === 'fallback-seedance');
    const fallback = content.examples.fallbackCards.find((candidate) => candidate.id === 'fallback-seedance');
    assert.ok(card);
    assert.ok(fallback);
    assert.deepEqual(
      {
        title: card.title,
        engine: card.engine,
        engineId: card.engineId,
        imageSrc: card.imageSrc,
        imageAlt: card.imageAlt,
        modelHref: card.modelHref,
        modelAriaLabel: `${card.modelCtaLabel} - ${card.engine}`,
      },
      {
        title: 'Seedance 2.0',
        engine: 'Seedance 2.0',
        engineId: 'seedance-2-0',
        imageSrc: '/hero/seedance-2-0.jpg',
        imageAlt: fallback.imageAlt,
        modelHref: { pathname: '/models/[slug]', params: { slug: 'seedance-2-0' } },
        modelAriaLabel: `${fallback.modelCta} - Seedance 2.0`,
      },
      `${locale} proof card must keep one coherent Seedance 2.0 identity`,
    );

    const markup = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        {
          locale,
          dictionary: messagesByLocale[locale] as Record<string, unknown>,
          fallback: englishMessages as Record<string, unknown>,
        },
        React.createElement(RealExamplesPreview, {
          copy: content.examples,
          examples: [card],
          providers: [],
        }),
      ),
    );
    const links = [...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const discoveryLink = links.find(([, href, body]) =>
      href === expectedDiscovery[locale].href && body.includes(expectedDiscovery[locale].label)
    );
    assert.ok(discoveryLink, `${locale} homepage must render its localized Seedance 2.5 discovery CTA`);
    assert.doesNotMatch(discoveryLink[0], /rel="[^"]*nofollow/);

    const escapedProofLabel = fallback.modelCta.replaceAll('&', '&amp;');
    const proofModelLink = links.find(([anchor, href]) =>
      href === expectedDiscovery[locale].proofHref &&
      anchor.includes(`aria-label="${escapedProofLabel} - Seedance 2.0"`)
    );
    assert.ok(proofModelLink, `${locale} homepage must render the Seedance 2.0 proof CTA`);
    assert.match(proofModelLink[0], new RegExp(`>${escapedProofLabel}<span aria-hidden="true">→<\/span>`));
  }
});

test('model catalogue keeps Seedance 2.0 on the lip-sync intent while 2.5 leads supported workflows', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const catalogue = buildModelsCatalogDecisionData({ activeLocale: locale, cards: [] });
    const bestByIntent = Object.fromEntries(catalogue.useCases.map(({ id, best }) => [id, best]));

    assert.deepEqual(
      {
        cinematicVideo: bestByIntent['cinematic-video'],
        nativeAudioAndLipSync: bestByIntent['native-audio'],
        imageToVideo: bestByIntent['image-to-video'],
        productAds: bestByIntent['product-ads'],
      },
      {
        cinematicVideo: 'Seedance 2.5',
        nativeAudioAndLipSync: 'Seedance 2.0',
        imageToVideo: 'Seedance 2.5',
        productAds: 'Seedance 2.5',
      },
      `${locale} catalogue use-case leaders should match validated capabilities`,
    );
  }
});

test('homepage titles keep the pay-as-you-go differentiator without getting too long', () => {
  const titles = {
    en: englishMessages.home?.meta?.title ?? '',
    fr: frenchMessages.home?.meta?.title ?? '',
    es: spanishMessages.home?.meta?.title ?? '',
  };

  assert.equal(titles.en, 'Pay-as-you-go AI Video Generator | MaxVideoAI');
  assert.equal(titles.fr, 'Générateur vidéo IA sans abonnement | MaxVideoAI');
  assert.equal(titles.es, 'Generador de video IA de pago por uso | MaxVideoAI');
  assert.ok(titles.en.length <= 55, `English title is too long: ${titles.en.length}`);
  assert.ok(titles.fr.length <= 55, `French title is too long: ${titles.fr.length}`);
  assert.ok(titles.es.length <= 55, `Spanish title is too long: ${titles.es.length}`);
  assert.match(englishMessages.home?.meta?.description ?? '', /Compare Seedance, Kling, Veo, LTX, Wan, Pika/);
  assert.match(englishMessages.home?.meta?.description ?? '', /pay-as-you-go credits/);
});

test('the locale runtime owns one canonical site organization entity', () => {
  assert.match(homeSource, /home-webapp-jsonld/);
  assert.match(localeRuntimeSource, /buildSiteOrganizationSchema/);
  assert.doesNotMatch(homeSource, /home-organization-jsonld/);
  assert.doesNotMatch(homeJsonLdSource, /buildOrganizationSchema/);
});

test('homepage FAQ targets search-intent questions and shares the same items with FAQPage schema', () => {
  const faqItems = englishMessages.home?.redesign?.faq?.items ?? [];
  const expectedQuestions = [
    'What is the best AI video generator right now?',
    'How do I make AI-generated videos?',
    'Can I generate AI videos from an image?',
    'What is the difference between text-to-video and image-to-video AI?',
    'Where can I find AI video prompt examples?',
    'How much does AI video generation cost?',
    'Is there a pay-as-you-go AI video generator?',
    'What limits should I check before choosing an AI video model?',
  ];
  const answerText = faqItems.map((item) => item.answer).join(' ');

  assert.deepEqual(
    faqItems.map((item) => item.question),
    expectedQuestions
  );
  assert.equal(faqItems.length, 8);
  assert.match(homeSource, /const faqSchema = buildFaqSchema\(content\.faq\.items\)/);
  assert.match(homeSource, /<HomeFaq copy={content\.faq} items={content\.faq\.items} \/>/);
  assert.match(homeSource, /home-faq-jsonld/);
  assert.match(homeSource, /<script id="home-faq-jsonld" type="application\/ld\+json" dangerouslySetInnerHTML=/);
  assert.match(answerText, /AI video generator/);
  assert.match(answerText, /AI-generated videos/);
  assert.match(answerText, /text-to-video AI/);
  assert.match(answerText, /image-to-video AI/);
  assert.match(answerText, /AI video prompt examples/);
  assert.match(answerText, /AI video examples/);
  assert.match(answerText, /AI video model/);
  assert.match(answerText, /AI video generation cost/);
  assert.match(answerText, /model limits/);
  assert.match(answerText, /price before you generate/);
  assert.match(answerText, /compare AI video engines/);
  assert.match(answerText, /pay-as-you-go AI video generator/);
  assert.doesNotMatch(answerText, /creative tools/i);
  assert.doesNotMatch(expectedQuestions.join(' '), /What is MaxVideoAI\?/);
});

test('homepage renders existing workflow SEO terms as visible HTML content', () => {
  const workflowTitles = englishMessages.home?.seoContent?.generateWays?.items?.map((item) => item.title);
  const workflowSource = readFileSync('frontend/components/marketing/home/HomeWorkflowSeoSummary.tsx', 'utf8');

  assert.deepEqual(workflowTitles, ['Text-to-Video AI', 'Image-to-Video AI', 'Video-to-Video AI']);
  assert.match(homeSource, /WorkflowSeoSummary/);
  assert.match(homeSource, /dictionary\.home\.seoContent/);
  assert.match(homeSource, /copy={workflowSeoCopy}/);
  assert.match(workflowSource, /AI video generator basics/);
  assert.match(workflowSource, /pay-as-you-go AI video generator/);
  assert.match(workflowSource, /Generate scenes from prompts\./);
  assert.match(workflowSource, /Animate a still image\./);
  assert.match(workflowSource, /Transform existing footage\./);
  assert.match(workflowSource, /copy\.generateWays\?\.items/);
  assert.match(workflowSource, /border-y border-hairline bg-surface py-6 sm:py-8/);
  assert.match(workflowSource, /container-page max-w-\[1280px\]/);
  assert.match(workflowSource, /lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(workflowSource, /grid grid-cols-3 gap-2 sm:gap-3/);
  assert.doesNotMatch(workflowSource, /rounded-\[24px\]/);
  assert.doesNotMatch(workflowSource, /shadow-\[0_20px_60px/);
  assert.doesNotMatch(workflowSource, /text\.includes\('genera'\)/);
  assert.doesNotMatch(workflowSource, /<h2[^>]*>\{copy\.definition\.title\}/);
});

test('homepage keeps the Startup Fame dofollow link under the best-for hub CTA', () => {
  const selectorSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('export function ShotTypeEngineSelector'),
    homeSectionsSource.indexOf('export function RealExamplesPreview')
  );
  const hubCtaIndex = selectorSource.indexOf('data-analytics-cta-name="best-for-hub"');
  const startupFameIndex = selectorSource.indexOf('<StartupFameLink');
  const startupComponentSource = readFileSync('frontend/components/marketing/home/HomeStartupFameLink.tsx', 'utf8');

  assert.match(homeSource, /startupFameLabel={startupFameLabel}/);
  assert.ok(hubCtaIndex >= 0, 'Best-for hub CTA should render inside the selector');
  assert.ok(startupFameIndex > hubCtaIndex, 'Startup Fame should stay below the best-for hub CTA');
  assert.match(homeSource, /dictionary\.home\.partners\?\.startupFameLabel/);
  assert.match(startupComponentSource, /https:\/\/startupfa\.me\/s\/maxvideoai\?utm_source=maxvideoai\.com/);
  assert.doesNotMatch(startupComponentSource, /nofollow/);
  assert.doesNotMatch(startupComponentSource, /<section/);
  assert.match(startupComponentSource, /text-\[10px\]/);
});

test('homepage disables prefetch for workspace CTAs that are blocked in robots.txt', () => {
  const workflowSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('export function ReferenceWorkflow'),
    homeSectionsSource.indexOf('export function AiVideoToolbox')
  );
  const toolboxSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('export function AiVideoToolbox'),
    homeSectionsSource.indexOf('export function TransparentPricingBlock')
  );

  assert.match(homeSectionsSource, /function isWorkspaceHref/);
  assert.match(workflowSource, /prefetch=\{isWorkspaceHref\(step\.href\) \? false : undefined\}/);
  assert.match(toolboxSource, /prefetch=\{isWorkspaceHref\(tool\.href\) \? false : undefined\}/);
  assert.match(toolboxSource, /href="\/app"[\s\S]*?prefetch=\{false\}/);
});

test('homepage scorecard image avoids duplicate long accessible text', () => {
  const scorecardSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('function ComparisonScorecard'),
    homeSectionsSource.indexOf('export function ComparisonPreview')
  );

  assert.match(scorecardSource, /role="img"/);
  assert.match(scorecardSource, /aria-label=\{`\$\{copy\.scorecardTitle/);
  assert.match(scorecardSource, /src="\/assets\/marketing\/comparison-scorecard-transparent\.webp"[\s\S]*alt=""/);
  assert.match(scorecardSource, /src="\/assets\/marketing\/comparison-scorecard-transparent\.webp"[\s\S]*aria-hidden="true"/);
  assert.doesNotMatch(scorecardSource, /Side-by-side AI video model scorecard comparing/);
});
