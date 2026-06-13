import { getBaseEnginesByCategory } from '@/lib/engines';
import type { AspectRatio, EngineCaps, Resolution } from '@/types/engines';
import type { WorkspaceEdgeKind, WorkspaceModelCapability, WorkspaceWorkflowType } from '../workspace-types';
import {
  ALL_INPUT_KINDS,
  inputConnectorsFor,
  inputConnectorsFromKinds,
  optionalInputsFor,
  requiredInputsFor,
} from './model-input-connectors';
import { hasFieldId, hasFieldType, hasMode } from './model-engine-fields';
import { resolveWorkspaceRenderOptions } from './model-pricing-adapter';

function workflowTypesFor(engine: EngineCaps): WorkspaceWorkflowType[] {
  const workflows: WorkspaceWorkflowType[] = [];
  const family = engine.id.toLowerCase();
  if (hasMode(engine, ['t2v'])) workflows.push('text_to_video');
  if (hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v'])) workflows.push('image_to_video');
  if (hasMode(engine, ['v2v', 'extend', 'retake', 'reframe'])) workflows.push('video_to_video');
  if (hasMode(engine, ['r2v']) || engine.id.includes('storyboard')) workflows.push('storyboard_to_video');
  if (hasMode(engine, ['i2v', 'ref2v', 'r2v']) && (family.includes('kling') || family.includes('ltx') || family.includes('happy-horse'))) {
    workflows.push('character_to_video');
  }
  if (hasMode(engine, ['t2i'])) workflows.push('text_to_image');
  if (hasMode(engine, ['i2i'])) workflows.push('image_to_image');
  return workflows.length ? workflows : ['text_to_video'];
}

function familyForEngine(engine: EngineCaps): WorkspaceModelCapability['family'] {
  const imageOnly = engine.modes.length > 0 && engine.modes.every((mode) => mode === 't2i' || mode === 'i2i');
  if (imageOnly || engine.pricing?.unit === 'image') return 'image';
  return 'video';
}

function supportedDurations(engine: EngineCaps): number[] {
  const values = new Set<number>();
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (!caps?.duration) return;
    if ('options' in caps.duration) {
      caps.duration.options.forEach((value) => {
        const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (Number.isFinite(numeric)) values.add(numeric);
      });
      return;
    }
    if (Number.isFinite(caps.duration.default)) values.add(caps.duration.default);
    if (Number.isFinite(caps.duration.min)) values.add(caps.duration.min);
  });
  if (!values.size && Number.isFinite(engine.maxDurationSec)) {
    values.add(Math.min(engine.maxDurationSec, 5));
    if (engine.maxDurationSec >= 8) values.add(8);
    if (engine.maxDurationSec >= 10) values.add(10);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function supportedAspectRatios(engine: EngineCaps): AspectRatio[] {
  const ratios = new Set<AspectRatio>(engine.aspectRatios);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.aspectRatio?.forEach((ratio) => ratios.add(ratio as AspectRatio));
  });
  return Array.from(ratios);
}

function supportedResolutions(engine: EngineCaps): Resolution[] {
  const resolutions = new Set<Resolution>(engine.resolutions);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.resolution?.forEach((resolution) => resolutions.add(resolution as Resolution));
  });
  return Array.from(resolutions);
}

function supportedFps(engine: EngineCaps): number[] {
  const fps = new Set<number>(engine.fps);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (Array.isArray(caps?.fps)) {
      caps.fps.forEach((value) => fps.add(value));
    } else if (typeof caps?.fps === 'number') {
      fps.add(caps.fps);
    }
  });
  return Array.from(fps).sort((a, b) => a - b);
}

function buildCapability(engine: EngineCaps): WorkspaceModelCapability {
  const workflows = workflowTypesFor(engine);
  const family = engine.id.toLowerCase();
  const generationFamily = familyForEngine(engine);
  const outputKind = generationFamily === 'image' ? 'image' : 'video';
  const supportsImage = hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v']) || hasFieldType(engine, 'image');
  const supportsVideo = hasMode(engine, ['v2v', 'extend', 'retake', 'reframe']) || hasFieldType(engine, 'video');
  const supportsAudio = engine.audio || hasFieldType(engine, 'audio') || hasMode(engine, ['a2v']);
  const renderOptions = resolveWorkspaceRenderOptions(engine);
  const baseRequiredInputs = requiredInputsFor(engine);
  const baseOptionalInputs = optionalInputsFor(engine);
  const inputConnectors = inputConnectorsFor(engine, baseRequiredInputs, baseOptionalInputs);
  const requiredInputs = inputConnectors.filter((connector) => connector.required).map((connector) => connector.kind);
  const optionalInputs = inputConnectors.filter((connector) => !connector.required).map((connector) => connector.kind);
  const supportedInputs = new Set([...requiredInputs, ...optionalInputs]);

  return {
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    providerEngineSlug: engine.providerMeta?.modelSlug ?? engine.id,
    family: generationFamily,
    outputKind,
    modes: [...engine.modes],
    workflows,
    text_to_video: workflows.includes('text_to_video'),
    image_to_video: workflows.includes('image_to_video'),
    video_to_video: workflows.includes('video_to_video'),
    storyboard_to_video: workflows.includes('storyboard_to_video'),
    character_to_video: workflows.includes('character_to_video'),
    text_to_image: workflows.includes('text_to_image'),
    image_to_image: workflows.includes('image_to_image'),
    image_upscale: workflows.includes('image_upscale'),
    video_upscale: workflows.includes('video_upscale'),
    music_generation: workflows.includes('music_generation'),
    voiceover_generation: workflows.includes('voiceover_generation'),
    sfx_generation: workflows.includes('sfx_generation'),
    chat_completion: workflows.includes('chat_completion'),
    reference_image: supportsImage,
    reference_video: supportsVideo,
    product_reference: supportsImage && !family.startsWith('sora'),
    character_reference: supportsImage && (family.includes('kling') || family.includes('ltx') || family.includes('happy-horse')),
    motion_reference: supportsVideo || hasMode(engine, ['ref2v']),
    audio_input: supportsAudio,
    music_input: supportsAudio,
    voiceover_input: supportsAudio || engine.audio || family.includes('veo') || family.includes('happy-horse'),
    dialogue: engine.audio || family.includes('veo') || family.includes('happy-horse') || hasFieldId(engine, ['dialogue']),
    lip_sync: renderOptions.some((option) => option.id === 'lip_sync'),
    audio_generation: renderOptions.some((option) => option.id === 'audio'),
    supports_people_reference: supportsImage && !family.startsWith('sora') && !family.includes('seedance-2-0-fast'),
    supports_product_reference: supportsImage && !family.startsWith('sora'),
    supported_aspect_ratios: supportedAspectRatios(engine),
    supported_durations: supportedDurations(engine),
    supported_resolutions: supportedResolutions(engine),
    supported_fps: supportedFps(engine),
    input_connectors: inputConnectors,
    render_options: renderOptions,
    required_inputs: requiredInputs,
    optional_inputs: optionalInputs,
    unsupported_inputs: ALL_INPUT_KINDS.filter((kind) => !supportedInputs.has(kind)),
  };
}

function virtualCapability(input: {
  id: string;
  label: string;
  family: WorkspaceModelCapability['family'];
  outputKind: WorkspaceModelCapability['outputKind'];
  workflow: WorkspaceWorkflowType;
  requiredInputs: WorkspaceEdgeKind[];
  optionalInputs: WorkspaceEdgeKind[];
}): WorkspaceModelCapability {
  const inputConnectors = inputConnectorsFromKinds(input.requiredInputs, input.optionalInputs);
  const supportedInputs = new Set([...input.requiredInputs, ...input.optionalInputs]);
  const renderOptions: WorkspaceModelCapability['render_options'] = input.family === 'audio'
    ? [{
        id: 'audio',
        label: 'Audio output',
        control: 'included',
        defaultEnabled: true,
      }]
    : [];
  return {
    id: input.id,
    label: input.label,
    provider: 'MaxVideoAI',
    providerEngineSlug: input.id,
    family: input.family,
    outputKind: input.outputKind,
    modes: [],
    workflows: [input.workflow],
    text_to_video: input.workflow === 'text_to_video',
    image_to_video: input.workflow === 'image_to_video',
    video_to_video: input.workflow === 'video_to_video',
    storyboard_to_video: input.workflow === 'storyboard_to_video',
    character_to_video: input.workflow === 'character_to_video',
    text_to_image: input.workflow === 'text_to_image',
    image_to_image: input.workflow === 'image_to_image',
    image_upscale: input.workflow === 'image_upscale',
    video_upscale: input.workflow === 'video_upscale',
    music_generation: input.workflow === 'music_generation',
    voiceover_generation: input.workflow === 'voiceover_generation',
    sfx_generation: input.workflow === 'sfx_generation',
    chat_completion: input.workflow === 'chat_completion',
    reference_image: input.optionalInputs.some((kind) => ['reference', 'start_image', 'product', 'character'].includes(kind)) ||
      input.requiredInputs.some((kind) => ['reference', 'start_image'].includes(kind)),
    reference_video: input.optionalInputs.includes('video_reference') || input.requiredInputs.includes('video_reference'),
    product_reference: input.optionalInputs.includes('product'),
    character_reference: input.optionalInputs.includes('character'),
    motion_reference: input.optionalInputs.includes('motion_reference'),
    audio_input: input.optionalInputs.includes('audio') || input.requiredInputs.includes('audio'),
    music_input: input.workflow === 'music_generation',
    voiceover_input: input.workflow === 'voiceover_generation',
    dialogue: input.workflow === 'voiceover_generation',
    lip_sync: false,
    audio_generation: renderOptions.some((option) => option.id === 'audio'),
    supports_people_reference: input.optionalInputs.includes('character'),
    supports_product_reference: input.optionalInputs.includes('product'),
    supported_aspect_ratios: ['16:9', '9:16', '1:1', '4:5'],
    supported_durations: input.family === 'audio' ? [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180] : [1, 5, 7, 8, 10],
    supported_resolutions: ['720p', '1080p', '1440p', '4k'],
    supported_fps: [24, 30],
    input_connectors: inputConnectors,
    render_options: renderOptions,
    required_inputs: input.requiredInputs,
    optional_inputs: input.optionalInputs,
    unsupported_inputs: ALL_INPUT_KINDS.filter((kind) => !supportedInputs.has(kind)),
  };
}

function getVirtualWorkspaceCapabilities(): WorkspaceModelCapability[] {
  return [
    virtualCapability({
      id: 'audio-music-only',
      label: 'Music generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'music_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['style'],
    }),
    virtualCapability({
      id: 'audio-voice-only',
      label: 'Voice-over generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'voiceover_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['voiceover', 'dialogue', 'narration'],
    }),
    virtualCapability({
      id: 'audio-sfx-only',
      label: 'SFX generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'sfx_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['video_reference', 'motion_reference'],
    }),
    virtualCapability({
      id: 'audio-cinematic',
      label: 'Cinematic sound design',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'cinematic_audio',
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt', 'music', 'sfx'],
    }),
    virtualCapability({
      id: 'audio-cinematic-voice',
      label: 'Cinematic sound design + voice',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'cinematic_voiceover',
      requiredInputs: ['video_reference', 'prompt'],
      optionalInputs: ['music', 'sfx', 'voiceover', 'dialogue', 'narration'],
    }),
    virtualCapability({
      id: 'character-builder-tool',
      label: 'Character Builder',
      family: 'image',
      outputKind: 'image',
      workflow: 'character_builder',
      requiredInputs: [],
      optionalInputs: ['prompt', 'reference', 'style'],
    }),
    virtualCapability({
      id: 'storyboard-gpt-image-2',
      label: 'Storyboard generator',
      family: 'image',
      outputKind: 'image',
      workflow: 'storyboard_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'character', 'style'],
    }),
    virtualCapability({
      id: 'angle-flux-multiple-angles',
      label: 'FLUX Multiple Angles',
      family: 'image',
      outputKind: 'image',
      workflow: 'angle_generation',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'angle-qwen-multiple-angles',
      label: 'Qwen Multiple Angles',
      family: 'image',
      outputKind: 'image',
      workflow: 'angle_generation',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-image-seedvr',
      label: 'SeedVR image upscale',
      family: 'upscale',
      outputKind: 'image',
      workflow: 'image_upscale',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-image-topaz',
      label: 'Topaz image upscale',
      family: 'upscale',
      outputKind: 'image',
      workflow: 'image_upscale',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-image-recraft-crisp',
      label: 'Recraft Crisp image upscale',
      family: 'upscale',
      outputKind: 'image',
      workflow: 'image_upscale',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-video-seedvr',
      label: 'SeedVR video upscale',
      family: 'upscale',
      outputKind: 'video',
      workflow: 'video_upscale',
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-video-flashvsr',
      label: 'FlashVSR video upscale',
      family: 'upscale',
      outputKind: 'video',
      workflow: 'video_upscale',
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-video-topaz',
      label: 'Topaz video upscale',
      family: 'upscale',
      outputKind: 'video',
      workflow: 'video_upscale',
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'studio-chat-openai',
      label: 'OpenAI chat',
      family: 'chat',
      outputKind: 'text',
      workflow: 'chat_completion',
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'video_reference', 'audio'],
    }),
    virtualCapability({
      id: 'studio-chat-gemini',
      label: 'Gemini chat',
      family: 'chat',
      outputKind: 'text',
      workflow: 'chat_completion',
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'video_reference', 'audio'],
    }),
  ];
}

export function getWorkspaceModelCapabilities(engines: EngineCaps[] = getBaseEnginesByCategory('all')): WorkspaceModelCapability[] {
  return [
    ...engines.map(buildCapability).filter((capability) => capability.workflows.length > 0),
    ...getVirtualWorkspaceCapabilities(),
  ];
}

export function getWorkspaceModelCapability(
  modelId: string,
  capabilities: WorkspaceModelCapability[] = getWorkspaceModelCapabilities()
): WorkspaceModelCapability | null {
  return capabilities.find((capability) => capability.id === modelId) ?? capabilities[0] ?? null;
}
