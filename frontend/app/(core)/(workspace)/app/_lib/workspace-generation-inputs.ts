import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import type { EngineCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';
import { normalizeExtraInputValue, type FormState } from './workspace-form-state';
import type { WorkspaceInputFieldEntry, WorkspaceInputSchemaSummary } from './workspace-input-schema';

export type GenerationAttachmentPayload = {
  name: string;
  type: string;
  size: number;
  kind: 'image' | 'video' | 'audio';
  slotId?: string;
  label?: string;
  url: string;
  width?: number | null;
  height?: number | null;
  assetId?: string;
};

export type GenerationKlingElementPayload = {
  frontalImageUrl?: string;
  referenceImageUrls?: string[];
  videoUrl?: string;
};

export type GenerationInputPreparationResult =
  | {
      ok: true;
      inputsPayload?: GenerationAttachmentPayload[];
      primaryAttachment: GenerationAttachmentPayload | null;
      referenceImageUrls: string[];
      referenceVideoUrls: string[];
      referenceAudioUrls: string[];
      primaryImageUrl?: string;
      primaryAudioUrl?: string;
      endImageUrl?: string;
      extraInputValues: Record<string, unknown>;
      klingElementsPayload?: GenerationKlingElementPayload[];
      multiPromptPayload?: Array<{ prompt: string; duration: number }>;
    }
  | {
      ok: false;
      message: string;
    };

export type PrepareGenerationInputsOptions = {
  selectedEngineId: string;
  activeMode: Mode;
  submissionMode: string;
  form: FormState;
  inputSchema: EngineCaps['inputSchema'] | null | undefined;
  inputSchemaSummary: Pick<WorkspaceInputSchemaSummary, 'assetFields'>;
  extraInputFields: WorkspaceInputFieldEntry[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  primaryAssetFieldIds: ReadonlySet<string>;
  referenceAssetFieldIds: ReadonlySet<string>;
  genericImageFieldIds: ReadonlySet<string>;
  frameAssetFieldIds: ReadonlySet<string>;
  referenceAudioFieldIds: ReadonlySet<string>;
  supportsKlingV3Controls: boolean;
  klingElements: KlingElementState[];
  multiPromptActive: boolean;
  multiPromptScenes: MultiPromptScene[];
};

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index, self) => self.indexOf(value) === index);
}

function buildAttachmentPayload(
  field: { id: string; label?: string },
  asset: ReferenceAsset & { url: string }
): GenerationAttachmentPayload {
  return {
    name: asset.name,
    type: asset.type || (asset.kind === 'image' ? 'image/*' : asset.kind === 'audio' ? 'audio/*' : 'video/*'),
    size: asset.size,
    kind: asset.kind,
    slotId: field.id,
    label: field.label,
    url: asset.url,
    width: asset.width,
    height: asset.height,
    assetId: asset.assetId,
  };
}

function buildKlingElementsPayload(
  options: Pick<PrepareGenerationInputsOptions, 'supportsKlingV3Controls' | 'form' | 'klingElements'>
): GenerationInputPreparationResult {
  if (!options.supportsKlingV3Controls || options.form.mode !== 'i2v') {
    return {
      ok: true,
      primaryAttachment: null,
      referenceImageUrls: [],
      referenceVideoUrls: [],
      referenceAudioUrls: [],
      extraInputValues: {},
    };
  }

  let videoCount = 0;
  const collected: GenerationKlingElementPayload[] = [];
  for (const element of options.klingElements) {
    const frontal = element.frontal;
    const references = element.references.filter((asset): asset is KlingElementAsset => Boolean(asset));
    const video = element.video;
    const hasAnyAsset = Boolean(frontal || references.length || video);
    if (!hasAnyAsset) {
      continue;
    }

    const assetsToCheck = [frontal, ...references, video].filter(Boolean) as KlingElementAsset[];
    for (const asset of assetsToCheck) {
      if (asset.status === 'uploading') {
        return { ok: false, message: 'Please wait for element uploads to finish before generating.' };
      }
      if (asset.status === 'error' || !asset.url) {
        return { ok: false, message: 'One of your element assets failed to upload. Remove it and try again.' };
      }
    }

    const frontalUrl = frontal?.url;
    const referenceUrls = references.map((asset) => asset.url).filter((url): url is string => Boolean(url));
    const videoUrl = video?.url;
    if (videoUrl) {
      videoCount += 1;
    }
    const hasImageSet = Boolean(frontalUrl && referenceUrls.length > 0);
    const hasVideoReference = Boolean(videoUrl);
    if (!hasImageSet && !hasVideoReference) {
      return {
        ok: false,
        message: 'Each Kling element needs a frontal image plus at least one reference image, or one video reference.',
      };
    }
    collected.push({
      frontalImageUrl: frontalUrl,
      referenceImageUrls: referenceUrls.length ? referenceUrls : undefined,
      videoUrl,
    });
  }

  if (videoCount > 1) {
    return { ok: false, message: 'Only one Kling element can include a video reference.' };
  }

  return {
    ok: true,
    primaryAttachment: null,
    referenceImageUrls: [],
    referenceVideoUrls: [],
    referenceAudioUrls: [],
    extraInputValues: {},
    klingElementsPayload: collected.length ? collected : undefined,
  };
}

export function prepareGenerationInputs(options: PrepareGenerationInputsOptions): GenerationInputPreparationResult {
  const fieldIndex = new Map<string, { id: string; label?: string }>();
  if (options.inputSchema) {
    [...(options.inputSchema.required ?? []), ...(options.inputSchema.optional ?? [])].forEach((field) => {
      fieldIndex.set(field.id, field);
    });
  }

  const orderedAttachments: Array<{ field: { id: string; label?: string }; asset: ReferenceAsset }> = [];
  options.inputSchemaSummary.assetFields.forEach(({ field }) => {
    const items = options.inputAssets[field.id] ?? [];
    items.forEach((asset) => {
      if (!asset) return;
      orderedAttachments.push({ field, asset });
    });
  });

  Object.entries(options.inputAssets).forEach(([fieldId, items]) => {
    if (orderedAttachments.some((entry) => entry.field.id === fieldId)) return;
    const field = fieldIndex.get(fieldId);
    if (!field) return;
    items.forEach((asset) => {
      if (!asset) return;
      orderedAttachments.push({ field, asset });
    });
  });

  let inputsPayload: GenerationAttachmentPayload[] | undefined;
  if (orderedAttachments.length) {
    const collected: GenerationAttachmentPayload[] = [];
    for (const { field, asset } of orderedAttachments) {
      const assetUrl = asset.url;
      if (asset.status === 'uploading') {
        return { ok: false, message: 'Please wait for uploads to finish before generating.' };
      }
      if (asset.status === 'error' || !assetUrl) {
        return { ok: false, message: 'One of your reference files is unavailable. Remove it and try again.' };
      }
      collected.push(buildAttachmentPayload(field, { ...asset, url: assetUrl }));
    }
    if (collected.length) {
      inputsPayload = collected;
    }
  }

  const referenceSlots = options.referenceAssetFieldIds.size > 0
    ? options.referenceAssetFieldIds
    : options.genericImageFieldIds;
  const activeReferenceSlots =
    options.selectedEngineId === 'happy-horse-1-0'
      ? options.submissionMode === 'v2v'
        ? new Set(['reference_image_urls'])
        : options.submissionMode === 'ref2v'
          ? new Set(['image_urls'])
          : referenceSlots
      : referenceSlots;
  const primaryAttachment =
    inputsPayload?.find(
      (attachment) => typeof attachment.slotId === 'string' && options.primaryAssetFieldIds.has(attachment.slotId)
    ) ?? null;
  const referenceImageUrls = inputsPayload
    ? uniqueValues(
        inputsPayload
          .filter((attachment) => {
            if (attachment.kind !== 'image' || typeof attachment.url !== 'string') return false;
            const slotId = attachment.slotId;
            if (slotId && options.primaryAssetFieldIds.has(slotId)) return false;
            if (slotId && options.frameAssetFieldIds.has(slotId)) return false;
            if (!slotId) return activeReferenceSlots.size === 0;
            if (activeReferenceSlots.size === 0) {
              return !options.primaryAssetFieldIds.has(slotId);
            }
            return activeReferenceSlots.has(slotId);
          })
          .map((attachment) => attachment.url)
      )
    : [];
  const referenceVideoUrls = inputsPayload
    ? uniqueValues(
        inputsPayload
          .filter((attachment) => attachment.kind === 'video' && typeof attachment.url === 'string')
          .map((attachment) => attachment.url)
      )
    : [];
  const referenceAudioUrls = inputsPayload
    ? uniqueValues(
        inputsPayload
          .filter(
            (attachment) =>
              attachment.kind === 'audio' &&
              typeof attachment.url === 'string' &&
              typeof attachment.slotId === 'string' &&
              options.referenceAudioFieldIds.has(attachment.slotId)
          )
          .map((attachment) => attachment.url)
      )
    : [];

  const primaryImageUrl =
    primaryAttachment?.url ??
    (options.activeMode === 'i2v' || options.activeMode === 'i2i' ? referenceImageUrls[0] : undefined);
  const primaryAudioUrl =
    inputsPayload?.find(
      (attachment) =>
        attachment.kind === 'audio' &&
        typeof attachment.url === 'string' &&
        !(typeof attachment.slotId === 'string' && options.referenceAudioFieldIds.has(attachment.slotId))
    )?.url ?? undefined;
  const endImageUrl =
    inputsPayload?.find((attachment) => attachment.slotId === 'end_image_url' && typeof attachment.url === 'string')
      ?.url ?? undefined;
  const extraInputValues = options.extraInputFields.reduce<Record<string, unknown>>((acc, { field }) => {
    const normalized = normalizeExtraInputValue(field, options.form.extraInputValues[field.id] ?? field.default);
    if (normalized !== undefined) {
      acc[field.id] = normalized;
    }
    return acc;
  }, {});

  const klingResult = buildKlingElementsPayload(options);
  if (!klingResult.ok) {
    return klingResult;
  }

  const multiPromptPayload = options.multiPromptActive
    ? options.multiPromptScenes
        .filter((scene) => scene.prompt.trim().length)
        .map((scene) => ({ prompt: scene.prompt.trim(), duration: Math.round(scene.duration || 0) }))
    : undefined;

  return {
    ok: true,
    inputsPayload,
    primaryAttachment,
    referenceImageUrls,
    referenceVideoUrls,
    referenceAudioUrls,
    primaryImageUrl,
    primaryAudioUrl,
    endImageUrl,
    extraInputValues,
    klingElementsPayload: klingResult.klingElementsPayload,
    multiPromptPayload,
  };
}
