import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AudioLines, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';

import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types.ts';
import type { AppLocale } from '../frontend/i18n/locales.ts';
import type { LocalizedLinkHref } from '../frontend/i18n/navigation.tsx';
import { parseModelExamplesContent, type ModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { getModelExamplesUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';
import {
  MODEL_EXAMPLE_FALLBACK_POSTER_SLUGS,
  resolveModelExampleFallbackPosters,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts';
import {
  buildModelExamplePreviewAlts,
  resolveModelExamplesRuntimePolicy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts';
import {
  buildModelExamplesViewModel,
  type BuildModelExamplesViewModelInput,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts';

const MODEL_CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const CONTENT_ROOT = path.join(MODEL_CONTENT_ROOT, 'en');
const RUNTIME_POLICY_PATH = path.join(
  process.cwd(),
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts',
);
const VIEW_MODEL_PATH = path.join(
  process.cwd(),
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts',
);
const examplesLinkHref = {
  pathname: '/examples/[model]',
  params: { model: 'fixture' },
} satisfies LocalizedLinkHref;

function videoContent(): ModelExamplesContent {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'Fixture examples',
      intro: 'Current Fixture outputs.',
      defaultCtaLabel: 'View all Fixture examples',
      recreateLabel: 'Recreate',
    },
    filters: [
      { id: 'all', label: 'All' },
      { id: 'cinematic', label: 'Cinematic' },
      { id: 'product', label: 'Product / Ad' },
      { id: 'audio', label: 'Audio' },
    ],
    proofItems: [
      { id: 'renders', icon: 'sparkles', title: 'Real renders', body: 'Review current outputs.' },
      { id: 'recreate', icon: 'zap', title: 'Recreate', body: 'Reuse the runtime setup.' },
      { id: 'audio', icon: 'audio', title: 'Audio', body: 'Check the current audio state.' },
      { id: 'continuity', icon: 'users', title: 'Continuity', body: 'Keep scenes consistent.' },
      { id: 'safety', icon: 'shield', title: 'Production-aware', body: 'Use safeguards.' },
    ],
    fallbackItems: null,
  };
}

function galleryVideo(overrides: Partial<ExampleGalleryVideo> = {}): ExampleGalleryVideo {
  return {
    id: 'job_fixture',
    href: '/video/job_fixture',
    engineLabel: 'Fixture Engine',
    engineIconId: 'fixture',
    priceLabel: null,
    prompt: 'Product launch on a tabletop.',
    promptFull: null,
    aspectRatio: '1920:1080',
    durationSec: 8,
    hasAudio: true,
    optimizedPosterUrl: '/fixture-optimized.webp',
    rawPosterUrl: '/fixture-raw.webp',
    recreateHref: '/app?engine=fixture-engine&recreate=job_fixture',
    ...overrides,
  };
}

function videoInput(
  overrides: Partial<BuildModelExamplesViewModelInput> = {},
): BuildModelExamplesViewModelInput {
  return {
    content: videoContent(),
    ui: getModelExamplesUiCopy('en'),
    locale: 'en',
    anchorId: 'text-to-video',
    modelName: 'Fixture Model',
    mode: 'video',
    audioMode: 'runtime',
    decisionAltMode: 'preview-alt',
    galleryVideos: [galleryVideo()],
    galleryPreviewAlts: new Map([['job_fixture', 'Fixture preview alt']]),
    fallbackPosters: new Map(),
    examplesLinkHref,
    imageWorkspaceHref: '/app/image?engine=fixture-image',
    ...overrides,
  };
}

function imageFallbackInput(): BuildModelExamplesViewModelInput {
  return {
    ...videoInput(),
    content: {
      ...videoContent(),
      modelSlug: 'fixture-image',
      section: {
        ...videoContent().section,
        defaultCtaLabel: null,
        recreateLabel: 'Open in workspace',
      },
      filters: [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'edit', label: 'Edit' },
      ],
      fallbackItems: [{
        id: 'product',
        title: 'Product still',
        category: 'Product',
        aspectRatio: '1:1',
        alt: 'Fixture product still',
        tags: ['product'],
      }],
    },
    mode: 'image-fallback',
    galleryVideos: [],
    galleryPreviewAlts: new Map(),
    fallbackPosters: new Map([['product', '/assets/model-examples/fixture/product.webp']]),
  };
}

function buildStoredExamplesViewModel({
  slug,
  locale,
  modelName,
  galleryVideos = [],
}: {
  slug: string;
  locale: AppLocale;
  modelName: string;
  galleryVideos?: ExampleGalleryVideo[];
}) {
  const document = JSON.parse(
    readFileSync(path.join(MODEL_CONTENT_ROOT, locale, `${slug}.json`), 'utf8'),
  ) as { examples?: unknown };
  const content = parseModelExamplesContent(document.examples, slug, locale);
  const ui = getModelExamplesUiCopy(locale);
  const policy = resolveModelExamplesRuntimePolicy({ modelSlug: slug, engineId: slug });
  return buildModelExamplesViewModel({
    content,
    ui,
    locale,
    anchorId: content.fallbackItems ? 'text-to-image' : 'text-to-video',
    modelName,
    mode: content.fallbackItems ? 'image-fallback' : 'video',
    audioMode: policy.audioMode,
    decisionAltMode: policy.decisionAltMode,
    galleryVideos,
    galleryPreviewAlts: buildModelExamplePreviewAlts({
      galleryVideos,
      locale,
      modelName,
      mode: policy.previewAltMode,
      numberedExampleLabel: ui.numberedExampleLabel,
    }),
    fallbackPosters: resolveModelExampleFallbackPosters(
      slug,
      content.fallbackItems?.map((item) => item.id) ?? [],
      null,
    ),
    examplesLinkHref: { pathname: '/examples/[model]', params: { model: slug } },
    imageWorkspaceHref: `/app/image?engine=${encodeURIComponent(slug)}`,
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

test('real video media preserves current title, alt, badges, links and available filters', () => {
  const result = buildModelExamplesViewModel(videoInput());

  assert.equal(result.visible, true);
  assert.equal(result.anchorId, 'text-to-video');
  assert.equal(result.decision.items[0]?.id, 'job_fixture');
  assert.equal(result.decision.items[0]?.title, 'Product launch on a tabletop');
  assert.equal(result.decision.items[0]?.alt, 'Fixture preview alt');
  assert.equal(result.decision.items[0]?.posterUrl, '/fixture-optimized.webp');
  assert.equal(result.decision.items[0]?.href, '/video/job_fixture');
  assert.equal(result.decision.items[0]?.recreateHref, '/app?engine=fixture-engine&recreate=job_fixture');
  assert.equal(result.decision.items[0]?.durationLabel, '8s');
  assert.equal(result.decision.items[0]?.aspectRatio, '16:9');
  assert.equal(result.decision.items[0]?.audioBadgeLabel, 'Audio on');
  assert.deepEqual(result.filters.map(({ id }) => id), ['all', 'product', 'audio']);
  assert.equal(result.decision.examplesLinkHref, examplesLinkHref);
  assert.equal(result.decision.viewAllLabel, 'View all examples');
  assert.equal(result.defaultPresentation.items[0]?.metadataLabel, '1920:1080 · 8s · audio on');
  assert.equal(result.defaultPresentation.examplesLinkHref, examplesLinkHref);
  assert.equal(result.section.defaultCtaLabel, 'View all Fixture examples');
});

test('Sora 2 Pro stored EN FR ES copy drives real-video filters, proof, recreate and audio output', () => {
  const videos = [
    galleryVideo({
      id: 'job_sora_cinematic',
      href: '/video/job_sora_cinematic',
      engineLabel: 'Sora 2 Pro',
      prompt: 'A cinematic film follows a rain-soaked detective.',
      hasAudio: true,
      recreateHref: '/app?engine=sora-2-pro&recreate=job_sora_cinematic',
    }),
    galleryVideo({
      id: 'job_sora_product',
      href: '/video/job_sora_product',
      engineLabel: 'Sora 2 Pro',
      prompt: 'A product packshot rotates on a clean tabletop.',
      hasAudio: false,
      recreateHref: '/app?engine=sora-2-pro&recreate=job_sora_product',
    }),
    galleryVideo({
      id: 'job_sora_action',
      href: '/video/job_sora_action',
      engineLabel: 'Sora 2 Pro',
      prompt: 'An athlete running through a narrow market.',
      aspectRatio: '9:16',
      hasAudio: false,
      recreateHref: '/app?engine=sora-2-pro&recreate=job_sora_action',
    }),
  ];
  const expected = {
    en: {
      title: 'Example Gallery: Sora 2 Pro Outputs',
      recreate: 'Recreate this Pro shot →',
      audio: 'Audio on',
    },
    fr: {
      title: 'Galerie d’exemples : rendus Sora 2 Pro',
      recreate: 'Recréer ce plan Pro →',
      audio: 'Audio activé',
    },
    es: {
      title: 'Galería de ejemplos: renders Sora 2 Pro',
      recreate: 'Recrear esta toma Pro →',
      audio: 'Audio activado',
    },
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const result = buildStoredExamplesViewModel({
      slug: 'sora-2-pro',
      locale,
      modelName: 'Sora 2 Pro',
      galleryVideos: videos,
    });

    assert.equal(result.section.title, expected[locale].title);
    assert.deepEqual(result.filters.map(({ id }) => id), [
      'all',
      'cinematic',
      'product',
      'action',
      'vertical',
      'audio',
    ]);
    assert.deepEqual(
      result.proofItems.map(({ icon }) => icon),
      [Sparkles, Zap, AudioLines, Users, ShieldCheck],
    );
    assert.equal(result.decision.items[0]?.title, 'A cinematic film follows a rain-soaked detective');
    assert.equal(result.decision.items[0]?.recreateLabel, expected[locale].recreate);
    assert.equal(result.decision.items[0]?.audioBadgeLabel, expected[locale].audio);
    assert.equal(
      result.decision.items[0]?.alt,
      'Sora 2 Pro a cinematic film follows a rain-soaked detective',
    );
  }
});

test('compatibility-prefix routes derive decision alts generically from the supplied model name', () => {
  for (const fixture of [
    {
      modelName: 'Sora 2 Pro',
      engineLabel: 'Sora 2',
      prompt: 'A cinematic tracking shot through a rain-soaked city.',
      expected: 'Sora 2 Pro a cinematic tracking shot through a rain-soaked city',
    },
    {
      modelName: 'Luma Ray 3.2',
      engineLabel: 'Luma Ray 3',
      prompt: 'A product bottle rotates under controlled studio light.',
      expected: 'Luma Ray 3.2 a product bottle rotates under controlled studio light',
    },
  ]) {
    const video = galleryVideo({
      engineLabel: fixture.engineLabel,
      prompt: fixture.prompt,
    });
    const result = buildModelExamplesViewModel(videoInput({
      modelName: fixture.modelName,
      decisionAltMode: 'model-name-prefix',
      galleryVideos: [video],
      galleryPreviewAlts: new Map([['job_fixture', `${fixture.engineLabel} supplied preview alt`]]),
    }));

    assert.equal(result.decision.items[0]?.alt, fixture.expected, fixture.modelName);
    assert.equal(
      result.defaultPresentation.items[0]?.alt,
      `${fixture.engineLabel} supplied preview alt`,
      fixture.modelName,
    );
  }
  assert.doesNotMatch(readFileSync(VIEW_MODEL_PATH, 'utf8'), /sora-2-pro|luma-ray-3-2/);
});

test('silent mode never exposes the audio filter and uses the silent badge', () => {
  const result = buildModelExamplesViewModel(videoInput({ audioMode: 'silent' }));

  assert.equal(result.decision.items[0]?.audioBadgeLabel, 'Silent');
  assert.equal(result.decision.items[0]?.tags.includes('audio'), false);
  assert.equal(result.filters.some(({ id }) => id === 'audio'), false);
});

test('image fallback attaches static posters without inventing runtime gallery media', () => {
  const result = buildModelExamplesViewModel(imageFallbackInput());

  assert.equal(result.decision.items[0]?.id, 'fixture-image-fallback-product');
  assert.equal(result.decision.items[0]?.posterUrl, '/assets/model-examples/fixture/product.webp');
  assert.equal(result.decision.items[0]?.href, '/app/image?engine=fixture-image');
  assert.equal(result.decision.items[0]?.recreateHref, '/app/image?engine=fixture-image');
  assert.equal(result.decision.items[0]?.durationLabel, null);
  assert.equal(result.decision.items[0]?.audioBadgeLabel, null);
  assert.equal(result.decision.examplesLinkHref, null);
  assert.equal(result.decision.renderLinkLabel, 'Open');
  assert.deepEqual(result.defaultPresentation.items, []);
  assert.deepEqual(result.filters.map(({ id }) => id), ['all', 'product']);
});

test('Nano Banana Pro and Luma Uni-1 stored fallbacks preserve item order and workspace output', () => {
  const fixtures = [
    {
      slug: 'nano-banana-pro',
      modelName: 'Nano Banana Pro',
      ids: ['campaign', 'typography', 'reference', 'final'],
      posters: [
        '/assets/model-examples/nano-banana-pro/campaign.webp',
        '/assets/model-examples/nano-banana-pro/typography.webp',
        '/assets/model-examples/nano-banana-pro/reference.webp',
        '/assets/model-examples/nano-banana-pro/final.webp',
      ],
      categories: ['Campaign', 'Typography', 'Reference edit', '4K final'],
      alts: [
        'Nano Banana Pro campaign image with ad layout',
        'Nano Banana Pro poster with readable typography',
        'Nano Banana Pro product edit guided by references',
        'Nano Banana Pro campaign asset finalized in 4K',
      ],
    },
    {
      slug: 'luma-uni-1',
      modelName: 'Luma Uni-1',
      ids: ['product', 'edit', 'reference', 'campaign'],
      posters: [
        '/assets/model-examples/luma-uni-1/product.webp',
        '/assets/model-examples/luma-uni-1/edit.webp',
        '/assets/model-examples/luma-uni-1/reference.webp',
        '/assets/model-examples/luma-uni-1/research.webp',
      ],
      categories: ['Product', 'Edit', 'References', 'Direction'],
      alts: [
        'Luma Uni-1 clean product still with simple studio light',
        'Luma Uni-1 edit preserving product shape while changing studio tone',
        'Luma Uni-1 still guided by product and mood references',
        'Luma Uni-1 retail research still for product direction',
      ],
    },
  ] as const;

  for (const fixture of fixtures) {
    const result = buildStoredExamplesViewModel({
      slug: fixture.slug,
      locale: 'en',
      modelName: fixture.modelName,
    });
    const workspaceHref = `/app/image?engine=${fixture.slug}`;

    assert.deepEqual(
      result.decision.items.map(({ id }) => id),
      fixture.ids.map((id) => `${fixture.slug}-fallback-${id}`),
    );
    assert.deepEqual(result.decision.items.map(({ posterUrl }) => posterUrl), fixture.posters);
    assert.deepEqual(result.decision.items.map(({ category }) => category), fixture.categories);
    assert.deepEqual(result.decision.items.map(({ alt }) => alt), fixture.alts);
    assert.ok(result.decision.items.every(({ href }) => href === workspaceHref));
    assert.ok(result.decision.items.every(({ recreateHref }) => recreateHref === workspaceHref));
    assert.equal(result.decision.examplesLinkHref, null);
  }
});

test('missing real media stays empty when content has no active fallback items', () => {
  const result = buildModelExamplesViewModel(videoInput({ galleryVideos: [] }));

  assert.equal(result.visible, true);
  assert.deepEqual(result.decision.items, []);
  assert.deepEqual(result.filters.map(({ id }) => id), ['all']);
});

test('builder does not mutate frozen content, media, maps or link inputs', () => {
  const input = deepFreeze(videoInput());

  assert.doesNotThrow(() => buildModelExamplesViewModel(input));
  assert.deepEqual(input.galleryVideos, [galleryVideo()]);
  assert.equal(input.galleryPreviewAlts.get('job_fixture'), 'Fixture preview alt');
  assert.deepEqual(input.examplesLinkHref, examplesLinkHref);
});

test('runtime policy bounds every silent engine and numbered-alt model compatibility case', () => {
  for (const engineId of [
    'minimax-hailuo-02-text',
    'pika-text-to-video',
    'luma-ray-2',
    'lumaRay2',
    'luma-ray-2-flash',
    'lumaRay2_flash',
    'luma-ray-3-2',
  ]) {
    assert.equal(
      resolveModelExamplesRuntimePolicy({ modelSlug: 'fixture', engineId }).audioMode,
      'silent',
      engineId,
    );
  }
  for (const modelSlug of [
    'seedance-2-0',
    'minimax-hailuo-02-text',
    'wan-2-6',
    'pika-text-to-video',
  ]) {
    assert.equal(
      resolveModelExamplesRuntimePolicy({ modelSlug, engineId: 'fixture-engine' }).previewAltMode,
      'numbered-model-example',
      modelSlug,
    );
  }
  for (const engineId of [
    'luma-ray-2',
    'lumaRay2',
    'luma-ray-3-2',
    'sora-2-pro',
    'sora-2',
    'ltx-2-3-fast',
    'ltx-2-3-pro',
    'ltx-2-3',
    'kling-3-pro',
    'kling-3-4k',
    'kling-3-standard',
    'veo-3-1-lite',
    'veo-3-1',
    'veo-3-1-fast',
    'seedance-2-0-fast',
    'seedance-1-5-pro',
  ]) {
    assert.equal(
      resolveModelExamplesRuntimePolicy({ modelSlug: 'fixture', engineId }).decisionAltMode,
      'model-name-prefix',
      engineId,
    );
  }
  assert.deepEqual(
    resolveModelExamplesRuntimePolicy({ modelSlug: 'fixture', engineId: 'fixture-engine' }),
    {
      audioMode: 'runtime',
      previewAltMode: 'prompt',
      decisionAltMode: 'preview-alt',
    },
  );
});

test('preview alt builder preserves prompt mode, localizes numbered mode and caps output at six', () => {
  const galleryVideos = Array.from({ length: 7 }, (_, index) => galleryVideo({
    id: `job_${index + 1}`,
    prompt: index === 0 ? 'Product launch on a tabletop.' : `Scene ${index + 1}`,
  }));
  const promptAlts = buildModelExamplePreviewAlts({
    galleryVideos,
    locale: 'en',
    modelName: 'Fixture Model',
    mode: 'prompt',
    numberedExampleLabel: getModelExamplesUiCopy('en').numberedExampleLabel,
  });
  const numberedAlts = buildModelExamplePreviewAlts({
    galleryVideos,
    locale: 'fr',
    modelName: 'Fixture Model',
    mode: 'numbered-model-example',
    numberedExampleLabel: getModelExamplesUiCopy('fr').numberedExampleLabel,
  });

  assert.equal(promptAlts.get('job_1'), 'Fixture Engine AI video example: Product launch on a tabletop.');
  assert.equal(numberedAlts.get('job_1'), 'Exemple video IA Fixture Engine: Fixture Model produit exemple 1');
  assert.equal(promptAlts.size, 6);
  assert.equal(promptAlts.has('job_7'), false);
});

test('runtime policy receives localized numbered-example copy without owning locale branches', () => {
  const source = readFileSync(RUNTIME_POLICY_PATH, 'utf8');

  assert.equal(getModelExamplesUiCopy('en').numberedExampleLabel, 'example');
  assert.equal(getModelExamplesUiCopy('fr').numberedExampleLabel, 'exemple');
  assert.equal(getModelExamplesUiCopy('es').numberedExampleLabel, 'ejemplo');
  assert.doesNotMatch(source, /\b(?:if|switch)\s*\([^)]*\blocale\b|locale\s*(?:===|==)|\blocale\s*\?/);
  assert.doesNotMatch(source, /['"`](?:example|exemple|ejemplo)['"`]/i);
});

test('static poster manifest keys exactly match migrated models with fallback items', () => {
  const documents = readdirSync(CONTENT_ROOT)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const slug = fileName.slice(0, -5);
      const document = JSON.parse(readFileSync(path.join(CONTENT_ROOT, fileName), 'utf8')) as { examples?: unknown };
      return parseModelExamplesContent(document.examples, slug, 'en');
    });
  const expected = documents
    .filter((content) => content.fallbackItems !== null)
    .map((content) => content.modelSlug)
    .sort();
  const sentinel = '/fallback-sentinel.webp';
  const actual = [...MODEL_EXAMPLE_FALLBACK_POSTER_SLUGS].sort();

  assert.equal(Object.isFrozen(MODEL_EXAMPLE_FALLBACK_POSTER_SLUGS), true);
  assert.deepEqual(actual, expected);
  for (const content of documents.filter((item) => item.fallbackItems !== null)) {
    const ids = content.fallbackItems?.map((item) => item.id) ?? [];
    const posters = resolveModelExampleFallbackPosters(content.modelSlug, ids, sentinel);
    assert.equal(Array.from(posters.values()).every((poster) => poster !== sentinel), true, content.modelSlug);
  }
  assert.deepEqual(
    Array.from(resolveModelExampleFallbackPosters('fixture', ['one'], null)),
    [['one', '']],
  );
});
