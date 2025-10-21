export type ResultProvider = 'test' | 'fal';

export type VideoAspect = '16:9' | '1:1' | '9:16';

export interface VideoItem {
  id: string;
  url: string;
  aspect: VideoAspect;
  thumb?: string;
  jobId?: string;
  durationSec?: number;
  engineId?: string;
  costCents?: number;
  meta?: Record<string, unknown>;
  indexable?: boolean;
  visibility?: 'public' | 'private';
}

export type VideoGroupLayout = 'x1' | 'x2' | 'x3' | 'x4';

export interface VideoGroup {
  id: string;
  items: VideoItem[];
  layout: VideoGroupLayout;
  createdAt: string;
  provider: ResultProvider;
  paramsSnapshot?: Record<string, unknown>;
  totalCostCents?: number;
  currency?: string;
  heroItemId?: string;
  meta?: Record<string, unknown>;
  status: 'loading' | 'ready' | 'error';
  errorMsg?: string;
}
