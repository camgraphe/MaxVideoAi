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
  assert.match(heroSource, /showcase-minimax-h3-max-7s\.webp/);
  assert.match(heroSource, /b0a6f7e2-69df-4cdd-9ce4-423100c75e7d\.mp4/);
  assert.match(heroSource, /6ab56b7c-bece-4c72-9372-c910bafdc622\.mp4/);
  assert.match(heroSource, /ca0adbafdacf6b5c2051314e3ebf4296f7ed8f7a3df1583ed033715ce2e4b9dd\.mp4/);
  assert.match(heroSource, /0e6eb160-5d11-42ec-8551-c436b0908c60\.mp4/);
  assert.match(heroSource, /2506829a4f4f3d7e5d2bd864a701fc6cc2fb7c53182f7a7f5ca10cc580c70aa8\.mp4/);
  assert.match(homeHeroSource, /applyCuratedHeroMedia\(item\)/);
  assert.match(source, /HERO_ENGINE_MEDIA\[engineId\]/);
  assert.match(source, /videoSrc:\s*media\.videoSrc \?\? null/);
});

test('homepage hero opens on the low-cost 7-second MiniMax H3 Max render and keeps current model media aligned', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const cases = [
    ['en', enMessages],
    ['fr', frMessages],
    ['es', esMessages],
  ] as const;
  let englishItems: HeroVideoShowcaseItem[] | null = null;

  for (const [locale, messages] of cases) {
    const copy = buildHeroContent(locale, messages.home.redesign as RedesignContent);
    const hero = HomeHero({
      copy,
      proofStats: [],
      previews: [],
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
      ['minimax-h3-max', 'seedance-2-5', 'wan-3', 'kling-3-pro', 'ltx-2-5-pro'],
      `HomeHero should keep the approved current-model order in ${locale}`,
    );
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
        estimateMeta: '7s generation',
        estimateValue: '$0.69',
        mediaInfo: 'Text-to-video · 7s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'minimax-h3-max' } },
        posterSrc: '/hero/showcase-minimax-h3-max-7s.webp',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/b0a6f7e2-69df-4cdd-9ce4-423100c75e7d.mp4',
        duration: '0:07',
        resolution: '16:9',
      },
      {
        engineId: 'seedance-2-5',
        estimateMeta: '15s generation',
        estimateValue: '$2.19',
        mediaInfo: 'Reference-to-video · 15s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'seedance-2-5' } },
        posterSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/93d61e58-260d-4fa7-87f7-24893333ded1.jpg',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6ab56b7c-bece-4c72-9372-c910bafdc622.mp4',
        duration: '0:15',
        resolution: '16:9',
      },
      {
        engineId: 'wan-3',
        estimateMeta: '5s generation',
        estimateValue: '$0.50',
        mediaInfo: 'Image-to-video · 5s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'wan-3' } },
        posterSrc: 'https://media.maxvideoai.com/user-asset-thumbs/by-content/c780259ed79d025b4ac74ccc513f18bf/74526116dfc966ce5f871d0ebc7f94967519628291cd25ca2f2f383d623f353c.jpeg',
        videoSrc: 'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/ca0adbafdacf6b5c2051314e3ebf4296f7ed8f7a3df1583ed033715ce2e4b9dd.mp4',
        duration: '0:05',
        resolution: '16:9',
      },
      {
        engineId: 'kling-3-pro',
        estimateMeta: '5s generation',
        estimateValue: '$0.73',
        mediaInfo: 'Text-to-video · 5s · 16:9',
        modelHref: { pathname: '/models/[slug]', params: { slug: 'kling-3-pro' } },
        posterSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/2ad99872-35db-4ff8-8805-99cc23c25e5e.jpg',
        videoSrc: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0e6eb160-5d11-42ec-8551-c436b0908c60.mp4',
        duration: '0:05',
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

test('homepage hero avoids initial mobile video downloads', () => {
  const showcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');

  assert.match(showcaseSource, /const \[shouldAutoplayPreview, setShouldAutoplayPreview\]/);
  assert.match(showcaseSource, /window\.matchMedia\('\(min-width: 768px\)'\)/);
  assert.match(showcaseSource, /if \(!selected\?\.videoSrc \|\| !shouldAutoplayPreview\) \{\n\s+setShouldLoadVideo\(false\);/);
  assert.match(showcaseSource, /window\.requestIdleCallback\(loadPreview, \{ timeout: 1800 \}\)/);
  assert.match(showcaseSource, /selected\.videoSrc && shouldLoadVideo/);
  assert.match(showcaseSource, /autoPlay=\{shouldAutoplayPreview\}/);
  assert.doesNotMatch(showcaseSource, /video\.load\(\)/);
  assert.doesNotMatch(showcaseSource, /loading="eager"/);
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
