import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
const homeSectionsSource = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
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

test('homepage structured data keeps Organization schema alongside WebApplication schema', () => {
  assert.match(homeSource, /home-webapp-jsonld/);
  assert.match(homeSource, /home-organization-jsonld/);
  assert.match(homeSource, /'@type': 'Organization'/);
  assert.match(homeSource, /logo: 'https:\/\/maxvideoai\.com\/favicon-512\.png'/);
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
  const workflowSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('const WORKFLOW_BASICS_COPY'),
    homeSectionsSource.indexOf('export function ProviderEngineStrip')
  );

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
  const startupComponentSource = homeSectionsSource.slice(
    homeSectionsSource.indexOf('export function StartupFameLink'),
    homeSectionsSource.indexOf('function formatBestForPickLabel')
  );

  assert.match(homeSource, /startupFameLabel={startupFameLabel}/);
  assert.ok(hubCtaIndex >= 0, 'Best-for hub CTA should render inside the selector');
  assert.ok(startupFameIndex > hubCtaIndex, 'Startup Fame should stay below the best-for hub CTA');
  assert.match(homeSource, /dictionary\.home\.partners\?\.startupFameLabel/);
  assert.match(startupComponentSource, /https:\/\/startupfa\.me\/s\/maxvideoai\?utm_source=maxvideoai\.com/);
  assert.doesNotMatch(startupComponentSource, /nofollow/);
  assert.doesNotMatch(startupComponentSource, /<section/);
  assert.match(startupComponentSource, /text-\[10px\]/);
});
