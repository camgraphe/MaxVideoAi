import type { CanonicalGenerationReferenceRole } from './generation-types';

export type ResolvedReference = {
  assetId: string;
  role: CanonicalGenerationReferenceRole;
  storageUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string;
};
