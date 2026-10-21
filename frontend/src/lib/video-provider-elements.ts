export type MaxVideoProviderElement = {
  /** Per-element voice binding supported by Kling V4; never a global voice list. */
  voiceId?: string;
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
  elements: MaxVideoProviderElement[] | null | undefined,
  options: { engineId?: string } = {},
): MaxVideoProviderElement[] {
  if (!Array.isArray(elements)) return [];
  const isV4 = options.engineId === 'kling-v4';
  // V4 must reject overflows, never silently submit a truncated subject set.
  if (isV4 && elements.length > 7) throw new Error('Kling V4 accepts at most seven elements.');
  return elements
    .map((element) => {
      if (!element || typeof element !== 'object') {
        if (isV4) throw new Error('Kling V4 elements must contain subject objects.');
        return null;
      }
      if (isV4 && [element.referenceImageUrls, element.referenceAssetIds].some(values => values !== undefined
        && (!Array.isArray(values) || values.length > 3 || values.some(value => !cleanString(value))))) {
        throw new Error('Kling V4 accepts at most three non-empty additional image references per element.');
      }
      const frontalImageUrl = cleanString(element.frontalImageUrl);
      const referenceImageUrls = cleanStringArray(element.referenceImageUrls);
      const videoUrl = cleanString(element.videoUrl);
      const providerElementId = normalizeProviderElementId(element.providerElementId);
      const normalized: MaxVideoProviderElement = {
        ...(isV4 && cleanString(element.voiceId) ? { voiceId: cleanString(element.voiceId) } : {}),
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
        if (isV4) throw new Error('Kling V4 subjects require visual media; a voice binding alone is insufficient.');
        return null;
      }
      return normalized;
    })
    .filter((element): element is MaxVideoProviderElement => Boolean(element))
    .slice(0, isV4 ? 7 : 3);
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
