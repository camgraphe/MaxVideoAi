import { query } from '@/lib/db';
import {
  getImageDimensionViolation,
  normalizeImageDimension,
  normalizeMinimumImageSide,
} from '@/lib/image-dimension-constraints';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import { getFalEngineById } from '@/config/falEngines';
import type { NormalizedAttachment } from './attachments';

const IMAGE_DIMENSIONS_TOO_SMALL = 'IMAGE_DIMENSIONS_TOO_SMALL';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type AssetDimensionRow = {
  asset_id: string;
  url: string;
  width: number | string | null;
  height: number | string | null;
};

type ImageCandidate = {
  assetId?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
};

export type GenerationImageDimensionValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: typeof IMAGE_DIMENSIONS_TOO_SMALL;
        message: string;
        actualWidth: number;
        actualHeight: number;
        minimumWidth: number;
        minimumHeight: number;
      };
      metric: {
        errorCode: typeof IMAGE_DIMENSIONS_TOO_SMALL;
        meta: {
          actualWidth: number;
          actualHeight: number;
          minimumWidth: number;
          minimumHeight: number;
        };
      };
    };

function collectElementImageCandidates(elements: MaxVideoProviderElement[] | null | undefined): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  for (const element of elements ?? []) {
    if (element.frontalAssetId || element.frontalImageUrl) {
      candidates.push({ assetId: element.frontalAssetId, url: element.frontalImageUrl });
    }
    const referenceAssetIds = element.referenceAssetIds ?? [];
    const referenceImageUrls = element.referenceImageUrls ?? [];
    const count = Math.max(referenceAssetIds.length, referenceImageUrls.length);
    for (let index = 0; index < count; index += 1) {
      candidates.push({ assetId: referenceAssetIds[index], url: referenceImageUrls[index] });
    }
  }
  return candidates;
}

function uniqueCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.assetId ?? candidate.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function validateGenerationImageDimensions(params: {
  engineId: string;
  userId: string;
  attachments?: NormalizedAttachment[];
  imageUrls?: Array<string | null | undefined>;
  elements?: MaxVideoProviderElement[] | null;
  deps?: { queryFn?: QueryFn };
}): Promise<GenerationImageDimensionValidationResult> {
  const engine = getFalEngineById(params.engineId)?.engine;
  const minimumSidePx = normalizeMinimumImageSide(
    engine?.inputSchema?.constraints?.minImageSidePx
  );
  if (!engine || minimumSidePx == null) return { ok: true };

  const candidates = uniqueCandidates([
    ...(params.attachments ?? [])
      .filter((attachment) => attachment.kind === 'image')
      .map((attachment) => ({
        assetId: attachment.assetId,
        url: attachment.url,
        width: attachment.width,
        height: attachment.height,
      })),
    ...(params.imageUrls ?? [])
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .map((url) => ({ url: url.trim() })),
    ...collectElementImageCandidates(params.elements),
  ]);
  if (!candidates.length) return { ok: true };

  const assetIds = Array.from(new Set(candidates.map((candidate) => candidate.assetId).filter(Boolean))) as string[];
  const urls = Array.from(new Set(candidates.map((candidate) => candidate.url).filter(Boolean))) as string[];
  const queryFn = params.deps?.queryFn ?? query;
  const rows = await queryFn<AssetDimensionRow>(
    `SELECT asset_id, url, width, height
       FROM user_assets
      WHERE user_id = $1
        AND (asset_id = ANY($2::text[]) OR url = ANY($3::text[]))`,
    [params.userId, assetIds, urls]
  );
  const rowsByAssetId = new Map(rows.map((row) => [row.asset_id, row]));
  const rowsByUrl = new Map(rows.map((row) => [row.url, row]));

  for (const candidate of candidates) {
    const stored =
      (candidate.assetId ? rowsByAssetId.get(candidate.assetId) : undefined) ??
      (candidate.url ? rowsByUrl.get(candidate.url) : undefined);
    const storedWidth = normalizeImageDimension(stored?.width);
    const storedHeight = normalizeImageDimension(stored?.height);
    const violation = getImageDimensionViolation({
      width: storedWidth ?? candidate.width,
      height: storedHeight ?? candidate.height,
      minimumSidePx,
      engineLabel: engine.label,
    });
    if (!violation) continue;

    const dimensions = {
      actualWidth: violation.width,
      actualHeight: violation.height,
      minimumWidth: violation.minimumSidePx,
      minimumHeight: violation.minimumSidePx,
    };
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: IMAGE_DIMENSIONS_TOO_SMALL,
        message: violation.message,
        ...dimensions,
      },
      metric: {
        errorCode: IMAGE_DIMENSIONS_TOO_SMALL,
        meta: dimensions,
      },
    };
  }

  return { ok: true };
}
