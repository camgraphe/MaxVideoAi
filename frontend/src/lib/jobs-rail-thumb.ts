import type { GroupSummary } from '../../types/groups';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '../../lib/media';

const PLACEHOLDER_THUMBS: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

export function resolveJobsRailPlaceholderThumb(aspectRatio?: string | null): string {
  const key = (aspectRatio ?? '').trim();
  return PLACEHOLDER_THUMBS[key] ?? '/assets/frames/thumb-16x9.svg';
}

function resolveRealThumb(candidate?: string | null): string | null {
  const normalized = normalizeMediaUrl(candidate);
  if (!normalized) return null;
  if (isPlaceholderMediaUrl(normalized)) return null;
  return normalized;
}

function resolveRealVideo(candidate?: string | null): string | null {
  const normalized = normalizeMediaUrl(candidate);
  if (!normalized) return null;
  if (isPlaceholderMediaUrl(normalized)) return null;
  return normalized;
}

export function resolveJobsRailThumb(group: GroupSummary): string {
  const previewThumb = group.previews
    .map((preview) => resolveRealThumb(preview?.thumbUrl))
    .find((thumb): thumb is string => Boolean(thumb));

  const candidates: Array<string | null | undefined> = [
    previewThumb,
    group.hero.thumbUrl,
    group.hero.job?.thumbUrl,
    group.hero.job?.previewFrame,
  ];

  for (const candidate of candidates) {
    const thumb = resolveRealThumb(candidate);
    if (thumb) return thumb;
  }

  return resolveJobsRailPlaceholderThumb(group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null);
}

export function resolveJobsRailVideo(group: GroupSummary): string | null {
  const candidates: Array<string | null | undefined> = [
    group.previews.find((preview) => preview?.videoUrl)?.videoUrl,
    group.hero.videoUrl,
    group.hero.job?.videoUrl,
  ];
  for (const candidate of candidates) {
    const video = resolveRealVideo(candidate);
    if (video) return video;
  }
  return null;
}
