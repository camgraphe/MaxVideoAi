import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { FeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import type { ModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import {
  resolveDefaultModelPromptingDemoPromptSource,
  resolveModelPromptingDemoPromptSource,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-prompt-source.ts';
import {
  buildModelPromptingViewModel,
  type BuildModelPromptingViewModelInput,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts';

const CONTENT_ROOT = join(process.cwd(), 'content/models');
const VEO_FAST_MEDIA_PROMPT =
  '8s 16:9 Veo 3.1 Fast desk draft with a presenter, slow handheld drift, soft typing, city ambience, and one short calm line.';

function videoContent(): ModelPromptingContent {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'Fixture prompting',
      intro: null,
      tip: null,
      guide: null,
      referencesTitle: null,
    },
    tabs: [
      {
        id: 'quick',
        label: 'Quick',
        title: 'Quick prompt',
        description: null,
        copy: 'Subject, action, camera',
      },
    ],
    tabNotes: [{ tabId: 'quick', body: 'Keep the subject explicit.' }],
    globalPrinciples: ['Name the subject.'],
    engineWhy: ['Explicit motion is more stable.'],
    demo: {
      title: 'Fixture demo',
      promptLabel: 'Text prompt',
      prompt: 'Editorial fallback prompt',
      notes: [],
      summary: {
        subject: 'Chef',
        action: 'Cooks',
        camera: 'Push-in',
        style: 'Cinematic',
        output: 'Market ambience',
      },
      presentationOverrides: {
        modeLabel: 'Text-to-video',
        outputLabel: 'Audio',
        duration: null,
        aspectRatio: null,
        audioChipMode: 'media',
        audioChipLabel: null,
        altContext: 'Fixture render',
      },
    },
    imageExamples: null,
  };
}

function media(overrides: Partial<FeaturedMedia> = {}): FeaturedMedia {
  return {
    id: 'job_fixture',
    prompt: null,
    videoUrl: '/fixture.mp4',
    previewVideoUrl: null,
    posterUrl: '/fixture.jpg',
    durationSec: 12,
    hasAudio: false,
    href: '/video/job_fixture',
    label: 'Fixture',
    aspectRatio: '16:9',
    ...overrides,
  };
}

function videoInput(
  overrides: Partial<BuildModelPromptingViewModelInput> = {},
): BuildModelPromptingViewModelInput {
  return {
    content: videoContent(),
    locale: 'en',
    engineId: 'fixture-engine',
    modelSlug: 'fixture-model',
    imageAnchorId: 'prompting',
    isVideoEngine: true,
    isImageEngine: false,
    supportsNativeAudio: false,
    demoPromptSource: 'editorial',
    defaultDemoPromptSource: 'editorial',
    demoMedia: null,
    defaultDemoPresentation: {
      audioBadgeLabel: 'Audio on',
      altContext: 'demo',
    },
    referenceWorkflows: [],
    ...overrides,
  };
}

function imageInput(): BuildModelPromptingViewModelInput {
  const content: ModelPromptingContent = {
    ...videoContent(),
    modelSlug: 'fixture-image',
    demo: null,
    imageExamples: {
      title: 'Fixture image prompts',
      intro: 'Fixture image introduction',
      workspaceLabel: 'Open image workspace',
      items: [
        {
          id: 'product',
          title: 'Product still',
          badge: '2K',
          kind: 'image',
          prompt: 'A clean product still.',
        },
      ],
    },
  };
  return {
    content,
    locale: 'en',
    engineId: 'fixture-image',
    modelSlug: 'fixture-image',
    imageAnchorId: 'prompting',
    isVideoEngine: false,
    isImageEngine: true,
    supportsNativeAudio: false,
    demoPromptSource: 'editorial',
    defaultDemoPromptSource: 'editorial',
    demoMedia: null,
    defaultDemoPresentation: {
      audioBadgeLabel: 'Audio off',
      altContext: 'demo',
    },
    referenceWorkflows: [],
  };
}

function withPresentation(
  mode: NonNullable<ModelPromptingContent['demo']>['presentationOverrides']['audioChipMode'],
  overrides: Partial<NonNullable<ModelPromptingContent['demo']>['presentationOverrides']> = {},
): ModelPromptingContent {
  const content = videoContent();
  assert.ok(content.demo);
  return {
    ...content,
    demo: {
      ...content.demo,
      presentationOverrides: {
        ...content.demo.presentationOverrides,
        audioChipMode: mode,
        ...overrides,
      },
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function localizedPrompting(locale: 'en' | 'fr' | 'es', slug: string): ModelPromptingContent {
  const filePath = join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(readFileSync(filePath, 'utf8')) as { prompting?: unknown };
  return parseModelPromptingContent(document.prompting, slug, locale, `${filePath}#prompting`);
}

function buildLocalizedRouteViewModel(locale: 'en' | 'fr' | 'es', content: ModelPromptingContent) {
  const demoMedia = media({
    id: 'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
    prompt: VEO_FAST_MEDIA_PROMPT,
    label: 'Veo 3.1 Fast',
  });
  const demoPromptSource = resolveModelPromptingDemoPromptSource({
    content,
    demoMedia,
    engineId: content.modelSlug,
    locale,
  });
  const defaultDemoPromptSource = resolveDefaultModelPromptingDemoPromptSource(demoMedia);

  return {
    demoPromptSource,
    defaultDemoPromptSource,
    viewModel: buildModelPromptingViewModel(
      videoInput({
        content,
        locale,
        engineId: content.modelSlug,
        modelSlug: content.modelSlug,
        demoMedia,
        demoPromptSource,
        defaultDemoPromptSource,
      }),
    ),
  };
}

test('localized Veo Fast routes keep editorial demo prompts when pinned media has short English prose', () => {
  const expectedStarts = {
    en: '8s 16:9 Veo 3.1 Fast draft',
    fr: 'Brouillon Veo 3.1 Fast',
    es: 'Borrador Veo 3.1 Fast',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = localizedPrompting(locale, 'veo-3-1-fast');
    const result = buildLocalizedRouteViewModel(locale, content);

    assert.equal(result.demoPromptSource, 'editorial', `${locale} route prompt source`);
    assert.equal(result.defaultDemoPromptSource, 'media', `${locale} default prompt source`);
    assert.equal(result.viewModel.demo?.prompt, content.demo?.prompt, `${locale} editorial prompt`);
    assert.ok(result.viewModel.demo?.prompt.startsWith(expectedStarts[locale]), `${locale} prompt opening`);
    assert.match(result.viewModel.demo?.prompt ?? '', /\n/, `${locale} multiline editorial projection`);
    assert.notEqual(result.viewModel.demo?.prompt, VEO_FAST_MEDIA_PROMPT, `${locale} pinned media prose`);
    assert.equal(result.viewModel.defaultPresentation.demo?.promptLabel, undefined);
    assert.deepEqual(result.viewModel.defaultPresentation.demo?.promptLines, []);
  }
});

test('route prompt-source policy uses media only for Happy Horse or summary-shaped fallback copy', () => {
  const happyHorse = localizedPrompting('en', 'happy-horse-1-1');
  const runtimeMedia = media({ prompt: 'Runtime media prose' });
  assert.equal(
    resolveModelPromptingDemoPromptSource({
      content: happyHorse,
      demoMedia: runtimeMedia,
      engineId: 'happy-horse-1-1',
      locale: 'en',
    }),
    'media',
  );

  const summaryContent = videoContent();
  assert.ok(summaryContent.demo);
  summaryContent.demo.prompt = [
    `Subject: ${summaryContent.demo.summary.subject}`,
    `Action: ${summaryContent.demo.summary.action}`,
    `Camera: ${summaryContent.demo.summary.camera}`,
    `Style: ${summaryContent.demo.summary.style}`,
    `Audio: ${summaryContent.demo.summary.output}`,
  ].join('\n');
  assert.equal(
    resolveModelPromptingDemoPromptSource({
      content: summaryContent,
      demoMedia: runtimeMedia,
      engineId: 'fixture-engine',
      locale: 'en',
    }),
    'media',
  );
  assert.equal(
    resolveModelPromptingDemoPromptSource({
      content: videoContent(),
      demoMedia: runtimeMedia,
      engineId: 'fixture-engine',
      locale: 'en',
    }),
    'editorial',
  );
});

test('default prompt-source policy uses every non-empty media prompt without changing decision policy', () => {
  assert.equal(resolveDefaultModelPromptingDemoPromptSource(null), 'editorial');
  assert.equal(resolveDefaultModelPromptingDemoPromptSource(media({ prompt: '   ' })), 'editorial');
  assert.equal(resolveDefaultModelPromptingDemoPromptSource(media({ prompt: 'Media prose' })), 'media');
});

test('video view model uses a media prompt only when route policy explicitly selects media', () => {
  const referenceWorkflows = [{ title: 'Image de référence', body: 'Verrouille le sujet.' }];
  const result = buildModelPromptingViewModel(
    videoInput({
      locale: 'fr',
      supportsNativeAudio: true,
      demoPromptSource: 'media',
      defaultDemoPromptSource: 'media',
      demoMedia: media({
        prompt: '  Prompt média  ',
        durationSec: 8,
        aspectRatio: '9:16',
        hasAudio: true,
      }),
      defaultDemoPresentation: {
        audioBadgeLabel: 'Audio activé',
        altContext: 'demo',
      },
      referenceWorkflows,
    }),
  );

  assert.equal(result.id, 'prompting');
  assert.equal(result.demo?.prompt, 'Prompt média');
  assert.equal(result.demo?.durationLabel, '8 s');
  assert.equal(result.demo?.aspectLabel, '9:16');
  assert.equal(result.demo?.audioChipLabel, 'Audio activé');
  assert.equal(result.demo?.posterSrc, '/fixture.jpg');
  assert.equal(result.demo?.videoSrc, '/fixture.mp4');
  assert.equal(result.demo?.fullHref, '/video/job_fixture');
  assert.equal(result.tabs.exampleHref, '/video/job_fixture');
  assert.equal(result.tabs.usePromptHref, '/app?engine=fixture-engine');
  assert.deepEqual(result.tabs.notesById, { quick: 'Keep the subject explicit.' });
  assert.deepEqual(result.referenceWorkflows, referenceWorkflows);
  assert.equal(result.defaultPresentation.locale, 'fr');
  assert.equal(result.defaultPresentation.mode, 'video');
  assert.equal(result.defaultPresentation.supportsAudio, true);
  assert.equal(result.defaultPresentation.demo?.audioBadgeLabel, 'Audio activé');
  assert.equal(result.defaultPresentation.demo?.altContext, 'demo');
  assert.equal(result.defaultPresentation.demo?.promptLabel, undefined);
  assert.deepEqual(result.defaultPresentation.demo?.promptLines, []);
  assert.equal(result.defaultPresentation.demo?.media.label, 'Fixture');
  assert.equal(result.defaultPresentation.demo?.media.durationSec, 8);
  assert.equal(result.defaultPresentation.demo?.media.aspectRatio, '9:16');
  assert.equal(result.defaultPresentation.demo?.media.hasAudio, true);
});

test('editorial prompt remains the decision fallback when media is missing, disabled, or blank', () => {
  const missing = buildModelPromptingViewModel(videoInput());
  const disabled = buildModelPromptingViewModel(
    videoInput({ demoMedia: media({ prompt: 'Unused media prompt' }) }),
  );
  const blank = buildModelPromptingViewModel(
    videoInput({ demoPromptSource: 'media', demoMedia: media({ prompt: '   ' }) }),
  );

  for (const result of [missing, disabled, blank]) {
    assert.equal(result.demo?.prompt, 'Editorial fallback prompt');
  }
  assert.equal(missing.demo?.durationLabel, '8s');
  assert.equal(missing.demo?.aspectLabel, '16:9');
  assert.equal(missing.demo?.posterSrc, null);
  assert.equal(missing.demo?.videoSrc, null);
  assert.equal(missing.demo?.fullHref, null);
  assert.equal(missing.tabs.exampleHref, null);
  assert.equal(disabled.defaultPresentation.demo?.promptLabel, 'Text prompt');
  assert.deepEqual(disabled.defaultPresentation.demo?.promptLines, ['Editorial fallback prompt']);
  assert.equal(disabled.defaultPresentation.demo?.media.label, 'Fixture');
});

test('missing numeric media duration preserves the pre-cutover 8-second decision fallback', () => {
  const cases = [
    { locale: 'en' as const, demoMedia: null, expected: '8s' },
    { locale: 'fr' as const, demoMedia: media({ durationSec: null }), expected: '8 s' },
    { locale: 'es' as const, demoMedia: media({ durationSec: undefined }), expected: '8 s' },
  ];

  for (const { locale, demoMedia, expected } of cases) {
    const result = buildModelPromptingViewModel(videoInput({ locale, demoMedia }));
    assert.equal(result.demo?.durationLabel, expected, `${locale} missing-duration fallback`);
  }
});

test('image view model routes to the encoded image workspace and does not manufacture a demo', () => {
  const input = imageInput();
  input.engineId = 'fixture/image engine';
  const result = buildModelPromptingViewModel(input);

  assert.equal(result.demo, null);
  assert.equal(result.imageExamples?.workspaceHref, '/app/image?engine=fixture%2Fimage%20engine');
  assert.equal(result.tabs.usePromptHref, '/app/image?engine=fixture%2Fimage%20engine');
});

test('audio chip modes derive labels only from presentation mode and runtime audio state', () => {
  const mediaOn = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('media'), demoMedia: media({ hasAudio: true }) }),
  );
  const mediaOff = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('media'), demoMedia: media({ hasAudio: false }) }),
  );
  const supportedOn = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('supported'), supportsNativeAudio: true }),
  );
  const supportedOff = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('supported'), supportsNativeAudio: false }),
  );
  const forcedOn = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('on'), demoMedia: media({ hasAudio: false }) }),
  );
  const forcedOff = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('off'), demoMedia: media({ hasAudio: true }) }),
  );
  const silent = buildModelPromptingViewModel(
    videoInput({ content: withPresentation('silent'), demoMedia: media({ hasAudio: true }) }),
  );

  assert.equal(mediaOn.demo?.audioChipLabel, 'Audio on');
  assert.equal(mediaOff.demo?.audioChipLabel, 'Audio off');
  assert.equal(supportedOn.demo?.audioChipLabel, 'Audio on');
  assert.equal(supportedOff.demo?.audioChipLabel, 'Audio off');
  assert.equal(forcedOn.demo?.audioChipLabel, 'Audio on');
  assert.equal(forcedOff.demo?.audioChipLabel, 'Audio off');
  assert.equal(silent.demo?.audioChipLabel, 'Silent');
});

test('presentation overrides win over runtime duration, aspect ratio, and audio labels', () => {
  const result = buildModelPromptingViewModel(
    videoInput({
      content: withPresentation('media', {
        duration: '10 secondes',
        aspectRatio: '1:1',
        audioChipLabel: 'Son natif',
      }),
      locale: 'fr',
      demoMedia: media({ durationSec: 6, aspectRatio: '9:16', hasAudio: false }),
    }),
  );

  assert.equal(result.demo?.durationLabel, '10 secondes');
  assert.equal(result.demo?.aspectLabel, '1:1');
  assert.equal(result.demo?.audioChipLabel, 'Son natif');
  assert.equal(result.demo?.modeLabel, 'Text-to-video');
  assert.equal(result.demo?.outputLabel, 'Audio');
  assert.equal(result.demo?.alt, 'Fixture render');
});

test('building the view model does not mutate frozen editorial or runtime inputs', () => {
  const input = deepFreeze(
    videoInput({
      demoPromptSource: 'media',
      defaultDemoPromptSource: 'media',
      demoMedia: media({ prompt: 'Runtime prompt', hasAudio: true }),
      referenceWorkflows: [{ title: 'Reference', body: 'Keep identity stable.' }],
    }),
  );
  const before = structuredClone(input);

  const result = buildModelPromptingViewModel(input);

  assert.deepEqual(input, before);
  assert.equal(result.demo?.prompt, 'Runtime prompt');
  assert.deepEqual(result.tabs.notesById, { quick: 'Keep the subject explicit.' });
});
