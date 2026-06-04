import assert from 'node:assert/strict';
import test from 'node:test';
import type { EngineCaps } from '../frontend/types/engines';

const baseEngine: Omit<EngineCaps, 'id' | 'label' | 'provider'> = {
  status: 'live',
  latencyTier: 'standard',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['auto', '16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: { imageMaxMB: 30 },
  updatedAt: '2026-06-04',
  ttlSec: 600,
  availability: 'available',
  modeCaps: {
    t2v: {
      modes: ['t2v'],
      duration: { options: ['auto', 4, 6, 10, 15], default: 'auto' },
      resolution: ['480p', '720p', '1080p'],
      aspectRatio: ['auto', '16:9', '9:16'],
      audioToggle: true,
    },
    ref2v: {
      modes: ['ref2v'],
      duration: { options: ['auto', 4, 6, 10, 15], default: 'auto' },
      resolution: ['480p', '720p', '1080p'],
      aspectRatio: ['auto', '16:9', '9:16'],
      audioToggle: true,
    },
  },
};

const engines: EngineCaps[] = [
  {
    ...baseEngine,
    id: 'seedance-2-0',
    label: 'Seedance 2.0',
    provider: 'ByteDance',
  },
  {
    ...baseEngine,
    id: 'kling-o3-pro',
    label: 'Kling O3 Pro',
    provider: 'Kuaishou',
    modes: ['t2v', 'i2v', 'ref2v'],
  },
];

test('storyboard generator handoff sends the board as a reference image for video generation', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');

  assert.equal(module.STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY, 'maxvideoai.storyboard.generatorHandoff.v1');

  const seedanceHandoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'seedance',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    thumbUrl: 'https://cdn.example.com/storyboard-thumb.png',
    jobId: 'job_storyboard',
    subject: 'Premium coffee bag beside a ceramic cup',
    action: 'Reveal packaging, pour coffee',
    dialogue: 'Voiceover: Fresh roast, ready for the morning.',
    durationSec: 10,
    frameCount: 6,
    orientation: 'landscape',
    width: 4096,
    height: 2304,
  });

  assert.equal(seedanceHandoff.engineId, 'seedance-2-0');
  assert.equal(seedanceHandoff.mode, 'ref2v');
  assert.equal(seedanceHandoff.referenceFieldId, 'image_urls');
  assert.equal(seedanceHandoff.aspectRatio, '16:9');
  assert.equal(seedanceHandoff.durationSec, 10);
  assert.equal(seedanceHandoff.audioEnabled, true);
  assert.match(seedanceHandoff.prompt, /Follow the uploaded storyboard reference image/);
  assert.match(seedanceHandoff.prompt, /shot order/);
  assert.match(seedanceHandoff.prompt, /dialogue timing/);
  assert.match(seedanceHandoff.prompt, /Do not reproduce storyboard labels/);

  const klingHandoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'kling',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    durationSec: 15,
    frameCount: 8,
    orientation: 'portrait',
  });

  assert.equal(klingHandoff.engineId, 'kling-o3-pro');
  assert.equal(klingHandoff.referenceFieldId, 'image_urls');
  assert.equal(klingHandoff.aspectRatio, '9:16');
  assert.equal(klingHandoff.audioEnabled, true);
  assert.match(klingHandoff.prompt, /Use @Image1 as the storyboard reference and shot plan/);
  assert.match(klingHandoff.prompt, /Use the storyboard shot plan as text direction/);
  assert.match(klingHandoff.prompt, /Start the video with a clean full-screen shot/);
  assert.equal(module.buildStoryboardGeneratorHandoffUrl(klingHandoff), '/app?engine=kling-o3-pro&mode=ref2v&storyboard=1');
});

test('video workspace converts storyboard handoff into form state and input assets', async () => {
  const handoffModule = await import('../frontend/lib/storyboard-generator-handoff.ts');
  const workspaceModule = await import(
    '../frontend/app/(core)/(workspace)/app/_lib/workspace-storyboard-handoff.ts'
  );

  const handoff = handoffModule.buildStoryboardGeneratorHandoff({
    targetModel: 'seedance',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    thumbUrl: 'https://cdn.example.com/storyboard-thumb.png',
    jobId: 'job_storyboard',
    subject: 'Premium coffee bag',
    durationSec: 10,
    frameCount: 6,
    orientation: 'landscape',
    width: 4096,
    height: 2304,
  });
  const state = workspaceModule.buildWorkspaceStoryboardHandoffState(handoff, engines, null);

  assert.equal(state.form.engineId, 'seedance-2-0');
  assert.equal(state.form.mode, 'ref2v');
  assert.equal(state.form.durationSec, 10);
  assert.equal(state.form.durationOption, 10);
  assert.equal(state.form.aspectRatio, '16:9');
  assert.equal(state.form.audio, false);
  assert.equal(state.prompt, handoff.prompt);
  assert.deepEqual(Object.keys(state.inputAssets), ['image_urls']);
  assert.equal(state.inputAssets.image_urls?.[0]?.url, 'https://cdn.example.com/storyboard.png');
  assert.equal(state.inputAssets.image_urls?.[0]?.previewUrl, 'https://cdn.example.com/storyboard-thumb.png');
  assert.equal(state.inputAssets.image_urls?.[0]?.assetId, 'job_storyboard');
  assert.equal(state.inputAssets.image_urls?.[0]?.width, 4096);
  assert.equal(state.inputAssets.image_urls?.[0]?.height, 2304);
});

test('kling storyboard handoff applies a clean first frame plus the board reference', async () => {
  const handoffModule = await import('../frontend/lib/storyboard-generator-handoff.ts');
  const workspaceModule = await import(
    '../frontend/app/(core)/(workspace)/app/_lib/workspace-storyboard-handoff.ts'
  );

  const handoff = handoffModule.buildStoryboardGeneratorHandoff({
    targetModel: 'kling',
    imageUrl: 'https://cdn.example.com/storyboard-board.png',
    thumbUrl: 'https://cdn.example.com/storyboard-board-thumb.png',
    jobId: 'job_storyboard',
    startFrameImageUrl: 'https://cdn.example.com/storyboard-first-frame.png',
    startFrameThumbUrl: 'https://cdn.example.com/storyboard-first-frame-thumb.png',
    startFrameJobId: 'job_storyboard_first_frame',
    subject: 'Realistic UGC creator presenting a soda can',
    action: 'Walk toward camera, lift the can, reaction close-up',
    dialogue: 'Talent: This is cold and loud.',
    durationSec: 10,
    frameCount: 6,
    orientation: 'portrait',
  });
  const state = workspaceModule.buildWorkspaceStoryboardHandoffState(handoff, engines, null);

  assert.equal(handoff.engineId, 'kling-o3-pro');
  assert.equal(handoff.mode, 'ref2v');
  assert.equal(handoff.referenceFieldId, 'image_urls');
  assert.equal(handoff.imageUrl, 'https://cdn.example.com/storyboard-board.png');
  assert.equal(handoff.startFrameFieldId, 'start_image_url');
  assert.equal(handoff.startFrameImageUrl, 'https://cdn.example.com/storyboard-first-frame.png');
  assert.match(handoff.prompt, /Use @Image1 as the storyboard reference and shot plan/);
  assert.match(handoff.prompt, /Start from the attached clean first frame/);
  assert.doesNotMatch(handoff.prompt, /No storyboard board image is attached/);
  assert.equal(handoffModule.buildStoryboardGeneratorHandoffUrl(handoff), '/app?engine=kling-o3-pro&mode=ref2v&storyboard=1');
  assert.equal(state.form.engineId, 'kling-o3-pro');
  assert.equal(state.form.mode, 'ref2v');
  assert.equal(state.form.audio, true);
  assert.deepEqual(Object.keys(state.inputAssets).sort(), ['image_urls', 'start_image_url']);
  assert.equal(state.inputAssets.image_urls?.[0]?.url, 'https://cdn.example.com/storyboard-board.png');
  assert.equal(state.inputAssets.image_urls?.[0]?.assetId, 'job_storyboard');
  assert.equal(state.inputAssets.start_image_url?.[0]?.url, 'https://cdn.example.com/storyboard-first-frame.png');
  assert.equal(state.inputAssets.start_image_url?.[0]?.assetId, 'job_storyboard_first_frame');
});

test('storyboard generator handoff falls back from Fal media outputs to stable thumbnails', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');

  const handoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'seedance',
    imageUrl: 'https://v3b.fal.media/files/b/provider-storyboard.png',
    thumbUrl: 'https://media.maxvideoai.com/renders/thumbs/user/storyboard.webp',
    durationSec: 10,
    frameCount: 6,
    orientation: 'landscape',
  });

  assert.equal(handoff.imageUrl, 'https://media.maxvideoai.com/renders/thumbs/user/storyboard.webp');
  assert.equal(handoff.thumbUrl, 'https://media.maxvideoai.com/renders/thumbs/user/storyboard.webp');
});

test('storyboard generator handoff keeps the video prompt inside the generator character limit', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');
  const longSubject = Array.from({ length: 80 }, (_, index) => `Subject detail ${index + 1}: same presenter, bottle, room, wardrobe, lighting, product label, and social video mood.`).join(' ');
  const longAction = Array.from({ length: 90 }, (_, index) => `Action beat ${index + 1}: keep a continuous handheld move, preserve the storyboard order, and avoid turning the panels into visible captions.`).join(' ');
  const longDialogue = Array.from({ length: 60 }, (_, index) => `Presenter: line ${index + 1} with energetic direct-to-camera product timing.`).join('\n');

  const handoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'seedance',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    subject: longSubject,
    action: longAction,
    dialogue: longDialogue,
    durationSec: 10,
    frameCount: 6,
    orientation: 'portrait',
  });

  assert.ok(handoff.prompt.length <= 2500, `expected video prompt <= 2500 chars, got ${handoff.prompt.length}`);
  assert.match(handoff.prompt, /Follow the uploaded storyboard reference image/);
  assert.match(handoff.prompt, /Subject summary:/);
  assert.match(handoff.prompt, /Action summary:/);
  assert.match(handoff.prompt, /Dialogue\/audio summary:/);
});

test('storyboard recent output prompt metadata restores target model and dialogue for generator handoff', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');
  const jobPrompt = [
    'Create one storyboard reference image for a 10s AI video.',
    'Format: Portrait 9:16 video storyboard. Compose each panel thumbnail as a vertical 9:16 frame.',
    'Use 6 clearly separated panels with consistent continuity across the board.',
    'Subject: Funny vertical UGC soda ad with an exaggerated Miami glam influencer.',
    'Action: One continuous vertical UGC plan-sequence with a handheld reveal.',
    'Dialogue/audio direction: Spoken in English, direct-to-camera UGC style. Talent: It is cold, loud, and way too good. Use this to plan dialogue timing, emotion, expression, gesture performance, reaction beats, and audio pacing.',
    'Target: Kling. Use generic non-famous people when human scenes are requested, with no famous-person resemblance.',
  ].join('\n');

  const draft = module.extractStoryboardGeneratorDraftFromPrompt(jobPrompt, {
    durationSec: 10,
    aspectRatio: '9:16',
  });

  assert.deepEqual(draft, {
    targetModel: 'kling',
    subject: 'Funny vertical UGC soda ad with an exaggerated Miami glam influencer',
    action: 'One continuous vertical UGC plan-sequence with a handheld reveal',
    dialogue:
      'Spoken in English, direct-to-camera UGC style. Talent: It is cold, loud, and way too good',
    durationSec: 10,
    frameCount: 6,
    orientation: 'portrait',
    audioEnabled: true,
  });

  const handoff = module.buildStoryboardGeneratorHandoff({
    targetModel: draft.targetModel ?? 'seedance',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    subject: draft.subject,
    action: draft.action,
    dialogue: draft.dialogue,
    durationSec: draft.durationSec ?? 6,
    frameCount: draft.frameCount ?? 4,
    orientation: draft.orientation ?? 'landscape',
  });

  assert.equal(handoff.engineId, 'kling-o3-pro');
  assert.equal(handoff.audioEnabled, true);
  assert.equal(handoff.aspectRatio, '9:16');
  assert.match(handoff.prompt, /Target model: Kling/);
  assert.match(handoff.prompt, /Dialogue\/audio summary: Spoken in English/);
});

test('storyboard generator handoff leaves audio off for explicit silent boards', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');

  const handoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'seedance',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    dialogue: 'No dialogue. No voiceover. Silent product motion only.',
    durationSec: 6,
    frameCount: 4,
    orientation: 'landscape',
  });

  assert.equal(handoff.audioEnabled, false);
});

test('storyboard generator handoff keeps audio on for spoken dialogue even when voiceover is excluded', async () => {
  const module = await import('../frontend/lib/storyboard-generator-handoff.ts');

  const handoff = module.buildStoryboardGeneratorHandoff({
    targetModel: 'kling',
    imageUrl: 'https://cdn.example.com/storyboard.png',
    dialogue:
      'Spoken in English, direct-to-camera UGC style. No voiceover. She talks while walking toward the camera.',
    durationSec: 10,
    frameCount: 6,
    orientation: 'portrait',
  });

  assert.equal(handoff.audioEnabled, true);
});
