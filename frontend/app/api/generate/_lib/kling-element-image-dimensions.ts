import { query } from '@/lib/db';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';

export const KLING_ELEMENT_MINIMUM_IMAGE_WIDTH = 300;
export const KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT = 300;

const KLING_ELEMENT_IMAGE_TOO_SMALL = 'KLING_ELEMENT_IMAGE_TOO_SMALL';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type AssetDimensionRow = {
  asset_id: string;
  url: string;
  width: number | string | null;
  height: number | string | null;
};

export type KlingElementImageDimensionValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: typeof KLING_ELEMENT_IMAGE_TOO_SMALL;
        message: string;
        actualWidth: number;
        actualHeight: number;
        minimumWidth: number;
        minimumHeight: number;
      };
      metric: {
        errorCode: typeof KLING_ELEMENT_IMAGE_TOO_SMALL;
        meta: {
          actualWidth: number;
          actualHeight: number;
          minimumWidth: number;
          minimumHeight: number;
        };
      };
    };

function collectElementImageSelectors(elements: MaxVideoProviderElement[]) {
  const assetIds = new Set<string>();
  const urls = new Set<string>();

  for (const element of elements) {
    if (element.frontalAssetId) assetIds.add(element.frontalAssetId);
    if (element.frontalImageUrl) urls.add(element.frontalImageUrl);
    for (const assetId of element.referenceAssetIds ?? []) assetIds.add(assetId);
    for (const url of element.referenceImageUrls ?? []) urls.add(url);
  }

  return {
    assetIds: Array.from(assetIds),
    urls: Array.from(urls),
  };
}

function knownDimension(value: number | string | null): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function validateKlingElementImageDimensions(params: {
  engineId: string;
  userId: string;
  elements: MaxVideoProviderElement[] | null;
  deps?: { queryFn?: QueryFn };
}): Promise<KlingElementImageDimensionValidationResult> {
  if (!params.engineId.startsWith('kling-') || !params.elements?.length) {
    return { ok: true };
  }

  const selectors = collectElementImageSelectors(params.elements);
  if (!selectors.assetIds.length && !selectors.urls.length) {
    return { ok: true };
  }

  const queryFn = params.deps?.queryFn ?? query;
  const rows = await queryFn<AssetDimensionRow>(
    `SELECT asset_id, url, width, height
       FROM user_assets
      WHERE user_id = $1
        AND (asset_id = ANY($2::text[]) OR url = ANY($3::text[]))`,
    [params.userId, selectors.assetIds, selectors.urls]
  );

  for (const row of rows) {
    const actualWidth = knownDimension(row.width);
    const actualHeight = knownDimension(row.height);
    if (actualWidth == null || actualHeight == null) continue;
    if (
      actualWidth >= KLING_ELEMENT_MINIMUM_IMAGE_WIDTH &&
      actualHeight >= KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT
    ) {
      continue;
    }

    const minimumWidth = KLING_ELEMENT_MINIMUM_IMAGE_WIDTH;
    const minimumHeight = KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT;
    const message =
      `This image is ${actualWidth} x ${actualHeight} px. ` +
      `Kling requires at least ${minimumWidth} px in width and ${minimumHeight} px in height. ` +
      'Choose a larger image and try again.';
    const dimensions = {
      actualWidth,
      actualHeight,
      minimumWidth,
      minimumHeight,
    };

    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: KLING_ELEMENT_IMAGE_TOO_SMALL,
        message,
        ...dimensions,
      },
      metric: {
        errorCode: KLING_ELEMENT_IMAGE_TOO_SMALL,
        meta: dimensions,
      },
    };
  }

  return { ok: true };
}
