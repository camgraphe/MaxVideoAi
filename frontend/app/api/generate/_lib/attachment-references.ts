import type { EngineInputSchema, Mode } from '@/types/engines';
import { isHappyHorseEngineId, supportsHappyHorseVideoEdit } from '@/lib/happy-horse-workflow';
import type { ReferenceBudgetMediaItem, ReferenceBudgetValuesByField } from '@/lib/reference-budget';
import type { NormalizedAttachment } from './attachments';

export type ReferenceProvenanceIssue =
  | {
      reason: 'missing-field-id';
      kind: ReferenceBudgetMediaItem['kind'];
      url: string;
    }
  | {
      reason: 'missing-kind';
      fieldId: string;
      url: string;
    };

type AttachmentReferenceParams = {
  attachments: NormalizedAttachment[];
  engineId: string;
  mode: Mode;
  soraImageUrl?: string;
  imageUrl?: unknown;
  image_url?: unknown;
  referenceImages?: unknown;
  reference_images?: unknown;
  rawAudioUrl?: string | null;
  inputSchema?: EngineInputSchema | null;
};

type AttachmentReferenceResult = {
  maxUploadedBytes: number;
  firstFrameUrl: string | undefined;
  lastFrameUrl: string | undefined;
  requestedPrimaryImageUrl: string | undefined;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  audioUrls: string[];
  resolvedAudioUrl: string | undefined;
  initialImageUrl: string | undefined;
  resolvedFirstFrameUrl: string | undefined;
  startImageUrl: string | undefined;
  sourceInputVideoUrl: string | undefined;
  referenceValuesByField: ReferenceBudgetValuesByField<string>;
  referenceMediaItems: ReferenceBudgetMediaItem[];
  referenceProvenanceIssues: ReferenceProvenanceIssue[];
};

type SourceVideoDurationResolution = {
  durationSec: number;
  durationLabel: string | undefined;
  sourceDurationSec: number | null;
  maxDurationSec: number | null;
  exceedsMax: boolean;
};

function trimString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => trimString(entry) ?? '')
        .filter((entry): entry is string => entry.length > 0)
    : [];
}

function uniqueNonEmpty(values: string[]): string[] {
  return values.filter((url, index, self) => url.length > 0 && self.indexOf(url) === index);
}

function positiveDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return null;
}

export function deriveGenerationAttachmentReferences(params: AttachmentReferenceParams): AttachmentReferenceResult {
  const maxUploadedBytes =
    params.attachments.reduce((max, attachment) => Math.max(max, attachment.size ?? 0), 0) ?? 0;
  const firstFrameUrl =
    params.attachments.find((attachment) => attachment.slotId === 'first_frame_url')?.url?.trim() ?? undefined;
  const lastFrameUrl =
    params.attachments.find((attachment) => attachment.slotId === 'last_frame_url')?.url?.trim() ?? undefined;
  const attachmentPrimaryImageUrl =
    params.attachments.find((attachment) => {
      if (attachment.kind !== 'image' || typeof attachment.url !== 'string') return false;
      return (
        attachment.slotId === 'image_url' ||
        attachment.slotId === 'input_image' ||
        attachment.slotId === 'image'
      );
    })?.url?.trim() ?? undefined;
  const requestedPrimaryImageUrl =
    params.soraImageUrl ?? trimString(params.imageUrl) ?? trimString(params.image_url) ?? attachmentPrimaryImageUrl;
  const referenceImagesInput = Array.isArray(params.referenceImages)
    ? params.referenceImages
    : Array.isArray(params.reference_images)
      ? params.reference_images
      : null;
  const attachmentReferenceImageUrls = params.attachments
    .filter((attachment) => {
      if (attachment.kind !== 'image' || typeof attachment.url !== 'string') return false;
      if (isHappyHorseEngineId(params.engineId)) {
        if (params.mode === 'v2v' && supportsHappyHorseVideoEdit(params.engineId)) {
          return attachment.slotId === 'reference_image_urls';
        }
        if (params.mode === 'ref2v') return attachment.slotId === 'image_urls' || attachment.slotId === 'reference_images';
        if (params.mode === 'v2v') return false;
      }
      return (
        attachment.slotId === 'image_urls' ||
        attachment.slotId === 'reference_images' ||
        attachment.slotId === 'reference_image_urls'
      );
    })
    .map((attachment) => attachment.url!.trim())
    .filter((url) => url.length > 0);
  const normalizedReferenceImages = Array.from(
    new Set([...normalizeStringList(referenceImagesInput), ...attachmentReferenceImageUrls])
  );
  const videoUrls = uniqueNonEmpty(
    params.attachments
      .filter((attachment) => attachment.kind === 'video' && typeof attachment.url === 'string')
      .map((attachment) => attachment.url!.trim())
  );
  const audioUrls = uniqueNonEmpty(
    params.attachments
      .filter((attachment) => attachment.kind === 'audio' && typeof attachment.url === 'string')
      .map((attachment) => attachment.url!.trim())
  );
  const referenceValuesByField: Record<string, string[]> = {};
  const referenceMediaItems: ReferenceBudgetMediaItem[] = [];
  const referenceProvenanceIssues: ReferenceProvenanceIssue[] = [];
  const appendReferenceValue = (fieldId: string, rawUrl: string | undefined) => {
    const normalizedFieldId = fieldId.trim();
    const url = rawUrl?.trim();
    if (!normalizedFieldId || !url) return null;
    (referenceValuesByField[normalizedFieldId] ??= []).push(url);
    return { fieldId: normalizedFieldId, url };
  };
  const appendTypedReferenceValue = (
    fieldId: string,
    rawUrl: string | undefined,
    kind: ReferenceBudgetMediaItem['kind']
  ) => {
    const referenceValue = appendReferenceValue(fieldId, rawUrl);
    if (referenceValue) referenceMediaItems.push({ ...referenceValue, kind });
  };

  for (const attachment of params.attachments) {
    const url = attachment.url?.trim();
    if (!url) continue;
    const fieldId = attachment.slotId?.trim();
    if (!fieldId) {
      if (attachment.kind) {
        referenceProvenanceIssues.push({
          reason: 'missing-field-id',
          kind: attachment.kind,
          url,
        });
      }
      continue;
    }
    if (!attachment.kind) {
      appendReferenceValue(fieldId, url);
      referenceProvenanceIssues.push({
        reason: 'missing-kind',
        fieldId,
        url,
      });
      continue;
    }
    appendTypedReferenceValue(fieldId, url, attachment.kind);
  }

  const appendProjectionOnlyValues = (
    fieldId: string,
    projectedUrls: string[],
    representedUrls: string[],
    kind: ReferenceBudgetMediaItem['kind']
  ) => {
    const remainingRepresented = new Map<string, number>();
    representedUrls.forEach((url) => {
      remainingRepresented.set(url, (remainingRepresented.get(url) ?? 0) + 1);
    });
    projectedUrls.forEach((url) => {
      const representedCount = remainingRepresented.get(url) ?? 0;
      if (representedCount > 0) {
        remainingRepresented.set(url, representedCount - 1);
        return;
      }
      appendTypedReferenceValue(fieldId, url, kind);
    });
  };

  const schemaFields = [
    ...(params.inputSchema?.required ?? []),
    ...(params.inputSchema?.optional ?? []),
  ];
  const directReferenceImageFieldId =
    schemaFields.find(
      (field) =>
        field.type === 'image' &&
        ['image_urls', 'reference_image_urls', 'reference_images'].includes(
          field.id
        ) &&
        (!field.modes?.length || field.modes.includes(params.mode))
    )?.id ?? (params.mode === 'v2v' ? 'reference_image_urls' : 'image_urls');
  const directReferenceImages = normalizeStringList(referenceImagesInput);
  appendProjectionOnlyValues(
    directReferenceImageFieldId,
    directReferenceImages,
    attachmentReferenceImageUrls,
    'image'
  );
  const directReferenceAudioFieldId = schemaFields.find(
    (field) =>
      field.type === 'audio' &&
      ['audio_urls', 'reference_audio_urls', 'reference_audios'].includes(
        field.id
      ) &&
      (!field.modes?.length || field.modes.includes(params.mode))
  )?.id;
  const directAudioUrl = trimString(params.rawAudioUrl);
  if (directReferenceAudioFieldId && directAudioUrl) {
    appendProjectionOnlyValues(
      directReferenceAudioFieldId,
      [directAudioUrl],
      audioUrls,
      'audio'
    );
  }
  const resolvedAudioUrl = params.rawAudioUrl ?? audioUrls[0] ?? undefined;
  const initialImageUrl =
    params.mode === 'i2v' || params.mode === 'i2i' || params.mode === 'v2v' || params.mode === 'reframe'
      ? requestedPrimaryImageUrl
      : undefined;
  const resolvedFirstFrameUrl = params.mode === 'fl2v' ? firstFrameUrl ?? requestedPrimaryImageUrl : firstFrameUrl;
  const explicitStartImageUrl =
    params.attachments.find((attachment) => attachment.slotId === 'start_image_url')?.url?.trim() ?? undefined;
  const startImageUrl =
    explicitStartImageUrl ??
    (params.engineId.startsWith('kling-o3') && params.mode === 'ref2v' ? requestedPrimaryImageUrl : undefined);
  const sourceInputVideoUrl = videoUrls[0];

  return {
    maxUploadedBytes,
    firstFrameUrl,
    lastFrameUrl,
    requestedPrimaryImageUrl,
    normalizedReferenceImages,
    videoUrls,
    audioUrls,
    resolvedAudioUrl,
    initialImageUrl,
    resolvedFirstFrameUrl,
    startImageUrl,
    sourceInputVideoUrl,
    referenceValuesByField,
    referenceMediaItems,
    referenceProvenanceIssues,
  };
}

export function resolveSourceVideoDurationSec(params: {
  mode: Mode;
  attachments: NormalizedAttachment[];
  sourceInputVideoUrl?: string;
  fallbackDurationSec: number;
  maxDurationSec?: number | null;
}): SourceVideoDurationResolution {
  const fallbackDurationSec = Math.max(1, Math.ceil(params.fallbackDurationSec || 1));
  const maxDurationSec =
    typeof params.maxDurationSec === 'number' && Number.isFinite(params.maxDurationSec)
      ? Math.max(1, Math.floor(params.maxDurationSec))
      : null;
  const isSourceVideoMode = params.mode === 'v2v' || params.mode === 'reframe' || params.mode === 'extend';
  if (!isSourceVideoMode) {
    return {
      durationSec: fallbackDurationSec,
      durationLabel: undefined,
      sourceDurationSec: null,
      maxDurationSec,
      exceedsMax: false,
    };
  }

  const sourceUrl = trimString(params.sourceInputVideoUrl);
  const sourceAttachment = params.attachments.find((attachment) => {
    if (attachment.kind !== 'video') return false;
    if (!sourceUrl) return true;
    return attachment.url?.trim() === sourceUrl;
  });
  const sourceDurationSec = positiveDuration(sourceAttachment?.durationSec);
  const shouldUseSourceDuration = params.mode === 'reframe';
  const durationSec = shouldUseSourceDuration && sourceDurationSec ? Math.max(1, Math.ceil(sourceDurationSec)) : fallbackDurationSec;

  return {
    durationSec,
    durationLabel: shouldUseSourceDuration ? `${durationSec}s` : undefined,
    sourceDurationSec,
    maxDurationSec,
    exceedsMax: Boolean(sourceDurationSec && maxDurationSec && sourceDurationSec > maxDurationSec),
  };
}
