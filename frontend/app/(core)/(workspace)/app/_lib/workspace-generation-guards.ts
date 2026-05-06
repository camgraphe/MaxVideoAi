import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2AspectRatio,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  LUMA_RAY2_ERROR_UNSUPPORTED,
} from '@/lib/luma-ray2';
import type { Mode } from '@/types/engines';
import type { GenerationAttachmentPayload } from './workspace-generation-inputs';
import { normalizeExtraInputValue, type FormState } from './workspace-form-state';
import type { WorkspaceInputFieldEntry, WorkspaceInputSchemaSummary } from './workspace-input-schema';
import type { ReferenceAsset } from './workspace-assets';

export type LumaRay2GenerationContext = {
  isLumaRay2: boolean;
  isLumaRay2GenerateWorkflow: boolean;
  isLumaRay2ReframeWorkflow: boolean;
  lumaDuration: ReturnType<typeof getLumaRay2DurationInfo> | null;
  lumaResolution: ReturnType<typeof getLumaRay2ResolutionInfo> | null;
  lumaAspectOk: boolean;
};

export type GetLumaRay2GenerationContextOptions = {
  selectedEngineId: string;
  submissionMode: string;
  form: Pick<FormState, 'durationOption' | 'durationSec' | 'resolution' | 'aspectRatio'>;
};

export type StartRenderValidationOptions = {
  audioWorkflowUnsupported: boolean;
  audioUnsupportedMessage: string;
  multiPromptActive: boolean;
  multiPromptInvalid: boolean;
  multiPromptError?: string | null;
  promptLength: number;
  promptCharLimitExceeded: boolean;
  promptMaxChars?: number | null;
  selectedEngineLabel: string;
  trimmedPrompt: string;
  trimmedNegativePrompt: string;
  inputSchemaSummary: Pick<
    WorkspaceInputSchemaSummary,
    | 'promptRequired'
    | 'negativePromptField'
    | 'negativePromptRequired'
    | 'assetFields'
  >;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  extraInputFields: WorkspaceInputFieldEntry[];
  form: Pick<FormState, 'extraInputValues'>;
  lumaContext: LumaRay2GenerationContext;
};

export type GenerationIterationGuardOptions = {
  selectedEngineId: string;
  submissionMode: Mode | string;
  allowsUnifiedVeoFirstLast: boolean;
  hasLastFrameInput: boolean;
  isUnifiedSeedance: boolean;
  primaryImageUrl?: string;
  primaryAudioUrl?: string;
  primaryAssetFieldLabel: string;
  referenceImageUrls: string[];
  referenceVideoUrls: string[];
  referenceAudioUrls: string[];
  inputsPayload?: GenerationAttachmentPayload[];
  primaryAttachment: GenerationAttachmentPayload | null;
  addReferenceMediaBeforeAudioMessage?: string;
  extendOrRetakeSourceVideoMessage: string;
};

export function getLumaRay2GenerationContext({
  selectedEngineId,
  submissionMode,
  form,
}: GetLumaRay2GenerationContextOptions): LumaRay2GenerationContext {
  const isLumaRay2 = isLumaRay2EngineId(selectedEngineId);
  const isLumaRay2GenerateWorkflow = isLumaRay2 && isLumaRay2GenerateMode(submissionMode);
  const isLumaRay2ReframeWorkflow = isLumaRay2 && submissionMode === 'reframe';
  const lumaDuration = isLumaRay2 ? getLumaRay2DurationInfo(form.durationOption ?? form.durationSec) : null;
  const lumaResolution = isLumaRay2 ? getLumaRay2ResolutionInfo(form.resolution) : null;
  const lumaAspectOk =
    !isLumaRay2 || isLumaRay2AspectRatio(form.aspectRatio, { includeSquare: isLumaRay2ReframeWorkflow });

  return {
    isLumaRay2,
    isLumaRay2GenerateWorkflow,
    isLumaRay2ReframeWorkflow,
    lumaDuration,
    lumaResolution,
    lumaAspectOk,
  };
}

export function supportsNegativePromptInput(
  inputSchemaSummary: Pick<WorkspaceInputSchemaSummary, 'negativePromptField'>
): boolean {
  return Boolean(inputSchemaSummary.negativePromptField);
}

export function getStartRenderValidationMessage(options: StartRenderValidationOptions): string | null {
  if (options.audioWorkflowUnsupported) {
    return options.audioUnsupportedMessage;
  }

  if (options.multiPromptActive && options.multiPromptInvalid) {
    return options.multiPromptError ?? 'Multi-prompt requires a prompt per scene and a valid total duration.';
  }

  if (options.promptCharLimitExceeded && typeof options.promptMaxChars === 'number') {
    const overflow = options.promptLength - options.promptMaxChars;
    return `Prompt is ${overflow} character${overflow === 1 ? '' : 's'} over the ${options.promptMaxChars}-character limit for ${options.selectedEngineLabel}.`;
  }

  if (options.inputSchemaSummary.promptRequired && !options.trimmedPrompt) {
    return 'A prompt is required for this engine and mode.';
  }

  const supportsNegativePrompt = supportsNegativePromptInput(options.inputSchemaSummary);
  if (
    supportsNegativePrompt &&
    options.inputSchemaSummary.negativePromptRequired &&
    !options.trimmedNegativePrompt
  ) {
    const label = options.inputSchemaSummary.negativePromptField?.label ?? 'Negative prompt';
    return `${label} is required before generating.`;
  }

  const missingAssetField = options.inputSchemaSummary.assetFields.find(({ field, required }) => {
    if (!required) return false;
    const minCount = field.minCount ?? 1;
    const current = options.inputAssets[field.id]?.filter((asset) => asset !== null).length ?? 0;
    return current < minCount;
  });
  if (missingAssetField) {
    return `${missingAssetField.field.label} is required before generating.`;
  }

  const missingGenericField = options.extraInputFields.find(({ field, required }) => {
    if (!required) return false;
    const value = normalizeExtraInputValue(field, options.form.extraInputValues[field.id] ?? field.default);
    return value === undefined;
  });
  if (missingGenericField) {
    return `${missingGenericField.field.label} is required before generating.`;
  }

  if (
    (options.lumaContext.isLumaRay2GenerateWorkflow &&
      (!options.lumaContext.lumaDuration || !options.lumaContext.lumaResolution || !options.lumaContext.lumaAspectOk)) ||
    (options.lumaContext.isLumaRay2ReframeWorkflow && !options.lumaContext.lumaAspectOk)
  ) {
    return LUMA_RAY2_ERROR_UNSUPPORTED;
  }

  return null;
}

export function getGenerationIterationGuardMessage(options: GenerationIterationGuardOptions): string | null {
  const isImageDrivenMode = options.submissionMode === 'i2v' || options.submissionMode === 'i2i';
  const isReferenceImageMode = options.submissionMode === 'ref2v';
  const isFirstLastMode = options.submissionMode === 'fl2v';
  const firstFrameAttachment = isFirstLastMode
    ? options.inputsPayload?.find((attachment) => attachment.slotId === 'first_frame_url') ?? options.primaryAttachment
    : null;
  const lastFrameAttachment = isFirstLastMode
    ? options.inputsPayload?.find((attachment) => attachment.slotId === 'last_frame_url') ?? null
    : null;

  if (options.allowsUnifiedVeoFirstLast && options.hasLastFrameInput && !options.primaryImageUrl) {
    return 'Add a start image before using Last frame with Veo.';
  }

  if (isImageDrivenMode && !options.primaryImageUrl) {
    return options.selectedEngineId.startsWith('sora-2')
      ? 'Ajoutez une image (URL ou fichier) pour lancer Image → Video avec Sora.'
      : `Add at least one ${options.primaryAssetFieldLabel.toLowerCase()} (URL or upload) before running this mode.`;
  }

  if (isReferenceImageMode) {
    if (options.isUnifiedSeedance) {
      if (options.referenceImageUrls.length === 0 && options.referenceVideoUrls.length === 0) {
        return options.referenceAudioUrls.length > 0
          ? options.addReferenceMediaBeforeAudioMessage ?? 'Add reference media before adding audio.'
          : 'Add at least one reference image or reference video before running Seedance Reference → Video.';
      }
    } else if (options.referenceImageUrls.length === 0) {
      return options.selectedEngineId === 'happy-horse-1-0'
        ? 'Add 1–9 reference images before running Happy Horse R2V.'
        : 'Add 1–4 reference images before running Reference → Video.';
    }
  }

  if (options.submissionMode === 'r2v' && options.referenceVideoUrls.length === 0) {
    return 'Add 1–3 reference videos (MP4/MOV) before running Reference → Video.';
  }

  if (options.submissionMode === 'a2v' && !options.primaryAudioUrl) {
    return 'Add an audio file before running Audio → Video.';
  }

  if (
    (options.submissionMode === 'extend' || options.submissionMode === 'retake') &&
    options.referenceVideoUrls.length === 0
  ) {
    return options.extendOrRetakeSourceVideoMessage;
  }

  if (isFirstLastMode) {
    if (!firstFrameAttachment || !lastFrameAttachment) {
      return 'Upload both a start image and last frame before generating with Veo.';
    }
    const sameSource =
      firstFrameAttachment.assetId && lastFrameAttachment.assetId
        ? firstFrameAttachment.assetId === lastFrameAttachment.assetId
        : firstFrameAttachment.url === lastFrameAttachment.url;
    if (sameSource) {
      return 'First and last frames must be two different images for this engine.';
    }
  }

  return null;
}
