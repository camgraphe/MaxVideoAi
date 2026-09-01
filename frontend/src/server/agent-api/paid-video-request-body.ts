import type { EngineCaps } from '@/types/engines';

import type {
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
  CanonicalReferenceMediaKind,
} from './generation-types';
import type { ResolvedReference } from './reference-types';
import { normalizeControlledHttpsReferenceUrl } from './controlled-reference-url';
import { toEngineGenerationMode } from './generation-mode-aliases';
import {
  resolveActiveVideoInputField,
  VIDEO_MEDIA_FIELD_CANDIDATES,
} from '@/lib/video-input-schema';

export type PaidVideoRequestBodyExecution = {
  quoteId: string;
  request: CanonicalGenerationRequest;
  resolvedReferences?: readonly ResolvedReference[];
  engine: EngineCaps;
  canonicalPricing: Record<string, unknown>;
};

type MaterializedReference = {
  kind: CanonicalReferenceMediaKind;
  role: CanonicalGenerationReference['role'];
  url: string;
  slot?: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  mimeType?: string;
};

function controlledHttpsUrl(value: unknown): string {
  try {
    return normalizeControlledHttpsReferenceUrl(value);
  } catch {
    throw new Error('A controlled HTTPS reference URL is required before provider submission.');
  }
}

function canonicalMediaKind(value: unknown): CanonicalReferenceMediaKind {
  if (value !== 'image' && value !== 'video' && value !== 'audio') {
    throw new Error('A verified reference media kind is required before provider submission.');
  }
  return value;
}

function resolvedKey(
  assetId: string,
  role: CanonicalGenerationReference['role'],
  slot: number | undefined,
): string {
  return `${assetId}\u0000${role}\u0000${slot ?? ''}`;
}

function materializeReferences(execution: PaidVideoRequestBodyExecution): MaterializedReference[] {
  const resolvedByKey = new Map<string, ResolvedReference>();
  for (const resolved of execution.resolvedReferences ?? []) {
    const key = resolvedKey(resolved.assetId, resolved.role, resolved.slot);
    if (resolvedByKey.has(key)) {
      throw new Error('Each private reference must resolve exactly once before provider submission.');
    }
    resolvedByKey.set(key, resolved);
  }

  const usedResolvedKeys = new Set<string>();
  const materialized = execution.request.references.map((reference): MaterializedReference => {
    if (reference.kind === 'https') {
      return {
        kind: canonicalMediaKind(reference.mediaKind),
        role: reference.role,
        url: controlledHttpsUrl(reference.url),
        ...(reference.slot === undefined ? {} : { slot: reference.slot }),
      };
    }
    const key = resolvedKey(reference.assetId, reference.role, reference.slot);
    const resolved = resolvedByKey.get(key);
    if (!resolved) {
      throw new Error('A verified resolved reference is required before provider submission.');
    }
    usedResolvedKeys.add(key);
    return {
      kind: canonicalMediaKind(resolved.mediaKind),
      role: reference.role,
      url: controlledHttpsUrl(resolved.storageUrl),
      width: resolved.width,
      height: resolved.height,
      durationSec: resolved.durationSec,
      mimeType: resolved.mimeType,
      ...(reference.slot === undefined ? {} : { slot: reference.slot }),
    };
  });

  if (usedResolvedKeys.size !== resolvedByKey.size) {
    throw new Error('Resolved reference material does not match the confirmed request.');
  }
  return materialized;
}

export function resolvePaidMembershipTier(
  pricing: Record<string, unknown>,
): 'member' | 'plus' | 'pro' {
  const value = pricing.membershipTier;
  if (value !== 'member' && value !== 'plus' && value !== 'pro') {
    throw new Error('Invalid paid generation membership tier.');
  }
  return value;
}

function input(reference: MaterializedReference, slotId: string) {
  return {
    kind: reference.kind,
    slotId,
    url: reference.url,
    ...(typeof reference.width === 'number' ? { width: reference.width } : {}),
    ...(typeof reference.height === 'number' ? { height: reference.height } : {}),
    ...(typeof reference.durationSec === 'number' ? { durationSec: reference.durationSec } : {}),
    ...(reference.mimeType ? { type: reference.mimeType } : {}),
  };
}

function supportsAspectRatio(execution: PaidVideoRequestBodyExecution): boolean {
  if (!execution.engine.inputSchema) return true;
  return Boolean(resolveActiveVideoInputField({
    inputSchema: execution.engine.inputSchema,
    mode: toEngineGenerationMode(execution.engine.id, execution.request.mode),
    candidateFieldIds: ['aspect_ratio'],
  }));
}

function activeReferenceFieldId(
  execution: PaidVideoRequestBodyExecution,
  type: CanonicalReferenceMediaKind,
  candidates: readonly string[],
): string | null {
  return resolveActiveVideoInputField({
    inputSchema: execution.engine.inputSchema,
    mode: toEngineGenerationMode(execution.engine.id, execution.request.mode),
    candidateFieldIds: candidates,
    type,
  })?.id ?? null;
}

function invalidModeReferences(): never {
  throw new Error('The confirmed references do not match the selected video mode.');
}

const EXTRA_INPUT_FIELD_BY_SETTING: Readonly<Record<string, string>> = Object.freeze({
  contextSec: 'context',
  cropEndX: 'x_end',
  cropEndY: 'y_end',
  cropStartX: 'x_start',
  cropStartY: 'y_start',
  editDepthBlur: 'edit_depth_blur',
  editFace: 'edit_face',
  editKeyframeIndexes: 'edit_keyframe_indexes',
  editNormalsAugmentation: 'edit_normals_augmentation',
  editPoseStrength: 'edit_pose_strength',
  editStrength: 'edit_strength',
  editTrajectorySparsity: 'edit_trajectory_sparsity',
  exrExport: 'exr_export',
  extendPosition: 'mode',
  guidanceScale: 'guidance_scale',
  hdr: 'hdr',
  modifyStrength: 'mode',
  reframeGridPositionX: 'grid_position_x',
  reframeGridPositionY: 'grid_position_y',
  retakeMode: 'retake_mode',
  sourcePositionHeight: 'source_position_h_norm',
  sourcePositionWidth: 'source_position_w_norm',
  sourcePositionX: 'source_position_x_norm',
  sourcePositionY: 'source_position_y_norm',
  startTimeSec: 'start_time',
});

function projectExtraInputValues(settings: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [setting, fieldId] of Object.entries(EXTRA_INPUT_FIELD_BY_SETTING)) {
    const value = settings[setting];
    delete settings[setting];
    if (value !== undefined) extra[fieldId] = value;
  }
  return extra;
}

export function buildPaidVideoRequestBody(
  execution: PaidVideoRequestBodyExecution,
): Record<string, unknown> {
  if (execution.request.surface !== 'video') {
    throw new Error('A video request is required for video provider projection.');
  }
  const settings = { ...execution.request.settings };
  if (!supportsAspectRatio(execution)) delete settings.aspectRatio;
  const extraInputValues = projectExtraInputValues(settings);
  const references = materializeReferences(execution);
  const body: Record<string, unknown> = {
    engineId: execution.request.engineId,
    mode: toEngineGenerationMode(execution.request.engineId, execution.request.mode),
    prompt: execution.request.prompt,
    jobId: execution.quoteId,
    payment: { mode: 'wallet' },
    membershipTier: resolvePaidMembershipTier(execution.canonicalPricing),
    ...settings,
    ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
    inputs: [],
  };

  if (execution.request.mode === 't2v') {
    if (references.length) invalidModeReferences();
    return body;
  }

  if (execution.request.mode === 'i2v' || execution.request.mode === 'i2v_standard') {
    const start = references.filter((reference) =>
      reference.kind === 'image'
      && (reference.role === 'source' || reference.role === 'first_frame'));
    const end = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    if (start.length !== 1 || end.length > 1 || start.length + end.length !== references.length) {
      invalidModeReferences();
    }
    body.imageUrl = start[0]!.url;
    if (end[0]) body.endImageUrl = end[0].url;
    const startFieldId = activeReferenceFieldId(
      execution, 'image', ['start_image_url', 'image_url', 'first_frame_url']);
    const endFieldId = activeReferenceFieldId(
      execution, 'image', ['end_image_url', 'last_frame_url']);
    if (!startFieldId || (end[0] && !endFieldId)) invalidModeReferences();
    body.inputs = [
      input(start[0]!, startFieldId),
      ...(end[0] && endFieldId ? [input(end[0], endFieldId)] : []),
    ];
    return body;
  }

  if (execution.request.mode === 'fl2v') {
    const first = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'first_frame');
    const last = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    if (first.length !== 1 || last.length !== 1 || references.length !== 2) {
      invalidModeReferences();
    }
    body.imageUrl = first[0]!.url;
    body.endImageUrl = last[0]!.url;
    const firstFieldId = activeReferenceFieldId(
      execution, 'image', VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame);
    const lastFieldId = activeReferenceFieldId(
      execution, 'image', VIDEO_MEDIA_FIELD_CANDIDATES.lastFrame);
    if (!firstFieldId || !lastFieldId) invalidModeReferences();
    body.inputs = [input(first[0]!, firstFieldId), input(last[0]!, lastFieldId)];
    return body;
  }

  if (execution.request.mode === 'ref2v') {
    const start = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'first_frame');
    const end = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    const referenceMedia = references.filter((reference) => reference.role === 'reference');
    if (
      start.length > 1
      || end.length > 1
      || start.length + end.length + referenceMedia.length !== references.length
    ) invalidModeReferences();
    const images = referenceMedia.filter((reference) => reference.kind === 'image').map(({ url }) => url);
    const videoReferences = referenceMedia.filter((reference) => reference.kind === 'video');
    const audioReferences = referenceMedia.filter((reference) => reference.kind === 'audio');
    const videos = videoReferences.map(({ url }) => url);
    const audio = audioReferences.map(({ url }) => url);
    if (!referenceMedia.length && !start.length) invalidModeReferences();
    if (start[0]) body.imageUrl = start[0].url;
    if (end[0]) body.endImageUrl = end[0].url;
    if (images.length) body.referenceImages = images;
    if (videos.length) body.referenceVideos = videos;
    if (audio.length) body.referenceAudio = audio;
    const startFieldId = activeReferenceFieldId(execution, 'image', ['start_image_url', 'image_url']);
    const endFieldId = activeReferenceFieldId(execution, 'image', ['end_image_url']);
    const imageFieldId = activeReferenceFieldId(
      execution, 'image', VIDEO_MEDIA_FIELD_CANDIDATES.referenceImage);
    const videoFieldId = activeReferenceFieldId(
      execution, 'video', VIDEO_MEDIA_FIELD_CANDIDATES.referenceVideo);
    const audioFieldId = activeReferenceFieldId(
      execution, 'audio', VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio);
    if (
      (start.length && !startFieldId)
      || (end.length && !endFieldId)
      || (images.length && !imageFieldId)
      || (videos.length && !videoFieldId)
      || (audio.length && !audioFieldId)
    ) invalidModeReferences();
    body.inputs = [
      ...(start[0] && startFieldId ? [input(start[0], startFieldId)] : []),
      ...(end[0] && endFieldId ? [input(end[0], endFieldId)] : []),
      ...(imageFieldId && imageFieldId !== 'image_urls'
        ? referenceMedia.filter((reference) => reference.kind === 'image')
          .map((reference) => input(reference, imageFieldId))
        : []),
      ...(videoFieldId ? videoReferences.map((reference) => input(reference, videoFieldId)) : []),
      ...(audioFieldId ? audioReferences.map((reference) => input(reference, audioFieldId)) : []),
    ];
    return body;
  }

  if (execution.request.mode === 'v2v') {
    const source = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'source');
    const guideFrames = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'first_frame');
    const imageReferences = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'reference');
    const audioReferences = references.filter((reference) =>
      reference.kind === 'audio' && reference.role === 'reference');
    const images = imageReferences.map(({ url }) => url);
    const audio = audioReferences.map(({ url }) => url);
    if (
      source.length !== 1
      || guideFrames.length > 1
      || 1 + guideFrames.length + images.length + audio.length !== references.length
    ) {
      invalidModeReferences();
    }
    body.videoUrl = source[0]!.url;
    const guideFieldId = activeReferenceFieldId(execution, 'image', ['start_image_url']);
    if (guideFrames.length) {
      if (!guideFieldId) invalidModeReferences();
      body.imageUrl = guideFrames[0]!.url;
    }
    const imageFieldId = activeReferenceFieldId(
      execution,
      'image',
      ['image_url', 'edit_keyframe_urls', 'image_urls', 'reference_image_urls'],
    );
    if (images.length) {
      if (imageFieldId === 'start_image_url' || imageFieldId === 'image_url') {
        if (images.length !== 1) invalidModeReferences();
        body.imageUrl = images[0];
      } else {
        body.referenceImages = images;
      }
    }
    if (audio.length) body.referenceAudio = audio;
    body.inputs = [
      input(source[0]!, 'video_url'),
      ...(guideFrames[0] && guideFieldId ? [input(guideFrames[0], guideFieldId)] : []),
      ...(imageFieldId === 'image_url'
        || imageFieldId === 'edit_keyframe_urls'
        ? imageReferences.map((reference) => input(reference, imageFieldId))
        : []),
      ...audioReferences.map((reference) => input(reference, 'audio_urls')),
    ];
    return body;
  }

  if (execution.request.mode === 'r2v') {
    const videos = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'reference');
    if (videos.length < 1 || videos.length !== references.length) {
      invalidModeReferences();
    }
    const urls = videos.map(({ url }) => url);
    body.referenceVideos = urls;
    body.inputs = videos.map((reference) => input(reference, 'video_urls'));
    return body;
  }

  if (execution.request.mode === 'extend') {
    const sources = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'source');
    if (sources.length < 1 || sources.length > 3 || sources.length !== references.length) {
      invalidModeReferences();
    }
    const urls = sources.map(({ url }) => url);
    const fieldId = activeReferenceFieldId(
      execution,
      'video',
      ['extension_source_videos', 'video_urls', 'video_url'],
    );
    if (!fieldId) invalidModeReferences();
    if (fieldId === 'video_url') {
      if (urls.length !== 1) invalidModeReferences();
      body.videoUrl = urls[0];
    } else if (fieldId === 'extension_source_videos') {
      body.extensionSourceVideos = urls;
    } else {
      body.referenceVideos = urls;
    }
    body.inputs = sources.map((reference) => input(reference, fieldId));
    return body;
  }

  if (execution.request.mode === 'a2v') {
    const audio = references.filter((reference) =>
      reference.kind === 'audio' && reference.role === 'source');
    const firstFrame = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'first_frame');
    if (audio.length !== 1 || firstFrame.length > 1 || audio.length + firstFrame.length !== references.length) {
      invalidModeReferences();
    }
    body.audioUrl = audio[0]!.url;
    if (firstFrame[0]) body.imageUrl = firstFrame[0].url;
    body.inputs = [
      input(audio[0]!, 'audio_url'),
      ...(firstFrame[0] ? [input(firstFrame[0], 'image_url')] : []),
    ];
    return body;
  }

  if (execution.request.mode === 'retake' || execution.request.mode === 'reframe') {
    const source = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'source');
    const guide = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'reference');
    if (source.length !== 1 || guide.length > 1 || source.length + guide.length !== references.length) {
      invalidModeReferences();
    }
    body.videoUrl = source[0]!.url;
    if (guide[0]) body.imageUrl = guide[0].url;
    body.inputs = [
      input(source[0]!, 'video_url'),
      ...(guide[0] ? [input(guide[0], 'image_url')] : []),
    ];
    return body;
  }

  invalidModeReferences();
}
