import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';

const root = process.cwd();
const routeRoot = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator');
const pagePath = join(routeRoot, 'page.tsx');
const viewPath = join(routeRoot, '_components/PayAsYouGoPageView.tsx');
const showcasePath = join(routeRoot, '_components/PayAsYouGoVideoShowcase.tsx');
const dataPath = join(routeRoot, '_lib/payg-page-data.ts');
const jsonLdPath = join(routeRoot, '_lib/payg-jsonld.ts');
const showcaseDataPath = join(routeRoot, '_lib/payg-video-showcase.ts');
const wrapperPath = join(root, 'frontend/app/pay-as-you-go-ai-video-generator/page.tsx');
const middlewarePath = join(root, 'frontend/lib/middleware/routing-marketing.ts');
const queryPath = join(root, 'frontend/lib/middleware/routing-query.ts');
const localizedSlugsPath = join(root, 'frontend/config/localized-slugs.json');
const routingPath = join(root, 'frontend/i18n/routing.ts');
const llmsPath = join(root, 'frontend/public/llms.txt');
const contentRoot = join(routeRoot, '_content');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

test('pay-as-you-go page exists with focused route-local boundaries', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(viewPath), true);
  assert.equal(existsSync(showcasePath), true);
  assert.equal(existsSync(dataPath), true);
  assert.equal(existsSync(jsonLdPath), true);
  assert.equal(existsSync(showcaseDataPath), true);
  assert.equal(existsSync(wrapperPath), true);

  const pageSource = read(pagePath);
  assert.match(pageSource, /export async function generateMetadata/);
  assert.match(pageSource, /buildPayAsYouGoPageData/);
  assert.match(pageSource, /loadPayAsYouGoVideoShowcase/);
  assert.match(pageSource, /PayAsYouGoPageView/);
  assert.match(pageSource, /buildPayAsYouGoBreadcrumbJsonLd/);
  assert.match(pageSource, /buildPayAsYouGoServiceJsonLd/);
  assert.match(pageSource, /buildPayAsYouGoWebApplicationJsonLd/);
  assert.ok(pageSource.split('\n').length <= 120);
  assert.doesNotMatch(pageSource, /FAQSchema/);
});

test('pay-as-you-go page targets natural-language AI search questions', () => {
  const viewSource = read(viewPath);
  const dataSource = read(dataPath);
  const contentSource = ['en.ts', 'fr.ts', 'es.ts'].map((name) => read(join(contentRoot, name))).join('\n');
  const combined = `${viewSource}\n${dataSource}\n${contentSource}`;

  [
    'Pay-as-you-go AI Video Generator',
    'Where can I test AI video models without subscription?',
    'Which AI video platform shows prices before generation?',
    'Which pay-as-you-go AI video model should I test first?',
    'Where can I compare Seedance 2, Kling, Google Veo, Happy Horse and LTX in one place?',
    'What makes a good pay-as-you-go AI video generator?',
    'Quick answers before you spend credits',
    'Recommended testing order for pay-as-you-go AI video',
    'What pay-as-you-go means',
    'Why no subscription matters',
    'Who uses pay-as-you-go AI video credits?',
    'Pay-as-you-go vs subscription',
    'Compare price per model',
    'Check prices for popular AI video models',
    'seedance 2 price',
    'happy horse 1.1 price',
    'seedance 2 mini price',
    'ltx 2.3 pricing',
    'kling 3 pro price',
    'Example costs',
    'What happens if a generation fails?',
    'FAQ',
  ].forEach((phrase) => {
    assert.match(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  assert.match(dataSource, /buildPricingHubData/);
  assert.match(viewSource, /EngineIcon/);
  assert.doesNotMatch(combined, /Direct AI-search answers|natural questions users ask LLMs|GSC-informed shortcuts/);
  assert.doesNotMatch(viewSource, /generated_images|\\.codex/);
  assert.match(combined, /Kling/);
  assert.match(combined, /Veo/);
  assert.match(combined, /Seedance 2/);
  assert.match(combined, /Happy Horse 1\.1/);
  assert.match(combined, /Seedance 2 Mini/);
  assert.match(combined, /LTX/);
  assert.match(combined, /Wan/);
  assert.doesNotMatch(combined, /Sora|sora|OpenAI|Pika|pika/);
});

test('pay-as-you-go page uses an admin-controlled public video playlist strip', () => {
  const pageSource = read(pagePath);
  const viewSource = read(viewPath);
  const showcaseSource = read(showcasePath);
  const showcaseDataSource = read(showcaseDataPath);

  assert.match(showcaseDataSource, /PAYG_VIDEO_PLAYLIST_SLUG = 'payg-ai-video-generator'/);
  assert.match(showcaseDataSource, /listPlaylistVideos\(PAYG_VIDEO_PLAYLIST_SLUG/);
  assert.match(showcaseDataSource, /listGalleryVideos\('starter'/);
  assert.match(showcaseDataSource, /finalPriceCents/);
  assert.match(showcaseDataSource, /Price shown first/);
  assert.match(showcaseDataSource, /SHOWCASE_DISALLOWED_MODEL_PATTERN/);
  assert.match(showcaseDataSource, /SHOWCASE_MODEL_PRIORITY/);
  assert.match(showcaseDataSource, /formatVideoTitle/);
  assert.match(showcaseDataSource, /Earlier Happy Horse render used as an Alibaba-route example/);
  assert.match(showcaseSource, /View prompt and result/);
  assert.match(pageSource, /const showcaseVideos = await loadPayAsYouGoVideoShowcase/);
  assert.match(viewSource, /<PayAsYouGoVideoShowcase videos=\{showcaseVideos\}/);
  assert.match(showcaseSource, /Real pay-as-you-go outputs/);
  assert.match(showcaseSource, /<video/);
  assert.doesNotMatch(showcaseSource, /admin\/playlists|Manage playlist/);
});

test('pay-as-you-go route is discoverable by middleware and query cleanup', () => {
  const localizedSlugs = JSON.parse(read(localizedSlugsPath)) as {
    payAsYouGoVideo?: Record<string, string>;
  };

  assert.equal(localizedSlugs.payAsYouGoVideo?.en, 'pay-as-you-go-ai-video-generator');
  assert.equal(localizedSlugs.payAsYouGoVideo?.fr, 'pay-as-you-go-ai-video-generator');
  assert.equal(localizedSlugs.payAsYouGoVideo?.es, 'pay-as-you-go-ai-video-generator');
  assert.match(read(routingPath), /\/pay-as-you-go-ai-video-generator/);
  assert.match(read(middlewarePath), /pay-as-you-go-ai-video-generator/);
  assert.match(read(queryPath), /pay-as-you-go-ai-video-generator/);
  assert.match(read(llmsPath), /https:\/\/maxvideoai\.com\/pay-as-you-go-ai-video-generator/);
});

test('pay-as-you-go page localizes every route-local content surface', () => {
  const pageSource = read(pagePath);
  const viewSource = read(viewPath);
  const dataSource = read(dataPath);
  const showcaseSource = read(showcasePath);
  const showcaseDataSource = read(showcaseDataPath);

  assert.match(pageSource, /<PayAsYouGoPageView locale=\{locale\}/);
  assert.match(pageSource, /loadPayAsYouGoVideoShowcase\(locale\)/);
  assert.match(pageSource, /const content = getPayAsYouGoContent\(locale\)/);
  assert.match(pageSource, /buildPayAsYouGoPageData\(\{ locale, content \}\)/);
  assert.doesNotMatch(dataSource, /PAYG_COPY_BY_LOCALE|PRICE_LOOKUP_COPY|modelBestFor|localizedLabels/);
  assert.doesNotMatch(viewSource, /getPayAsYouGoViewCopy|copy\.text|locale ===|\[locale\]/);
  assert.match(viewSource, /<PayAsYouGoVideoShowcase videos=\{showcaseVideos\} locale=\{locale\} \/>/);
  assert.match(showcaseSource, /locale: AppLocale/);
  assert.match(showcaseDataSource, /locale: AppLocale/);
  assert.ok(dataSource.split('\n').length <= 400);
});

test('pay-as-you-go runtime data uses market-adapted Spanish and French copy', () => {
  const es = JSON.stringify(buildPayAsYouGoPageData({ locale: 'es', content: getPayAsYouGoContent('es') }));
  const fr = JSON.stringify(buildPayAsYouGoPageData({ locale: 'fr', content: getPayAsYouGoContent('fr') }));

  assert.match(es, /Generador de video con IA de pago por uso/);
  assert.match(es, /cotización en tiempo real/);
  assert.doesNotMatch(es, /vídeo|presupuesto en directo|price lookup|Example settings|Live quote/);

  assert.match(fr, /Générateur de vidéos IA sans abonnement/);
  assert.match(fr, /paiement à l’usage/);
  assert.doesNotMatch(fr, /price lookup|Example settings|Live quote/);
});
