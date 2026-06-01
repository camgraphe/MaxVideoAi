import assert from 'node:assert/strict';
import test from 'node:test';

import type { VideoSeoEditorialEntry } from '../frontend/config/video-seo-editorial.ts';
import type { SeoWatchVideoConfig } from '../frontend/config/video-seo-watchlist.ts';
import { validateVideoSeoEditorialEntry } from '../frontend/lib/video-seo-editorial-qa.ts';
import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals';
import type { GalleryVideo } from '../frontend/server/videos-normalization';

const storyboardShortDescription =
  'This Seedance 2.0 storyboard-to-video example uses a visual reference storyboard to generate a short 3D animated sequence with multi-prompt scene structure, native audio and dialogue. Use it as a reference for AI animation workflows that need stronger visual continuity than a single text prompt, including character action, cinematic staging, scene progression and animated storytelling.';

const storyboardPromptBreakdown =
  'This storyboard-to-video workflow uses a visual reference storyboard as the main creative input. Instead of relying on a long text prompt alone, the reference frames define the animated characters, scene style, action beats and visual continuity. Seedance 2.0 then turns the storyboard into a short 3D animated sequence with multi-prompt scene progression, cinematic camera movement, native audio and dialogue. The result demonstrates how visual planning can guide an AI video model toward a more structured animated scene than a single text-to-video prompt.';

const storyboardEditorial: VideoSeoEditorialEntry = {
  id: 'job_visual_storyboard',
  seoStatus: 'approved',
  seoTitle: 'Seedance 2.0 Storyboard-to-Video Example',
  metaDescription:
    'Watch a Seedance 2.0 storyboard-to-video animation example with multi-prompt 3D scenes, native audio, dialogue and cinematic action.',
  h1: 'Seedance 2.0 storyboard-to-video 3D animation example',
  videoObjectName: 'Seedance 2.0 storyboard-to-video 3D animation example',
  shortDescription: storyboardShortDescription,
  editorialPromptBreakdown: storyboardPromptBreakdown,
  targetKeyword: 'Seedance 2.0 storyboard to video example',
  intent: 'image-to-video',
  modelSlug: 'seedance-2-0',
  examplesSlug: 'seedance',
  showSourceImages: true,
};

const storyboardEntry: SeoWatchVideoConfig = {
  id: storyboardEditorial.id,
  engineSlug: 'seedance-2-0',
  engineFamily: 'seedance',
  engineLabel: 'Seedance 2.0',
  sourceType: 'examples',
  sourcePath: '/examples/seedance',
  sourceLabel: 'Examples hero - Seedance',
  seoTitle: 'Seedance storyboard candidate',
  intro: 'Seedance storyboard candidate.',
  reasonForSelection: 'Visual prompt exception fixture.',
  priority: 1,
  publishedAt: '2026-05-30T08:00:00.000Z',
  videoPrimaryIntent: 'image-to-video',
  exampleFamily: 'seedance',
};

const visualQaContext = {
  promptText: 'Follow the storyboard.',
  isVisualReferenceWorkflow: true,
  hasVisualReferenceAsset: true,
  hasAudio: true,
  hasMultiShot: true,
  hasVideoAsset: true,
  hasThumbnailAsset: true,
  hasStableVideoAsset: true,
  hasStableThumbnailAsset: true,
  hasInternalLinkTargets: true,
  canonicalUrl: 'https://maxvideoai.com/video/job_visual_storyboard',
  expectedCanonicalUrl: 'https://maxvideoai.com/video/job_visual_storyboard',
  canonicalTargetIndexable: true,
  technicallyIndexable: true,
  duplicateVideoObjectNames: new Set<string>(),
};

function buildVideo(overrides: Partial<GalleryVideo> = {}): GalleryVideo {
  return {
    id: storyboardEditorial.id,
    userId: 'user_storyboard',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    durationSec: 5,
    prompt: 'Follow the storyboard.',
    promptExcerpt: 'Follow the storyboard.',
    thumbUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/thumb.jpg',
    videoUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/video.mp4',
    aspectRatio: '16:9',
    createdAt: '2026-05-30T08:00:00.000Z',
    visibility: 'public',
    indexable: true,
    hasAudio: true,
    canUpscale: false,
    settingsSnapshot: {
      surface: 'video',
      inputMode: 'i2v',
      engineId: 'seedance-2-0',
      engineLabel: 'Seedance 2.0',
      prompt: 'Follow the storyboard.',
      core: {
        durationSec: 5,
        aspectRatio: '16:9',
        resolution: '1080p',
        audio: true,
      },
      advanced: {
        multiPrompt: [{ prompt: 'Scene one' }, { prompt: 'Scene two' }],
      },
      refs: {
        imageUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/first.png',
        firstFrameUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/first.png',
        lastFrameUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/last.png',
        endImageUrl: 'https://media.maxvideoai.com/renders/job_visual_storyboard/end.png',
        referenceImages: [
          'https://media.maxvideoai.com/renders/job_visual_storyboard/storyboard-1.png',
          'https://media.maxvideoai.com/renders/job_visual_storyboard/storyboard-2.png?X-Amz-Signature=temp',
        ],
      },
    },
    ...overrides,
  };
}

test('short text-to-video prompts still fail video SEO QA', () => {
  const qa = validateVideoSeoEditorialEntry(
    {
      ...storyboardEditorial,
      id: 'job_short_text',
      intent: 'prompt-example',
      modelSlug: 'sora-2',
      examplesSlug: 'sora',
      editorialPromptBreakdown: '',
    },
    {
      ...visualQaContext,
      promptText: 'Animate this.',
      isVisualReferenceWorkflow: false,
      hasVisualReferenceAsset: false,
      hasAudio: false,
      hasMultiShot: false,
      canonicalUrl: 'https://maxvideoai.com/video/job_short_text',
      expectedCanonicalUrl: 'https://maxvideoai.com/video/job_short_text',
    }
  );

  assert.equal(qa.passed, false);
  assert.match(qa.errors.join(' '), /Prompt is too short for video SEO/);
});

test('approved visual workflows can pass QA with short prompts and rich editorial context', () => {
  const qa = validateVideoSeoEditorialEntry(storyboardEditorial, visualQaContext);

  assert.equal(qa.passed, true, qa.errors.join(' '));
});

test('visual short prompt exception requires the editorial context signals', () => {
  const qa = validateVideoSeoEditorialEntry(
    { ...storyboardEditorial, editorialPromptBreakdown: 'Follow the image.' },
    visualQaContext
  );

  assert.equal(qa.passed, false);
  assert.match(qa.errors.join(' '), /Visual prompt SEO context must be at least 80 words/);
});

test('watch signals use editorial prompt context and stable opted-in source images', () => {
  const signals = deriveWatchPageSignals({
    entry: storyboardEntry,
    video: buildVideo(),
    editorial: storyboardEditorial,
    duplicateVideoObjectNames: new Set<string>(),
  });

  assert.equal(signals.indexable, true, signals.auditNotes.join(' '));
  assert.equal(signals.promptText, 'Follow the storyboard.');
  assert.equal(signals.seoPromptContext, storyboardPromptBreakdown);
  assert.deepEqual(signals.editorialQaErrors, []);
  assert.equal(signals.sourceImages.length, 4);
  assert.ok(signals.sourceImages.some((image) => image.label === 'Storyboard frame 1'));
  assert.ok(signals.sourceImages.every((image) => !image.url.includes('X-Amz-Signature')));
});

test('source images stay hidden without explicit editorial permission', () => {
  const signals = deriveWatchPageSignals({
    entry: storyboardEntry,
    video: buildVideo(),
    editorial: { ...storyboardEditorial, showSourceImages: false },
    duplicateVideoObjectNames: new Set<string>(),
  });

  assert.equal(signals.indexable, true, signals.auditNotes.join(' '));
  assert.deepEqual(signals.sourceImages, []);
});
