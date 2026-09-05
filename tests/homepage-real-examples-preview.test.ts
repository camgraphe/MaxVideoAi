import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import enMessages from '../frontend/messages/en.json' with { type: 'json' };
import esMessages from '../frontend/messages/es.json' with { type: 'json' };
import frMessages from '../frontend/messages/fr.json' with { type: 'json' };
import { isIndexedExampleFamilyId, resolveExampleFamilyId } from '../frontend/lib/model-families.ts';
import { HeroVideoShowcase, type HeroVideoShowcaseItem } from '../frontend/components/marketing/home/HeroVideoShowcase.tsx';
import { HomeHero } from '../frontend/components/marketing/home/HomeHeroSection.tsx';
import { buildHeroContent } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/hero.ts';
import type { RedesignContent } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types.ts';

type FallbackCard = {
  title: string;
  engineId: string;
  modelSlug: string;
  mode: string;
  duration?: string;
  price?: string;
  useCase: string;
  cta: string;
  modelCta: string;
  examplesSlug?: string;
  showExamplesCta?: boolean;
};

const examplesCopy = enMessages.home.redesign.examples;
const cards = examplesCopy.fallbackCards as FallbackCard[];
const modelSlugs = new Set(engineCatalog.map((entry) => entry.modelSlug));

function readHomeSectionsSource() {
  return [
    readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8'),
    readFileSync('frontend/components/marketing/home/HomeHeroSection.tsx', 'utf8'),
    readFileSync('frontend/components/marketing/home/HomeShotTypeEngineSelector.tsx', 'utf8'),
    readFileSync('frontend/components/marketing/home/HomeRealExamplesPreview.tsx', 'utf8'),
    readFileSync('frontend/components/marketing/home/HomeConversionSections.tsx', 'utf8'),
  ].join('\n');
}

test('homepage real examples preview uses compact decision-oriented copy and CTAs', () => {
  assert.equal(examplesCopy.title, 'Preview real outputs before you choose an engine.');
  assert.equal(
    examplesCopy.subtitle,
    'Compare real Seedance, Kling, LTX, Veo, Wan and Happy Horse outputs, then check full specs, limits, pricing and prompts before you generate.'
  );
  assert.equal(examplesCopy.eyebrow, 'AI video examples');
  assert.equal(examplesCopy.cta, 'Browse all examples');
  assert.equal(examplesCopy.modelsCta, 'View all model specs');
  assert.equal(examplesCopy.compareLink, 'Compare engines');
  assert.equal('supportingText' in examplesCopy, false);

  assert.equal(cards.length, 6);
  assert.deepEqual(
    cards.map((card) => [card.title, card.useCase, card.mode, card.duration ?? null, card.price ?? null]),
    [
      ['Seedance 2.0', 'Cinematic realism', 'Reference-to-video', '12s', 'Live price'],
      ['Kling 3 Pro', 'Camera motion', 'Image-to-video', '15s', 'Live price'],
      ['Veo 3.1', 'Premium realism', 'Image-to-video', '6s', 'Live price'],
      ['Happy Horse 1.1', 'Audio-native workflows', 'Text/image/reference-to-video', '10s', 'Live price'],
      ['LTX 2.3 Fast', 'Fast drafts', 'Text-to-video', '10s', 'Live price'],
      ['Wan 2.6', 'Structured video workflows', 'Text/image-to-video', '5s', 'Live price'],
    ]
  );

  for (const card of cards) {
    assert.equal(card.cta, 'Examples & prompts');
    assert.notEqual((card as FallbackCard & { showExamplesCta?: boolean }).showExamplesCta, false);
    assert.equal(card.modelCta, 'Specs & pricing');
    assert.ok(!card.cta.includes('Open model'));
    assert.ok(!card.modelCta.includes('Open model'));
    assert.ok(modelSlugs.has(card.modelSlug), `Missing model route for ${card.modelSlug}`);
  }
});

test('homepage examples preview pins accurate recent 16:9 media for Wan, Veo, and Happy Horse', () => {
  const homeRouteDataSource = readFileSync(
    "frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts",
    'utf8'
  );

  assert.match(homeRouteDataSource, /HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES/);
  assert.match(homeRouteDataSource, /job_c36e082d-cd1d-4a25-9f17-02246a878eb9/);
  assert.match(homeRouteDataSource, /job_110f0282-bf5e-4d58-ab34-8b117c94d4e4/);
  assert.match(homeRouteDataSource, /1212fdd0-0299-4e07-8546-c8fc0925432d\.webp/);
  assert.doesNotMatch(homeRouteDataSource, /8a1ff925-a483-4dfd-8c29-8ba2e003b86d-job_2c795d5a/);

  const wan = cards.find((card) => card.engineId === 'wan-2-6');
  const happyHorse = cards.find((card) => card.engineId === 'happy-horse-1-1');

  assert.equal(wan?.mode, 'Text/image-to-video');
  assert.equal(happyHorse?.mode, 'Text/image/reference-to-video');
  assert.match(happyHorse?.imageSrc ?? '', /1212fdd0-0299-4e07-8546-c8fc0925432d\.webp/);
});

test('homepage examples preview keeps only real crawlable example routes', () => {
  const expectedExamples = new Map([
    ['Seedance 2.0', 'seedance'],
    ['Kling 3 Pro', 'kling'],
    ['Veo 3.1', 'veo'],
    ['Happy Horse 1.1', 'happy-horse'],
    ['LTX 2.3 Fast', 'ltx'],
    ['Wan 2.6', 'wan'],
  ]);

  for (const [title, examplesSlug] of expectedExamples) {
    assert.equal(cards.find((card) => card.title === title)?.examplesSlug, examplesSlug);
    assert.equal(isIndexedExampleFamilyId(examplesSlug), true, `Expected /examples/${examplesSlug} to be indexed`);
  }

  assert.equal(cards.some((card) => card.title === 'Pika Text to Video' || card.engineId === 'pika-text-to-video'), false);
});

test('homepage real examples component uses compact two-column rows instead of the old large gallery', () => {
  const source = readHomeSectionsSource();
  const homeRouteDataSource = readFileSync(
    "frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts",
    'utf8'
  );
  const previewSource = source.slice(
    source.indexOf('export function RealExamplesPreview'),
    source.indexOf('function ComparisonScorecard')
  );

  assert.match(previewSource, /divide-y/);
  assert.match(previewSource, /dark:divide-white\/\[0\.07\]/);
  assert.match(previewSource, /dark:border-white\/\[0\.08\]/);
  assert.match(previewSource, /dark:bg-white\/\[0\.035\]/);
  assert.match(previewSource, /dark:hover:border-white\/\[0\.16\]/);
  assert.match(previewSource, /lg:grid-cols-\[132px_220px_165px_72px_82px_170px\]/);
  assert.match(previewSource, /grid-cols-2[^"]*lg:grid-cols-1/);
  assert.match(previewSource, /lg:border-l lg:border-t-0/);
  assert.match(previewSource, /Browse all examples/);
  assert.match(previewSource, /View all model specs/);
  assert.match(previewSource, /examplesCtaVisible/);
  assert.match(homeRouteDataSource, /preferHomepageExampleVideo/);
  assert.match(homeRouteDataSource, /aspectRatio\s*===\s*'16:9'/);
  assert.match(homeRouteDataSource, /formatHomepageExampleDuration/);
  assert.match(homeRouteDataSource, /formatHomepageExamplePrice/);
  assert.doesNotMatch(previewSource, /supportingText/);
  assert.doesNotMatch(previewSource, /Compare AI video examples/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-2/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-3/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-\[132px_220px_165px_72px_82px_150px_140px\]/);
  assert.doesNotMatch(previewSource, /Want the full library\?/);
  assert.doesNotMatch(previewSource, /Open model/);
});

test('homepage hero uses only curated media even when programmed slots exist', () => {
  const source = readHomeSectionsSource();
  const visualsSource = readFileSync('frontend/components/marketing/home/home-redesign-visuals.ts', 'utf8');
  const heroSource = visualsSource.slice(
    visualsSource.indexOf('export const HERO_VIDEO_ORDER'),
    visualsSource.indexOf('export const BEST_FOR_CARD_VISUALS')
  );
  const homeHeroSource = source.slice(source.indexOf('export function HomeHero'), source.indexOf('export function ShotTypeEngineSelector'));

  assert.match(heroSource, /KLING_3_PRO_HERO_RENDER/);
  assert.match(heroSource, /showcase-minimax-h3-max-12s\.webp/);
  assert.match(heroSource, /6e299d72-22dd-46f4-8260-4d6887777558\.mp4/);
  assert.match(heroSource, /085cc0a7-063d-4801-91f9-ec3d9c5eb95d\.mp4/);
  assert.match(heroSource, /c8567e3b0531ae10a993534c41d5f76ec8a1fc2329294d0c8fdb7e4b38ab349a\.mp4/);
  assert.match(heroSource, /7b1f1c7b-f7f0-473e-9610-82723604b690\.mp4/);
  assert.match(heroSource, /2506829a4f4f3d7e5d2bd864a701fc6cc2fb7c53182f7a7f5ca10cc580c70aa8\.mp4/);
  assert.match(homeHeroSource, /applyCuratedHeroMedia\(item\)/);
  assert.match(source, /HERO_ENGINE_MEDIA\[engineId\]/);
  assert.match(source, /videoSrc:\s*media\.videoSrc \?\? null/);
});

test('homepage hero opens on the approved MiniMax H3 Max disaster story with coherent media and pricing', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const cases = [
    ['en', enMessages],
    ['fr', frMessages],
    ['es', esMessages],
  ] as const;
  let englishItems: HeroVideoShowcaseItem[] | null = null;

  const expectedMiniMaxDescriptions = {
    en: 'Cinematic disaster storytelling',
    fr: 'Récit catastrophe cinématographique',
    es: 'Narrativa cinematográfica de catástrofes',
  } as const;
  const expectedMiniMaxChips = {
    en: ['Narrative', 'Native audio'],
    fr: ['Narration', 'Audio natif'],
    es: ['Narrativa', 'Audio nativo'],
  } as const;
  const expectedMiniMaxAlts = {
    en: 'A mother and child shelter during a photorealistic retro-futuristic disaster generated with MiniMax H3 Max.',
    fr: 'Une mère et un enfant se mettent à l’abri dans une catastrophe rétrofuturiste photoréaliste générée avec MiniMax H3 Max.',
    es: 'Una madre y un niño se refugian durante una catástrofe retrofuturista fotorrealista generada con MiniMax H3 Max.',
  } as const;

  for (const [locale, messages] of cases) {
    const copy = buildHeroContent(locale, messages.home.redesign as RedesignContent);
    const hero = HomeHero({
      copy,
      proofStats: [],
      previews: [],
      programmedHeroItems: [
        {
          id: 'programmed-minimax',
          engineId: 'minimax-h3-max',
          name: 'MiniMax H3 Max',
          provider: 'MiniMax',
          bestFor: 'Stale programmed copy',
          chips: ['Stale', 'Programmed'],
          mediaInfo: 'Text-to-video · 5s · 1:1',
          price: '$9.99',
          estimateLabel: 'Estimate',
          estimateValue: '$9.99',
          estimateMeta: '5s generation',
          modelHref: { pathname: '/models/[slug]', params: { slug: 'minimax-h3-max' } },
          posterSrc: '/stale-programmed-poster.webp',
          videoSrc: 'https://example.com/stale-programmed-video.mp4',
          duration: '0:05',
          resolution: '1:1',
          imageAlt: 'Stale programmed alt text.',
        },
      ],
    });
    const pending = [hero] as React.ReactNode[];
    let showcaseItems: HeroVideoShowcaseItem[] | null = null;

    while (pending.length) {
      const node = pending.shift();
      if (!React.isValidElement(node)) continue;
      if (node.type === HeroVideoShowcase) {
        showcaseItems = (node.props as { items: HeroVideoShowcaseItem[] }).items;
        break;
      }
      pending.push(...React.Children.toArray((node.props as { children?: React.ReactNode }).children));
    }

    assert.ok(showcaseItems, `HomeHero should compose the ${locale} video showcase`);
    assert.deepEqual(
      showcaseItems.map((item) => item.engineId),
      ['minimax-h3-max', 'seedance-2-5', 'wan-3-prime', 'kling-3-pro', 'ltx-2-5-pro'],
      `HomeHero should keep the approved current-model order in ${locale}`,
    );
    assert.equal(showcaseItems[0]?.bestFor, expectedMiniMaxDescriptions[locale]);
    assert.deepEqual(showcaseItems[0]?.chips, expectedMiniMaxChips[locale]);
    assert.equal(showcaseItems[0]?.imageAlt, expectedMiniMaxAlts[locale]);
    if (locale === 'en') englishItems = showcaseItems;
  }

  assert.ok(englishItems);
  assert.deepEqual(
    englishItems.map((item) => ({
      engineId: item.engineId,
      estimateMeta: item.estimateMeta,
      estimateValue: item.estimateValue,
      mediaInfo: item.mediaInfo,
      modelHref: item.modelHref,
      posterSrc: item.posterSrc,
      videoSrc: item.videoSrc,
      duration: item.duration,
      resolution: item.resolution,
    })),
    [
      {
        engineId: 'minimax-h3-max',
        estimateMeta: '12s generation',
        estimateValue: '$1.19',
        mediaInfo: 'Text-to-video · 12s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'minimax-h3-max' } },
        posterSrc: '/hero/showcase-minimax-h3-max-12s.webp',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4',
        duration: '0:12',
        resolution: '16:9',
      },
      {
        engineId: 'seedance-2-5',
        estimateMeta: '10s generation',
        estimateValue: '$1.46',
        mediaInfo: 'Text-to-video · 10s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'seedance-2-5' } },
        posterSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/322680c4-ca2f-405f-89f6-0bdb90f186b9.jpg',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/085cc0a7-063d-4801-91f9-ec3d9c5eb95d.mp4',
        duration: '0:10',
        resolution: '16:9',
      },
      {
        engineId: 'wan-3-prime',
        estimateMeta: '5s generation',
        estimateValue: '$0.70',
        mediaInfo: 'Text-to-video · 5s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'wan-3-prime' } },
        posterSrc: 'https://media.maxvideoai.com/user-asset-thumbs/by-content/c780259ed79d025b4ac74ccc513f18bf/db3ef505b123301c648d118f0d740df7b05d098ec47b5104f0425f42019c069f.jpeg',
        videoSrc: 'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/c8567e3b0531ae10a993534c41d5f76ec8a1fc2329294d0c8fdb7e4b38ab349a.mp4',
        duration: '0:05',
        resolution: '16:9',
      },
      {
        engineId: 'kling-3-pro',
        estimateMeta: '12s generation',
        estimateValue: '$2.63',
        mediaInfo: 'Image-to-video · 12s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'kling-3-pro' } },
        posterSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/01245e62-6bb2-4d5d-89c6-c60923a004ad.jpg',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/7b1f1c7b-f7f0-473e-9610-82723604b690.mp4',
        duration: '0:12',
        resolution: '16:9',
      },
      {
        engineId: 'ltx-2-5-pro',
        estimateMeta: '6s generation',
        estimateValue: '$0.72',
        mediaInfo: 'Image-to-video · 6s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'ltx-2-5-pro' } },
        posterSrc: 'https://media.maxvideoai.com/user-asset-thumbs/by-content/c780259ed79d025b4ac74ccc513f18bf/eca62625821feb6bd76c6e023a43988bc8ea18508c783bc6adf4973f172b8d75.jpeg',
        videoSrc: 'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/2506829a4f4f3d7e5d2bd864a701fc6cc2fb7c53182f7a7f5ca10cc580c70aa8.mp4',
        duration: '0:06',
        resolution: '16:9',
      },
    ],
  );
});

test('homepage hero defers mobile thumbnail images without changing desktop thumbnails', () => {
  const showcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');

  assert.match(showcaseSource, /const \[shouldLoadMobileThumbnails, setShouldLoadMobileThumbnails\]/);
  assert.match(showcaseSource, /const mobileThumbnailsRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(showcaseSource, /new IntersectionObserver/);
  assert.match(showcaseSource, /observer\.observe\(mobileThumbnails\)/);
  assert.match(showcaseSource, /rootMargin: '64px 0px'/);
  assert.match(showcaseSource, /ref=\{mobileThumbnailsRef\}/);
  assert.match(showcaseSource, /unoptimized=\{item\.unoptimizedPoster\}/);
  assert.match(showcaseSource, /className="hidden object-cover md:block"/);
  assert.match(showcaseSource, /shouldLoadMobileThumbnails \? \(/);
  assert.match(showcaseSource, /className="object-cover md:hidden"/);
});

test('homepage hero model CTA says specs and pricing instead of open model', () => {
  const homeRouteDataSource = readFileSync(
    "frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/hero.ts",
    'utf8'
  );
  const showcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');

  assert.match(homeRouteDataSource, /function heroModelLabel\(\)/);
  assert.match(homeRouteDataSource, /return 'Specs & pricing';/);
  assert.doesNotMatch(homeRouteDataSource, /Open `?\$\{name\} model|Ouvrir le modèle|Abrir modelo/);
  assert.doesNotMatch(showcaseSource, /Open \$\{selected\.name\} model/);
});

test('homepage examples model CTAs keep visible text in accessible names', () => {
  const previewSource = readFileSync('frontend/components/marketing/home/HomeRealExamplesPreview.tsx', 'utf8');

  assert.match(previewSource, /const modelCtaLabel = example\.modelCtaLabel \?\? 'Specs & pricing';/);
  assert.match(previewSource, /aria-label=\{`\$\{modelCtaLabel\} - \$\{example\.engine\}`\}/);
  assert.doesNotMatch(previewSource, /aria-label=\{example\.engine === 'Seedance 2\.0'/);
});

test('homepage supported engines strip includes the Happy Horse family', () => {
  const providers = enMessages.home.redesign.providers.items;
  const happyHorse = providers.find((item) => item.providerKey === 'Alibaba' && item.model === 'Happy Horse');
  assert.ok(happyHorse);
  assert.deepEqual(happyHorse.href, {
    pathname: '/examples/[model]',
    params: { model: 'happy-horse' },
  });
  assert.match(enMessages.home.redesign.providers.subtitle, /Happy Horse/);
});

test('homepage final sections keep alternating backgrounds before the footer', () => {
  const source = readHomeSectionsSource();
  const pricingSource = source.slice(
    source.indexOf('export function TransparentPricingBlock'),
    source.indexOf('export function ProviderEngineStrip')
  );
  const faqSource = source.slice(source.indexOf('export function HomeFaq'));

  assert.match(pricingSource, /<section className="dark-section-neon border-b border-hairline bg-surface section">/);
  assert.match(faqSource, /<section className="dark-section-neon bg-bg section">/);
  assert.match(faqSource, /dark-neon-panel group rounded-card border border-hairline bg-surface p-5/);
  assert.doesNotMatch(faqSource, /<section className="bg-surface section">/);
});
