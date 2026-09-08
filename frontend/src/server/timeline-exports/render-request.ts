import { z } from 'zod';
import { timelineExportIdempotencyKeySchema } from './idempotency';
import type {
  WorkspaceTimelineVideoExportRequest,
  WorkspaceTimelineVideoExportSettings,
} from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

export const MAX_EXPORT_DURATION_SEC = 30 * 60;
export const MAX_EXPORT_CLIPS = 120;
const MAX_EXPORT_TRACKS = 12;
const MAX_EXPORT_PIXEL_EDGE = 8192;
const MAX_EXPORT_PIXEL_AREA = 40_000_000;
const MAX_EXPORT_FRAMES = 108_000;
const ID = z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9._:-]+$/);
const finiteSeconds = z.number().finite().min(0).max(MAX_EXPORT_DURATION_SEC);
const positiveDuration = z.number().finite().positive().max(MAX_EXPORT_DURATION_SEC);
const nullablePositiveDuration = z.number().finite().positive().max(MAX_EXPORT_DURATION_SEC).nullable();
const pixel = z.number().int().positive().max(MAX_EXPORT_PIXEL_EDGE).nullable().optional();
const trackId = z.string().regex(/^(?:video(?:-[1-4])?|audio(?:-[1-8])?)$/);

const transformSchema = z.object({
  scale: z.number().finite().min(0.01).max(100),
  positionX: z.number().finite().min(-1000).max(1000),
  positionY: z.number().finite().min(-1000).max(1000),
  rotation: z.number().finite().min(-3600).max(3600),
  opacity: z.number().finite().min(0).max(1),
}).strict();

const compositionSchema = z.object({
  sequenceWidth: z.number().int().positive().max(MAX_EXPORT_PIXEL_EDGE),
  sequenceHeight: z.number().int().positive().max(MAX_EXPORT_PIXEL_EDGE),
  sourceWidth: z.number().int().positive().max(MAX_EXPORT_PIXEL_EDGE),
  sourceHeight: z.number().int().positive().max(MAX_EXPORT_PIXEL_EDGE),
  width: z.number().finite().positive().max(100_000),
  height: z.number().finite().positive().max(100_000),
  left: z.number().finite().min(-100_000).max(100_000),
  top: z.number().finite().min(-100_000).max(100_000),
  scale: z.number().finite().min(0.01).max(100),
  rotation: z.number().finite().min(-3600).max(3600),
  opacity: z.number().finite().min(0).max(1),
}).strict();

const clipSchema = z.object({
  id: ID,
  assetId: ID.nullable().optional(),
  outputNodeId: ID,
  title: z.string().min(1).max(500),
  track: trackId,
  mediaKind: z.enum(['video', 'audio', 'image']),
  mediaUrl: z.string().min(1).max(4096),
  thumbnailUrl: z.string().max(4096).nullable().optional(),
  startSec: finiteSeconds,
  endSec: positiveDuration,
  durationSec: positiveDuration,
  sourceStartSec: finiteSeconds,
  sourceEndSec: positiveDuration,
  sourceDurationSec: nullablePositiveDuration.optional(),
  linkedGroupId: ID.nullable().optional(),
  hasEmbeddedAudio: z.boolean().optional(),
  audioProvenance: z.enum(['none', 'embedded', 'external', 'unknown']).optional(),
  sourceWidth: pixel,
  sourceHeight: pixel,
  modelId: z.string().max(200).optional(),
  transform: transformSchema.optional(),
  composition: compositionSchema.nullable().optional(),
  audioMix: z.object({
    volume: z.number().finite().min(0).max(100),
    muted: z.boolean(),
  }).strict().optional(),
  transitionOut: z.object({
    type: z.literal('crossfade'),
    durationSec: positiveDuration,
    nextClipId: ID,
  }).strict().nullable().optional(),
}).strict();

const trackSchema = z.object({
  id: trackId,
  clips: z.array(clipSchema).max(MAX_EXPORT_CLIPS),
  durationSec: finiteSeconds,
}).strict();

const issueSchema = z.object({
  code: z.enum([
    'empty_timeline',
    'missing_media',
    'processing_media',
    'missing_dimensions',
    'overlapping_clips',
    'orphan_linked_audio',
    'invalid_transition',
  ]),
  severity: z.enum(['blocking', 'warning']),
  itemId: ID.optional(),
  message: z.string().min(1).max(1000),
}).strict();

const manifestSchema = z.object({
  version: z.literal(1),
  source: z.literal('maxvideoai-editor'),
  projectName: z.string().trim().min(1).max(200),
  sequenceId: ID,
  sequenceName: z.string().trim().min(1).max(200),
  projectSettings: z.object({
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5', '21:9']),
    resolution: z.enum(['720p', '1080p', '1440p', '4k']),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
  }).strict().optional(),
  createdAt: z.string().datetime(),
  status: z.enum(['ready', 'blocked']),
  durationSec: positiveDuration,
  exportRange: z.object({
    mode: z.enum(['sequence', 'in-out']),
    startSec: finiteSeconds,
    endSec: positiveDuration,
    durationSec: positiveDuration,
  }).strict(),
  tracks: z.array(trackSchema).max(MAX_EXPORT_TRACKS),
  issues: z.array(issueSchema).max(MAX_EXPORT_CLIPS * 2),
}).strict();

const requestSchema = z.object({
  version: z.literal(1),
  source: z.literal('maxvideoai-editor'),
  projectId: ID,
  idempotencyKey: timelineExportIdempotencyKeySchema,
  createdAt: z.string().datetime(),
  status: z.enum(['ready', 'blocked']),
  manifest: manifestSchema,
  exportSettings: z.object({
    format: z.literal('mp4-h264'),
    qualityPreset: z.enum(['draft', 'standard', 'high']),
    includeAudio: z.boolean(),
    serverRenderMode: z.literal('server'),
  }).strict(),
}).strict();

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.002;
}

function exceedsPixelArea(width: number | null | undefined, height: number | null | undefined): boolean {
  return typeof width === 'number'
    && typeof height === 'number'
    && width * height > MAX_EXPORT_PIXEL_AREA;
}

function assertManifestInvariants(manifest: WorkspaceTimelineRenderManifest): void {
  if (manifest.status !== 'ready' || manifest.issues.some((issue) => issue.severity === 'blocking')) {
    throw new Error('EXPORT_MANIFEST_BLOCKED');
  }
  if (
    !almostEqual(manifest.durationSec, manifest.exportRange.durationSec)
    || !almostEqual(manifest.exportRange.endSec - manifest.exportRange.startSec, manifest.exportRange.durationSec)
  ) throw new Error('EXPORT_MANIFEST_RANGE_INVALID');
  const fps = manifest.projectSettings?.fps ?? 30;
  if (Math.ceil(manifest.durationSec * fps) > MAX_EXPORT_FRAMES) throw new Error('EXPORT_RESOURCE_LIMIT');

  const trackIds = new Set<string>();
  const clipIds = new Set<string>();
  let clipCount = 0;
  for (const track of manifest.tracks) {
    if (trackIds.has(track.id)) throw new Error('EXPORT_MANIFEST_DUPLICATE_TRACK');
    trackIds.add(track.id);
    const clips = [...track.clips].sort((left, right) => left.startSec - right.startSec || left.id.localeCompare(right.id));
    clipCount += clips.length;
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      if (clipIds.has(clip.id)) throw new Error('EXPORT_MANIFEST_DUPLICATE_CLIP');
      clipIds.add(clip.id);
      if (clip.track !== track.id) throw new Error('EXPORT_MANIFEST_TRACK_MISMATCH');
      if (!clip.assetId) throw new Error('EXPORT_ASSET_ID_REQUIRED');
      if (exceedsPixelArea(clip.sourceWidth, clip.sourceHeight)) throw new Error('EXPORT_RESOURCE_LIMIT');
      if (
        clip.composition
        && (
          exceedsPixelArea(clip.composition.sourceWidth, clip.composition.sourceHeight)
          || exceedsPixelArea(clip.composition.sequenceWidth, clip.composition.sequenceHeight)
        )
      ) throw new Error('EXPORT_RESOURCE_LIMIT');
      if (
        !almostEqual(clip.endSec, clip.startSec + clip.durationSec)
        || !almostEqual(clip.sourceEndSec, clip.sourceStartSec + clip.durationSec)
        || clip.endSec > manifest.durationSec + 0.002
        || (clip.sourceDurationSec !== null
          && clip.sourceDurationSec !== undefined
          && clip.sourceEndSec > clip.sourceDurationSec + 0.002)
      ) throw new Error('EXPORT_MANIFEST_CLIP_TIMING_INVALID');
      const previous = clips[index - 1];
      if (previous && clip.startSec < previous.endSec - 0.002) throw new Error('EXPORT_MANIFEST_OVERLAP');
    }
    const expectedTrackDuration = clips.reduce((duration, clip) => Math.max(duration, clip.endSec), 0);
    if (!almostEqual(track.durationSec, expectedTrackDuration)) throw new Error('EXPORT_MANIFEST_TRACK_DURATION_INVALID');
  }
  if (clipCount === 0) throw new Error('EXPORT_MANIFEST_CLIP_COUNT_INVALID');
  if (clipCount > MAX_EXPORT_CLIPS) throw new Error('EXPORT_RESOURCE_LIMIT');
}

export function parseTimelineExportManifest(value: unknown): WorkspaceTimelineRenderManifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success) throw new Error('INVALID_EXPORT_REQUEST');
  const manifest = result.data as WorkspaceTimelineRenderManifest;
  assertManifestInvariants(manifest);
  return manifest;
}

export function parseTimelineExportRequest(value: unknown): WorkspaceTimelineVideoExportRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) throw new Error('INVALID_EXPORT_REQUEST');
  const request = result.data as WorkspaceTimelineVideoExportRequest;
  if (request.status !== 'ready' || request.status !== request.manifest.status) {
    throw new Error('EXPORT_MANIFEST_BLOCKED');
  }
  assertManifestInvariants(request.manifest);
  return request;
}

export function resolveTimelineExportResolution(request: WorkspaceTimelineVideoExportRequest): string | null {
  return request.manifest.projectSettings?.resolution ?? null;
}

export function resolveTimelineExportFps(request: WorkspaceTimelineVideoExportRequest): number | null {
  return request.manifest.projectSettings?.fps ?? null;
}

export function isTimelineExportQualityPreset(value: unknown): value is WorkspaceTimelineVideoExportSettings['qualityPreset'] {
  return value === 'draft' || value === 'standard' || value === 'high';
}
