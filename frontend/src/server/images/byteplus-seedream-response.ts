type BytePlusSeedreamImageItem = {
  size?: unknown;
  url?: unknown;
};

export type BytePlusSeedreamImage = {
  url: string;
  seed: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

function parseSeedreamSize(value: unknown): { width: number | null; height: number | null } {
  if (typeof value !== 'string') return { width: null, height: null };
  const match = value.trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return { width: null, height: null };
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function extractBytePlusSeedreamImages(data: unknown): BytePlusSeedreamImage[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { data?: unknown }).data;
  if (!Array.isArray(items)) return [];

  return items
    .map((item): BytePlusSeedreamImage | null => {
      if (!item || typeof item !== 'object') return null;
      const url = (item as BytePlusSeedreamImageItem).url;
      if (typeof url !== 'string' || !url.trim()) return null;
      const size = parseSeedreamSize((item as BytePlusSeedreamImageItem).size);
      return {
        url: url.trim(),
        seed: null,
        mimeType: null,
        width: size.width,
        height: size.height,
      };
    })
    .filter((item): item is BytePlusSeedreamImage => Boolean(item));
}

export function parseBytePlusSeedreamRequestId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as { id?: unknown; request_id?: unknown }).id ?? (data as { request_id?: unknown }).request_id;
  return typeof id === 'string' && id.trim().length ? id.trim() : null;
}
