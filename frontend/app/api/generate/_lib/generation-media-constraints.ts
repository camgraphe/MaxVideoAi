import { query } from '@/lib/db';
import {
  hasFieldSpecificMediaConstraint,
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
} from '@/lib/media-field-constraints';
import type { ReferenceBudgetMediaItem } from '@/lib/reference-budget';
import { getFalEngineById } from '@/config/falEngines';
import { getPrivateRuntimeEngineById } from '@/server/video-generation/private-engine-registry';
import type { EngineInputSchema, Mode } from '@/types/engines';
import type { NormalizedAttachment } from './generation-attachment-types';
import { MINIMAX_H3_ENGINE } from '@/src/config/fal-engines/minimax-h3';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import { detectVideoDimensions } from '@/server/media/detect-has-audio';
import type { ResolvedReference } from '@/server/agent-api/reference-types';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

export type StoredMediaMetadataRow = {
  asset_id: string;
  url: string;
  origin_url: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: string | number | null;
  duration_sec?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
};

type MediaConstraintError =
  | 'MEDIA_METADATA_UNVERIFIED'
  | 'MEDIA_FILE_TOO_LARGE'
  | 'MEDIA_FORMAT_UNSUPPORTED'
  | 'MEDIA_DIMENSIONS_UNVERIFIED'
  | 'MEDIA_DIMENSIONS_TOO_SMALL'
  | 'MEDIA_DURATION_UNVERIFIED'
  | 'MEDIA_DURATION_UNSUPPORTED'
  | 'MEDIA_COMBINED_DURATION_EXCEEDED';

export type GenerationMediaConstraintValidationResult =
  | { ok: true; trustedDurationSecByField?: Record<string, number[]> }
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: MediaConstraintError;
        message: string;
        field: string;
        maxMB?: number;
        acceptedFormats?: string[];
        minDurationSec?: number;
        maxDurationSec?: number;
        durationSec?: number;
        actualWidth?: number;
        actualHeight?: number;
        minimumPixelCount?: number;
        minimumSidePx?: number;
      };
      metric: {
        errorCode: MediaConstraintError;
        meta: Record<string, unknown>;
      };
    };

function normalizeUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function normalizeSizeBytes(value: string | number | null): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function normalizeDurationSec(value: string | number | null | undefined): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function normalizeDimension(value: string | number | null | undefined): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : null;
}

function inferredAudioMime(name: string): string {
  const clean = name.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.wav')) return 'audio/wav';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  return '';
}

function failure(params: {
  error: MediaConstraintError;
  fieldId: string;
  message: string;
  maxMB?: number;
  acceptedFormats?: string[];
  minDurationSec?: number;
  maxDurationSec?: number;
  durationSec?: number;
  actualWidth?: number;
  actualHeight?: number;
  minimumPixelCount?: number;
  minimumSidePx?: number;
}): GenerationMediaConstraintValidationResult {
  return {
    ok: false,
    status: 422,
    body: {
      ok: false,
      error: params.error,
      message: params.message,
      field: params.fieldId,
      ...(typeof params.maxMB === 'number' ? { maxMB: params.maxMB } : {}),
      ...(params.acceptedFormats?.length ? { acceptedFormats: params.acceptedFormats } : {}),
      ...(typeof params.minDurationSec === 'number' ? { minDurationSec: params.minDurationSec } : {}),
      ...(typeof params.maxDurationSec === 'number' ? { maxDurationSec: params.maxDurationSec } : {}),
      ...(typeof params.durationSec === 'number' ? { durationSec: params.durationSec } : {}),
      ...(typeof params.actualWidth === 'number' ? { actualWidth: params.actualWidth } : {}),
      ...(typeof params.actualHeight === 'number' ? { actualHeight: params.actualHeight } : {}),
      ...(typeof params.minimumPixelCount === 'number' ? { minimumPixelCount: params.minimumPixelCount } : {}),
      ...(typeof params.minimumSidePx === 'number' ? { minimumSidePx: params.minimumSidePx } : {}),
    },
    metric: {
      errorCode: params.error,
      meta: {
        field: params.fieldId,
        ...(typeof params.maxMB === 'number' ? { maxMB: params.maxMB } : {}),
        ...(params.acceptedFormats?.length ? { acceptedFormats: params.acceptedFormats } : {}),
        ...(typeof params.minDurationSec === 'number' ? { minDurationSec: params.minDurationSec } : {}),
        ...(typeof params.maxDurationSec === 'number' ? { maxDurationSec: params.maxDurationSec } : {}),
        ...(typeof params.durationSec === 'number' ? { durationSec: params.durationSec } : {}),
        ...(typeof params.actualWidth === 'number' ? { actualWidth: params.actualWidth } : {}),
        ...(typeof params.actualHeight === 'number' ? { actualHeight: params.actualHeight } : {}),
        ...(typeof params.minimumPixelCount === 'number' ? { minimumPixelCount: params.minimumPixelCount } : {}),
        ...(typeof params.minimumSidePx === 'number' ? { minimumSidePx: params.minimumSidePx } : {}),
      },
    },
  };
}

export async function validateGenerationMediaConstraints(params: {
  engineId: string;
  mode: Mode;
  userId: string;
  inputSchema?: EngineInputSchema | null;
  attachments: readonly NormalizedAttachment[];
  referenceMediaItems: readonly ReferenceBudgetMediaItem[];
  trustedResolvedReferences?: readonly ResolvedReference[];
  deps?: {
    queryFn?: QueryFn;
    detectVideoDimensionsFn?: typeof detectVideoDimensions;
  };
}): Promise<GenerationMediaConstraintValidationResult> {
  const engine =
    getFalEngineById(params.engineId)?.engine ??
    getPrivateRuntimeEngineById(params.engineId) ??
    (isMinimaxH3EngineId(params.engineId) ? MINIMAX_H3_ENGINE : undefined);
  if (!engine) return { ok: true };
  const requiresOwnedMedia = params.inputSchema?.constraints?.ownedAssetModes?.includes(params.mode) === true;

  const constrainedFields = [
    ...(params.inputSchema?.required ?? []),
    ...(params.inputSchema?.optional ?? []),
  ].filter(
    (field) =>
      (field.type === 'image' || field.type === 'video' || field.type === 'audio') &&
      (!field.modes?.length || field.modes.includes(params.mode)) &&
      (hasFieldSpecificMediaConstraint(field) ||
        (() => {
          const constraint = resolveEngineMediaFieldConstraint({ engine, field });
          return typeof constraint.maxSizeMB === 'number'
            || constraint.acceptedMimeTypes.length > 0
            || constraint.acceptedFileExtensions.length > 0;
        })() ||
        (requiresOwnedMedia && (field.type === 'image' || field.type === 'video')) ||
        (field.type === 'image' && typeof params.inputSchema?.constraints?.minImageSidePx === 'number') ||
        (field.type === 'video' &&
          typeof params.inputSchema?.constraints?.minVideoPixelCount === 'number') ||
        typeof field.minDurationSec === 'number' ||
        typeof field.maxDurationSec === 'number')
  );
  if (!constrainedFields.length) return { ok: true };

  const fieldsById = new Map(constrainedFields.map((field) => [field.id, field]));
  const candidates = params.referenceMediaItems
    .filter((item) => fieldsById.has(item.fieldId) && item.url.trim().length > 0)
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.fieldId === item.fieldId && candidate.url.trim() === item.url.trim()
        ) === index
    )
    .map((item) => {
      const url = item.url.trim();
      const attachment = params.attachments.find(
        (candidate) => candidate.url?.trim() === url && candidate.slotId?.trim() === item.fieldId
      ) ?? params.attachments.find((candidate) => candidate.url?.trim() === url);
      return { fieldId: item.fieldId, kind: item.kind, url, assetId: attachment?.assetId?.trim() || null };
    });
  if (!candidates.length) return { ok: true };

  const assetIds = Array.from(new Set(candidates.map((candidate) => candidate.assetId).filter(Boolean))) as string[];
  const urls = Array.from(new Set(candidates.map((candidate) => candidate.url)));
  const detectVideoDimensionsFn =
    params.deps?.detectVideoDimensionsFn ?? detectVideoDimensions;
  let rows: StoredMediaMetadataRow[];
  if (params.trustedResolvedReferences !== undefined) {
    rows = candidates.flatMap((candidate) => {
      if (!candidate.assetId) return [];
      const matches = params.trustedResolvedReferences!.filter((resolved) =>
        resolved.assetId === candidate.assetId
        && resolved.storageUrl === candidate.url
        && resolved.mediaKind === candidate.kind);
      if (matches.length !== 1) return [];
      const resolved = matches[0]!;
      return [{
        asset_id: resolved.assetId,
        url: resolved.storageUrl,
        origin_url: null,
        original_name: resolved.originalName ?? null,
        mime_type: resolved.mimeType,
        size_bytes: resolved.sizeBytes ?? null,
        duration_sec: resolved.durationSec,
        width: resolved.width,
        height: resolved.height,
      } satisfies StoredMediaMetadataRow];
    });
  } else try {
    const queryFn = params.deps?.queryFn ?? query;
    rows = await queryFn<StoredMediaMetadataRow>(
      `SELECT asset_id::text AS asset_id,
              url,
              metadata->>'originUrl' AS origin_url,
              metadata->>'originalName' AS original_name,
              mime_type,
              size_bytes,
              metadata->>'durationSec' AS duration_sec,
              width,
              height
         FROM user_assets
        WHERE user_id = $1
          AND (
            asset_id = ANY($2::text[])
            OR url = ANY($3::text[])
            OR metadata->>'originUrl' = ANY($3::text[])
          )
        UNION ALL
       SELECT id::text AS asset_id,
              url,
              metadata->>'originUrl' AS origin_url,
              metadata->>'originalName' AS original_name,
              mime_type,
              size_bytes,
              metadata->>'durationSec' AS duration_sec,
              width,
              height
         FROM media_assets
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND (
            id = ANY($2::text[])
            OR url = ANY($3::text[])
            OR metadata->>'originUrl' = ANY($3::text[])
          )`,
      [params.userId, assetIds, urls]
    );
  } catch {
    rows = [];
  }

  const durationByKindAndUrl = new Map<string, { kind: 'video' | 'audio'; durationSec: number; fieldId: string }>();
  for (const candidate of candidates) {
    const matchingRows = rows.filter((row) => {
      const rowUrl = normalizeUrl(row.url);
      const originUrl = normalizeUrl(row.origin_url);
      return rowUrl === candidate.url || originUrl === candidate.url;
    });
    const stored =
      (candidate.assetId
        ? matchingRows.find((row) => row.asset_id === candidate.assetId)
        : undefined) ?? matchingRows[0];
    const sizeBytes = stored ? normalizeSizeBytes(stored.size_bytes) : null;
    if (!stored || sizeBytes == null) {
      if (candidate.kind === 'image' && !requiresOwnedMedia) continue;
      return failure({
        error: 'MEDIA_METADATA_UNVERIFIED',
        fieldId: candidate.fieldId,
        message: `This ${candidate.kind} reference could not be verified in your media library. Upload it again before generating.`,
      });
    }

    const field = fieldsById.get(candidate.fieldId)!;
    const constraint = resolveEngineMediaFieldConstraint({ engine, field });
    const trustedName = normalizeUrl(stored.original_name) ?? normalizeUrl(stored.origin_url) ?? stored.url;
    const trustedMime = normalizeUrl(stored.mime_type) ?? inferredAudioMime(trustedName);
    const validation = validateMediaFileAgainstConstraint({
      name: trustedName,
      mimeType: trustedMime,
      sizeBytes,
      constraint,
    });
    if (!validation.ok && validation.reason === 'size') {
      return failure({
        error: 'MEDIA_FILE_TOO_LARGE',
        fieldId: candidate.fieldId,
        message: `Each ${field.type} reference must be ${validation.maxSizeMB} MB or smaller.`,
        maxMB: validation.maxSizeMB,
      });
    }
    if (!validation.ok) {
      return failure({
        error: 'MEDIA_FORMAT_UNSUPPORTED',
        fieldId: candidate.fieldId,
        message: `${field.type[0]?.toUpperCase()}${field.type.slice(1)} references must use ${validation.acceptedFileExtensions?.map((format) => format.toUpperCase()).join(' or ')}.`,
        acceptedFormats: validation.acceptedFileExtensions,
      });
    }

    const trustedWidth = normalizeDimension(stored.width);
    const trustedHeight = normalizeDimension(stored.height);
    if (
      requiresOwnedMedia
      && (field.type === 'image' || field.type === 'video')
      && (trustedWidth == null || trustedHeight == null)
    ) {
      return failure({
        error: 'MEDIA_DIMENSIONS_UNVERIFIED',
        fieldId: candidate.fieldId,
        message: `This ${field.type} reference has no trusted dimension metadata. Upload it again before generating.`,
      });
    }

    const minimumSidePx = field.type === 'image'
      ? params.inputSchema?.constraints?.minImageSidePx
      : undefined;
    if (typeof minimumSidePx === 'number' && Number.isFinite(minimumSidePx) && minimumSidePx > 0) {
      const width = trustedWidth;
      const height = trustedHeight;
      if (width == null || height == null) {
        return failure({
          error: 'MEDIA_DIMENSIONS_UNVERIFIED',
          fieldId: candidate.fieldId,
          message: 'This image reference has no trusted dimension metadata. Upload it again before generating.',
          minimumSidePx,
        });
      }
      if (width < minimumSidePx || height < minimumSidePx) {
        return failure({
          error: 'MEDIA_DIMENSIONS_TOO_SMALL',
          fieldId: candidate.fieldId,
          message: `This image is ${width} x ${height} px. ${engine.label} requires each side to be at least ${minimumSidePx} px.`,
          actualWidth: width,
          actualHeight: height,
          minimumSidePx,
        });
      }
    }

    const minimumPixelCount =
      field.type === 'video'
        ? params.inputSchema?.constraints?.minVideoPixelCount
        : undefined;
    if (
      field.type === 'video' &&
      typeof minimumPixelCount === 'number' &&
      Number.isFinite(minimumPixelCount) &&
      minimumPixelCount > 0
    ) {
      let width = trustedWidth;
      let height = trustedHeight;
      if (!requiresOwnedMedia && (width == null || height == null)) {
        const detected = await detectVideoDimensionsFn(stored.url).catch(() => null);
        width = normalizeDimension(detected?.width);
        height = normalizeDimension(detected?.height);
      }
      if (width == null || height == null) {
        return failure({
          error: 'MEDIA_DIMENSIONS_UNVERIFIED',
          fieldId: candidate.fieldId,
          message: 'This video reference has no trusted dimension metadata. Upload it again before generating.',
          minimumPixelCount,
        });
      }
      if (width * height < minimumPixelCount) {
        return failure({
          error: 'MEDIA_DIMENSIONS_TOO_SMALL',
          fieldId: candidate.fieldId,
          message: `This video is ${width} x ${height} px. ${engine.label} requires at least ${minimumPixelCount} total pixels. Choose a larger video and try again.`,
          actualWidth: width,
          actualHeight: height,
          minimumPixelCount,
        });
      }
    }

    const combinedDurationLimit =
      field.type === 'video'
        ? params.inputSchema?.constraints?.maxCombinedVideoDurationSec
        : field.type === 'audio'
          ? params.inputSchema?.constraints?.maxCombinedAudioDurationSec
          : undefined;
    const requiresTrustedDuration =
      (field.type === 'video' || field.type === 'audio') &&
      (typeof field.minDurationSec === 'number' ||
        typeof field.maxDurationSec === 'number' ||
        typeof combinedDurationLimit === 'number');
    if ((field.type === 'video' || field.type === 'audio') && requiresTrustedDuration) {
      const durationSec = normalizeDurationSec(stored.duration_sec);
      if (durationSec == null) {
        return failure({
          error: 'MEDIA_DURATION_UNVERIFIED',
          fieldId: candidate.fieldId,
          message: `This ${field.type} reference has no trusted duration metadata. Upload it again before generating.`,
        });
      }
      const belowMinimum =
        typeof field.minDurationSec === 'number' && durationSec < field.minDurationSec;
      const aboveMaximum =
        typeof field.maxDurationSec === 'number' && durationSec > field.maxDurationSec;
      if (belowMinimum || aboveMaximum) {
        return failure({
          error: 'MEDIA_DURATION_UNSUPPORTED',
          fieldId: candidate.fieldId,
          message: `Each ${field.type} reference must be between ${field.minDurationSec ?? 0} and ${field.maxDurationSec ?? 'the provider maximum'} seconds.`,
          minDurationSec: field.minDurationSec,
          maxDurationSec: field.maxDurationSec,
          durationSec,
        });
      }
      durationByKindAndUrl.set(`${field.type}:${candidate.url}`, {
        kind: field.type,
        durationSec,
        fieldId: candidate.fieldId,
      });
    }
  }

  const combinedLimits = {
    video: params.inputSchema?.constraints?.maxCombinedVideoDurationSec,
    audio: params.inputSchema?.constraints?.maxCombinedAudioDurationSec,
  } as const;
  for (const kind of ['video', 'audio'] as const) {
    const maxDurationSec = combinedLimits[kind];
    if (typeof maxDurationSec !== 'number' || !Number.isFinite(maxDurationSec)) continue;
    const matching = [...durationByKindAndUrl.values()].filter((entry) => entry.kind === kind);
    const durationSec = matching.reduce((total, entry) => total + entry.durationSec, 0);
    if (durationSec <= maxDurationSec) continue;
    return failure({
      error: 'MEDIA_COMBINED_DURATION_EXCEEDED',
      fieldId: matching[0]?.fieldId ?? (kind === 'video' ? 'video_urls' : 'audio_urls'),
      message: `Combined ${kind} references must be ${maxDurationSec} seconds or shorter.`,
      maxDurationSec,
      durationSec,
    });
  }

  const trustedDurationSecByField = [...durationByKindAndUrl.values()].reduce<Record<string, number[]>>(
    (result, entry) => {
      (result[entry.fieldId] ??= []).push(entry.durationSec);
      return result;
    },
    {},
  );
  return Object.keys(trustedDurationSecByField).length
    ? { ok: true, trustedDurationSecByField }
    : { ok: true };
}
