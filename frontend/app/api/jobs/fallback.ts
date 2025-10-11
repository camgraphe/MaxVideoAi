import path from 'path';
import { promises as fs } from 'fs';
import type { PricingSnapshot } from '@/types/engines';

const FALLBACK_VIDEOS = [
  '/assets/gallery/adraga-beach.mp4',
  '/assets/gallery/drone-snow.mp4',
  '/assets/gallery/swimmer.mp4',
  '/assets/gallery/aerial-road.mp4',
  '/assets/gallery/robot-eyes.mp4',
  '/assets/gallery/robot-look.mp4',
  '/assets/gallery/parking-portrait.mp4',
];

type FallbackJob = {
  jobId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl?: string;
  previewFrame?: string;
  createdAt?: string;
  engineId?: string;
  aspectRatio?: string;
  hasAudio?: boolean;
  canUpscale?: boolean;
  finalPriceCents?: number;
  pricingSnapshot?: PricingSnapshot;
  currency?: string;
  videoUrl?: string;
  [key: string]: unknown;
};

function getThumbForAspectRatio(aspectRatio: string | undefined): string {
  if (aspectRatio === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (aspectRatio === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

async function readFallbackFile(): Promise<{ jobs: FallbackJob[] }> {
  const file = path.join(process.cwd(), '..', 'jobs.json');
  const raw = await fs.readFile(file, 'utf-8');
  const json = JSON.parse(raw) as { jobs?: FallbackJob[] };
  return { jobs: Array.isArray(json.jobs) ? json.jobs : [] };
}

function mapFallbackJob(job: FallbackJob, index: number): FallbackJob & {
  thumbUrl: string;
  previewFrame: string;
  createdAt: string;
  videoUrl: string;
  currency: string;
} {
  const aspectRatio = typeof job.aspectRatio === 'string' ? job.aspectRatio : '16:9';
  const fallbackThumb = getThumbForAspectRatio(aspectRatio);
  const thumb = typeof job.previewFrame === 'string' && job.previewFrame.length > 0 ? job.previewFrame : job.thumbUrl;
  const resolvedThumb = typeof thumb === 'string' && thumb.length > 0 ? thumb : fallbackThumb;
  const videoUrl = typeof job.videoUrl === 'string' && job.videoUrl.length > 0 ? job.videoUrl : FALLBACK_VIDEOS[index % FALLBACK_VIDEOS.length];

  return {
    ...job,
    thumbUrl: resolvedThumb,
    previewFrame: resolvedThumb,
    createdAt: job.createdAt ?? new Date(Date.now() - index * 60_000).toISOString(),
    videoUrl,
    currency: job.currency ?? 'USD',
  };
}

export async function loadFallbackJobs(limit: number, cursor: string | null) {
  const { jobs } = await readFallbackFile();
  const offset = cursor ? Number(cursor) || 0 : 0;
  const slice = jobs.slice(offset, offset + limit).map((job, idx) => mapFallbackJob(job, offset + idx));
  const nextCursor = offset + limit < jobs.length ? String(offset + limit) : null;
  return { jobs: slice, nextCursor };
}

export async function loadFallbackJob(jobId: string) {
  const { jobs } = await readFallbackFile();
  const index = jobs.findIndex((job) => job.jobId === jobId);
  if (index === -1) return null;
  const mapped = mapFallbackJob(jobs[index], index);
  return {
    jobId: mapped.jobId,
    engineLabel: mapped.engineLabel,
    durationSec: mapped.durationSec,
    prompt: mapped.prompt,
    thumbUrl: mapped.thumbUrl,
    videoUrl: mapped.videoUrl,
    createdAt: mapped.createdAt,
    engineId: mapped.engineId,
    aspectRatio: mapped.aspectRatio,
    hasAudio: Boolean(mapped.hasAudio),
    canUpscale: Boolean(mapped.canUpscale),
    previewFrame: mapped.previewFrame,
    finalPriceCents: mapped.finalPriceCents,
    pricingSnapshot: mapped.pricingSnapshot,
    currency: mapped.currency,
  };
}
