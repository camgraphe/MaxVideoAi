import type {
  CanonicalGenerationReferenceRole,
  CanonicalReferenceMediaKind,
} from './generation-types';

export type ResolvedReference = {
  assetId: string;
  role: CanonicalGenerationReferenceRole;
  mediaKind: CanonicalReferenceMediaKind;
  storageUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string;
};
