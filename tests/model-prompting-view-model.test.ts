import assert from 'node:assert/strict';
import test from 'node:test';

import type { FeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import type { ModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import {
  buildModelPromptingViewModel,
  type BuildModelPromptingViewModelInput,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts';

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
    isImageEngine: false,
    supportsNativeAudio: false,
    useDemoMediaPrompt: false,
    demoMedia: null,
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
    isImageEngine: true,
    supportsNativeAudio: false,
    useDemoMediaPrompt: false,
    demoMedia: null,
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

test('video view model prefers the selected media prompt and derives localized media labels', () => {
  const referenceWorkflows = [{ title: 'Image de référence', body: 'Verrouille le sujet.' }];
  const result = buildModelPromptingViewModel(
    videoInput({
      locale: 'fr',
      supportsNativeAudio: true,
      useDemoMediaPrompt: true,
      demoMedia: media({
        prompt: '  Prompt média  ',
        durationSec: 8,
        aspectRatio: '9:16',
        hasAudio: true,
      }),
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
});

test('editorial prompt remains the fallback when media is missing, disabled, or blank', () => {
  const missing = buildModelPromptingViewModel(videoInput());
  const disabled = buildModelPromptingViewModel(
    videoInput({ demoMedia: media({ prompt: 'Unused media prompt' }) }),
  );
  const blank = buildModelPromptingViewModel(
    videoInput({ useDemoMediaPrompt: true, demoMedia: media({ prompt: '   ' }) }),
  );

  for (const result of [missing, disabled, blank]) {
    assert.equal(result.demo?.prompt, 'Editorial fallback prompt');
  }
  assert.equal(missing.demo?.durationLabel, '12s');
  assert.equal(missing.demo?.aspectLabel, '16:9');
  assert.equal(missing.demo?.posterSrc, null);
  assert.equal(missing.demo?.videoSrc, null);
  assert.equal(missing.demo?.fullHref, null);
  assert.equal(missing.tabs.exampleHref, null);
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
      useDemoMediaPrompt: true,
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
