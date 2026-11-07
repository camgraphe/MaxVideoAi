export const MAX_MARKETING_IMPORT_BODY_BYTES = 2 * 1024 ** 2;

export type MarketingImportPreview = {
  videoId: string;
  name: string;
  durationSec: number;
  resolution: string | null;
  width: number | null;
  height: number | null;
  fileCount: number;
};

export type MarketingMediaFile = {
  sourceUrl: string;
  url: string;
  key: string;
  sizeBytes: number;
  mime: string;
  sha256: string;
};
export type MarketingPlacement = {
  label: string;
  href?: string;
  kind: 'playlist' | 'homepage' | 'watch' | 'authored' | 'public';
};
export type MarketingMediaItem = {
  videoId: string;
  sourceKind: 'job' | 'import';
  state: 'copying' | 'ready' | 'failed' | 'deleting' | 'deleted';
  visibility: 'public' | 'private';
  prompt: string;
  engineLabel: string;
  videoUrl?: string;
  thumbUrl?: string;
  sizeBytes: number;
  createdAt: string;
  error?: string;
  copyActive?: boolean;
  placements: MarketingPlacement[];
  recreationSnapshot?: Record<string, unknown>;
};
