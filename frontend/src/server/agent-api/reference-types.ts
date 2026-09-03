import type {
  CanonicalGenerationReferenceRole,
  CanonicalReferenceMediaKind,
} from './generation-types';

export type ResolvedReference = {
  assetId: string;
  role: CanonicalGenerationReferenceRole;
  slot?: number;
  mediaKind: CanonicalReferenceMediaKind;
  storageUrl: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
  sizeBytes?: number | null;
  originalName?: string | null;
};
