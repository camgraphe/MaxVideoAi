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
  /** Exact measured cadence, supplied only by the owned video probe. */
  fps?: number;
  mimeType: string;
  sizeBytes?: number | null;
  decodedFrameCount?: number;
  constantFrameRate?: boolean;
  sourceSha256?: string;
  originalName?: string | null;
};
