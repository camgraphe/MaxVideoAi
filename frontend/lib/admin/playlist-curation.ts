export type CurationOpening = [string, string, string, string];
export type CurationDraft = { mode: 'manual' | 'hybrid'; orderedIds: string[]; excludedIds: string[]; openingIds?: CurationOpening | null };
export type CurationItem = {
  id: string; engineId: string; engineLabel: string | null; prompt: string;
  thumbUrl: string | null; videoUrl: string; createdAt: string;
  outputWidth?: number | null; outputHeight?: number | null; aspectRatio?: string | null;
};
export type EffectiveCurationPreview = {
  mediaRevision?: string;
  total: number; firstPageIds: string[]; currentTotal: number; addedCount: number; removedCount: number;
  suppressedSourceSlugs: string[]; openingFormats: Array<'16:9' | '9:16' | null>; warnings: string[];
};
export type CurationPreview = { items: CurationItem[]; token: string; revision: string; effective: EffectiveCurationPreview };
export type CurationSnapshot = {
  available: boolean; openingAvailable?: boolean; supported: boolean; revision: string; config: CurationDraft | null;
  slug: string; isPublic: boolean; legacyIds: string[];
};

export function parseCurationDraft(value: unknown): CurationDraft {
  if (!value || typeof value !== 'object') throw new Error('Invalid curation');
  const row = value as Record<string, unknown>;
  if (row.mode !== 'manual' && row.mode !== 'hybrid') throw new Error('Invalid ordering mode');
  const ids = (input: unknown, max: number) => {
    if (!Array.isArray(input) || input.length > max || input.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200)) {
      throw new Error('Invalid media selection');
    }
    if (new Set(input).size !== input.length) throw new Error('Duplicate media selection');
    return input as string[];
  };
  const orderedIds = ids(row.orderedIds, Infinity);
  const excludedIds = ids(row.excludedIds, 5000);
  const excluded = new Set(excludedIds);
  if (orderedIds.some(id => excluded.has(id))) throw new Error('A selected video cannot also be excluded');
  const openingIds = row.openingIds == null ? null : ids(row.openingIds, 4);
  if (openingIds && openingIds.length !== 4) throw new Error('Choose all four opening videos');
  if (openingIds?.some(id => excludedIds.includes(id))) throw new Error('An opening video cannot also be excluded');
  return { mode: row.mode, orderedIds, excludedIds, ...(row.openingIds === undefined ? {} : {openingIds: openingIds as CurationOpening | null}) };
}

/** Candidates arrive in deterministic creation-date order. Eligibility is server-owned. */
export function resolveCuration(draft: CurationDraft, candidates: CurationItem[]): CurationItem[] {
  const excluded = new Set(draft.excludedIds);
  const byId = new Map(candidates.filter(item => !excluded.has(item.id)).map(item => [item.id, item]));
  const result: CurationItem[] = [];
  for (const id of [...(draft.openingIds ?? []), ...draft.orderedIds]) {
    const item = byId.get(id);
    if (item) { result.push(item); byId.delete(id); }
  }
  if (draft.mode === 'hybrid') result.push(...byId.values());
  return result;
}

/** Dimensions describe the media; declared ratios are only a fallback for legacy rows. */
export function curationItemFormat(item: Pick<CurationItem, 'outputWidth' | 'outputHeight' | 'aspectRatio'>): '16:9' | '9:16' | null {
  const width = item.outputWidth;
  const height = item.outputHeight;
  const parts = item.aspectRatio?.split(/[:/]/).map(Number);
  const ratio = width && height && width > 0 && height > 0
    ? width / height
    : parts?.length === 2 && parts[0] > 0 && parts[1] > 0 ? parts[0] / parts[1] : NaN;
  if (Math.abs(ratio / (16 / 9) - 1) <= 0.02) return '16:9';
  if (Math.abs(ratio / (9 / 16) - 1) <= 0.02) return '9:16';
  return null;
}

export function validateCurationOpening(draft: CurationDraft, candidates: CurationItem[]): void {
  if (!draft.openingIds) return;
  for (const [index, id] of draft.openingIds.entries()) {
    const item = candidates.find(candidate => candidate.id === id);
    if (!item) throw new Error('An opening video is no longer eligible. Choose another video.');
    const required = index === 1 ? '9:16' : '16:9';
    if (curationItemFormat(item) !== required) throw new Error(`Opening slot ${index + 1} requires a ${required} video.`);
  }
}
