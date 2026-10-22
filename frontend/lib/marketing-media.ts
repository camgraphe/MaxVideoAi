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
