import type { ToolAssetRef } from '@/lib/toolbox/contract';

/** Exact original facts in the picker-only API. Missing output facts stay unknown. */
export type GeneratedVideoCandidate = {
  jobId: string;
  videoUrl: string;
  thumbUrl?: string | null;
  previewFrame?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;
  hasAudio?: boolean | null;
  createdAt: string;
  sourceOutputId?: string;
  sourceRevision?: string;
  ref?: ToolAssetRef;
};
