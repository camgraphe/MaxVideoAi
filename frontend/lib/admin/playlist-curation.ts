export type CurationDraft = { mode: 'manual' | 'hybrid'; orderedIds: string[]; excludedIds: string[] };
export type CurationItem = {
  id: string; engineId: string; engineLabel: string | null; prompt: string;
  thumbUrl: string | null; videoUrl: string; createdAt: string;
};
export type CurationPreview = { items: CurationItem[]; token: string; revision: string };
export type CurationSnapshot = {
  available: boolean; supported: boolean; revision: string; config: CurationDraft | null;
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
  const orderedIds = ids(row.orderedIds, 2000);
  const excludedIds = ids(row.excludedIds, 5000);
  if (orderedIds.some(id => excludedIds.includes(id))) throw new Error('A selected video cannot also be excluded');
  return { mode: row.mode, orderedIds, excludedIds };
}

/** Candidates arrive in deterministic creation-date order. Eligibility is server-owned. */
export function resolveCuration(draft: CurationDraft, candidates: CurationItem[]): CurationItem[] {
  const excluded = new Set(draft.excludedIds);
  const byId = new Map(candidates.filter(item => !excluded.has(item.id)).map(item => [item.id, item]));
  const result: CurationItem[] = [];
  for (const id of draft.orderedIds) {
    const item = byId.get(id);
    if (item) { result.push(item); byId.delete(id); }
  }
  if (draft.mode === 'hybrid') result.push(...byId.values());
  return result;
}
