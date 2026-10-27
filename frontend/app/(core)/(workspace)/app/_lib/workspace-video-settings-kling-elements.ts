import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';

type CreateLocalId = (prefix: string) => string;

function buildKlingAssetFromUrl(
  url: string,
  kind: 'image' | 'video',
  index: number,
  createLocalId: CreateLocalId
): KlingElementAsset {
  return {
    id: createLocalId(`kling_${kind}`),
    previewUrl: url,
    name: url.split('/').pop() ?? `${kind}-${index + 1}`,
    kind,
    status: 'ready',
    url,
  };
}

/** V4 snapshots refuse malformed subjects instead of filtering entries and changing identity order. */
function readKlingV4SnapshotElements(value: unknown, createLocalId: CreateLocalId): KlingElementState[] {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 7) throw new Error('Invalid Kling 4.0 saved subjects.');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid Kling 4.0 saved subject.');
    const record = entry as Record<string, unknown>;
    const optionalString = (key: string): string | undefined => {
      const field = record[key];
      if (field === undefined || field === null) return undefined;
      if (typeof field !== 'string' || !field.trim()) throw new Error(`Invalid saved subject ${key}.`);
      return field;
    };
    const strings = (key: string): string[] => {
      const field = record[key];
      if (field === undefined || field === null) return [];
      if (!Array.isArray(field) || field.length > 3 || field.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`Invalid saved subject ${key}.`);
      }
      return field as string[];
    };
    const urls = strings('referenceImageUrls');
    const ids = strings('referenceAssetIds');
    if (ids.length && ids.length !== urls.length) throw new Error('Saved subject reference identities do not match its views.');
    const makeAsset = (url: string | undefined, kind: 'image' | 'video', assetId: string | undefined, view: number) =>
      url ? { ...buildKlingAssetFromUrl(url, kind, view, createLocalId), ...(assetId ? { assetId } : {}) } : null;
    const frontalUrl = optionalString('frontalImageUrl');
    const videoUrl = optionalString('videoUrl');
    const voiceId = optionalString('voiceId');
    if (!frontalUrl && !videoUrl && !urls.length) throw new Error('Saved subject has no visual reference.');
    return {
      id: optionalString('id') ?? createLocalId(`element_${index}`),
      frontal: makeAsset(frontalUrl, 'image', optionalString('frontalAssetId'), 0),
      video: makeAsset(videoUrl, 'video', optionalString('videoAssetId'), 0),
      references: Array.from({ length: 3 }, (_, view) => makeAsset(urls[view], 'image', ids[view], view)),
      ...(voiceId ? { voiceId } : {}),
    };
  });
}

export function readSnapshotKlingElements(
  value: unknown,
  createLocalId: CreateLocalId,
  createFallbackKlingElement: () => KlingElementState,
  preserveExact = false
): KlingElementState[] | null {
  if (preserveExact) {
    const elements = readKlingV4SnapshotElements(value, createLocalId);
    return elements.length ? elements : [createFallbackKlingElement()];
  }
  if (value !== null && !Array.isArray(value)) return null;
  const elements = Array.isArray(value)
    ? value
        .map((entry, elementIndex) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const frontalUrl =
            typeof record.frontalImageUrl === 'string' && record.frontalImageUrl.trim().length
              ? record.frontalImageUrl.trim()
              : null;
          const referenceUrls = Array.isArray(record.referenceImageUrls)
            ? record.referenceImageUrls
                .map((entry: unknown) => (typeof entry === 'string' ? entry.trim() : ''))
                .filter((entry): entry is string => entry.length > 0)
                .slice(0, 3)
            : [];
          const videoUrl =
            typeof record.videoUrl === 'string' && record.videoUrl.trim().length ? record.videoUrl.trim() : null;
          if (!frontalUrl && referenceUrls.length === 0 && !videoUrl) return null;
          const references = Array.from({ length: 3 }, (_, index) =>
            referenceUrls[index] ? { ...buildKlingAssetFromUrl(referenceUrls[index], 'image', index, createLocalId), ...(typeof (record.referenceAssetIds as unknown[])?.[index] === 'string' ? {assetId: (record.referenceAssetIds as string[])[index]} : {}) } : null
          );
          return {
            id: createLocalId(`element_${elementIndex}`),
            frontal: frontalUrl ? { ...buildKlingAssetFromUrl(frontalUrl, 'image', 0, createLocalId), ...(typeof record.frontalAssetId === 'string' ? {assetId: record.frontalAssetId} : {}) } : null,
            references,
            video: videoUrl ? { ...buildKlingAssetFromUrl(videoUrl, 'video', 0, createLocalId), ...(typeof record.videoAssetId === 'string' ? {assetId: record.videoAssetId} : {}) } : null,
          } satisfies KlingElementState;
        })
        .filter((element): element is KlingElementState => Boolean(element))
    : [];
  return elements.length ? elements : [createFallbackKlingElement()];
}
