import { runAngleTool, runAudioGenerate, runCharacterBuilderTool, runGenerate, runImageGeneration, runUpscaleTool } from '@/lib/api';
import { buildStoryboardPrompt } from '@/components/tools/storyboard/_lib/storyboard-prompt';
import { getAbsoluteStoryboardTemplateUrl, getStoryboardLengthPreset, getStoryboardOutputConfig } from '@/components/tools/storyboard/_lib/storyboard-templates';
import type { AngleToolEngineId, AngleToolResponse } from '@/types/tools-angle';
import type { CharacterBuilderResponse } from '@/types/character-builder';
import { getAudioPackConfig, type AudioGenerateRequestBody, type AudioPackId } from '@/lib/audio-generation';
import type { ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';
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
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
import { resolveWorkspaceAudioProvenance } from './workspace-audio-provenance';
import {
  buildWorkspaceShotGenerateRequest,
  mediaUrlsFromKinds,
  workspaceGenerationMediaInputsFromGraph,
} from './workspace-generation';
import {
  buildWorkspaceAngleToolRequest,
  buildWorkspaceAudioGenerateRequest,
  buildWorkspaceCharacterBuilderRequest,
  buildWorkspaceImageGenerationRequest,
  buildWorkspaceUpscaleToolRequest,
} from './workspace-tool-requests';
import { resolveWorkspaceSelectedOutputCount } from './workspace-output-count';

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
  submissionId: string;
};

export type WorkspaceOutputMappingContext = {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  resolvedWorkflowType: WorkspaceWorkflowType;
  sourceShotId: string;
  submissionId?: string;
  createdAt?: string;
};

function requestedSettingsForOutput(
  context: WorkspaceOutputMappingContext
): NonNullable<WorkspaceOutputMetadata['requestedSettings']> {
  return {
    durationSec: context.settings.durationSec,
    aspectRatio: context.settings.aspectRatio,
    resolution: context.settings.resolution,
    fps: context.settings.fps,
    outputCount: resolveWorkspaceSelectedOutputCount(
      context.settings,
      context.capability?.output_count
    ),
  };
}

function sourceMetadataForDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
  durationSec: number | null = null
): NonNullable<WorkspaceOutputMetadata['sourceMetadata']> {
  const measuredWidth = typeof width === 'number' && width > 0 ? width : null;
  const measuredHeight = typeof height === 'number' && height > 0 ? height : null;
  const measuredDuration = typeof durationSec === 'number' && durationSec > 0 ? durationSec : null;
  return {
    measurementStatus: measuredDuration || (measuredWidth && measuredHeight) ? 'measured' : 'unknown',
    durationSec: measuredDuration,
    width: measuredWidth,
    height: measuredHeight,
  };
}

function mappingContextFromRoute(
  params: WorkspaceGenerationRouteParams
): WorkspaceOutputMappingContext {
  return {
    settings: params.settings,
    capability: params.capability,
    resolvedWorkflowType: params.resolvedWorkflowType,
    sourceShotId: params.shotNode.id,
    submissionId: params.submissionId,
  };
}

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
  hasAudio?: boolean;
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

function uniqueMediaUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

export function workspaceCharacterReferenceUrlsForGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
}): {
  identityImageUrls: string[];
  styleImageUrls: string[];
} {
  return {
    identityImageUrls: uniqueMediaUrls(mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [
      'start_image',
      'end_image',
      'product',
      'reference',
      'character',
      'logo',
    ])).slice(0, 2),
    styleImageUrls: uniqueMediaUrls(mediaUrlsFromKinds(
      params.nodes,
      params.edges,
      params.shotNode.id,
      ['style']
    )).slice(0, 2),
  };
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
  const mediaInputs = workspaceGenerationMediaInputsFromGraph({
    nodes: params.nodes,
    edges: params.edges,
    shotNodeId: params.shotNode.id,
  });
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
    mediaInputs,
    shotNodeId: params.shotNode.id,
    outputName: params.outputName,
    submissionId: params.submissionId,
  }))) as VideoGenerationMediaResult;
  const primaryImageUrl = referenceImages[0] ?? null;
  const audioUrl = result.audioUrl ?? result.audio?.url ?? null;
  const audioProvenance = resolveWorkspaceAudioProvenance({
    kind: 'video',
    audioUrl,
    hasAudio: result.hasAudio,
  });

  return {
    kind: 'video',
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    requestedSettings: requestedSettingsForOutput(mappingContextFromRoute(params)),
    sourceMetadata: sourceMetadataForDimensions(null, null),
    submissionId: params.submissionId,
    providerOutputId: `${result.jobId ?? params.submissionId}:video:1`,
    outputIndex: 0,
    outputCount: 1,
    pricing: result.pricing ?? null,
    status: outputStatusFromVideoResult(result),
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: result.videoUrl ?? result.video?.url ?? null,
    audioUrl,
    thumbUrl: result.thumbUrl ?? result.video?.thumbnailUrl ?? primaryImageUrl,
    hasAudio: audioProvenance === 'unknown'
      ? undefined
      : audioProvenance === 'embedded' || audioProvenance === 'external',
    audioProvenance,
    jobId: result.jobId,
  };
}

export function mapWorkspaceImageGenerationOutputs(
  result: ImageGenerationResponse,
  context: WorkspaceOutputMappingContext
): WorkspaceOutputMetadata[] {
  const createdAt = context.createdAt ?? new Date().toISOString();
  const outputCount = result.images.length;
  const providerRunId = result.jobId ?? result.requestId ?? result.providerJobId ?? context.submissionId ?? context.sourceShotId;
  return result.images.map((image, outputIndex) => ({
    kind: 'image',
    modelId: result.engineId ?? context.settings.modelId,
    modelLabel: result.engineLabel ?? context.capability?.label ?? context.settings.modelId,
    workflowType: context.resolvedWorkflowType,
    requestedSettings: requestedSettingsForOutput(context),
    sourceMetadata: sourceMetadataForDimensions(image.width, image.height),
    submissionId: context.submissionId ?? null,
    providerOutputId: `${providerRunId}:image:${outputIndex + 1}`,
    outputIndex,
    outputCount,
    pricing: result.pricing ?? null,
    status: 'ready',
    createdAt,
    sourceShotId: context.sourceShotId,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? result.thumbUrl ?? image.url,
    hasAudio: false,
    audioProvenance: 'none',
    jobId: result.jobId ?? result.requestId ?? null,
  }));
}

async function submitImageGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata[]> {
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
  if (!result.images.some((image) => Boolean(image.url))) {
    throw new Error('Image generation returned no image output.');
  }
  return mapWorkspaceImageGenerationOutputs(result, mappingContextFromRoute(params));
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
    requestedSettings: requestedSettingsForOutput(mappingContextFromRoute(params)),
    sourceMetadata: sourceMetadataForDimensions(result.output?.width, result.output?.height),
    submissionId: params.submissionId,
    providerOutputId: `${result.jobId ?? result.requestId ?? params.submissionId}:upscale:${result.output?.assetId ?? '1'}`,
    outputIndex: 0,
    outputCount: 1,
    pricing: pricingSnapshotFromToolPricing(result.pricing),
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: outputUrl,
    audioUrl: null,
    thumbUrl: result.output?.thumbUrl ?? (mediaType === 'image' ? outputUrl : null),
    hasAudio: mediaType === 'image' ? false : undefined,
    audioProvenance: mediaType === 'video' ? 'unknown' : 'none',
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

export function buildWorkspaceAudioGenerationRequest({
  settings,
  prompt,
  videoReferences,
}: {
  settings: WorkspaceShotSettings;
  prompt: string;
  videoReferences: string[];
}): AudioGenerateRequestBody {
  const pack = audioPackForWorkflow(settings.workflowType);
  return buildWorkspaceAudioGenerateRequest({
    settings,
    pack,
    prompt,
    sourceVideoUrl: getAudioPackConfig(pack).requiresVideo ? videoReferences[0] : undefined,
  });
}

async function submitAudioGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata> {
  const result = await runAudioGenerate(buildWorkspaceAudioGenerationRequest({
    settings: params.settings,
    prompt: params.prompt,
    videoReferences: videoReferencesFor(params),
  }));
  const audioUrl = result.audioUrl ?? (result.outputKind === 'audio' ? result.videoUrl : null);
  const mediaUrl = result.outputKind === 'video' ? result.videoUrl : audioUrl;
  const outputKind = result.outputKind === 'video' ? 'video' : 'audio';
  const audioProvenance = resolveWorkspaceAudioProvenance({
    kind: outputKind,
    audioUrl,
  });

  return {
    kind: outputKind,
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: params.resolvedWorkflowType,
    requestedSettings: requestedSettingsForOutput(mappingContextFromRoute(params)),
    sourceMetadata: sourceMetadataForDimensions(null, null),
    submissionId: params.submissionId,
    providerOutputId: `${result.jobId ?? params.submissionId}:audio:1`,
    outputIndex: 0,
    outputCount: 1,
    pricing: result.pricing ?? null,
    status: outputStatusFromUrl(mediaUrl, result.status),
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    url: mediaUrl ?? null,
    audioUrl,
    thumbUrl: result.thumbUrl ?? null,
    hasAudio: true,
    audioProvenance,
    jobId: result.jobId,
  };
}

export function mapWorkspaceCharacterBuilderOutputs(
  result: CharacterBuilderResponse,
  context: WorkspaceOutputMappingContext
): WorkspaceOutputMetadata[] {
  const run = result.run;
  if (!run) return [];
  const outputCount = run.results.length;
  return run.results.map((image, outputIndex) => ({
    kind: 'image',
    modelId: run.engineId ?? context.settings.modelId,
    modelLabel: run.engineLabel ?? context.capability?.label ?? context.settings.modelId,
    workflowType: context.resolvedWorkflowType,
    requestedSettings: requestedSettingsForOutput(context),
    sourceMetadata: sourceMetadataForDimensions(image.width, image.height),
    submissionId: context.submissionId ?? null,
    providerOutputId: `${run.jobId ?? run.id}:character:${image.id}`,
    outputIndex,
    outputCount,
    pricing: result.pricing ?? run.pricing ?? null,
    status: 'ready',
    createdAt: image.createdAt || context.createdAt || new Date().toISOString(),
    sourceShotId: context.sourceShotId,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? image.url,
    hasAudio: false,
    audioProvenance: 'none',
    jobId: run.jobId,
  }));
}

async function submitCharacterBuilderGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata[]> {
  const references = workspaceCharacterReferenceUrlsForGeneration(params);
  const result = await runCharacterBuilderTool(buildWorkspaceCharacterBuilderRequest({
    settings: params.settings,
    prompt: params.prompt,
    identityImageUrls: references.identityImageUrls,
    styleImageUrls: references.styleImageUrls,
    jobId: `studio_character_${crypto.randomUUID()}`,
  }));
  const outputs = mapWorkspaceCharacterBuilderOutputs(result, mappingContextFromRoute(params));
  if (!outputs.length) {
    throw new Error('Character Builder returned no image output.');
  }
  return outputs;
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

async function submitStoryboardGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata[]> {
  const referenceImages = referenceImagesFor(params);
  const result = await runImageGeneration(buildWorkspaceStoryboardGenerationRequest({
    settings: params.settings,
    prompt: params.prompt,
    referenceImages,
  }));
  if (!result.images.some((image) => Boolean(image.url))) {
    throw new Error('Storyboard generation returned no image output.');
  }
  const storyboardSettings: WorkspaceShotSettings = {
    ...params.settings,
    durationSec: params.settings.toolSettings?.storyboard?.durationSec ?? getStoryboardLengthPreset(
      params.settings.toolSettings?.storyboard?.lengthPreset ?? 'medium'
    ).durationSec,
    aspectRatio: params.settings.toolSettings?.storyboard?.orientation === 'portrait' ? '9:16' : '16:9',
    outputCount: result.images.length,
  };
  return mapWorkspaceImageGenerationOutputs(result, {
    ...mappingContextFromRoute(params),
    settings: storyboardSettings,
  });
}

export function mapWorkspaceAngleGenerationOutputs(
  result: AngleToolResponse,
  context: WorkspaceOutputMappingContext
): WorkspaceOutputMetadata[] {
  const createdAt = context.createdAt ?? new Date().toISOString();
  const outputCount = result.outputs.length;
  const providerRunId = result.jobId ?? result.requestId ?? result.providerJobId ?? context.submissionId ?? context.sourceShotId;
  return result.outputs.map((image, outputIndex) => ({
    kind: 'image',
    modelId: result.engineId,
    modelLabel: result.engineLabel ?? context.capability?.label ?? context.settings.modelId,
    workflowType: context.resolvedWorkflowType,
    requestedSettings: requestedSettingsForOutput(context),
    sourceMetadata: sourceMetadataForDimensions(image.width, image.height),
    submissionId: context.submissionId ?? null,
    providerOutputId: `${providerRunId}:angle:${image.assetId ?? outputIndex + 1}`,
    outputIndex,
    outputCount,
    pricing: pricingSnapshotFromToolPricing(result.pricing),
    status: 'ready',
    createdAt,
    sourceShotId: context.sourceShotId,
    url: image.url,
    audioUrl: null,
    thumbUrl: image.thumbUrl ?? image.url,
    hasAudio: false,
    audioProvenance: 'none',
    jobId: result.jobId ?? result.requestId ?? null,
  }));
}

async function submitAngleGeneration(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata[]> {
  const imageUrl = referenceImagesFor(params)[0];
  if (!imageUrl) {
    throw new Error('A source image is required for angle generation.');
  }
  const result = await runAngleTool(buildWorkspaceAngleToolRequest({
    settings: params.settings,
    imageUrl,
    engineId: angleEngineIdForStudioModel(params.settings.modelId),
  }));
  const outputs = mapWorkspaceAngleGenerationOutputs(result, mappingContextFromRoute(params));
  if (!outputs.length) {
    throw new Error('Angle tool returned no image output.');
  }
  return outputs;
}

export async function submitWorkspaceGenerationByFamily(params: WorkspaceGenerationRouteParams): Promise<WorkspaceOutputMetadata[]> {
  const route = resolveWorkspaceGenerationRoute(params.settings);
  if (route === 'character-builder') return submitCharacterBuilderGeneration(params);
  if (route === 'storyboard') return submitStoryboardGeneration(params);
  if (route === 'angle') return submitAngleGeneration(params);
  if (route === 'image') return submitImageGeneration(params);
  if (route === 'audio') return [await submitAudioGeneration(params)];
  if (route === 'upscale') return [await submitUpscaleGeneration(params)];
  if (route === 'unsupported') throw new Error('This Studio block does not support generation through media routes.');
  return [await submitVideoGeneration(params)];
}
