import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import { resolveEngineMediaFieldConstraint, validateImageAspectRatio, validateMediaFileAgainstConstraint } from '@/lib/media-field-constraints';
import { getMediaExcerptDurationIssue, getMediaExcerptImportMode, getMediaExcerptLimits, VIDEO_EXCERPT_PREPARATION_LIMITS } from '@/lib/video-excerpt';
import { isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { getImageDimensionViolation, normalizeMinimumImageSide } from '@/lib/image-dimension-constraints';
import { validateKlingEditSourceDimensions } from '@/lib/video-operation';
import { validateFluxLtxSource } from '@/lib/flux-ltx-operations';
import { getKlingElementImageDimensionIssue, KLING_ELEMENT_MINIMUM_IMAGE_WIDTH } from '@/lib/kling-element-media-constraints';

export type MediaInputFacts = {
  kind: 'image' | 'video' | 'audio';
  url: string;
  mime?: string | null;
  size?: number | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
};
export type MediaInputIssue = 'kind' | 'mode' | 'format' | 'size' | 'duration' | 'aspect_ratio' | 'dimensions';
export type MediaInputEligibility = {
  status: 'usable' | 'unverified' | 'excerpt_required' | 'blocked';
  issue?: MediaInputIssue;
  durationIssue?: 'too-short' | 'too-long';
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
  maxDurationExclusive?: boolean;
  minimumImageSidePx?: number;
};
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Element slots have a separate owned-media contract, rather than a normal engine field. */
export function getKlingElementMediaEligibility(asset: MediaInputFacts, slot: 'frontal' | 'reference' | 'video'): MediaInputEligibility {
  const kind = slot === 'video' ? 'video' : 'image';
  if (asset.kind !== kind) return { status: 'blocked', issue: 'kind' };
  const mime = asset.mime?.split(';', 1)[0]?.trim().toLowerCase();
  const knownMime = Boolean(mime && mime !== 'application/octet-stream');
  if (knownMime && !mime!.startsWith(`${kind}/`)) return { status: 'blocked', issue: 'format' };
  const dimensionIssue = kind === 'image' ? getKlingElementImageDimensionIssue(asset.width, asset.height)
    : positive(asset.width) && positive(asset.height) ? null : 'unverified';
  if (dimensionIssue === 'too-small') return { status: 'blocked', issue: 'dimensions', minimumImageSidePx: KLING_ELEMENT_MINIMUM_IMAGE_WIDTH };
  return { status: !knownMime || dimensionIssue === 'unverified' || (kind === 'video' && !positive(asset.durationSec)) ? 'unverified' : 'usable' };
}

/** Selection checks known original facts only. Missing facts remain subject to upload/preflight validation. */
export function getMediaInputEligibility({ asset, field, engine, mode, context = 'stored' }: {
  asset: MediaInputFacts; field: EngineInputField; engine?: EngineCaps | null; mode?: Mode; context?: 'stored' | 'file';
}): MediaInputEligibility {
  if (field.type !== asset.kind) return { status: 'blocked', issue: 'kind' };
  if (mode && isVideoSourceWorkflow(mode) && field.modes?.length && !field.modes.includes(mode))
    return { status: 'blocked', issue: 'mode' };
  const temporal = asset.kind !== 'image';
  const importMode = temporal && engine?.modes && mode ? getMediaExcerptImportMode(engine, mode, field.id) : null;
  const excerpt = importMode && engine ? getMediaExcerptLimits(engine, importMode, field.id) : null;
  const constraints = engine ? resolveEngineMediaFieldConstraint({ engine, field }) : {
    maxSizeMB: field.maxSizeMB, acceptedMimeTypes: field.acceptedMimeTypes ?? [], acceptedFileExtensions: field.acceptedFileExtensions ?? [],
  };
  const minDurationSec = field.minDurationSec ?? excerpt?.minDurationSec;
  const maxDuration = field.maxDurationSec ?? excerpt?.maxDurationSec
    ?? (asset.kind === 'audio' ? engine?.inputLimits.audioMaxDurationSec ?? engine?.inputSchema?.constraints?.maxAudioDurationSec
      : asset.kind === 'video' ? engine?.inputLimits.videoMaxDurationSec ?? engine?.inputSchema?.constraints?.maxVideoDurationSec : undefined);
  const maxDurationSec = positive(maxDuration) ? maxDuration : null;
  const duration = { minDurationSec, maxDurationSec,
    maxDurationExclusive: engine?.inputSchema?.constraints?.videoDurationExclusiveMaxSec === maxDurationSec };
  const knownDimensions = positive(asset.width) && positive(asset.height);
  const minImageSide = field.type === 'image' ? normalizeMinimumImageSide(engine?.inputSchema?.constraints?.minImageSidePx) : null;
  const minVideoPixels = field.type === 'video' ? engine?.inputSchema?.constraints?.minVideoPixelCount : null;
  const klingEdit = engine?.activeVideoOperation === 'kling-edit' && field.id === 'video_url';
  if (knownDimensions && ((minImageSide && getImageDimensionViolation({ width: asset.width, height: asset.height,
    minimumSidePx: minImageSide, engineLabel: engine?.label ?? '' }))
    || (positive(minVideoPixels) && asset.width! * asset.height! < minVideoPixels)
    || (klingEdit && validateKlingEditSourceDimensions(asset)))) return { status: 'blocked', issue: 'dimensions' };
  const mime = asset.mime?.split(';', 1)[0]?.trim().toLowerCase();
  const knownMime = Boolean(mime && mime !== 'application/octet-stream');
  if (knownMime && !mime!.startsWith(`${asset.kind}/`)) return { status: 'blocked', issue: 'format' };
  const extension = /\.([a-z0-9]+)$/i.exec(asset.url.split(/[?#]/, 1)[0] ?? '')?.[1];
  const validation = validateMediaFileAgainstConstraint({ name: asset.url, mimeType: knownMime ? mime! : '',
    // Image imports already normalize before upload; the prepared bytes own their size check.
    sizeBytes: context === 'file' && asset.kind === 'image' ? 0 : positive(asset.size) ? asset.size : 0, constraint: { ...constraints,
      acceptedMimeTypes: knownMime ? constraints.acceptedMimeTypes : [],
      acceptedFileExtensions: extension ? constraints.acceptedFileExtensions : [],
    } });
  const budget = VIDEO_EXCERPT_PREPARATION_LIMITS;
  const canPrepare = excerpt && (!positive(asset.durationSec) || asset.durationSec <= budget.maxSourceSec)
    && (!positive(asset.size) || asset.size <= budget.maxBytes)
    && (!positive(minDurationSec) || minDurationSec <= budget.maxExcerptSec)
    && !(positive(asset.width) && positive(asset.height) && asset.width * asset.height > budget.maxPixels);
  const sizeNeedsPreparation = !validation.ok && validation.reason === 'size' && context === 'stored' && canPrepare
    && positive(asset.durationSec) && positive(maxDurationSec) && asset.durationSec > maxDurationSec;
  if (!validation.ok && !sizeNeedsPreparation) return { status: 'blocked', issue: validation.reason };
  if (sizeNeedsPreparation) {
    const formatCheck = validateMediaFileAgainstConstraint({ name: asset.url, mimeType: knownMime ? mime! : '', sizeBytes: 1,
      constraint: { ...constraints, acceptedMimeTypes: knownMime ? constraints.acceptedMimeTypes : [], acceptedFileExtensions: extension ? constraints.acceptedFileExtensions : [] } });
    if (!formatCheck.ok) return { status: 'blocked', issue: formatCheck.reason };
  }
  const aspect = validateImageAspectRatio(field, asset.width, asset.height);
  if (aspect === 'unsupported') return { status: 'blocked', issue: 'aspect_ratio' };
  if (temporal && positive(asset.durationSec)) {
    const durationIssue = getMediaExcerptDurationIssue(asset.durationSec, { minDurationSec: minDurationSec ?? null, maxDurationSec: maxDurationSec ?? null });
    if (durationIssue === 'too-short')
      return { status: 'blocked', issue: 'duration', durationIssue: 'too-short', ...duration };
    if (durationIssue === 'too-long') {
      return { status: canPrepare ? 'excerpt_required' : 'blocked', issue: canPrepare ? undefined : 'duration', durationIssue: 'too-long', ...duration };
    }
  }
  if (engine?.activeVideoOperation === 'flux-fast-edit' && field.id === 'video_url') {
    const strictDuration = engine.inputSchema?.constraints?.videoDurationExclusiveMaxSec;
    if (positive(strictDuration) && asset.durationSec === strictDuration)
      return { status: canPrepare ? 'excerpt_required' : 'blocked', issue: canPrepare ? undefined : 'duration', durationIssue: 'too-long', ...duration };
    if (positive(asset.durationSec) && positive(asset.size) && knownMime && validateFluxLtxSource('flux-fast-edit', {
      durationSec: asset.durationSec, sizeBytes: asset.size, mimeType: mime })) return { status: 'blocked', issue: mime !== 'video/mp4' ? 'format' : 'size' };
  }
  const unknown = (positive(constraints.maxSizeMB) && !positive(asset.size))
    || (constraints.acceptedMimeTypes.length > 0 && !knownMime)
    || (constraints.acceptedFileExtensions.length > 0 && !extension)
    || (temporal && (positive(minDurationSec) || positive(maxDurationSec)) && !positive(asset.durationSec))
    || aspect === 'unverified'
    || (!knownDimensions && (Boolean(minImageSide) || positive(minVideoPixels) || klingEdit))
    // Frame cadence and shot constraints require the existing owned byte/content checks.
    || (field.id === 'video_url' && engine?.activeVideoOperation === 'h3-relight');
  return { status: unknown ? 'unverified' : 'usable', ...duration };
}
