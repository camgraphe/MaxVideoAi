import type { runGenerate } from '@/lib/api';
import { toLumaRay2DurationLabel, type LumaRay2DurationLabel } from '@/lib/luma-ray2';
import type { EngineModeUiCaps, Mode } from '@/types/engines';
import type {
  GenerationAttachmentPayload,
  GenerationKlingElementPayload,
} from './workspace-generation-inputs';
import type { FormState } from './workspace-form-state';
import type { LumaRay2GenerationContext } from './workspace-generation-guards';

export type WorkspaceGeneratePayload = Parameters<typeof runGenerate>[0] & {
  imageUrl?: string;
  referenceImages?: string[];
};

export type WorkspaceGeneratePayloadBuildResult = {
  payload: WorkspaceGeneratePayload;
  resolvedDurationSeconds: number;
};

export type BuildWorkspaceGeneratePayloadOptions = {
  selectedEngineId: string;
  activeMode: Mode;
  submissionMode: Mode | string;
  form: FormState;
  trimmedPrompt: string;
  trimmedNegativePrompt: string;
  effectiveDurationSec: number;
  memberTier?: string;
  paymentMode: 'wallet' | 'platform';
  cfgScale?: number | null;
  capability?: EngineModeUiCaps | null;
  supportsNegativePrompt: boolean;
  supportsAudioToggle: boolean;
  isSeedance: boolean;
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  voiceIds: string[];
  voiceControlEnabled: boolean;
  shotType: 'customize' | 'intelligent';
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  friendlyMessage: string;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  lumaContext: Pick<LumaRay2GenerationContext, 'isLumaRay2GenerateWorkflow' | 'lumaDuration' | 'lumaResolution'>;
  inputsPayload?: GenerationAttachmentPayload[];
  primaryImageUrl?: string;
  primaryAudioUrl?: string;
  referenceImageUrls: string[];
  endImageUrl?: string;
  extraInputValues: Record<string, unknown>;
  multiPromptPayload?: Array<{ prompt: string; duration: number }>;
  klingElementsPayload?: GenerationKlingElementPayload[];
};

export function buildWorkspaceGeneratePayload(
  options: BuildWorkspaceGeneratePayloadOptions
): WorkspaceGeneratePayloadBuildResult {
  const shouldSendAspectRatio =
    !options.capability || (options.capability.aspectRatio?.length ?? 0) > 0;
  const resolvedDurationSeconds =
    options.lumaContext.isLumaRay2GenerateWorkflow && options.lumaContext.lumaDuration
      ? options.lumaContext.lumaDuration.seconds
      : options.effectiveDurationSec;
  const durationOptionLabel: LumaRay2DurationLabel | undefined =
    typeof options.form.durationOption === 'string'
      ? (['5s', '9s'].includes(options.form.durationOption)
          ? (options.form.durationOption as LumaRay2DurationLabel)
          : undefined)
      : undefined;
  const resolvedDurationLabel =
    options.lumaContext.isLumaRay2GenerateWorkflow && options.lumaContext.lumaDuration
      ? options.lumaContext.lumaDuration.label
      : toLumaRay2DurationLabel(options.effectiveDurationSec, durationOptionLabel) ??
        durationOptionLabel ??
        options.effectiveDurationSec;
  const shouldSendDuration = !options.capability || Boolean(options.capability.duration || options.capability.frames);
  const shouldSendResolution = !options.capability || (options.capability.resolution?.length ?? 0) > 0;
  const resolvedResolution =
    options.lumaContext.isLumaRay2GenerateWorkflow && options.lumaContext.lumaResolution
      ? options.lumaContext.lumaResolution.value
      : options.form.resolution;
  const shouldSendFps =
    !options.capability ||
    (Array.isArray(options.capability.fps) ? options.capability.fps.length > 0 : typeof options.capability.fps === 'number');
  const seedNumber =
    typeof options.form.seed === 'number' && Number.isFinite(options.form.seed)
      ? Math.trunc(options.form.seed)
      : undefined;
  const cameraFixed = typeof options.form.cameraFixed === 'boolean' ? options.form.cameraFixed : undefined;
  const safetyChecker = typeof options.form.safetyChecker === 'boolean' ? options.form.safetyChecker : undefined;

  const payload: WorkspaceGeneratePayload = {
    engineId: options.selectedEngineId,
    prompt: options.trimmedPrompt,
    mode: options.submissionMode,
    durationSec: resolvedDurationSeconds,
    membershipTier: options.memberTier,
    payment: { mode: options.paymentMode },
    cfgScale: typeof options.cfgScale === 'number' ? options.cfgScale : undefined,
    ...(options.selectedEngineId.startsWith('sora-2')
      ? { variant: options.selectedEngineId === 'sora-2-pro' ? 'sora2pro' : 'sora2' }
      : {}),
    ...(shouldSendDuration ? { durationOption: resolvedDurationLabel } : {}),
    ...(options.form.numFrames != null ? { numFrames: options.form.numFrames } : {}),
    ...(shouldSendResolution ? { resolution: resolvedResolution } : {}),
    ...(shouldSendFps ? { fps: options.form.fps } : {}),
    ...(shouldSendAspectRatio ? { aspectRatio: options.form.aspectRatio } : {}),
    ...(options.supportsNegativePrompt && options.trimmedNegativePrompt
      ? { negativePrompt: options.trimmedNegativePrompt }
      : {}),
    ...(options.supportsAudioToggle ? { audio: options.form.audio } : {}),
    ...(options.inputsPayload ? { inputs: options.inputsPayload } : {}),
    ...(options.primaryImageUrl ? { imageUrl: options.primaryImageUrl } : {}),
    ...(options.primaryAudioUrl ? { audioUrl: options.primaryAudioUrl } : {}),
    ...(options.referenceImageUrls.length ? { referenceImages: options.referenceImageUrls } : {}),
    ...(options.endImageUrl ? { endImageUrl: options.endImageUrl } : {}),
    ...(Object.keys(options.extraInputValues).length ? { extraInputValues: options.extraInputValues } : {}),
    ...(options.multiPromptPayload && options.multiPromptPayload.length ? { multiPrompt: options.multiPromptPayload } : {}),
    ...(options.supportsKlingV3Controls
      ? {
          shotType: options.activeMode === 'i2v' ? 'customize' : options.shotType,
          ...(options.supportsKlingV3VoiceControl && options.voiceIds.length ? { voiceIds: options.voiceIds } : {}),
          ...(options.voiceControlEnabled ? { voiceControl: true } : {}),
          ...(options.klingElementsPayload ? { elements: options.klingElementsPayload } : {}),
        }
      : {}),
    ...(options.isSeedance
      ? {
          ...(typeof seedNumber === 'number' ? { seed: seedNumber } : {}),
          ...(typeof cameraFixed === 'boolean' ? { cameraFixed } : {}),
          ...(typeof safetyChecker === 'boolean' ? { safetyChecker } : {}),
        }
      : {}),
    idempotencyKey: options.localKey,
    batchId: options.batchId,
    groupId: options.batchId,
    iterationIndex: options.iterationIndex,
    iterationCount: options.iterationCount,
    localKey: options.localKey,
    message: options.friendlyMessage,
    etaSeconds: options.etaSeconds,
    etaLabel: options.etaLabel,
    visibility: 'private',
    indexable: false,
    ...(options.lumaContext.isLumaRay2GenerateWorkflow ? { loop: Boolean(options.form.loop) } : {}),
  };

  return {
    payload,
    resolvedDurationSeconds,
  };
}
