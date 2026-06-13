import { runAngleTool, runAudioGenerate, runCharacterBuilderTool, runGenerate, runImageGeneration, runUpscaleTool } from '@/lib/api';
import { buildStoryboardPrompt } from '@/components/tools/storyboard/_lib/storyboard-prompt';
import { getAbsoluteStoryboardTemplateUrl, getStoryboardLengthPreset, getStoryboardOutputConfig } from '@/components/tools/storyboard/_lib/storyboard-templates';
import type { AngleToolEngineId } from '@/types/tools-angle';
import type { AudioPackId } from '@/lib/audio-generation';
import type { UpscaleOutputFormat, UpscaleTargetResolution, UpscaleToolEngineId } from '@/types/tools-upscale';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceOutputMetadata,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from './workspace-types';
import { workspaceAudioEnabledForRequest } from './workspace-capabilities';
import {
  buildWorkspaceShotGenerateRequest,
  mediaUrlsFromKinds,
} from './workspace-generation';
import { buildWorkspaceCharacterBuilderRequest } from './workspace-tool-requests';

type WorkspaceGenerationRouteParams = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  prompt: string;
  outputName: string;
  connectedInputs: WorkspaceEdgeKind[];
  resolvedWorkflowType: WorkspaceWorkflowType;
};

export type WorkspaceGenerationRoute =
  | 'angle'
  | 'audio'
  | 'character-builder'
  | 'image'
  | 'storyboard'
  | 'upscale'
  | 'video';

export function resolveWorkspaceGenerationRoute(settings: WorkspaceShotSettings): WorkspaceGenerationRoute {
  if (settings.toolKind === 'character-builder') return 'character-builder';
  if (settings.toolKind === 'storyboard') return 'storyboard';
  if (settings.toolKind === 'angle') return 'angle';
  const family = settings.family ?? 'video';
  if (family === 'image') return 'image';
  if (family === 'audio') return 'audio';
  if (family === 'upscale') return 'upscale';
  return 'video';
}

type VideoGenerationMediaResult = Awaited<ReturnType<typeof runGenerate>> & {
  audioUrl?: string | null;
  audio?: { url?: string | null } | null;
};

function outputStatusFromVideoResult(result: VideoGenerationMediaResult): WorkspaceOutputMetadata['status'] {
  const videoUrl = result.videoUrl ?? result.video?.url ?? null;
  if (result.status === 'failed') return 'failed';
  if (result.status === 'completed' && videoUrl) return 'ready';
  return 'processing';
}

function outputStatusFromUrl(
  url: string | null | undefined,
  fallbackStatus?: 'pending' | 'completed' | 'failed'
): WorkspaceOutputMetadata['status'] {
  if (fallbackStatus === 'failed') return 'failed';
  if (fallbackStatus === 'completed' && url) return 'ready';
  return url ? 'ready' : 'processing';
}

function referenceImagesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [
    'start_image',
    'end_image',
    'product',
    'reference',
    'style',
    'character',
    'logo',
  ]);
}

function styleImagesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['style']);
}

function videoReferencesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [
    'video_reference',
    'motion_reference',
    'previous_shot',
    'continuity',
  ]);
}

function audioReferencesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['audio', 'music', 'voiceover', 'sfx']);
}

async function submitVideoGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const referenceImages = referenceImagesFor(params);
  const videoReferences = videoReferencesFor(params);
  const audioReferences = audioReferencesFor(params);
  const result = (await runGenerate(buildWorkspaceShotGenerateRequest({
    settings: params.settings,
    capability: params.capability,
    prompt: params.prompt,
    connectedInputs: params.connectedInputs,
    referenceImages,
    videoReferences,
    audioReferences,
    shotNodeId: params.shotNode.id,
    outputName: params.outputName,
  }))) as VideoGenerationMediaResult;
  const primaryImageUrl = referenceImages[0] ?? null;

  return {
    kind: 'video',
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: result.pricing ?? null,
    status: outputStatusFromVideoResult(result),
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: result.videoUrl ?? result.video?.url ?? null,
    audioUrl: result.audioUrl ?? result.audio?.url ?? null,
    thumbUrl: result.thumbUrl ?? result.video?.thumbnailUrl ?? primaryImageUrl,
    hasAudio: workspaceAudioEnabledForRequest(params.settings, params.capability),
    jobId: result.jobId,
  };
}

async function submitImageGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const referenceImages = referenceImagesFor(params);
  const result = await runImageGeneration({
    mode: referenceImages.length ? 'i2i' : 't2i',
    prompt: params.prompt,
    numImages: 1,
    imageUrls: referenceImages.length ? referenceImages : undefined,
    allowIndex: false,
    indexable: false,
    visibility: 'private',
    seed: params.settings.seed ?? undefined,
    engineId: params.settings.modelId,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
  });
  const image = result.images[0];
  if (!image?.url) {
    throw new Error('Image generation returned no image output.');
  }

  return {
    kind: 'image',
    modelId: result.engineId ?? params.settings.modelId,
    modelLabel: result.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: params.settings.durationSec,
    aspectRatio: (result.aspectRatio ?? params.settings.aspectRatio) as WorkspaceShotSettings['aspectRatio'],
    resolution: (result.resolution ?? params.settings.resolution) as WorkspaceShotSettings['resolution'],
    pricing: result.pricing ?? null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? result.thumbUrl ?? image.url,
    hasAudio: false,
    jobId: result.jobId ?? result.requestId ?? null,
  };
}

export function upscaleEngineIdForStudioModel(
  modelId: string,
  mediaType: 'image' | 'video'
): UpscaleToolEngineId {
  const map: Record<string, UpscaleToolEngineId> = {
    'upscale-image-seedvr': 'seedvr-image',
    'upscale-image-topaz': 'topaz-image',
    'upscale-image-recraft-crisp': 'recraft-crisp',
    'upscale-video-seedvr': 'seedvr-video',
    'upscale-video-flashvsr': 'flashvsr-video',
    'upscale-video-topaz': 'topaz-video',
  };
  const mapped = map[modelId];
  if (mapped) return mapped;
  return mediaType === 'video' ? 'seedvr-video' : 'seedvr-image';
}

export function angleEngineIdForStudioModel(modelId: string): AngleToolEngineId {
  if (modelId === 'angle-qwen-multiple-angles') return 'qwen-multiple-angles';
  return 'flux-multiple-angles';
}

function upscaleTargetResolutionFor(settings: WorkspaceShotSettings): UpscaleTargetResolution {
  if (settings.resolution === '4k') return '2160p';
  if (settings.resolution === '1440p') return '1440p';
  if (settings.resolution === '720p') return '720p';
  return '1080p';
}

function pricingSnapshotFromToolPricing(pricing: unknown): PricingSnapshot | null {
  return pricing ? pricing as PricingSnapshot : null;
}

async function submitUpscaleGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const mediaType = params.settings.outputKind === 'video' || params.settings.workflowType === 'video_upscale' ? 'video' : 'image';
  const mediaUrl = mediaType === 'video' ? videoReferencesFor(params)[0] : referenceImagesFor(params)[0];
  if (!mediaUrl) {
    throw new Error(mediaType === 'video' ? 'A source video is required for upscale.' : 'A source image is required for upscale.');
  }

  const result = await runUpscaleTool({
    mediaType,
    mediaUrl,
    engineId: upscaleEngineIdForStudioModel(params.settings.modelId, mediaType),
    mode: params.settings.toolSettings?.upscale?.mode ?? 'target',
    upscaleFactor: params.settings.toolSettings?.upscale?.upscaleFactor,
    targetResolution: upscaleTargetResolutionFor(params.settings),
    outputFormat: params.settings.toolSettings?.upscale?.outputFormat as UpscaleOutputFormat | undefined,
  });
  const outputUrl = result.output?.url ?? null;
  if (!outputUrl) {
    throw new Error('Upscale returned no media output.');
  }

  return {
    kind: mediaType,
    modelId: params.settings.modelId,
    modelLabel: result.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: pricingSnapshotFromToolPricing(result.pricing),
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: outputUrl,
    audioUrl: null,
    thumbUrl: result.output?.thumbUrl ?? (mediaType === 'image' ? outputUrl : null),
    hasAudio: mediaType === 'video',
    jobId: result.jobId ?? result.requestId ?? null,
  };
}

export function audioPackForWorkflow(workflowType: WorkspaceWorkflowType): AudioPackId {
  if (workflowType === 'cinematic_audio') return 'cinematic';
  if (workflowType === 'cinematic_voiceover') return 'cinematic_voice';
  if (workflowType === 'voiceover_generation') return 'voice_only';
  if (workflowType === 'sfx_generation') return 'sfx_only';
  return 'music_only';
}

async function submitAudioGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const pack = audioPackForWorkflow(params.settings.workflowType);
  const audioSettings = params.settings.toolSettings?.audio;
  const videoReferences = videoReferencesFor(params);
  const result = await runAudioGenerate({
    sourceVideoUrl: videoReferences[0],
    pack,
    prompt: pack === 'voice_only' ? undefined : params.prompt,
    mood: pack === 'voice_only' ? undefined : audioSettings?.mood ?? 'epic',
    intensity: audioSettings?.intensity ?? 'standard',
    script: pack === 'voice_only' ? params.prompt : undefined,
    voiceGender: audioSettings?.voiceGender,
    voiceProfile: audioSettings?.voiceProfile,
    voiceDelivery: audioSettings?.voiceDelivery,
    language: audioSettings?.language,
    musicEnabled: audioSettings?.musicEnabled,
    durationSec: params.settings.durationSec,
  });
  const audioUrl = result.audioUrl ?? (result.outputKind === 'audio' ? result.videoUrl : null);
  const mediaUrl = result.outputKind === 'video' ? result.videoUrl : audioUrl;

  return {
    kind: result.outputKind === 'video' ? 'video' : 'audio',
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: result.pricing ?? null,
    status: outputStatusFromUrl(mediaUrl, result.status),
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: mediaUrl ?? null,
    audioUrl,
    thumbUrl: result.thumbUrl ?? null,
    hasAudio: Boolean(audioUrl || result.outputKind === 'video'),
    jobId: result.jobId,
  };
}

async function submitCharacterBuilderGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const identityImages = referenceImagesFor(params).slice(0, 2);
  const styleImages = styleImagesFor(params).slice(0, Math.max(0, 2 - identityImages.length));
  const result = await runCharacterBuilderTool(buildWorkspaceCharacterBuilderRequest({
    settings: params.settings,
    prompt: params.prompt,
    identityImageUrls: identityImages,
    styleImageUrls: styleImages,
    jobId: `studio_character_${crypto.randomUUID()}`,
  }));
  const run = result.run ?? null;
  const image = run?.results[0] ?? null;
  if (!run || !image?.url) {
    throw new Error('Character Builder returned no image output.');
  }

  return {
    kind: 'image',
    modelId: run.engineId ?? params.settings.modelId,
    modelLabel: run.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: 1,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: result.pricing ?? run.pricing ?? null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? image.url,
    hasAudio: false,
    jobId: run.jobId,
  };
}

async function submitStoryboardGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const settings = params.settings.toolSettings?.storyboard;
  const lengthPreset = getStoryboardLengthPreset(settings?.lengthPreset ?? 'medium');
  const orientation = settings?.orientation ?? 'landscape';
  const tier = settings?.tier ?? '4k';
  const outputConfig = getStoryboardOutputConfig(tier, orientation);
  const referenceImages = referenceImagesFor(params);
  const templateUrl = typeof window !== 'undefined'
    ? getAbsoluteStoryboardTemplateUrl(settings?.frameCount ?? lengthPreset.frameCount, orientation, window.location.origin)
    : getAbsoluteStoryboardTemplateUrl(settings?.frameCount ?? lengthPreset.frameCount, orientation, 'http://localhost:3000');
  const imageUrls = [templateUrl, ...referenceImages];
  const prompt = buildStoryboardPrompt({
    subject: params.prompt,
    action: params.prompt,
    style: 'cinema',
    targetModel: settings?.targetModel ?? 'seedance',
    orientation,
    durationSec: settings?.durationSec ?? lengthPreset.durationSec,
    frameCount: settings?.frameCount ?? lengthPreset.frameCount,
    templateReference: true,
    referenceImageCount: referenceImages.length,
  });
  const result = await runImageGeneration({
    jobId: `storyboard_${crypto.randomUUID()}`,
    engineId: 'gpt-image-2',
    mode: 'i2i',
    prompt,
    numImages: 1,
    imageUrls,
    resolution: outputConfig.resolution,
    customImageSize: outputConfig.customImageSize,
    quality: outputConfig.quality,
    outputFormat: 'png',
    source: 'storyboard',
    metadata: {
      storyboard: {
        role: 'board',
        targetModel: settings?.targetModel ?? 'seedance',
      },
    },
  });
  const image = result.images[0] ?? null;
  if (!image?.url) {
    throw new Error('Storyboard generation returned no image output.');
  }

  return {
    kind: 'image',
    modelId: result.engineId ?? params.settings.modelId,
    modelLabel: result.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: settings?.durationSec ?? lengthPreset.durationSec,
    aspectRatio: orientation === 'portrait' ? '9:16' : '16:9',
    resolution: params.settings.resolution,
    pricing: result.pricing ?? null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? image.url,
    hasAudio: false,
    jobId: result.jobId ?? result.requestId ?? null,
  };
}

async function submitAngleGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const imageUrl = referenceImagesFor(params)[0];
  if (!imageUrl) {
    throw new Error('A source image is required for angle generation.');
  }
  const angleSettings = params.settings.toolSettings?.angle;
  const result = await runAngleTool({
    imageUrl,
    engineId: angleEngineIdForStudioModel(params.settings.modelId),
    params: {
      rotation: angleSettings?.rotation ?? 35,
      tilt: angleSettings?.tilt ?? 0,
      zoom: angleSettings?.zoom ?? 1,
    },
    safeMode: angleSettings?.safeMode ?? true,
    generateBestAngles: angleSettings?.generateBestAngles ?? false,
  });
  const image = result.outputs[0] ?? null;
  if (!image?.url) {
    throw new Error('Angle tool returned no image output.');
  }

  return {
    kind: 'image',
    modelId: result.engineId,
    modelLabel: result.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: 1,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: pricingSnapshotFromToolPricing(result.pricing),
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? image.url,
    hasAudio: false,
    jobId: result.jobId ?? result.requestId ?? null,
  };
}

export async function submitWorkspaceGenerationByFamily(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const route = resolveWorkspaceGenerationRoute(params.settings);
  if (route === 'character-builder') return submitCharacterBuilderGeneration(params);
  if (route === 'storyboard') return submitStoryboardGeneration(params);
  if (route === 'angle') return submitAngleGeneration(params);
  if (route === 'image') return submitImageGeneration(params);
  if (route === 'audio') return submitAudioGeneration(params);
  if (route === 'upscale') return submitUpscaleGeneration(params);
  return submitVideoGeneration(params);
}
