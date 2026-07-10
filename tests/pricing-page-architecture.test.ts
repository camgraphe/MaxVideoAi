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
const rootLayoutPath = join(root, 'frontend/app/layout.tsx');
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
const heroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingHeroSection.tsx');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingJsonLdScripts.tsx');
const jsonLdLibPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricing-jsonld.ts');
const videoMatrixPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingVideoMatrixSection.tsx');
const popularChecksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPopularChecksSection.tsx');
const otherSurfacesPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingOtherSurfacesSection.tsx');
const creditsRefundsPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingCreditsRefundsSection.tsx'
);
const faqPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingRefundsFaqSection.tsx');
const engineIconPath = join(root, 'frontend/components/ui/EngineIcon.tsx');
const hubCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubCopy.ts');
const hubDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts');
const catalogPath = join(root, 'frontend/config/engine-catalog.json');
const englishMessagesPath = join(root, 'frontend/messages/en.json');

const rootLayoutSource = readFileSync(rootLayoutPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const heroSource = readFileSync(heroPath, 'utf8');
const jsonLdLibSource = readFileSync(jsonLdLibPath, 'utf8');
const videoMatrixSource = existsSync(videoMatrixPath) ? readFileSync(videoMatrixPath, 'utf8') : '';
const popularChecksSource = existsSync(popularChecksPath) ? readFileSync(popularChecksPath, 'utf8') : '';
const otherSurfacesSource = existsSync(otherSurfacesPath) ? readFileSync(otherSurfacesPath, 'utf8') : '';
const creditsRefundsSource = existsSync(creditsRefundsPath) ? readFileSync(creditsRefundsPath, 'utf8') : '';
const faqSource = readFileSync(faqPath, 'utf8');
const engineIconSource = readFileSync(engineIconPath, 'utf8');
const hubCopySource = readFileSync(hubCopyPath, 'utf8');
const hubDataSource = readFileSync(hubDataPath, 'utf8');
const englishMessages = JSON.parse(readFileSync(englishMessagesPath, 'utf8')) as {
  pricing?: {
    meta?: { title?: string; description?: string };
    faq?: { title?: string; subtitle?: string; entries?: Array<{ question?: string; answer?: string }> };
  };
};
const engineCatalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as EngineCatalogEntry[];

test('pricing page delegates compact matrix sections and JSON-LD rendering', () => {
  assert.ok(existsSync(heroPath), 'pricing hero should live in a route-local component');
  assert.ok(existsSync(jsonLdPath), 'pricing JSON-LD scripts should live in a route-local component');
  assert.ok(existsSync(jsonLdLibPath), 'pricing JSON-LD builders should live in a route-local lib module');
  assert.ok(existsSync(videoMatrixPath), 'video pricing matrix should live in a route-local component');
  assert.ok(existsSync(popularChecksPath), 'popular price checks should live in a route-local component');
  assert.ok(existsSync(otherSurfacesPath), 'image/audio/tool pricing should live in a route-local component');
  assert.ok(existsSync(creditsRefundsPath), 'credits/refunds explanation should live in a route-local component');
  assert.ok(existsSync(faqPath), 'pricing FAQ should live in a route-local component');
  assert.ok(existsSync(hubCopyPath), 'pricing hub copy should live in a route-local lib module');
  assert.ok(existsSync(hubDataPath), 'pricing matrix data should live in a route-local lib module');

  assert.match(pageSource, /from '\.\/_components\/PricingHeroSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingJsonLdScripts'/);
  assert.match(pageSource, /from '\.\/_components\/PricingVideoMatrixSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingPopularChecksSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingOtherSurfacesSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingCreditsRefundsSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingRefundsFaqSection'/);
  assert.match(pageSource, /locale=\{locale\}/);
  assert.match(pageSource, /from '\.\/_lib\/pricingHubData'/);
  assert.match(pageSource, /from '\.\/_lib\/pricing-jsonld'/);
  assert.match(pageSource, /export default async function PricingPage/);
  assert.match(jsonLdLibSource, /buildPricingBreadcrumbJsonLd/, 'pricing JSON-LD helper should own breadcrumb schema');
  assert.match(jsonLdLibSource, /buildPricingServiceJsonLd/, 'pricing JSON-LD helper should own service schema');
  assert.doesNotMatch(pageSource, /buildMarketingServiceJsonLd/, 'pricing route should not own service schema internals');
  assert.doesNotMatch(pageSource, /'@type': 'BreadcrumbList'/, 'pricing route should not own breadcrumb schema internals');
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
  const creditsIndex = pageSource.indexOf('<PricingCreditsRefundsSection');
  const faqIndex = pageSource.indexOf('<PricingRefundsFaqSection');
  assert.ok(videoIndex >= 0, 'video matrix should render');
  assert.ok(checksIndex > videoIndex, 'popular checks should follow the video matrix');
  assert.ok(surfacesIndex > checksIndex, 'image/audio/tool matrices should follow popular checks');
  assert.ok(creditsIndex > surfacesIndex, 'credits/refunds should follow non-video pricing matrices');
  assert.ok(faqIndex > creditsIndex, 'FAQ should remain below the pricing matrices');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 260, `pricing page should stay compact after refactor, got ${lineCount} lines`);
});

test('hero is compact and uses the requested CTA copy', () => {
  assert.match(heroSource, /export function PricingHeroSection/);
  assert.match(heroSource, /MaxVideoAI Pricing/);
  assert.match(heroSource, /AI Video Pricing Comparison/);
  assert.match(heroSource, /eyebrow/);
  assert.match(heroSource, /Open app for live pricing before you generate/);
  assert.match(heroSource, /Compare prices below/);
  assert.match(heroSource, /No subscription/);
  assert.match(heroSource, /Guest preview/);
  assert.match(heroSource, /Starter credits from \$10/);
  assert.match(heroSource, /min-h-\[260px\]|min-h-\[300px\]|min-h-\[320px\]|min-h-\[340px\]/);
  assert.doesNotMatch(heroSource, /min-h-\[520px\]/);
  assert.doesNotMatch(heroSource, /MarketingHeroImage/);
});

test('pricing matrix data is generated from the catalog with scenario total presets', () => {
  assert.match(hubDataSource, /VIDEO_PRICE_PRESETS/);
  assert.match(hubDataSource, /getPresetQuote/);
  assert.match(hubDataSource, /DEFAULT_VIDEO_PRICE_PRESET_ID/);
  assert.match(hubDataSource, /engineIcon/);
  assert.match(hubDataSource, /PRICING_HIGHLIGHT_EXCLUDED_ENGINE_IDS/);
  assert.match(hubDataSource, /PREVIOUS_GENERATION_PRICING_ENGINE_IDS/);
  assert.match(hubDataSource, /seedance-1-5-pro/);
  assert.match(hubDataSource, /pika-text-to-video/);
  assert.match(hubDataSource, /PRICING_DISPLAY_MODEL_ORDER/);
  assert.match(hubDataSource, /PRICING_DISPLAY_FAMILY_ORDER/);
  assert.match(hubDataSource, /getPricingDisplayRank/);
  assert.match(hubDataSource, /'seedance-2-0'[\s\S]*'kling-3-pro'[\s\S]*'veo-3-1'[\s\S]*'happy-horse-1-1'[\s\S]*'ltx-2-3-fast'[\s\S]*'wan-2-6'[\s\S]*'minimax-hailuo-02-text'[\s\S]*'luma-ray-2'[\s\S]*'happy-horse-1-0'/);
  assert.match(hubDataSource, /Entry route/);
  assert.match(hubDataSource, /chooseEntryDuration/);
  assert.match(hubDataSource, /chooseEntryResolution/);
  assert.match(hubDataSource, /5s 720p/);
  assert.match(hubDataSource, /10s 720p/);
  assert.match(hubDataSource, /8s 1080p/);
  assert.match(hubDataSource, /10s 1080p/);
  assert.match(hubDataSource, /10s \+ audio/);
  assert.match(hubDataSource, /4K output/);
  assert.match(hubDataSource, /buildCapsLabel/);
  assert.match(hubDataSource, /buildLocalizedMarketingHref/);
  assert.match(hubDataSource, /buildPricingAnchorHref/);
  assert.match(hubDataSource, /buildSlugMap\('models'\)/);
  assert.match(hubDataSource, /buildSlugMap\('gallery'\)/);
  assert.match(hubDataSource, /buildSlugMap\('compare'\)/);
  assert.match(hubDataSource, /buildSlugMap\('pricing'\)/);
  assert.match(hubDataSource, /formatResolutionLabel/);
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
  assert.doesNotMatch(hubDataSource, /VIDEO_RATE_PRESETS/);
  assert.doesNotMatch(hubDataSource, /getPresetRateQuote/);

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
  assert.match(videoMatrixSource, /getPricingHubCopy/);
  assert.match(videoMatrixSource, /EngineIcon/);
  assert.match(hubCopySource, /AI video prices by engine/);
  assert.match(hubCopySource, /Prix vidéo IA par moteur/);
  assert.match(hubCopySource, /Compare preset MaxVideoAI total prices/);
  assert.match(hubCopySource, /Comparez les prix totaux MaxVideoAI/);
  assert.match(hubCopySource, /Compare by scenario/);
  assert.match(hubCopySource, /Comparer par scénario/);
  assert.match(hubCopySource, /Recommended video engines/);
  assert.match(hubCopySource, /Moteurs vidéo recommandés/);
  assert.match(hubCopySource, /Previous-generation and budget routes/);
  assert.match(hubDataSource, /5s 720p/);
  assert.match(hubDataSource, /8s 1080p/);
  assert.match(hubDataSource, /10s 1080p/);
  assert.match(hubDataSource, /10s \+ audio/);
  assert.match(hubDataSource, /4K output/);
  assert.match(hubCopySource, /Prices shown in USD credits\./);
  assert.match(hubCopySource, /Prix affichés en crédits USD\./);
  assert.match(hubCopySource, /Caps/);
  assert.doesNotMatch(hubCopySource, /Limits/);
  assert.doesNotMatch(hubCopySource, /Limites/);
  assert.match(hubCopySource, /Actions/);
  assert.match(hubCopySource, /Video/);
  assert.match(hubCopySource, /Vidéo/);
  assert.match(hubCopySource, /Tools & Upscale/);
  assert.match(hubCopySource, /Outils & upscale/);
  assert.match(hubCopySource, /Cheapest/);
  assert.match(hubCopySource, /Cheapest current-gen 5s 720p/);
  assert.doesNotMatch(hubCopySource, /Best-value current-gen 5s 720p/);
  assert.match(hubCopySource, /Moins cher/);
  assert.match(videoMatrixSource, /tabular-nums/);
  assert.match(videoMatrixSource, /sticky left-0/);
  assert.match(videoMatrixSource, /scope="colgroup"/);
  assert.match(videoMatrixSource, /<tbody>/);
  assert.match(hubCopySource, /Live price/);
  assert.match(hubCopySource, /More/);
  assert.match(hubCopySource, /Prix live/);
  assert.match(hubCopySource, /Plus/);
  assert.match(hubCopySource, /Cheapest 4K output/);
  assert.match(hubCopySource, /Dedicated 4K engine/);
  assert.match(hubCopySource, /Prices are current MaxVideoAI display prices for preset scenarios/);
  assert.match(hubCopySource, /Les prix sont les prix affichés MaxVideoAI/);
  assert.doesNotMatch(videoMatrixSource, /engineName\.slice/);
  assert.doesNotMatch(videoMatrixSource, /from \$/i);
  assert.doesNotMatch(videoMatrixSource, /per output second/);
  assert.doesNotMatch(hubDataSource, /720p \/ sec/);
  assert.doesNotMatch(hubDataSource, /1080p \/ sec/);
  assert.doesNotMatch(hubCopySource, /Cheapest available engine/);
  assert.match(hubCopySource, /no audio/);
  assert.match(hubCopySource, /no \$\{resolution\}/);
  assert.doesNotMatch(hubCopySource, /unavailable`/);
  assert.doesNotMatch(hubCopySource, /indisponible`/);
  assert.doesNotMatch(hubCopySource, /no disponible`/);
  assert.doesNotMatch(hubCopySource, /durationsOnly: \(seconds\) => .*only/);
  assert.match(hubDataSource, /exactRank \* 1_000_000 \+\s*pricedRank \* 100 \+\s*displayRank/s);
  assert.doesNotMatch(videoMatrixSource, /'use client'/);
  assert.doesNotMatch(videoMatrixSource, /LazyPriceEstimator/);
});

test('popular checks and non-video pricing surfaces are compact matrices', () => {
  assert.match(popularChecksSource, /export function PricingPopularChecksSection/);
  assert.match(popularChecksSource, /getPricingHubCopy/);
  assert.match(hubCopySource, /Popular price checks/);
  assert.match(hubCopySource, /Vérifications de prix fréquentes/);
  assert.match(hubCopySource, /5s 720p video/);
  assert.match(hubCopySource, /Vidéo 5 s 720p/);
  assert.match(hubCopySource, /8s 1080p premium video/);
  assert.match(hubCopySource, /Vidéo premium 8 s 1080p/);
  assert.match(hubCopySource, /10s 1080p video/);
  assert.match(hubCopySource, /Vidéo 10 s 1080p/);
  assert.match(hubCopySource, /10s 1080p \+ audio/);
  assert.match(hubCopySource, /10 s 1080p \+ audio/);
  assert.match(hubCopySource, /30s voice-over/);
  assert.match(hubCopySource, /Voix off 30 s/);
  assert.match(hubCopySource, /4K upscale/);
  assert.match(hubCopySource, /Upscale 4K/);
  assert.match(popularChecksSource, /<a href=\{check\.link\.href\}/);
  assert.doesNotMatch(popularChecksSource, /<Link href=\{check\.link\.href\}/);
  assert.match(hubDataSource, /buildPricingAnchorHref\(locale, 'image-pricing'\)/);
  assert.match(hubDataSource, /buildPricingAnchorHref\(locale, 'audio-pricing'\)/);
  assert.match(hubDataSource, /buildPricingAnchorHref\(locale, 'upscale-pricing'\)/);

  assert.match(otherSurfacesSource, /export function PricingOtherSurfacesSection/);
  assert.match(otherSurfacesSource, /getPricingHubCopy/);
  assert.match(hubCopySource, /Image, audio and tool pricing/);
  assert.match(hubCopySource, /Prix image, audio et outils/);
  assert.match(hubCopySource, /Image generation pricing/);
  assert.match(hubCopySource, /Prix génération d’images/);
  assert.match(otherSurfacesSource, /id="image-pricing" className="scroll-mt-24/);
  assert.match(otherSurfacesSource, /id="audio-pricing" className="scroll-mt-24/);
  assert.match(otherSurfacesSource, /id="tool-pricing" className="scroll-mt-24/);
  assert.match(hubCopySource, /Audio pricing/);
  assert.match(hubCopySource, /Prix audio/);
  assert.match(hubCopySource, /Prep tools and upscale pricing/);
  assert.match(hubCopySource, /Prix outils de préparation et upscale/);
  assert.match(hubDataSource, /resolveGptImage2PricingTier/);
  assert.doesNotMatch(hubDataSource, /copy\.links\.gptImage2/, 'GPT Image 2 row should not duplicate its model link');
  assert.match(hubCopySource, /Character Builder/);
  assert.doesNotMatch(otherSurfacesSource, /'use client'/);
});

test('credits and refunds stay compact below pricing matrices', () => {
  assert.match(creditsRefundsSource, /export function PricingCreditsRefundsSection/);
  assert.match(creditsRefundsSource, /getPricingHubCopy/);
  assert.match(hubCopySource, /Credits, live quotes and refunds/);
  assert.match(hubCopySource, /Crédits, devis live et remboursements/);
  assert.match(hubCopySource, /Pay-as-you-go credits/);
  assert.match(hubCopySource, /How pay-as-you-go credits work/);
  assert.match(creditsRefundsSource, /href=\{card\.link\.href\}/);
  assert.match(hubCopySource, /Crédits à l’usage/);
  assert.match(hubCopySource, /Exact price before launch/);
  assert.match(hubCopySource, /Prix exact avant lancement/);
  assert.match(hubCopySource, /Failed generations refunded/);
  assert.match(hubCopySource, /Échecs remboursés/);
  assert.match(hubCopySource, /Apple Pay/);
  assert.match(hubCopySource, /Google Pay/);
  assert.match(hubCopySource, /Stripe/);
  assert.match(creditsRefundsSource, /CreditCard/);
  assert.doesNotMatch(creditsRefundsSource, /'use client'/);
});

test('engine icons reject broken image placeholders', () => {
  assert.match(engineIconSource, /value\.toLowerCase\(\) !== 'image'/);
  assert.match(engineIconSource, /resolveRenderableBrandMark/);
  assert.match(engineIconSource, /const fallback = light \?\? dark/);
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
    'Compare AI video prices by engine, duration, resolution and audio. See preset prices for 720p, 1080p and 4K, then open the app for live pricing.'
  );
  assert.deepEqual(faqQuestions, [
    'How is AI video pricing calculated?',
    'Which AI video engine is cheapest?',
    'Which engine is cheapest for 10s 1080p video?',
    'Why is there an 8s 1080p column?',
    'Why is 4K shown separately?',
    'Can I see the exact price before generating?',
    'Do failed generations cost credits?',
    'Do I need a subscription?',
    'Why are some cheaper engines not highlighted first?',
    'Are image, audio and tools priced the same as video?',
    'Why does the table show total prices instead of cost per second?',
    'How often do prices change?',
  ]);
  assert.match(faqSource, /Pricing FAQ/);
  assert.match(faqSource, /dark-section-neon/);
  assert.match(faqSource, /mx-auto w-full max-w-\[900px\]/);
  assert.match(faqSource, /group w-full rounded-card/);
  assert.match(faqSource, /<details/);
  assert.match(faqSource, /<summary/);
  assert.match(faqSource, /summary className="flex w-full/);
  assert.match(faqSource, /group-open:rotate-45/);
  assert.equal(
    pricing?.faq?.subtitle,
    'Short answers about live quotes, credits, refunds and engine availability.'
  );
  assert.doesNotMatch(faqSource, /md:grid-cols-2/);
  assert.doesNotMatch(faqSource, /<dl/);
});

test('marketing shell is not forced no-store from the root layout', () => {
  assert.match(pageSource, /export const revalidate = 600/);
  assert.doesNotMatch(rootLayoutSource, /unstable_noStore|noStore\(\)/);
});
