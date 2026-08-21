import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildLocalizedModelPath,
  getModelRegistryEntryById,
} from '../frontend/config/model-registry.ts';
import { buildModelRegistryRedirects } from '../frontend/config/model-registry-redirects.cjs';
import { buildExamplesNextStepLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  buildInternalLinkSuggestions,
  formatInternalLinkSectionMarkdown,
} from '../frontend/lib/seo/internal-link-builder';
import {
  buildCodexActionQueue,
  formatCodexActionQueueMarkdown,
} from '../frontend/lib/seo/codex-action-queue';
import { buildStrategicSeoOpportunities } from '../frontend/lib/seo/seo-opportunity-engine';

const PROJECT_ROOT = process.cwd();
const LOCALES = ['en', 'fr', 'es'] as const;
const REQUIRED_SEEDANCE_25_TARGETS = {
  en: '/models/seedance-2-5',
  fr: '/fr/modeles/seedance-2-5',
  es: '/es/modelos/seedance-2-5',
} as const;
const EXPECTED_SEEDANCE_25_COMPARISON_TARGETS = {
  en: '/ai-video-engines/seedance-2-0-vs-seedance-2-5',
  fr: '/fr/comparatif/seedance-2-0-vs-seedance-2-5',
  es: '/es/comparativa/seedance-2-0-vs-seedance-2-5',
} as const;
const SEEDANCE_25_BEST_FOR_SLUGS = [
  'ads',
  'cinematic-realism',
  'image-to-video',
  'reference-to-video',
  'multi-shot-video',
  'product-videos',
  'ugc-ads',
] as const;

function readRepositoryFile(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), 'utf8');
}

test('Seedance 2.5 launch-link matrix covers examples, Seedance 2.0, and relevant best-for clusters', () => {
  const compareConfig = JSON.parse(readRepositoryFile('frontend/config/compare-config.json')) as {
    bestForPages: Array<{ slug: string; topPicks?: string[] }>;
  };

  for (const locale of LOCALES) {
    const target = REQUIRED_SEEDANCE_25_TARGETS[locale];
    const examplesLinks = buildExamplesNextStepLinks({
      appLocale: locale,
      isKlingLanding: false,
      isLtxLanding: false,
      isSeedanceLanding: true,
      isVeoLanding: false,
      locale,
      pricingPath: locale === 'fr' ? '/fr/tarifs' : locale === 'es' ? '/es/precios' : '/pricing',
    });
    assert.equal(examplesLinks[0]?.href, target, `${locale} Seedance examples should lead with the 2.5 profile`);
    assert.equal(examplesLinks[1]?.href, EXPECTED_SEEDANCE_25_COMPARISON_TARGETS[locale]);
    assert.equal(examplesLinks.length, 5);

    const seedance20Path = `content/models/${locale}/seedance-2-0.json`;
    assert.match(readRepositoryFile(seedance20Path), new RegExp(target.replaceAll('/', '\\/')));

    for (const slug of SEEDANCE_25_BEST_FOR_SLUGS) {
      const sourcePath = `content/${locale}/best-for/${slug}.mdx`;
      const source = readRepositoryFile(sourcePath);
      const firstPickHref = source.match(/## (?:Best picks|Meilleurs choix|Mejores opciones)[\s\S]*?1\. \*\*\[[^\]]+\]\(([^)]+)\)/)?.[1];
      assert.equal(firstPickHref, target, `${sourcePath} should rank the localized Seedance 2.5 profile first`);
      assert.match(
        source,
        new RegExp(buildLocalizedModelPath(locale, 'seedance-2-0').replaceAll('/', '\\/')),
        `${sourcePath} should retain Seedance 2.0 as an alternative`,
      );
    }
  }

  for (const slug of SEEDANCE_25_BEST_FOR_SLUGS) {
    const entry = compareConfig.bestForPages.find((candidate) => candidate.slug === slug);
    assert.equal(entry?.topPicks?.[0], 'seedance-2-5', `${slug} ranked cards should lead with Seedance 2.5`);
    assert.ok(entry?.topPicks?.includes('seedance-2-0'), `${slug} ranked cards should retain Seedance 2.0`);
  }
});

test('Seedance 2.0 routes stay published, self-owned, and 4K-specific after the 2.5 launch', () => {
  const seedance20 = getModelRegistryEntryById('seedance-2-0');
  const seedance20Fast = getModelRegistryEntryById('seedance-2-0-fast');
  const seedance20Mini = getModelRegistryEntryById('seedance-2-0-mini');

  assert.ok(seedance20);
  assert.equal(seedance20.slug, 'seedance-2-0');
  assert.equal(seedance20.publication.model.published, true);
  assert.equal(seedance20.publication.model.indexable, true);
  assert.equal(seedance20.replacement, null);
  assert.equal(seedance20Fast?.publication.model.published, true);
  assert.equal(seedance20Mini?.publication.model.published, true);

  const registryDocument = JSON.parse(readRepositoryFile('frontend/config/model-registry.json'));
  const redirects = buildModelRegistryRedirects(registryDocument);
  for (const locale of LOCALES) {
    const source = buildLocalizedModelPath(locale, 'seedance-2-0');
    const target = REQUIRED_SEEDANCE_25_TARGETS[locale];
    assert.equal(
      redirects.some((redirect) => redirect.source === source && redirect.destination === target),
      false,
      `${source} must not redirect to ${target}`,
    );

    const fourKPath = `content/${locale}/best-for/4k-video.mdx`;
    const fourKSource = readRepositoryFile(fourKPath);
    assert.match(fourKSource, new RegExp(source.replaceAll('/', '\\/')));
    assert.doesNotMatch(fourKSource, new RegExp(target.replaceAll('/', '\\/')));
  }
});

function gscRow(
  query: string,
  page: string | null,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number
): GscPerformanceRow {
  return {
    query,
    page,
    country: 'usa',
    device: 'DESKTOP',
    searchAppearance: null,
    date: null,
    searchType: 'web',
    clicks,
    impressions,
    ctr,
    position,
  };
}

test('examples page recommends a current canonical model target instead of an alias-only target', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
      gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/examples/ltx', 8, 74, 0.108, 6.2),
    ],
  });
  const link = suggestions.find((item) => item.sourceUrl === '/examples/ltx' && item.targetUrl === '/models/ltx-2-3-pro');

  assert.ok(link);
  assert.equal(link.recommendationType, 'examples_to_model');
  assert.equal(link.family, 'LTX');
  assert.match(link.suggestedAnchor, /LTX 2\.3 prompt examples and specs/i);
  assert.equal(link.verifyExistingLinkFirst, true);
  assert.equal(suggestions.some((item) => item.targetUrl === '/models/ltx-2-3'), false);
});

test('model page to examples links are downgraded as expected-existing maintenance checks', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('kling ai video examples', 'https://maxvideoai.com/models/kling-3-pro', 12, 140, 0.086, 8.4),
      gscRow('kling ai image to video examples', 'https://maxvideoai.com/models/kling-3-pro', 5, 90, 0.056, 9.1),
    ],
  });
  const link = suggestions.find((item) => item.sourceUrl === '/models/kling-3-pro' && item.targetUrl === '/examples/kling');

  assert.ok(link);
  assert.equal(link.recommendationType, 'model_to_examples');
  assert.equal(link.family, 'Kling');
  assert.match(link.suggestedAnchor, /Kling/i);
  assert.equal(link.priority, 'low');
});

test('comparison page model links are downgraded when the route pattern already implies exact links', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow(
        'seedance 2.0 vs seedance 2.0 fast',
        'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        10,
        47,
        0.213,
        4.6
      ),
      gscRow(
        'seedance fast vs normal',
        'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        4,
        35,
        0.114,
        5.2
      ),
    ],
  });

  const left = suggestions.find((item) => item.sourceUrl.includes('seedance-2-0-vs-seedance-2-0-fast') && item.targetUrl === '/models/seedance-2-0');
  const right = suggestions.find((item) => item.sourceUrl.includes('seedance-2-0-vs-seedance-2-0-fast') && item.targetUrl === '/models/seedance-2-0-fast');
  assert.ok(left);
  assert.ok(right);
  assert.equal(left.priority, 'low');
  assert.equal(right.priority, 'low');
  assert.ok(suggestions.every((item) => item.verifyExistingLinkFirst));
});

test('internal link builder avoids noisy all-to-all model linking', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 10, 120, 0.083, 7),
      gscRow('ltx video examples', 'https://maxvideoai.com/examples/ltx', 3, 45, 0.067, 8),
    ],
  });

  assert.ok(suggestions.length <= 4);
  assert.ok(suggestions.every((item) => !item.targetUrl.includes('/models/seedance') && !item.targetUrl.includes('/models/sora')));
});

test('Sora suggestions remain visible but de-prioritized', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('sora 2 prompt examples', 'https://maxvideoai.com/examples/sora', 8, 120, 0.067, 9),
      gscRow('sora examples', 'https://maxvideoai.com/examples/sora', 4, 80, 0.05, 11),
    ],
  });

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((item) => item.family === 'Sora'));
  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('emerging Happy Horse queries are detected but kept low priority without strong signal', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('happy horse 1.0 examples', 'https://maxvideoai.com/examples/happy-horse', 1, 34, 0.029, 12),
      gscRow('happy horse prompt examples', 'https://maxvideoai.com/examples/happy-horse', 0, 22, 0, 13),
    ],
  });

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((item) => item.family === 'Happy Horse'));
  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('adult or junk queries do not generate internal link recommendations', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('nsfw ai video generator examples', 'https://maxvideoai.com/examples/ltx', 0, 900, 0, 3),
      gscRow('ai video generator crack', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 200, 0, 2),
    ],
  });

  assert.equal(suggestions.length, 0);
});

test('tiny 4 to 5 impression suggestions stay low priority', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/ltx-2-fast-vs-veo-3-1-lite', 3, 4, 0.75, 6.3),
      gscRow('kling ai video', 'https://maxvideoai.com/examples/kling', 5, 5, 1, 27.4),
    ],
  });

  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('internal link suggestions do not add duplicate Codex action queue items', () => {
  const rows = [
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
    gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/examples/ltx', 8, 74, 0.108, 6.2),
  ];
  const opportunities = buildStrategicSeoOpportunities(rows);
  const actions = buildCodexActionQueue(opportunities);
  const suggestions = buildInternalLinkSuggestions({ rows, opportunities });
  const markdown = formatCodexActionQueueMarkdown(actions, [], [], suggestions);

  assert.match(markdown, new RegExp(`Generated actions: ${actions.length}`));
  assert.match(markdown, /# Internal Link Suggestions/);
  assert.equal(actions.length, buildCodexActionQueue(opportunities).length);
});

test('Internal Link Builder export shape is stable', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 4, 120, 0.033, 8.1),
      gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 2, 80, 0.025, 8.2),
    ],
  });
  const section = formatInternalLinkSectionMarkdown(suggestions);
  const markdown = formatCodexActionQueueMarkdown([], [], [], suggestions);
  const jsonPayload = { actions: [], opportunities: [], ctrDoctorItems: [], missingContentItems: [], internalLinkSuggestions: suggestions };

  assert.match(section, /# Internal Link Suggestions/);
  assert.match(markdown, /# Internal Link Suggestions/);
  assert.equal(Array.isArray(jsonPayload.internalLinkSuggestions), true);
  assert.ok(jsonPayload.internalLinkSuggestions.length > 0);
});
