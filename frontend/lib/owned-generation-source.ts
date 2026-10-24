export type OwnedGenerationSourceOperation = 'luma-extend' | 'flux-draft-enhance';
export type OwnedGenerationSourceOption = {
  sourceJobId: string;
  sourceOutputId: string;
  label: string;
  createdAt: string;
  durationSec: number | null;
  preparation: 'ready' | 'prepare' | 'unavailable';
};
export type OwnedGenerationSourcePage = { sources: OwnedGenerationSourceOption[]; nextCursor: string | null };
