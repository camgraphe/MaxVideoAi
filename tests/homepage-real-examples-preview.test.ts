import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import enMessages from '../frontend/messages/en.json' with { type: 'json' };
import { isIndexedExampleFamilyId, resolveExampleFamilyId } from '../frontend/lib/model-families.ts';

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
      ['Seedance 2.0', 'Cinematic realism', 'Reference-to-video', '12s', '$4.72'],
      ['Kling 3 Pro', 'Camera motion', 'Image-to-video', '15s', '$4.37'],
      ['LTX 2.3 Fast', 'Fast drafts', 'Text-to-video', '10s', '$0.52'],
      ['Veo 3.1', 'Premium realism', 'Image-to-video', '6s', '$3.12'],
      ['Wan 2.6', 'Structured video workflows', 'Text/image-to-video', '5s', '$0.65'],
      ['Happy Horse 1.0', 'Audio-native workflows', 'Text/image/reference-to-video', '10s', '$1.82'],
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
  const homePageSource = readFileSync("frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx", 'utf8');

  assert.match(homePageSource, /HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES/);
  assert.match(homePageSource, /job_c36e082d-cd1d-4a25-9f17-02246a878eb9/);
  assert.match(homePageSource, /job_110f0282-bf5e-4d58-ab34-8b117c94d4e4/);
  assert.match(homePageSource, /1212fdd0-0299-4e07-8546-c8fc0925432d\.webp/);
  assert.doesNotMatch(homePageSource, /8a1ff925-a483-4dfd-8c29-8ba2e003b86d-job_2c795d5a/);

  const wan = cards.find((card) => card.engineId === 'wan-2-6');
  const happyHorse = cards.find((card) => card.engineId === 'happy-horse-1-0');

  assert.equal(wan?.mode, 'Text/image-to-video');
  assert.equal(happyHorse?.mode, 'Text/image/reference-to-video');
  assert.match(happyHorse?.imageSrc ?? '', /1212fdd0-0299-4e07-8546-c8fc0925432d\.webp/);
});

test('homepage examples preview keeps only real crawlable example routes', () => {
  const expectedExamples = new Map([
    ['Seedance 2.0', 'seedance'],
    ['Kling 3 Pro', 'kling'],
    ['LTX 2.3 Fast', 'ltx'],
    ['Veo 3.1', 'veo'],
    ['Wan 2.6', 'wan'],
    ['Happy Horse 1.0', 'happy-horse'],
  ]);

  for (const [title, examplesSlug] of expectedExamples) {
    assert.equal(cards.find((card) => card.title === title)?.examplesSlug, examplesSlug);
    assert.equal(isIndexedExampleFamilyId(examplesSlug), true, `Expected /examples/${examplesSlug} to be indexed`);
  }

  assert.equal(cards.some((card) => card.title === 'Pika Text to Video' || card.engineId === 'pika-text-to-video'), false);
});

test('homepage real examples component uses compact two-column rows instead of the old large gallery', () => {
  const source = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
  const homePageSource = readFileSync("frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx", 'utf8');
  const previewSource = source.slice(
    source.indexOf('export function RealExamplesPreview'),
    source.indexOf('function ComparisonScorecard')
  );

  assert.match(previewSource, /divide-y/);
  assert.match(previewSource, /lg:grid-cols-\[132px_220px_165px_72px_82px_170px\]/);
  assert.match(previewSource, /grid-cols-2[^"]*lg:grid-cols-1/);
  assert.match(previewSource, /lg:border-l lg:border-t-0/);
  assert.match(previewSource, /Browse all examples/);
  assert.match(previewSource, /View all model specs/);
  assert.match(previewSource, /examplesCtaVisible/);
  assert.match(homePageSource, /preferHomepageExampleVideo/);
  assert.match(homePageSource, /aspectRatio\s*===\s*'16:9'/);
  assert.match(homePageSource, /formatHomepageExampleDuration/);
  assert.match(homePageSource, /formatHomepageExamplePrice/);
  assert.doesNotMatch(previewSource, /supportingText/);
  assert.doesNotMatch(previewSource, /Compare AI video examples/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-2/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-3/);
  assert.doesNotMatch(previewSource, /lg:grid-cols-\[132px_220px_165px_72px_82px_150px_140px\]/);
  assert.doesNotMatch(previewSource, /Want the full library\?/);
  assert.doesNotMatch(previewSource, /Open model/);
});

test('homepage hero uses the current Kling 3 Pro render even when programmed slots exist', () => {
  const source = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
  const heroSource = source.slice(source.indexOf('const HERO_VIDEO_ORDER'), source.indexOf('const BEST_FOR_CARD_VISUALS'));
  const homeHeroSource = source.slice(source.indexOf('export function HomeHero'), source.indexOf('const valueCards'));

  assert.match(heroSource, /KLING_3_PRO_HERO_RENDER/);
  assert.match(heroSource, /01245e62-6bb2-4d5d-89c6-c60923a004ad\.jpg/);
  assert.match(heroSource, /7b1f1c7b-f7f0-473e-9610-82723604b690\.mp4/);
  assert.match(homeHeroSource, /applyHeroMediaOverride\(item\)/);
});

test('homepage hero model CTA says specs and pricing instead of open model', () => {
  const homePageSource = readFileSync("frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx", 'utf8');
  const showcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');

  assert.match(homePageSource, /function heroModelLabel\(\)/);
  assert.match(homePageSource, /return 'Specs & pricing';/);
  assert.doesNotMatch(homePageSource, /Open `?\$\{name\} model|Ouvrir le modèle|Abrir modelo/);
  assert.doesNotMatch(showcaseSource, /Open \$\{selected\.name\} model/);
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
  const source = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
  const pricingSource = source.slice(
    source.indexOf('export function TransparentPricingBlock'),
    source.indexOf('export function ProviderEngineStrip')
  );
  const faqSource = source.slice(source.indexOf('export function HomeFaq'));

  assert.match(pricingSource, /<section className="border-b border-hairline bg-surface section">/);
  assert.match(faqSource, /<section className="bg-bg section">/);
  assert.match(faqSource, /rounded-card border border-hairline bg-surface p-5/);
  assert.doesNotMatch(faqSource, /<section className="bg-surface section">/);
});
