export type NormalizedAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: 'image' | 'video' | 'audio';
  slotId?: string;
  label?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  assetId?: string;
};
