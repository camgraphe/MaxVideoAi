import type { Job } from '@/types/jobs';

export type GroupSource = 'active' | 'history';
export type GroupMemberSource = 'render' | 'job';

export interface GroupMemberSummary {
  id: string;
  jobId?: string;
  localKey?: string;
  batchId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  engineId?: string;
  engineLabel: string;
  durationSec: number;
  priceCents?: number | null;
  currency?: string | null;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  aspectRatio?: string | null;
  prompt?: string | null;
  status?: 'pending' | 'completed' | 'failed';
  progress?: number | null;
  message?: string | null;
  etaLabel?: string | null;
  etaSeconds?: number | null;
  createdAt: string;
  source: GroupMemberSource;
  job?: Job;
}

export interface GroupSummary {
  id: string;
  source: GroupSource;
  splitMode?: string | null;
  batchId?: string | null;
  count: number;
  totalPriceCents: number | null;
  currency?: string | null;
  createdAt: string;
  hero: GroupMemberSummary;
  previews: Array<{
    id: string;
    thumbUrl?: string | null;
    videoUrl?: string | null;
    aspectRatio?: string | null;
  }>;
  members: GroupMemberSummary[];
}
