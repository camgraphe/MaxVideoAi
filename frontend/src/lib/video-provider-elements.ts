export type MaxVideoProviderElement = {
  id?: string;
  providerElementId?: string | number;
  frontalImageUrl?: string;
  frontalAssetId?: string;
  referenceImageUrls?: string[];
  referenceAssetIds?: string[];
  videoUrl?: string;
  videoAssetId?: string;
};

export type FalProviderElementInput = {
  frontal_image_url?: string;
  reference_image_urls?: string[];
  video_url?: string;
};

export type KlingDirectElementInput = {
  element_id: string | number;
};

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function cleanStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const cleaned = values
    .map((value) => cleanString(value))
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  return cleaned.length ? cleaned : undefined;
}

function normalizeProviderElementId(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const stringValue = cleanString(value);
  if (!stringValue) return undefined;
  const numeric = Number(stringValue);
  return Number.isInteger(numeric) && String(numeric) === stringValue ? numeric : stringValue;
}

export function normalizeMaxVideoProviderElements(
  elements: MaxVideoProviderElement[] | null | undefined
): MaxVideoProviderElement[] {
  if (!Array.isArray(elements)) return [];
  return elements
    .map((element) => {
      if (!element || typeof element !== 'object') return null;
      const frontalImageUrl = cleanString(element.frontalImageUrl);
      const referenceImageUrls = cleanStringArray(element.referenceImageUrls);
      const videoUrl = cleanString(element.videoUrl);
      const providerElementId = normalizeProviderElementId(element.providerElementId);
      const normalized: MaxVideoProviderElement = {
        id: cleanString(element.id),
        providerElementId,
        frontalImageUrl,
        frontalAssetId: cleanString(element.frontalAssetId),
        referenceImageUrls,
        referenceAssetIds: cleanStringArray(element.referenceAssetIds),
        videoUrl,
        videoAssetId: cleanString(element.videoAssetId),
      };
      if (!providerElementId && !frontalImageUrl && !referenceImageUrls?.length && !videoUrl) {
        return null;
      }
      return normalized;
    })
    .filter((element): element is MaxVideoProviderElement => Boolean(element))
    .slice(0, 3);
}

export function buildFalElementInputs(
  elements: MaxVideoProviderElement[] | null | undefined
): FalProviderElementInput[] | undefined {
  const normalized = normalizeMaxVideoProviderElements(elements);
  const falElements = normalized
    .map((element) => ({
      frontal_image_url: element.frontalImageUrl,
      reference_image_urls: element.referenceImageUrls,
      video_url: element.videoUrl,
    }))
    .filter((element) =>
      Boolean(element.video_url || (element.frontal_image_url && element.reference_image_urls?.length))
    );
  return falElements.length ? falElements : undefined;
}

export function buildKlingDirectElementList(
  elements: MaxVideoProviderElement[] | null | undefined
): KlingDirectElementInput[] | undefined {
  const elementList = normalizeMaxVideoProviderElements(elements)
    .map((element) => element.providerElementId)
    .filter((providerElementId): providerElementId is string | number => providerElementId !== undefined)
    .slice(0, 3)
    .map((element_id) => ({ element_id }));
  return elementList.length ? elementList : undefined;
}
