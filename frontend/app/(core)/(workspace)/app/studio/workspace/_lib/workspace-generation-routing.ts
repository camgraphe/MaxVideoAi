import { runAngleTool, runAudioGenerate, runCharacterBuilderTool, runGenerate, runImageGeneration, runUpscaleTool } from '@/lib/api';
import { buildStoryboardPrompt } from '@/components/tools/storyboard/_lib/storyboard-prompt';
import { getAbsoluteStoryboardTemplateUrl, getStoryboardLengthPreset, getStoryboardOutputConfig } from '@/components/tools/storyboard/_lib/storyboard-templates';
import type { AngleToolEngineId } from '@/types/tools-angle';
import type { AudioPackId } from '@/lib/audio-generation';
import type { ImageGenerationRequest } from '@/types/image-generation';
import type { UpscaleToolEngineId } from '@/types/tools-upscale';
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
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
import {
  buildWorkspaceShotGenerateRequest,
  mediaUrlsFromKinds,
} from './workspace-generation';
import {
  buildWorkspaceAngleToolRequest,
  buildWorkspaceAudioGenerateRequest,
  buildWorkspaceCharacterBuilderRequest,
  buildWorkspaceImageGenerationRequest,
  buildWorkspaceUpscaleToolRequest,
} from './workspace-tool-requests';

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
  | 'unsupported'
  | 'upscale'
  | 'video';

export function resolveWorkspaceGenerationRoute(settings: WorkspaceShotSettings): WorkspaceGenerationRoute {
  if (settings.toolKind === 'character-builder') return 'character-builder';
  if (settings.toolKind === 'storyboard') return 'storyboard';
  if (settings.toolKind === 'angle') return 'angle';
  const family = settings.family ?? 'video';
  if (family === 'chat') return 'unsupported';
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

function imageReferenceUrlFor(params: WorkspaceGenerationRouteParams, kind: 'start_image' | 'end_image'): string | undefined {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [kind])[0];
}

function styleImagesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['style']);
}

export function workspaceVideoReferencesForGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
}): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [
    'video_reference',
    'motion_reference',
    'previous_shot',
    'continuity',
  ]);
}

function videoReferencesFor(params: WorkspaceGenerationRouteParams): string[] {
  return workspaceVideoReferencesForGeneration(params);
}

function audioReferencesFor(params: WorkspaceGenerationRouteParams): string[] {
  return mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['audio', 'music', 'voiceover', 'sfx']);
}

async function submitVideoGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const referenceImages = referenceImagesFor(params);
  const startImageUrl = imageReferenceUrlFor(params, 'start_image');
  const endImageUrl = imageReferenceUrlFor(params, 'end_image');
  const videoReferences = videoReferencesFor(params);
  const audioReferences = audioReferencesFor(params);
  const result = (await runGenerate(buildWorkspaceShotGenerateRequest({
    settings: params.settings,
    capability: params.capability,
    prompt: params.prompt,
    connectedInputs: params.connectedInputs,
    referenceImages,
    startImageUrl,
    endImageUrl,
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
  const policy = resolveWorkspaceBlockPolicy({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: params.connectedInputs,
  });
  const result = await runImageGeneration(buildWorkspaceImageGenerationRequest({
    settings: params.settings,
    prompt: params.prompt,
    referenceImages,
    policy,
  }));
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

function pricingSnapshotFromToolPricing(pricing: unknown): PricingSnapshot | null {
  return pricing ? pricing as PricingSnapshot : null;
}

async function submitUpscaleGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const mediaType = params.settings.outputKind === 'video' || params.settings.workflowType === 'video_upscale' ? 'video' : 'image';
  const mediaUrl = mediaType === 'video' ? videoReferencesFor(params)[0] : referenceImagesFor(params)[0];
  if (!mediaUrl) {
    throw new Error(mediaType === 'video' ? 'A source video is required for upscale.' : 'A source image is required for upscale.');
  }

  const result = await runUpscaleTool(buildWorkspaceUpscaleToolRequest({
    settings: params.settings,
    mediaType,
    mediaUrl,
    engineId: upscaleEngineIdForStudioModel(params.settings.modelId, mediaType),
  }));
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
  const videoReferences = videoReferencesFor(params);
  const result = await runAudioGenerate(buildWorkspaceAudioGenerateRequest({
    settings: params.settings,
    pack,
    prompt: params.prompt,
    sourceVideoUrl: videoReferences[0],
  }));
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

export function buildWorkspaceStoryboardGenerationRequest({
  settings,
  prompt,
  referenceImages,
  origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  jobId = `storyboard_${crypto.randomUUID()}`,
}: {
  settings: WorkspaceShotSettings;
  prompt: string;
  referenceImages: string[];
  origin?: string;
  jobId?: string;
}): ImageGenerationRequest {
  const storyboardSettings = settings.toolSettings?.storyboard;
  const lengthPreset = getStoryboardLengthPreset(storyboardSettings?.lengthPreset ?? 'medium');
  const orientation = storyboardSettings?.orientation ?? 'landscape';
  const tier = storyboardSettings?.tier ?? '4k';
  const frameCount = storyboardSettings?.frameCount ?? lengthPreset.frameCount;
  const durationSec = storyboardSettings?.durationSec ?? lengthPreset.durationSec;
  const targetModel = storyboardSettings?.targetModel ?? 'seedance';
  const outputConfig = getStoryboardOutputConfig(tier, orientation);
  const templateUrl = getAbsoluteStoryboardTemplateUrl(frameCount, orientation, origin);

  return {
    jobId,
    engineId: 'gpt-image-2',
    mode: 'i2i',
    prompt: buildStoryboardPrompt({
      subject: prompt,
      action: prompt,
      style: 'cinema',
      targetModel,
      orientation,
      durationSec,
      frameCount,
      templateReference: true,
      referenceImageCount: referenceImages.length,
    }),
    numImages: 1,
    imageUrls: [templateUrl, ...referenceImages],
    resolution: outputConfig.resolution,
    customImageSize: outputConfig.customImageSize,
    quality: outputConfig.quality,
    outputFormat: 'png',
    source: 'storyboard',
    metadata: {
      storyboard: {
        role: 'board',
        targetModel,
      },
    },
  };
}

async function submitStoryboardGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const referenceImages = referenceImagesFor(params);
  const result = await runImageGeneration(buildWorkspaceStoryboardGenerationRequest({
    settings: params.settings,
    prompt: params.prompt,
    referenceImages,
  }));
  const image = result.images[0] ?? null;
  if (!image?.url) {
    throw new Error('Storyboard generation returned no image output.');
  }

  return {
    kind: 'image',
    modelId: result.engineId ?? params.settings.modelId,
    modelLabel: result.engineLabel ?? params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    durationSec: params.settings.toolSettings?.storyboard?.durationSec ?? getStoryboardLengthPreset(
      params.settings.toolSettings?.storyboard?.lengthPreset ?? 'medium'
    ).durationSec,
    aspectRatio: params.settings.toolSettings?.storyboard?.orientation === 'portrait' ? '9:16' : '16:9',
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
  const result = await runAngleTool(buildWorkspaceAngleToolRequest({
    settings: params.settings,
    imageUrl,
    engineId: angleEngineIdForStudioModel(params.settings.modelId),
  }));
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
  if (route === 'unsupported') throw new Error('This Studio block does not support generation through media routes.');
  return submitVideoGeneration(params);
}
