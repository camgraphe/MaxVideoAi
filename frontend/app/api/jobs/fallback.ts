import path from 'path';
import { promises as fs } from 'fs';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';

const FALLBACK_MEDIA = [
  { video: '/assets/gallery/adraga-beach.mp4', thumb: '/assets/gallery/sample-01.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/drone-snow.mp4', thumb: '/assets/gallery/sample-02.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/swimmer.mp4', thumb: '/assets/gallery/sample-03.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/aerial-road.mp4', thumb: '/assets/gallery/sample-04.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/robot-eyes.mp4', thumb: '/assets/gallery/sample-05.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/robot-look.mp4', thumb: '/assets/gallery/sample-06.svg', aspectRatio: '16:9' },
  { video: '/assets/gallery/parking-portrait.mp4', thumb: '/assets/gallery/sample-portrait-01.svg', aspectRatio: '9:16' },
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
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[];
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
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
  const media = FALLBACK_MEDIA[index % FALLBACK_MEDIA.length];
  const aspectRatio = typeof job.aspectRatio === 'string' ? job.aspectRatio : media.aspectRatio;
  const fallbackThumb = media.thumb ?? getThumbForAspectRatio(aspectRatio);
  const thumb = typeof job.previewFrame === 'string' && job.previewFrame.length > 0 ? job.previewFrame : job.thumbUrl;
  const resolvedThumb = normalizeMediaUrl(typeof thumb === 'string' && thumb.length > 0 ? thumb : fallbackThumb) ?? fallbackThumb;
  const videoUrl = normalizeMediaUrl(typeof job.videoUrl === 'string' && job.videoUrl.length > 0 ? job.videoUrl : media.video) ?? media.video;

  return {
    ...job,
    thumbUrl: resolvedThumb,
    previewFrame: resolvedThumb,
    createdAt: job.createdAt ?? new Date(Date.now() - index * 60_000).toISOString(),
    videoUrl,
    currency: job.currency ?? 'USD',
    batchId: job.batchId ?? null,
    groupId: job.groupId ?? null,
    iterationIndex: typeof job.iterationIndex === 'number' ? job.iterationIndex : null,
    iterationCount: typeof job.iterationCount === 'number' ? job.iterationCount : null,
    renderIds: Array.isArray(job.renderIds) ? job.renderIds.filter((value): value is string => typeof value === 'string') : undefined,
    heroRenderId: job.heroRenderId ?? null,
    localKey: job.localKey ?? null,
    message: typeof job.message === 'string' ? job.message : null,
    etaSeconds: typeof job.etaSeconds === 'number' ? job.etaSeconds : null,
    etaLabel: typeof job.etaLabel === 'string' ? job.etaLabel : null,
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
    batchId: mapped.batchId ?? undefined,
    groupId: mapped.groupId ?? undefined,
    iterationIndex: mapped.iterationIndex ?? undefined,
    iterationCount: mapped.iterationCount ?? undefined,
    renderIds: mapped.renderIds ?? undefined,
    heroRenderId: mapped.heroRenderId ?? undefined,
    localKey: mapped.localKey ?? undefined,
    message: mapped.message ?? undefined,
    etaSeconds: mapped.etaSeconds ?? undefined,
    etaLabel: mapped.etaLabel ?? undefined,
  };
}
