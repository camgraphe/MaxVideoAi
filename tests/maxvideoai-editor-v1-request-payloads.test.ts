import assert from 'node:assert/strict';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { getWorkspaceModelCapability } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { buildWorkspaceShotGenerateRequest } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import {
  audioPackForWorkflow,
  buildWorkspaceAudioGenerationRequest,
  buildWorkspaceStoryboardGenerationRequest,
  resolveWorkspaceGenerationRoute,
  upscaleEngineIdForStudioModel,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing';
import { WORKSPACE_V1_BLOCK_MATRIX } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix';
import {
  buildWorkspaceAngleToolRequest,
  buildWorkspaceAudioGenerateRequest,
  buildWorkspaceCharacterBuilderRequest,
  buildWorkspaceChatApiRequest,
  buildWorkspaceImageGenerationRequest,
  buildWorkspaceUpscaleToolRequest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests';
import { resolveWorkspaceBlockPolicy } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import type {
  WorkspaceChatSettings,
  WorkspaceGenerationPresetId,
  WorkspaceShotSettings,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

function shot(presetId: WorkspaceGenerationPresetId): WorkspaceShotSettings {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot, `${presetId} should provide default shot settings`);
  return preset.defaultShot;
}

function capabilityFor(settings: WorkspaceShotSettings) {
  const capability = getWorkspaceModelCapability(settings.modelId);
  assert.ok(capability, `${settings.modelId} should resolve to a model capability`);
  return capability;
}

const V1_PAYLOAD_PRESET_IDS = [
  'generate-video',
  'modify-video',
  'generate-image',
  'modify-image',
  'audio-music',
  'audio-voiceover',
  'audio-sfx',
  'audio-sound-design',
  'audio-sound-design-voice',
  'angle',
  'character-builder',
  'storyboard',
  'upscale-image',
  'upscale-video',
  'chat-box',
] as const satisfies readonly WorkspaceGenerationPresetId[];

test('every V1 block matrix preset has a payload coverage case', () => {
  assert.deepEqual(
    Object.keys(WORKSPACE_V1_BLOCK_MATRIX).sort(),
    [...V1_PAYLOAD_PRESET_IDS].sort()
  );
});

test('V1 block presets resolve to their dedicated generation routes', () => {
  assert.equal(resolveWorkspaceGenerationRoute(shot('generate-video')), 'video');
  assert.equal(resolveWorkspaceGenerationRoute(shot('modify-video')), 'video');
  assert.equal(resolveWorkspaceGenerationRoute(shot('generate-image')), 'image');
  assert.equal(resolveWorkspaceGenerationRoute(shot('modify-image')), 'image');
  assert.equal(resolveWorkspaceGenerationRoute(shot('audio-music')), 'audio');
  assert.equal(resolveWorkspaceGenerationRoute(shot('audio-sound-design')), 'audio');
  assert.equal(resolveWorkspaceGenerationRoute(shot('angle')), 'angle');
  assert.equal(resolveWorkspaceGenerationRoute(shot('character-builder')), 'character-builder');
  assert.equal(resolveWorkspaceGenerationRoute(shot('storyboard')), 'storyboard');
  assert.equal(resolveWorkspaceGenerationRoute(shot('upscale-image')), 'upscale');
  assert.equal(resolveWorkspaceGenerationRoute(shot('upscale-video')), 'upscale');
  assert.equal(resolveWorkspaceGenerationRoute({ ...shot('generate-video'), family: 'chat' }), 'unsupported');
});

test('video generation request preserves mode, render controls, and connected media', () => {
  const settings = {
    ...shot('generate-video'),
    durationSec: 7,
    aspectRatio: '9:16' as const,
    resolution: '4k' as const,
    fps: 30,
    seed: 42,
    audioEnabled: true,
  };
  const request = buildWorkspaceShotGenerateRequest({
    settings,
    capability: capabilityFor(settings),
    prompt: 'A product hero shot on a rotating glass plinth.',
    connectedInputs: ['prompt', 'start_image', 'video_reference', 'audio'],
    referenceImages: [
      'https://example.com/product.png',
      'https://example.com/style.png',
    ],
    startImageUrl: 'https://example.com/product.png',
    videoReferences: ['https://example.com/motion.mp4'],
    audioReferences: ['https://example.com/music.mp3'],
    shotNodeId: 'shot-video',
    outputName: 'Product hero',
  });

  assert.equal(request.engineId, 'seedance-2-0');
  assert.equal(request.mode, 'i2v');
  assert.equal(request.prompt, 'A product hero shot on a rotating glass plinth.');
  assert.equal(request.durationSec, 7);
  assert.equal(request.aspectRatio, '9:16');
  assert.equal(request.resolution, '4k');
  assert.equal(request.fps, 30);
  assert.equal(request.seed, 42);
  assert.equal(request.audio, true);
  assert.equal(request.imageUrl, 'https://example.com/product.png');
  assert.deepEqual(request.referenceImages, [
    'https://example.com/product.png',
    'https://example.com/style.png',
  ]);
  assert.equal(request.audioUrl, 'https://example.com/music.mp3');
  assert.deepEqual(request.inputs?.map((input) => [input.kind, input.url]), [
    ['video', 'https://example.com/motion.mp4'],
    ['audio', 'https://example.com/music.mp3'],
  ]);
});

test('image generation request stays text-only and preserves selected controls', () => {
  const settings = {
    ...shot('generate-image'),
    aspectRatio: '9:16' as const,
    resolution: '4k' as const,
    seed: 19,
  };
  const request = buildWorkspaceImageGenerationRequest({
    settings,
    prompt: 'A premium skincare product on reflective blue glass.',
    referenceImages: [],
    policy: resolveWorkspaceBlockPolicy({
      settings,
      capability: capabilityFor(settings),
      connectedInputs: ['prompt'],
    }),
  });

  assert.equal(request.mode, 't2i');
  assert.equal(request.engineId, 'seedream');
  assert.equal(request.aspectRatio, '9:16');
  assert.equal(request.resolution, '4k');
  assert.equal(request.seed, 19);
  assert.equal(request.imageUrls, undefined);
});

test('modify video request keeps the source video on the V1 video route', () => {
  const settings = shot('modify-video');
  const request = buildWorkspaceShotGenerateRequest({
    settings,
    capability: capabilityFor(settings),
    prompt: 'Make the lighting more cinematic while preserving the subject.',
    connectedInputs: ['prompt', 'video_reference'],
    referenceImages: [],
    videoReferences: ['https://example.com/source.mp4'],
    audioReferences: [],
    shotNodeId: 'shot-modify',
    outputName: 'Modified shot',
  });

  assert.equal(request.engineId, 'luma-ray-3-2');
  assert.equal(request.mode, 'v2v');
  assert.equal(request.imageUrl, undefined);
  assert.deepEqual(request.inputs?.map((input) => [input.kind, input.url]), [
    ['video', 'https://example.com/source.mp4'],
  ]);
});

test('image modify request uses source images and policy-supported controls', () => {
  const settings = { ...shot('modify-image'), aspectRatio: '1:1' as const, resolution: '1080p' as const };
  const request = buildWorkspaceImageGenerationRequest({
    settings,
    prompt: 'Change the jacket to red.',
    referenceImages: ['https://example.com/person.png'],
    policy: resolveWorkspaceBlockPolicy({
      settings,
      capability: capabilityFor(settings),
      connectedInputs: ['prompt', 'reference'],
    }),
  });

  assert.equal(request.mode, 'i2i');
  assert.equal(request.engineId, 'seedream');
  assert.equal(request.aspectRatio, '1:1');
  assert.equal(request.resolution, '1080p');
  assert.deepEqual(request.imageUrls, ['https://example.com/person.png']);
});

test('music-only audio route excludes a connected source video', () => {
  const music = shot('audio-music');
  const musicRequest = buildWorkspaceAudioGenerationRequest({
    settings: music,
    prompt: 'Minimal electronic score with a clean final resolve.',
    videoReferences: ['https://example.com/ignored-source.mp4'],
  });
  assert.equal(musicRequest.pack, 'music_only');
  assert.equal(musicRequest.sourceVideoUrl, undefined);
});

test('voiceover audio payload includes script and voice controls', () => {
  const settings = {
    ...shot('audio-voiceover'),
    toolSettings: {
      audio: {
        voiceGender: 'female' as const,
        voiceProfile: 'narrator' as const,
        voiceDelivery: 'warm' as const,
        language: 'french' as const,
      },
    },
  };
  const request = buildWorkspaceAudioGenerateRequest({
    settings,
    pack: audioPackForWorkflow(settings.workflowType),
    prompt: 'Une narration chaleureuse pour le lancement du produit.',
    sourceVideoUrl: 'https://example.com/ignored-source.mp4',
  });

  assert.equal(request.pack, 'voice_only');
  assert.equal(request.sourceVideoUrl, undefined);
  assert.equal(request.script, 'Une narration chaleureuse pour le lancement du produit.');
  assert.equal(request.voiceGender, 'female');
  assert.equal(request.voiceProfile, 'narrator');
  assert.equal(request.voiceDelivery, 'warm');
  assert.equal(request.language, 'french');
});

test('SFX audio payload uses the standalone SFX pack', () => {
  const request = buildWorkspaceAudioGenerateRequest({
    settings: shot('audio-sfx'),
    pack: audioPackForWorkflow(shot('audio-sfx').workflowType),
    prompt: 'A crisp camera shutter with a subtle mechanical tail.',
    sourceVideoUrl: 'https://example.com/ignored-source.mp4',
  });

  assert.equal(request.pack, 'sfx_only');
  assert.equal(request.sourceVideoUrl, undefined);
  assert.equal(request.prompt, 'A crisp camera shutter with a subtle mechanical tail.');
});

test('sound design audio payload preserves its required source video', () => {
  const soundDesign = shot('audio-sound-design');
  const soundDesignRequest = buildWorkspaceAudioGenerateRequest({
    settings: soundDesign,
    pack: audioPackForWorkflow(soundDesign.workflowType),
    prompt: 'Layer natural city ambience with a cinematic transition.',
    sourceVideoUrl: 'https://example.com/source.mp4',
  });
  assert.equal(soundDesignRequest.pack, 'cinematic');
  assert.equal(soundDesignRequest.sourceVideoUrl, 'https://example.com/source.mp4');
});

test('sound design voice payload preserves source video, narration, and music toggle', () => {
  const settings = {
    ...shot('audio-sound-design-voice'),
    toolSettings: {
      audio: {
        mood: 'tense' as const,
        intensity: 'intense' as const,
        musicEnabled: false,
        voiceGender: 'male' as const,
        voiceProfile: 'narrator' as const,
        voiceDelivery: 'dramatic' as const,
        language: 'english' as const,
      },
    },
  };
  const request = buildWorkspaceAudioGenerateRequest({
    settings,
    pack: audioPackForWorkflow(settings.workflowType),
    prompt: 'A dramatic product reveal with a confident voice-over.',
    sourceVideoUrl: 'https://example.com/source.mp4',
  });

  assert.equal(request.pack, 'cinematic_voice');
  assert.equal(request.sourceVideoUrl, 'https://example.com/source.mp4');
  assert.equal(request.script, 'A dramatic product reveal with a confident voice-over.');
  assert.equal(request.musicEnabled, false);
  assert.equal(request.voiceGender, 'male');
  assert.equal(request.voiceProfile, 'narrator');
  assert.equal(request.voiceDelivery, 'dramatic');
  assert.equal(request.language, 'english');
});

test('angle request preserves camera controls and safe mode', () => {
  const settings = {
    ...shot('angle'),
    toolSettings: {
      angle: {
        rotation: 125,
        tilt: -12,
        zoom: 1.4,
        safeMode: false,
        generateBestAngles: true,
      },
    },
  };
  const request = buildWorkspaceAngleToolRequest({
    settings,
    imageUrl: 'https://example.com/product.png',
  });

  assert.equal(request.engineId, 'flux-multiple-angles');
  assert.deepEqual(request.params, { rotation: 125, tilt: -12, zoom: 1.4 });
  assert.equal(request.safeMode, false);
  assert.equal(request.generateBestAngles, true);
});

test('character builder request includes traits and reference image roles', () => {
  const base = shot('character-builder');
  assert.ok(base.toolSettings?.characterBuilder);
  const request = buildWorkspaceCharacterBuilderRequest({
    settings: {
      ...base,
      toolSettings: {
        characterBuilder: {
          ...base.toolSettings.characterBuilder,
          traits: {
            ...base.toolSettings.characterBuilder.traits,
            realismStyle: 'cinematic',
          },
        },
      },
    },
    prompt: 'Keep the signature red jacket visible.',
    identityImageUrls: ['https://example.com/identity.png'],
    styleImageUrls: ['https://example.com/style.png'],
    jobId: 'character-test',
  });

  assert.equal(request.jobId, 'character-test');
  assert.equal(request.traits.realismStyle, 'cinematic');
  assert.deepEqual(request.referenceImages.map((image) => [image.url, image.role]), [
    ['https://example.com/identity.png', 'identity'],
    ['https://example.com/style.png', 'style'],
  ]);
  assert.match(request.advancedNotes ?? '', /signature red jacket/);
});

test('storyboard request includes the template, prompt, and selected output configuration', () => {
  const settings = {
    ...shot('storyboard'),
    toolSettings: {
      storyboard: {
        targetModel: 'kling' as const,
        lengthPreset: 'short' as const,
        frameCount: 4 as const,
        durationSec: 6 as const,
        orientation: 'portrait' as const,
        tier: 'ultra' as const,
      },
    },
  };
  const request = buildWorkspaceStoryboardGenerationRequest({
    settings,
    prompt: 'A dancer moves through a rain-soaked neon alley.',
    referenceImages: ['https://example.com/dancer.png'],
    origin: 'https://studio.example.com',
    jobId: 'storyboard-test',
  });

  assert.equal(request.jobId, 'storyboard-test');
  assert.equal(request.engineId, 'gpt-image-2');
  assert.equal(request.mode, 'i2i');
  assert.equal(request.source, 'storyboard');
  assert.equal(request.resolution, 'custom');
  assert.deepEqual(request.customImageSize, { width: 2160, height: 3840 });
  assert.equal(request.quality, 'high');
  assert.deepEqual(request.imageUrls, [
    'https://studio.example.com/storyboard/templates/storyboard-template-portrait-4.png',
    'https://example.com/dancer.png',
  ]);
  assert.match(request.prompt, /6s AI video/);
  assert.match(request.prompt, /Use 4 clearly separated panels/);
  assert.equal(request.metadata?.storyboard?.targetModel, 'kling');
});

test('upscale requests keep source media type and target resolution', () => {
  const imageSettings = { ...shot('upscale-image'), resolution: '1440p' as const };
  const imageRequest = buildWorkspaceUpscaleToolRequest({
    settings: imageSettings,
    mediaType: 'image',
    mediaUrl: 'https://example.com/source.png',
    engineId: upscaleEngineIdForStudioModel(imageSettings.modelId, 'image'),
  });
  assert.equal(imageRequest.mediaType, 'image');
  assert.equal(imageRequest.engineId, 'seedvr-image');
  assert.equal(imageRequest.targetResolution, '1440p');

  const videoSettings = { ...shot('upscale-video'), resolution: '4k' as const };
  const videoRequest = buildWorkspaceUpscaleToolRequest({
    settings: videoSettings,
    mediaType: 'video',
    mediaUrl: 'https://example.com/source.mp4',
    engineId: upscaleEngineIdForStudioModel(videoSettings.modelId, 'video'),
  });
  assert.equal(videoRequest.mediaType, 'video');
  assert.equal(videoRequest.engineId, 'seedvr-video');
  assert.equal(videoRequest.targetResolution, '2160p');
});

test('chat request preserves provider, model, system instruction, history, and text context', () => {
  const preset = getWorkspaceBlockPreset('chat-box');
  assert.ok(preset?.defaultChat);
  const chat: WorkspaceChatSettings = {
    ...preset.defaultChat,
    provider: 'gemini',
    modelId: 'gemini-3.5-flash',
    systemPrompt: 'You are a concise Studio assistant.',
  };
  const request = buildWorkspaceChatApiRequest({
    chat,
    nextMessages: [
      { id: 'user-1', role: 'user', content: 'Draft a product prompt.', createdAt: '2026-07-10T10:00:00.000Z' },
      { id: 'assistant-1', role: 'assistant', content: 'What visual style?', createdAt: '2026-07-10T10:01:00.000Z' },
    ],
    contextSummaries: [
      { kind: 'text', label: 'Campaign brief', content: 'Premium athletic footwear in moonlight.', sourceId: 'brief-1' },
      { kind: 'unsupported', label: 'Reference image', content: 'https://example.com/reference.png' },
    ],
  });

  assert.equal(request.provider, 'gemini');
  assert.equal(request.modelId, 'gemini-3.5-flash');
  assert.deepEqual(request.messages, [
    { role: 'system', content: 'You are a concise Studio assistant.' },
    { role: 'user', content: 'Draft a product prompt.' },
    { role: 'assistant', content: 'What visual style?' },
  ]);
  assert.deepEqual(request.contextSummaries, [
    { kind: 'text', label: 'Campaign brief', content: 'Premium athletic footwear in moonlight.', sourceId: 'brief-1' },
  ]);
});
