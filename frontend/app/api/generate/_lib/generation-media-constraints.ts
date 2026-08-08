import { query } from '@/lib/db';
import {
  hasFieldSpecificMediaConstraint,
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
} from '@/lib/media-field-constraints';
import type { ReferenceBudgetMediaItem } from '@/lib/reference-budget';
import { getFalEngineById } from '@/config/falEngines';
import type { EngineInputSchema, Mode } from '@/types/engines';
import type { NormalizedAttachment } from './attachments';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

export type StoredMediaMetadataRow = {
  asset_id: string;
  url: string;
  origin_url: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: string | number | null;
};

export type GenerationMediaConstraintValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: 'MEDIA_METADATA_UNVERIFIED' | 'MEDIA_FILE_TOO_LARGE' | 'MEDIA_FORMAT_UNSUPPORTED';
        message: string;
        field: string;
        maxMB?: number;
        acceptedFormats?: string[];
      };
      metric: {
        errorCode: 'MEDIA_METADATA_UNVERIFIED' | 'MEDIA_FILE_TOO_LARGE' | 'MEDIA_FORMAT_UNSUPPORTED';
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

function inferredAudioMime(name: string): string {
  const clean = name.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.wav')) return 'audio/wav';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  return '';
}

function failure(params: {
  error: 'MEDIA_METADATA_UNVERIFIED' | 'MEDIA_FILE_TOO_LARGE' | 'MEDIA_FORMAT_UNSUPPORTED';
  fieldId: string;
  message: string;
  maxMB?: number;
  acceptedFormats?: string[];
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
    },
    metric: {
      errorCode: params.error,
      meta: {
        field: params.fieldId,
        ...(typeof params.maxMB === 'number' ? { maxMB: params.maxMB } : {}),
        ...(params.acceptedFormats?.length ? { acceptedFormats: params.acceptedFormats } : {}),
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
  deps?: { queryFn?: QueryFn };
}): Promise<GenerationMediaConstraintValidationResult> {
  const engine = getFalEngineById(params.engineId)?.engine;
  if (!engine) return { ok: true };

  const constrainedFields = [
    ...(params.inputSchema?.required ?? []),
    ...(params.inputSchema?.optional ?? []),
  ].filter(
    (field) =>
      (field.type === 'image' || field.type === 'video' || field.type === 'audio') &&
      (!field.modes?.length || field.modes.includes(params.mode)) &&
      hasFieldSpecificMediaConstraint(field)
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
      return { fieldId: item.fieldId, url, assetId: attachment?.assetId?.trim() || null };
    });
  if (!candidates.length) return { ok: true };

  const assetIds = Array.from(new Set(candidates.map((candidate) => candidate.assetId).filter(Boolean))) as string[];
  const urls = Array.from(new Set(candidates.map((candidate) => candidate.url)));
  const queryFn = params.deps?.queryFn ?? query;
  let rows: StoredMediaMetadataRow[];
  try {
    rows = await queryFn<StoredMediaMetadataRow>(
      `SELECT asset_id::text AS asset_id,
              url,
              metadata->>'originUrl' AS origin_url,
              metadata->>'originalName' AS original_name,
              mime_type,
              size_bytes
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
              size_bytes
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
      return failure({
        error: 'MEDIA_METADATA_UNVERIFIED',
        fieldId: candidate.fieldId,
        message: 'This audio reference could not be verified in your media library. Upload it again before generating.',
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
        message: `Each audio reference must be ${validation.maxSizeMB} MB or smaller.`,
        maxMB: validation.maxSizeMB,
      });
    }
    if (!validation.ok) {
      return failure({
        error: 'MEDIA_FORMAT_UNSUPPORTED',
        fieldId: candidate.fieldId,
        message: `Audio references must use ${validation.acceptedFileExtensions?.map((format) => format.toUpperCase()).join(' or ')}.`,
        acceptedFormats: validation.acceptedFileExtensions,
      });
    }
  }

  return { ok: true };
}
