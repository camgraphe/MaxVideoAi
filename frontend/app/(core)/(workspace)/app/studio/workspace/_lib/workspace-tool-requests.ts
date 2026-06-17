import type { AudioGenerateRequestBody, AudioPackId } from '@/lib/audio-generation';
import { getAudioPackConfig } from '@/lib/audio-generation';
import type { CharacterBuilderRequest } from '@/types/character-builder';
import type { ImageGenerationRequest } from '@/types/image-generation';
import type { AngleToolEngineId, AngleToolRequest } from '@/types/tools-angle';
import type {
  UpscaleMediaType,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolRequest,
} from '@/types/tools-upscale';
import type { WorkspacePolicyControlField, WorkspaceShotSettings } from './workspace-types';
import type { WorkspaceBlockPolicyResult } from './models/workspace-block-capability-policy';
import { normalizeWorkspaceCharacterBuilderSettings } from './workspace-tool-settings';

type BuildWorkspaceCharacterBuilderRequestInput = {
  settings: WorkspaceShotSettings;
  prompt: string;
  identityImageUrls: string[];
  styleImageUrls: string[];
  jobId?: string | null;
};

function mergeNotes(primary: string, secondary: string): string {
  return [primary.trim(), secondary.trim()].filter(Boolean).join('\n\n');
}

type WorkspaceRequestPolicy = Pick<
  WorkspaceBlockPolicyResult,
  'controlFields' | 'outputCount' | 'outputMediaKind' | 'pricingRelevantFields'
> | null | undefined;

function policyAllowsField(
  policy: WorkspaceRequestPolicy,
  field: WorkspacePolicyControlField
): boolean {
  return !policy || policy.controlFields.includes(field);
}

function outputCountForImageRequest(policy: WorkspaceRequestPolicy): number {
  const count = policy?.outputCount;
  if (typeof count === 'number') return Math.max(1, count);
  return 1;
}

function optionalString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildWorkspaceImageGenerationRequest({
  settings,
  prompt,
  referenceImages,
  policy,
}: {
  settings: WorkspaceShotSettings;
  prompt: string;
  referenceImages: string[];
  policy?: WorkspaceRequestPolicy;
}): ImageGenerationRequest {
  const imageUrls = referenceImages.filter((url) => url.trim().length > 0);
  return {
    mode: imageUrls.length ? 'i2i' : 't2i',
    prompt,
    numImages: outputCountForImageRequest(policy),
    ...(imageUrls.length ? { imageUrls } : {}),
    allowIndex: false,
    indexable: false,
    visibility: 'private',
    ...(typeof settings.seed === 'number' ? { seed: settings.seed } : {}),
    engineId: settings.modelId,
    ...(policyAllowsField(policy, 'aspectRatio') ? { aspectRatio: settings.aspectRatio } : {}),
    ...(policyAllowsField(policy, 'resolution') ? { resolution: settings.resolution } : {}),
  };
}

function angleEngineIdForStudioModel(modelId: string): AngleToolEngineId {
  if (modelId === 'angle-qwen-multiple-angles') return 'qwen-multiple-angles';
  return 'flux-multiple-angles';
}

export function buildWorkspaceAngleToolRequest({
  settings,
  imageUrl,
  engineId,
}: {
  settings: WorkspaceShotSettings;
  imageUrl: string;
  engineId?: AngleToolEngineId;
}): AngleToolRequest {
  const angleSettings = settings.toolSettings?.angle;
  return {
    imageUrl,
    engineId: engineId ?? angleEngineIdForStudioModel(settings.modelId),
    params: {
      rotation: angleSettings?.rotation ?? 35,
      tilt: angleSettings?.tilt ?? 0,
      zoom: angleSettings?.zoom ?? 1,
    },
    safeMode: angleSettings?.safeMode ?? true,
    generateBestAngles: angleSettings?.generateBestAngles ?? false,
  };
}

export function upscaleTargetResolutionForSettings(settings: WorkspaceShotSettings): UpscaleTargetResolution {
  if (settings.resolution === '4k') return '2160p';
  if (settings.resolution === '1440p') return '1440p';
  if (settings.resolution === '720p') return '720p';
  return '1080p';
}

export function buildWorkspaceUpscaleToolRequest({
  settings,
  mediaType,
  mediaUrl,
  engineId,
}: {
  settings: WorkspaceShotSettings;
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  engineId: UpscaleToolEngineId;
}): UpscaleToolRequest {
  const upscaleSettings = settings.toolSettings?.upscale;
  return {
    mediaType,
    mediaUrl,
    engineId,
    mode: upscaleSettings?.mode ?? 'target',
    upscaleFactor: upscaleSettings?.upscaleFactor,
    targetResolution: upscaleTargetResolutionForSettings(settings),
    outputFormat: upscaleSettings?.outputFormat as UpscaleOutputFormat | undefined,
  };
}

export function buildWorkspaceAudioGenerateRequest({
  settings,
  pack,
  prompt,
  sourceVideoUrl,
}: {
  settings: WorkspaceShotSettings;
  pack: AudioPackId;
  prompt: string;
  sourceVideoUrl?: string | null;
}): AudioGenerateRequestBody {
  const config = getAudioPackConfig(pack);
  const audioSettings = settings.toolSettings?.audio;
  const trimmedPrompt = prompt.trim();
  const request: AudioGenerateRequestBody = {
    ...(optionalString(sourceVideoUrl) ? { sourceVideoUrl: optionalString(sourceVideoUrl) } : {}),
    pack,
    ...(pack === 'voice_only' ? {} : trimmedPrompt ? { prompt: trimmedPrompt } : {}),
    ...(config.requiresMood ? { mood: audioSettings?.mood ?? 'epic' } : {}),
    intensity: audioSettings?.intensity ?? 'standard',
    ...(config.includesVoice && trimmedPrompt ? { script: trimmedPrompt } : {}),
    ...(config.includesVoice && audioSettings?.voiceGender ? { voiceGender: audioSettings.voiceGender } : {}),
    ...(config.includesVoice && audioSettings?.voiceProfile ? { voiceProfile: audioSettings.voiceProfile } : {}),
    ...(config.includesVoice && audioSettings?.voiceDelivery ? { voiceDelivery: audioSettings.voiceDelivery } : {}),
    ...(config.includesVoice && audioSettings?.language ? { language: audioSettings.language } : {}),
    durationSec: settings.durationSec,
    ...(config.supportsMusicToggle
      ? { musicEnabled: audioSettings?.musicEnabled ?? config.defaultMusicEnabled }
      : {}),
  };
  return request;
}

export function buildWorkspaceCharacterBuilderRequest({
  settings,
  prompt,
  identityImageUrls,
  styleImageUrls,
  jobId,
}: BuildWorkspaceCharacterBuilderRequestInput): CharacterBuilderRequest {
  const sourceMode = identityImageUrls.length ? 'reference-image' : 'scratch';
  const characterSettings = normalizeWorkspaceCharacterBuilderSettings(
    settings.toolSettings?.characterBuilder,
    sourceMode
  );
  const referenceImages: CharacterBuilderRequest['referenceImages'] = [
    ...identityImageUrls.slice(0, 2).map((url, index) => ({
      id: `studio-character-identity-${index + 1}`,
      url,
      role: 'identity' as const,
      name: `Identity ${index + 1}`,
    })),
    ...styleImageUrls.slice(0, Math.max(0, 2 - identityImageUrls.length)).map((url, index) => ({
      id: `studio-character-style-${index + 1}`,
      url,
      role: 'style' as const,
      name: `Style ${index + 1}`,
    })),
  ];

  return {
    jobId: jobId ?? null,
    action: 'generate',
    sourceMode,
    outputMode: characterSettings.outputMode,
    consistencyMode: characterSettings.consistencyMode,
    referenceStrength: sourceMode === 'reference-image' ? characterSettings.referenceStrength : null,
    qualityMode: characterSettings.qualityMode,
    formatMode: characterSettings.formatMode,
    referenceImages,
    traits: characterSettings.traits,
    outputOptions: characterSettings.outputOptions,
    advancedNotes: mergeNotes(characterSettings.advancedNotes, prompt),
    mustRemainVisible: characterSettings.mustRemainVisible,
    generateCount: characterSettings.generateCount,
    selectedResultId: null,
    selectedResultUrl: null,
    pinnedReferenceResultId: null,
    pinnedReferenceResultUrl: null,
    lineage: {
      parentResultId: null,
      parentRunId: null,
      pinnedReferenceResultId: null,
    },
  };
}
