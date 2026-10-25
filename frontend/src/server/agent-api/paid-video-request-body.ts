import { withoutRetiredOutputControls } from '@/lib/generation-output-policy';
import { validateOwnedKlingElements, isElementReference } from '@/lib/kling-owned-elements';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import type { PreparedSeedanceWorkflow } from '@/server/seedance-workflow-request';
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
  seedanceWorkflow?: PreparedSeedanceWorkflow;
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
  assetId?: string;
  sizeBytes?: number | null;
  originalName?: string | null;
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
      assetId: resolved.assetId,
      sizeBytes: resolved.sizeBytes,
      originalName: resolved.originalName,
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
    ...(reference.assetId ? { assetId: reference.assetId } : {}),
    ...(reference.originalName ? { name: reference.originalName } : {}),
    ...(reference.mimeType ? { type: reference.mimeType } : {}),
    ...(typeof reference.sizeBytes === 'number' ? { size: reference.sizeBytes } : {}),
    kind: reference.kind,
    slotId,
    url: reference.url,
    ...(typeof reference.width === 'number' ? { width: reference.width } : {}),
    ...(typeof reference.height === 'number' ? { height: reference.height } : {}),
    ...(typeof reference.durationSec === 'number' ? { durationSec: reference.durationSec } : {}),
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
  keepAudio: 'keep_audio',
  safetyTolerance: 'safety_tolerance',
  audioSetting: 'audio_setting',
  personGeneration: 'person_generation',
  compressionQuality: 'compression_quality',
  promptAudioDirection: 'prompt_audio_direction',
  promptCameraDirection: 'prompt_camera_direction',
  promptEditInstruction: 'prompt_edit_instruction',
  outputFormat: 'output_format',
  contextSec: 'context',
  cropEndX: 'x_end',
  cropEndY: 'y_end',
  cropStartX: 'x_start',
  cropStartY: 'y_start',
  documentUrl: 'file_url',
  editDepthBlur: 'edit_depth_blur',
  extendDirection: 'extend_direction',
  editFace: 'edit_face',
  editControlMode: 'edit_control_mode',
  editPoseMode: 'edit_pose_mode',
  editDepthMode: 'edit_depth_mode',
  editNormalsMode: 'edit_normals_mode',
  editTrajectoryMode: 'edit_trajectory_mode',
  editFaceMode: 'edit_face_mode',
  editKeyframeIndexes: 'edit_keyframe_indexes',
  reasoningLevel: 'reasoning_level',
  keyframeIndexes: 'keyframe_indexes',
  editNormalsAugmentation: 'edit_normals_augmentation',
  editPoseStrength: 'edit_pose_strength',
  editStrength: 'edit_strength',
  editTrajectorySparsity: 'edit_trajectory_sparsity',
  exrExport: 'exr_export',
  enablePromptExpansion: 'enable_prompt_expansion',
  extendPosition: 'mode',
  guidanceScale: 'guidance_scale',
  hdr: 'hdr',
  modifyStrength: 'mode',
  promptExpansionMode: 'prompt_expansion_mode',
  enhanceRealism: 'enhance_realism',
  middleFrameTime: 'middle_frame_time',
  referenceOrder: 'reference_order',
  reframeGridPositionX: 'grid_position_x',
  reframeGridPositionY: 'grid_position_y',
  retakeMode: 'retake_mode',
  sourcePositionHeight: 'source_position_h_norm',
  sourcePositionWidth: 'source_position_w_norm',
  sourcePositionX: 'source_position_x_norm',
  sourcePositionY: 'source_position_y_norm',
  startTimeSec: 'start_time',
  webpageUrl: 'web_url',
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

function projectMultiPrompt(settings: Record<string, unknown>): Array<{ prompt: string; duration: number }> | null {
  const value = settings.multiPrompt;
  delete settings.multiPrompt;
  if (!Array.isArray(value)) return null;
  return value.map((scene) => ({
    prompt: String((scene as { prompt?: unknown }).prompt ?? ''),
    duration: Number((scene as { durationSec?: unknown }).durationSec),
  }));
}

export function buildPaidVideoRequestBody(
  execution: PaidVideoRequestBodyExecution,
): Record<string, unknown> {
  if (execution.request.surface !== 'video') {
    throw new Error('A video request is required for video provider projection.');
  }
  if (execution.request.seedanceWorkflow?.step === 'final') {
    if (!execution.seedanceWorkflow?.finalFacts) throw new Error('Verified owned Draft facts are required.');
    return { ...execution.seedanceWorkflow.body, engineId: execution.request.engineId, jobId: execution.quoteId,
      payment: { mode: 'wallet' }, membershipTier: resolvePaidMembershipTier(execution.canonicalPricing) };
  }
  if (execution.engine) execution = { ...execution, engine: resolveVideoOperationEngine(execution.engine, toEngineGenerationMode(execution.request.engineId, execution.request.mode), execution.request.operation) };
  const settings = withoutRetiredOutputControls(execution.request.settings);
  if (!supportsAspectRatio(execution)) delete settings.aspectRatio;
  const multiPrompt = projectMultiPrompt(settings);
  const extraInputValues = projectExtraInputValues(settings);
  validateOwnedKlingElements(execution.request, execution.resolvedReferences);
  const allReferences = materializeReferences(execution);

  const elementMedia = (slot: number) => allReferences.find(ref => ref.role === 'reference' && ref.slot === slot)!;
  const elements = execution.request.elements?.map(element => element.kind === 'video'
    ? { videoUrl: elementMedia(element.videoSlot).url, videoAssetId: elementMedia(element.videoSlot).assetId }
    : { frontalImageUrl: elementMedia(element.frontalSlot).url, frontalAssetId: elementMedia(element.frontalSlot).assetId,
      referenceImageUrls: element.referenceSlots.map(slot => elementMedia(slot).url), referenceAssetIds: element.referenceSlots.map(slot => elementMedia(slot).assetId) });
  const materialized = allReferences;
  const subjectSlots = new Set<number>();
  const subjectReference = (slot: number, kind: 'image' | 'video') => {
    const reference = materialized.find(reference => reference.role === 'reference' && reference.slot === slot);
    if (!reference?.assetId || reference.kind !== kind) throw new Error('A verified owned subject reference is required before provider submission.');
    subjectSlots.add(slot);
    return reference;
  };
  const v4Elements = execution.request.subjects?.map(subject => {
    if (execution.request.engineId !== 'kling-v4' || !['ref2v', 'v2v'].includes(execution.request.mode)) throw new Error('Unsupported subjects.');
    if (subject.kind === 'video') {
      const video = subjectReference(subject.referenceSlot, 'video');
      return {videoUrl: video.url, videoAssetId: video.assetId};
    }
    const front = subjectReference(subject.frontalReferenceSlot, 'image');
    const views = subject.referenceSlots.map(slot => subjectReference(slot, 'image'));
    return {frontalImageUrl: front.url, frontalAssetId: front.assetId,
      referenceImageUrls: views.map(view => view.url), referenceAssetIds: views.map(view => view.assetId!)};
  });
  const references = allReferences.filter(ref => !isElementReference(ref, execution.request.elements)).filter(reference => reference.role !== 'reference' || reference.slot === undefined || !subjectSlots.has(reference.slot));
  const body: Record<string, unknown> = {
    engineId: execution.request.engineId,
    ...(elements || v4Elements ? {elements: v4Elements ?? elements} : {}),
    ...(execution.request.sourceJobId ? { sourceJobId: execution.request.sourceJobId, sourceOutputId: execution.request.sourceOutputId } : {}),
    ...(execution.request.operation ? { operation: execution.request.operation } : {}),
    mode: toEngineGenerationMode(execution.request.engineId, execution.request.mode),
    prompt: execution.request.prompt,
    jobId: execution.quoteId,
    payment: { mode: 'wallet' },
    membershipTier: resolvePaidMembershipTier(execution.canonicalPricing),
    ...settings,
    ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
    ...(multiPrompt?.length ? { multiPrompt } : {}),

    ...(execution.request.seedanceWorkflow ? { seedanceWorkflow: execution.request.seedanceWorkflow, iterationCount: 1 } : {}),
    inputs: [],
  };

  if (execution.request.operation==='flux-draft-enhance') return body;
  if (execution.request.engineId === 'luma-ray-3-2' && execution.request.mode === 'extend') return body;

  if (execution.request.mode === 't2v') {
    if (execution.request.engineId === 'luma-ray-3-2' && references.length) {
      if (references.some(ref => ref.kind !== 'image' || ref.role !== 'reference') || references.length > 64) invalidModeReferences();
      body.inputs = references.map(ref => input(ref, 'keyframe_urls'));
      return body;
    }
    const targetAudioFieldId = activeReferenceFieldId(execution, 'audio', ['target_audio_url']);
    if (references.length) {
      if (!targetAudioFieldId || references.length !== 1
        || references[0]!.kind !== 'audio' || references[0]!.role !== 'reference') invalidModeReferences();
      body.inputs = [input(references[0]!, targetAudioFieldId)];
    }
    return body;
  }

  if (execution.request.mode === 'i2v' || execution.request.mode === 'i2v_standard') {
    const start = references.filter((reference) =>
      reference.kind === 'image'
      && (reference.role === 'source' || reference.role === 'first_frame'));
    const end = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    const audio = references.filter((reference) =>
      reference.kind === 'audio' && reference.role === 'reference');
    const alternatives = execution.engine.inputSchema?.constraints?.atLeastOneReferenceField;
    const allowsEndOnly = Array.isArray(alternatives) && alternatives.includes('end_image_url');
    if (start.length > 1 || (!start.length && (!allowsEndOnly || !end.length))
      || end.length > 1 || audio.length > 1
      || start.length + end.length + audio.length !== references.length) {
      invalidModeReferences();
    }
    if (start[0]) body.imageUrl = start[0].url;
    if (end[0]) body.endImageUrl = end[0].url;
    const startFieldId = activeReferenceFieldId(
      execution, 'image', ['start_image_url', 'image_url', 'first_frame_url']);
    const endFieldId = activeReferenceFieldId(
      execution, 'image', ['end_image_url', 'last_frame_url']);
    const audioFieldId = activeReferenceFieldId(execution, 'audio', ['target_audio_url']);
    if ((start[0] && !startFieldId) || (end[0] && !endFieldId) || (audio[0] && !audioFieldId)) invalidModeReferences();
    body.inputs = [
      ...(start[0] && startFieldId ? [input(start[0], startFieldId)] : []),
      ...(end[0] && endFieldId ? [input(end[0], endFieldId)] : []),
      ...(audio[0] && audioFieldId ? [input(audio[0], audioFieldId)] : []),
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
    const middle = references.filter(reference=>reference.kind==='image'&&reference.role==='middle_frame');
    const middleFieldId=activeReferenceFieldId(execution,'image',['middle_image_url']);
    if (middle.length>1 || (middle.length && !middleFieldId)) invalidModeReferences();
    const end = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    const referenceMedia = references.filter((reference) => reference.role === 'reference');
    if (
      start.length > 1
      || end.length > 1
      || start.length + middle.length + end.length + referenceMedia.length !== references.length
    ) invalidModeReferences();
    const images = referenceMedia.filter((reference) => reference.kind === 'image').map(({ url }) => url);
    const videoReferences = referenceMedia.filter((reference) => reference.kind === 'video');
    const audioReferences = referenceMedia.filter((reference) => reference.kind === 'audio');
    const videos = videoReferences.map(({ url }) => url);
    const audio = audioReferences.map(({ url }) => url);
    const hasDocumentReference = typeof extraInputValues.file_url === 'string'
      || typeof extraInputValues.web_url === 'string';
    if (!referenceMedia.length && !start.length && !(execution.engine.id==='minimax-h3-max' && end.length) && !hasDocumentReference && !elements?.length && !v4Elements?.length) invalidModeReferences();
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
      ...(middle[0] && middleFieldId ? [input(middle[0],middleFieldId)] : []),
      ...(start[0] && startFieldId ? [input(start[0], startFieldId)] : []),
      ...(end[0] && endFieldId ? [input(end[0], endFieldId)] : []),
      ...(imageFieldId && (imageFieldId !== 'image_urls' || execution.engine.id === 'kling-v4')
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
      ['image_url', 'edit_keyframe_urls', 'image_urls', 'reference_image_urls', 'reference_image_url'],
    );
    const audioFieldId = activeReferenceFieldId(execution, 'audio', VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio);
    if ((images.length && !imageFieldId) || (audio.length && !audioFieldId)) invalidModeReferences();
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
      ...(imageFieldId && (imageFieldId !== 'image_urls' || ['seedance-2-5','kling-v4'].includes(execution.engine.id))
        ? imageReferences.map((reference) => input(reference, imageFieldId)) : []),
      ...(audioFieldId ? audioReferences.map((reference) => input(reference, audioFieldId)) : []),
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
    const images = references.filter((reference) => reference.kind === 'image' && reference.role === 'reference');
    const audio = references.filter((reference) => reference.kind === 'audio' && reference.role === 'reference');
    if (sources.length < 1 || sources.length > 3 || sources.length + images.length + audio.length !== references.length) {
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
    const imageFieldId = activeReferenceFieldId(execution, 'image', VIDEO_MEDIA_FIELD_CANDIDATES.referenceImage);
    const audioFieldId = activeReferenceFieldId(execution, 'audio', VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio);
    if ((images.length && !imageFieldId) || (audio.length && !audioFieldId)) invalidModeReferences();
    if (images.length) body.referenceImages = images.map(({ url }) => url);
    if (audio.length) body.referenceAudio = audio.map(({ url }) => url);
    body.inputs = [
      ...sources.map((reference) => input(reference, fieldId)),
      ...(imageFieldId ? images.map((reference) => input(reference, imageFieldId)) : []),
      ...(audioFieldId ? audio.map((reference) => input(reference, audioFieldId)) : []),
    ];
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
