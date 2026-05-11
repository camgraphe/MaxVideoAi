import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

type EngineCatalogEntry = {
  category?: string;
  availability?: string;
  engine?: {
    availability?: string;
    modes?: string[];
  };
  surfaces?: {
    app?: { enabled?: boolean };
    compare?: { includeInHub?: boolean };
    modelPage?: { indexable?: boolean };
    pricing?: { includeInEstimator?: boolean };
  };
};

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
const heroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingHeroSection.tsx');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingJsonLdScripts.tsx');
const videoMatrixPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingVideoMatrixSection.tsx');
const popularChecksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPopularChecksSection.tsx');
const otherSurfacesPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingOtherSurfacesSection.tsx');
const faqPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingRefundsFaqSection.tsx');
const hubDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts');
const catalogPath = join(root, 'frontend/config/engine-catalog.json');
const englishMessagesPath = join(root, 'frontend/messages/en.json');

const pageSource = readFileSync(pagePath, 'utf8');
const heroSource = readFileSync(heroPath, 'utf8');
const videoMatrixSource = existsSync(videoMatrixPath) ? readFileSync(videoMatrixPath, 'utf8') : '';
const popularChecksSource = existsSync(popularChecksPath) ? readFileSync(popularChecksPath, 'utf8') : '';
const otherSurfacesSource = existsSync(otherSurfacesPath) ? readFileSync(otherSurfacesPath, 'utf8') : '';
const faqSource = readFileSync(faqPath, 'utf8');
const hubDataSource = readFileSync(hubDataPath, 'utf8');
const englishMessages = JSON.parse(readFileSync(englishMessagesPath, 'utf8')) as {
  pricing?: {
    meta?: { title?: string; description?: string };
    faq?: { entries?: Array<{ question?: string; answer?: string }> };
  };
};
const engineCatalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as EngineCatalogEntry[];

test('pricing page delegates compact matrix sections and JSON-LD rendering', () => {
  assert.ok(existsSync(heroPath), 'pricing hero should live in a route-local component');
  assert.ok(existsSync(jsonLdPath), 'pricing JSON-LD scripts should live in a route-local component');
  assert.ok(existsSync(videoMatrixPath), 'video pricing matrix should live in a route-local component');
  assert.ok(existsSync(popularChecksPath), 'popular price checks should live in a route-local component');
  assert.ok(existsSync(otherSurfacesPath), 'image/audio/tool pricing should live in a route-local component');
  assert.ok(existsSync(faqPath), 'pricing FAQ should live in a route-local component');
  assert.ok(existsSync(hubDataPath), 'pricing matrix data should live in a route-local lib module');

  assert.match(pageSource, /from '\.\/_components\/PricingHeroSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingJsonLdScripts'/);
  assert.match(pageSource, /from '\.\/_components\/PricingVideoMatrixSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingPopularChecksSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingOtherSurfacesSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingRefundsFaqSection'/);
  assert.match(pageSource, /from '\.\/_lib\/pricingHubData'/);
  assert.match(pageSource, /export default async function PricingPage/);
});

test('pricing page does not regain calculator-first or long model-section ownership', () => {
  assert.doesNotMatch(pageSource, /PricingEstimatorSection/, 'live estimator CTA should not be a main page section');
  assert.doesNotMatch(pageSource, /PricingExampleCostsSection/, 'workflow cards should be replaced by compact price checks');
  assert.doesNotMatch(pageSource, /PricingModelMatrixSection/, 'old family-level from-price matrix should not render');
  assert.doesNotMatch(pageSource, /PricingModelSections/, 'long model pricing detail blocks should not render');
  assert.doesNotMatch(pageSource, /PricingMemberTiersSection/, 'membership tier cards should not dominate pricing comparison');
  assert.doesNotMatch(pageSource, /PricingRelatedLinksSection/, 'row links should be the internal linking hub');
  assert.doesNotMatch(pageSource, /PricingPreviewSection/, 'standalone preview CTA should not duplicate the hero CTA');
  assert.doesNotMatch(pageSource, /PricingPriceFactorsSection/, 'long price factor copy should not return');
  assert.doesNotMatch(pageSource, /LazyPriceEstimator/, 'public pricing should not mount the app estimator');
  assert.doesNotMatch(pageSource, /MarketingHeroImage/, 'compact hero should not depend on the old decorative image');

  const videoIndex = pageSource.indexOf('<PricingVideoMatrixSection');
  const checksIndex = pageSource.indexOf('<PricingPopularChecksSection');
  const surfacesIndex = pageSource.indexOf('<PricingOtherSurfacesSection');
  const faqIndex = pageSource.indexOf('<PricingRefundsFaqSection');
  assert.ok(videoIndex >= 0, 'video matrix should render');
  assert.ok(checksIndex > videoIndex, 'popular checks should follow the video matrix');
  assert.ok(surfacesIndex > checksIndex, 'image/audio/tool matrices should follow popular checks');
  assert.ok(faqIndex > surfacesIndex, 'FAQ should remain below the pricing matrices');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 260, `pricing page should stay compact after refactor, got ${lineCount} lines`);
});

test('hero is compact and uses the requested CTA copy', () => {
  assert.match(heroSource, /export function PricingHeroSection/);
  assert.match(heroSource, /MaxVideoAI Pricing/);
  assert.match(heroSource, /Open app for live pricing before you generate/);
  assert.match(heroSource, /Compare prices below/);
  assert.match(heroSource, /No subscription/);
  assert.match(heroSource, /Guest preview/);
  assert.match(heroSource, /Starter credits from \$10/);
  assert.match(heroSource, /min-h-\[260px\]|min-h-\[300px\]|min-h-\[320px\]|min-h-\[340px\]/);
  assert.doesNotMatch(heroSource, /min-h-\[520px\]/);
  assert.doesNotMatch(heroSource, /MarketingHeroImage/);
});

test('pricing matrix data is generated from the catalog with scenario presets', () => {
  assert.match(hubDataSource, /VIDEO_PRICE_PRESETS/);
  assert.match(hubDataSource, /getPresetQuote/);
  assert.match(hubDataSource, /10s 1080p \+ audio/);
  assert.match(hubDataSource, /listFalEngines/);
  assert.match(hubDataSource, /supportsVideoGeneration/);
  assert.match(hubDataSource, /buildImagePricingRows/);
  assert.match(hubDataSource, /buildAudioPricingRows/);
  assert.match(hubDataSource, /buildToolPricingRows/);
  assert.doesNotMatch(hubDataSource, /export const PRICING_MODEL_GROUPS/);
  assert.doesNotMatch(hubDataSource, /Displayed per output second with MaxVideoAI margin included/);
  assert.doesNotMatch(hubDataSource, /listPricingRules/);
  assert.doesNotMatch(hubDataSource, /listEnginePricingOverrides/);
  assert.doesNotMatch(hubDataSource, /computePricingSnapshot/);

  const publicVideoEngines = Object.values(engineCatalog).filter((entry) => {
    const surfaces = entry.surfaces ?? {};
    const modes = new Set(entry.engine?.modes ?? []);
    const supportsVideo =
      entry.category === 'video' ||
      modes.has('t2v') ||
      modes.has('i2v') ||
      modes.has('ref2v') ||
      modes.has('v2v') ||
      modes.has('a2v') ||
      modes.has('r2v') ||
      modes.has('extend') ||
      modes.has('retake');
    return (
      supportsVideo &&
      (entry.availability ?? entry.engine?.availability) === 'available' &&
      Boolean(
        surfaces.pricing?.includeInEstimator ||
          surfaces.modelPage?.indexable ||
          surfaces.compare?.includeInHub ||
          surfaces.app?.enabled
      )
    );
  });
  assert.ok(publicVideoEngines.length > 12, `expected a broad public video catalog, got ${publicVideoEngines.length}`);
});

test('video matrix renders exact scenario columns and compact links', () => {
  assert.match(videoMatrixSource, /export function PricingVideoMatrixSection/);
  assert.match(videoMatrixSource, /AI video prices by engine/);
  assert.match(videoMatrixSource, /Compare preset MaxVideoAI prices for common video scenarios/);
  assert.match(hubDataSource, /5s 720p/);
  assert.match(hubDataSource, /10s 720p/);
  assert.match(hubDataSource, /5s 1080p/);
  assert.match(hubDataSource, /10s 1080p/);
  assert.match(hubDataSource, /10s 1080p \+ audio/);
  assert.match(videoMatrixSource, /Cheapest/);
  assert.match(videoMatrixSource, /tabular-nums/);
  assert.match(videoMatrixSource, /sticky left-0/);
  assert.match(videoMatrixSource, /Live price/);
  assert.match(videoMatrixSource, /Prices are current MaxVideoAI display prices for preset scenarios/);
  assert.doesNotMatch(videoMatrixSource, /from \$/i);
  assert.doesNotMatch(videoMatrixSource, /'use client'/);
  assert.doesNotMatch(videoMatrixSource, /LazyPriceEstimator/);
});

test('popular checks and non-video pricing surfaces are compact matrices', () => {
  assert.match(popularChecksSource, /export function PricingPopularChecksSection/);
  assert.match(popularChecksSource, /Popular price checks/);
  assert.match(hubDataSource, /5s 720p video/);
  assert.match(hubDataSource, /10s 1080p with audio/);
  assert.match(hubDataSource, /30s voice-over/);
  assert.match(hubDataSource, /4K upscale/);

  assert.match(otherSurfacesSource, /export function PricingOtherSurfacesSection/);
  assert.match(otherSurfacesSource, /Image, audio and tool pricing/);
  assert.match(otherSurfacesSource, /Image generation pricing/);
  assert.match(otherSurfacesSource, /Audio pricing/);
  assert.match(otherSurfacesSource, /Prep tools and upscale pricing/);
  assert.match(otherSurfacesSource, /GPT Image 2/);
  assert.match(otherSurfacesSource, /Character Builder/);
  assert.doesNotMatch(otherSurfacesSource, /'use client'/);
});

test('pricing metadata and FAQ target comparison intent first', () => {
  const pricing = englishMessages.pricing;
  const faqQuestions = pricing?.faq?.entries?.map((entry) => entry.question) ?? [];

  assert.equal(
    pricing?.meta?.title,
    'AI Video Pricing Comparison: Veo, LTX, Kling, Seedance & More | MaxVideoAI'
  );
  assert.equal(
    pricing?.meta?.description,
    'Compare AI video prices by engine, duration, resolution and audio. See 720p, 1080p and 10s costs, then open the app for live pricing.'
  );
  assert.deepEqual(faqQuestions, [
    'How is AI video pricing calculated?',
    'Which AI video engine is cheapest?',
    'Which engine is cheapest for 10s 1080p video?',
    'Can I see the exact price before generating?',
    'Do failed generations cost credits?',
    'Do I need a subscription?',
    'Why are some engines unavailable for 10s, 1080p or audio?',
    'Are image, audio and tools priced the same as video?',
    'How often do prices change?',
  ]);
  assert.match(faqSource, /Pricing FAQ/);
});
