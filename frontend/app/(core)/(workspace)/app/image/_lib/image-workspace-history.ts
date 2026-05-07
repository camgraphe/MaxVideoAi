import type { GeneratedImage } from '@/types/image-generation';
import type { GroupMemberSummary, GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { isPlaceholderMediaUrl, resolvePreferredMediaUrl } from '@/lib/media';
import type { HistoryEntry } from './image-workspace-types';

export function mapJobToHistoryEntry(job: Job): HistoryEntry | null {
  const renderUrls = Array.isArray(job.renderIds)
    ? job.renderIds.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const renderThumbUrls = Array.isArray(job.renderThumbUrls)
    ? job.renderThumbUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const heroOriginal = typeof job.heroRenderId === 'string' && job.heroRenderId.length ? job.heroRenderId : null;
  const images: GeneratedImage[] =
    renderUrls.length > 0
      ? renderUrls.map((url, index) => ({
          url,
          thumbUrl: resolvePreferredMediaUrl(renderThumbUrls[index], index === 0 ? job.thumbUrl ?? null : null, url),
        }))
      : (() => {
          const thumbUrl = resolvePreferredMediaUrl(job.thumbUrl, heroOriginal);
          if (!thumbUrl || isPlaceholderMediaUrl(thumbUrl)) {
            return [];
          }
          return [{ url: heroOriginal ?? thumbUrl, thumbUrl }];
        })();
  if (!images.length) return null;
  const timestamp = Date.parse(job.createdAt ?? '');
  return {
    id: job.jobId,
    jobId: job.jobId,
    engineId: job.engineId ?? '',
    engineLabel: job.engineLabel ?? job.engineId ?? 'Image generation',
    mode: 't2i',
    prompt: job.prompt ?? '',
    createdAt: Number.isNaN(timestamp) ? Date.now() : timestamp,
    description: job.message ?? null,
    images,
    aspectRatio: job.aspectRatio ?? null,
  };
}

export function buildPendingGroup({
  id,
  engineId,
  engineLabel,
  prompt,
  count,
  createdAt,
}: {
  id: string;
  engineId: string;
  engineLabel: string;
  prompt: string;
  count: number;
  createdAt: number;
}): GroupSummary {
  const normalizedCount = Math.max(1, Math.round(count));
  const previewCount = Math.min(4, normalizedCount);
  const createdAtIso = new Date(createdAt).toISOString();
  const members: GroupMemberSummary[] = Array.from({ length: previewCount }, (_, index) => ({
    id: `${id}-pending-${index + 1}`,
    engineId,
    engineLabel,
    durationSec: 0,
    prompt,
    createdAt: createdAtIso,
    source: 'render',
    status: 'pending',
    iterationIndex: index,
    iterationCount: normalizedCount,
  }));

  return {
    id,
    source: 'active',
    splitMode: normalizedCount > 1 ? 'quad' : 'single',
    count: normalizedCount,
    totalPriceCents: null,
    createdAt: createdAtIso,
    hero: members[0],
    previews: members.map((member) => ({
      id: member.id,
      thumbUrl: null,
      videoUrl: null,
      aspectRatio: null,
    })),
    members,
  };
}

export function buildCompletedGroup({
  id,
  engineId,
  engineLabel,
  prompt,
  aspectRatio,
  images,
  createdAt,
  totalPriceCents,
  currency,
}: {
  id: string;
  engineId: string;
  engineLabel: string;
  prompt: string;
  aspectRatio: string | null;
  images: GeneratedImage[];
  createdAt: number;
  totalPriceCents?: number | null;
  currency?: string | null;
}): GroupSummary {
  const createdAtIso = new Date(createdAt).toISOString();
  const members: GroupMemberSummary[] = images.map((image, index) => ({
    id: `${id}-image-${index + 1}`,
    jobId: id,
    engineId,
    engineLabel,
    durationSec: 0,
    priceCents: totalPriceCents ?? null,
    currency: currency ?? null,
    thumbUrl: image.url,
    aspectRatio,
    prompt,
    status: 'completed',
    progress: 100,
    createdAt: createdAtIso,
    source: 'render',
  }));

  return {
    id,
    source: 'active',
    splitMode: members.length > 1 ? 'quad' : 'single',
    count: members.length,
    totalPriceCents: totalPriceCents ?? null,
    currency: currency ?? null,
    createdAt: createdAtIso,
    hero: members[0],
    previews: images.map((image, index) => ({
      id: `${id}-preview-${index + 1}`,
      thumbUrl: image.url,
      videoUrl: null,
      aspectRatio,
      source: 'render',
    })),
    members,
  };
}
