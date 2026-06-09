import type { Mode } from '@/types/engines';
import type { NormalizedAttachment } from './attachments';

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
      if (params.engineId === 'happy-horse-1-0') {
        if (params.mode === 'v2v') return attachment.slotId === 'reference_image_urls';
        if (params.mode === 'ref2v') return attachment.slotId === 'image_urls' || attachment.slotId === 'reference_images';
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
  };
}
