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
  assert.match(heroSource, /01245e62-6bb2-4d5d-89c6-c60923a004ad\.jpg/);
  assert.match(heroSource, /7b1f1c7b-f7f0-473e-9610-82723604b690\.mp4/);
  assert.match(heroSource, /9d6811c9-226c-44bd-8b56-b3aa74039d59\.mp4/);
  assert.match(homeHeroSource, /applyCuratedHeroMedia\(item\)/);
  assert.match(source, /HERO_ENGINE_MEDIA\[engineId\]/);
  assert.match(source, /videoSrc:\s*media\.videoSrc \?\? null/);
});

test('homepage Veo 3.1 Lite hero renders its real Romantic clip and matching overlays', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const cases = [
    ['en', enMessages, 'Text-to-video'],
    ['fr', frMessages, 'Texte-vers-vidéo'],
    ['es', esMessages, 'Texto a video'],
  ] as const;
  let englishItem: HeroVideoShowcaseItem | null = null;

  for (const [locale, messages, expectedModeLabel] of cases) {
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
    const veoLiteItem = showcaseItems.find((item) => item.engineId === 'veo-3-1-lite') ?? null;
    assert.ok(veoLiteItem, `HomeHero should include Veo 3.1 Lite in ${locale}`);
    assert.equal(veoLiteItem.mediaInfo, `${expectedModeLabel} · 8s · 16:9`);
    if (locale === 'en') englishItem = veoLiteItem;
  }

  assert.ok(englishItem);
  assert.deepEqual(
    {
      chips: englishItem.chips,
      estimateMeta: englishItem.estimateMeta,
      estimateValue: englishItem.estimateValue,
      imageAlt: englishItem.imageAlt,
      posterSrc: englishItem.posterSrc,
      videoSrc: englishItem.videoSrc,
      duration: englishItem.duration,
      resolution: englishItem.resolution,
    },
    {
      chips: ['Cinematic', 'Audio'],
      estimateMeta: '8s generation',
      estimateValue: '$0.52',
      imageAlt: 'Veo 3.1 Lite romantic train-station reunion generated with MaxVideoAI.',
      posterSrc:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/8729a3ad-aa8e-470d-85e5-558a5f897893.jpg',
      videoSrc:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4e4954fc-513a-4345-945c-41adba7ec26a.mp4',
      duration: '0:08',
      resolution: '16:9',
    },
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
