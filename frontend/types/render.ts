export type VideoAsset = {
  url: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  tags: string[];
  thumbnailUrl?: string | null;
};
