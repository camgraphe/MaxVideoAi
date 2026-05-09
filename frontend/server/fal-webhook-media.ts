import { normalizeMediaUrl } from '@/lib/media';

export function fallbackThumbnail(aspectRatio?: string | null): string {
  const normalized = aspectRatio?.trim().toLowerCase();
  if (normalized === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (normalized === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

const COMMON_ASPECT_RATIOS: Array<{ label: string; value: number }> = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '5:3', value: 5 / 3 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
];

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function formatAspectRatioLabel(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const ratio = width / height;
  let closest: { label: string; diff: number } | null = null;
  for (const entry of COMMON_ASPECT_RATIOS) {
    const diff = Math.abs(ratio - entry.value);
    if (!closest || diff < closest.diff) {
      closest = { label: entry.label, diff };
    }
  }
  if (closest && closest.diff <= 0.03) {
    return closest.label;
  }
  const divisor = gcd(width, height);
  const simplifiedWidth = Math.max(1, Math.round(width / divisor));
  const simplifiedHeight = Math.max(1, Math.round(height / divisor));
  return `${simplifiedWidth}:${simplifiedHeight}`;
}

export function extractMediaUrls(payload: unknown): { videoUrl?: string | null; thumbUrl?: string | null } {
  if (!payload || typeof payload !== 'object') return {};

  const candidates: unknown[] = [];

  const pushCandidate = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushCandidate(entry));
    } else {
      candidates.push(value);
    }
  };

  const container = payload as Record<string, unknown>;
  pushCandidate(container.video);
  pushCandidate(container.videos);
  pushCandidate(container.assets);
  pushCandidate(container.response);
  pushCandidate(container.output);
  pushCandidate(container.result);

  const flatten = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return candidate;
    const record = candidate as Record<string, unknown>;
    const nested: unknown[] = [];
    if (record.video) nested.push(record.video);
    if (record.videos) nested.push(record.videos);
    if (record.assets) nested.push(record.assets);
    if (record.response) nested.push(record.response);
    if (record.output) nested.push(record.output);
    return [candidate, ...nested];
  });

  let videoUrl: string | null | undefined;
  let thumbUrl: string | null | undefined;

  for (const candidate of flatten) {
    if (typeof candidate === 'string' && !videoUrl) {
      videoUrl = candidate;
      continue;
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      if (!videoUrl) {
        videoUrl =
          (typeof record.url === 'string' && record.url) ||
          (typeof record.video_url === 'string' && record.video_url) ||
          (typeof record.path === 'string' && record.path) ||
          null;
      }
      if (!thumbUrl) {
        thumbUrl =
          (typeof record.thumbnail === 'string' && record.thumbnail) ||
          (typeof record.thumb_url === 'string' && record.thumb_url) ||
          (typeof record.poster === 'string' && record.poster) ||
          (typeof record.preview === 'string' && record.preview) ||
          null;
      }
    }
    if (videoUrl && thumbUrl) break;
  }

  return { videoUrl, thumbUrl };
}

export function normalizeRenderIdList(value: unknown): string[] {
  const collect = (entries: unknown[]): string[] =>
    entries
      .map((entry) => {
        if (typeof entry === 'string' && entry.trim().length) {
          return normalizeMediaUrl(entry) ?? entry;
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.url === 'string' && record.url.trim().length) {
            return normalizeMediaUrl(record.url) ?? record.url;
          }
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));

  if (Array.isArray(value)) {
    return collect(value);
  }
  if (typeof value === 'string' && value.trim().length) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return collect(parsed);
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function extractImageUrlsFromPayload(payload: unknown): string[] {
  if (!payload) return [];
  const urls = new Set<string>();
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === 'string') {
      if (/^https?:\/\//i.test(current)) {
        urls.add(normalizeMediaUrl(current) ?? current);
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (Array.isArray(record.images)) {
        record.images.forEach((entry) => stack.push(entry));
      }
      const directUrl =
        (typeof record.url === 'string' && record.url.trim().length ? record.url : null) ||
        (typeof record.image_url === 'string' && record.image_url.trim().length ? record.image_url : null) ||
        (typeof record.thumbnail === 'string' && record.thumbnail.trim().length ? record.thumbnail : null);
      if (directUrl) {
        urls.add(normalizeMediaUrl(directUrl) ?? directUrl);
      }
      for (const value of Object.values(record)) {
        if (value && (typeof value === 'object' || typeof value === 'string')) {
          stack.push(value);
        }
      }
    }
  }

  return Array.from(urls);
}
