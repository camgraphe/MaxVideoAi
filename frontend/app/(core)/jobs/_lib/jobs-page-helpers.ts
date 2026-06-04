import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { deriveJobSurface } from '@/lib/job-surface';
import type { JobSurface } from '@/types/billing';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';

export type LibrarySaveKind = 'image' | 'video' | 'audio';

export type LibrarySavePayload = {
  url: string;
  kind: LibrarySaveKind;
  jobId?: string | null;
  label?: string | null;
  thumbUrl?: string | null;
  previewUrl?: string | null;
};

export function resolveClientJobSurface(job: Job): JobSurface {
  return deriveJobSurface({
    surface: job.surface,
    settingsSnapshot: job.settingsSnapshot,
    jobId: job.jobId,
    engineId: job.engineId ?? null,
    videoUrl: job.videoUrl ?? null,
    renderIds: job.renderIds,
  });
}

export function resolveWorkspaceJobHref(jobId: string, surface: JobSurface, forceImageGroup = false): string {
  if (surface === 'audio') {
    return `/app/audio?job=${encodeURIComponent(jobId)}`;
  }
  if (surface === 'storyboard') {
    return `/app/tools/storyboard?job=${encodeURIComponent(jobId)}`;
  }
  if (forceImageGroup || surface === 'image') {
    return `/app/image?job=${encodeURIComponent(jobId)}`;
  }
  if (surface === 'upscale') {
    return `/app/tools/upscale?job=${encodeURIComponent(jobId)}`;
  }
  return `/app?job=${encodeURIComponent(jobId)}`;
}

function firstHttpUrl(values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)) ?? null;
}

export function resolveGroupLibrarySavePayload(group: GroupSummary): LibrarySavePayload | null {
  const job = group.hero.job;
  const members = group.members;
  const firstPreview = group.previews[0];
  const jobRenderUrl = firstHttpUrl(job?.renderIds ?? []);
  const videoUrl = firstHttpUrl([group.hero.videoUrl, firstPreview?.videoUrl, ...members.map((member) => member.videoUrl)]);
  const audioUrl = firstHttpUrl([group.hero.audioUrl, ...members.map((member) => member.audioUrl)]);
  const thumbUrl = firstHttpUrl([group.hero.thumbUrl, firstPreview?.thumbUrl, job?.thumbUrl]);
  const previewUrl = firstHttpUrl([group.hero.previewVideoUrl, firstPreview?.previewVideoUrl, job?.previewVideoUrl]);
  const imageUrl = firstHttpUrl([jobRenderUrl, ...members.map((member) => member.thumbUrl), thumbUrl]);
  const jobId = job?.jobId ?? group.hero.jobId ?? group.id;
  const label = job?.prompt ?? group.hero.prompt ?? undefined;

  if (videoUrl) {
    return { url: videoUrl, kind: 'video', jobId, label, thumbUrl, previewUrl };
  }
  if (audioUrl) {
    return { url: audioUrl, kind: 'audio', jobId, label, thumbUrl, previewUrl: null };
  }
  if (imageUrl) {
    return { url: imageUrl, kind: 'image', jobId, label, thumbUrl, previewUrl: null };
  }
  return null;
}

export function resolveEntryLibrarySavePayload(entry: MediaLightboxEntry): LibrarySavePayload | null {
  const videoUrl = firstHttpUrl([entry.videoUrl]);
  const audioUrl = firstHttpUrl([entry.audioUrl]);
  const imageUrl = firstHttpUrl([entry.imageUrl, entry.thumbUrl]);
  const label = entry.prompt ?? entry.label ?? undefined;

  if (videoUrl) {
    return {
      url: videoUrl,
      kind: 'video',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? null,
      previewUrl: entry.previewUrl ?? null,
    };
  }
  if (audioUrl) {
    return {
      url: audioUrl,
      kind: 'audio',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? null,
      previewUrl: null,
    };
  }
  if (imageUrl) {
    return {
      url: imageUrl,
      kind: 'image',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? imageUrl,
      previewUrl: null,
    };
  }
  return null;
}
