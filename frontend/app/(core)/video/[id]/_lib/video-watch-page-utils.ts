import { SITE_ORIGIN } from '@/lib/siteOrigin';
import type { getVideoWatchPageDataById } from '@/server/video-seo';

export type WatchPageData = NonNullable<Awaited<ReturnType<typeof getVideoWatchPageDataById>>>;
export type AspectRatio = { width: number; height: number } | null;
export type DetailRow = { key: string; label: string; value: string };

export const SITE = SITE_ORIGIN.replace(/\/$/, '');
export const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
export const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
export const TITLE_SUFFIX = ' — MaxVideoAI';

const TRAILING_BRAND_SUFFIX = /\s+[—-]\s*MaxVideo\s*AI\s*$/i;

export function normalizeTitlePrimary(primary: string) {
  let normalized = primary.trim();
  while (TRAILING_BRAND_SUFFIX.test(normalized)) {
    normalized = normalized.replace(TRAILING_BRAND_SUFFIX, '').trim();
  }
  return normalized;
}

export function buildMetaTitle(primary: string) {
  const normalizedPrimary = primary ? normalizeTitlePrimary(primary) : '';
  const safePrimary = normalizedPrimary.length ? normalizedPrimary : 'Video example';
  return `${safePrimary}${TITLE_SUFFIX}`;
}

export function toDurationIso(seconds?: number | null): string {
  const safe = Math.max(1, Math.round(Number(seconds ?? 0) || 1));
  return `PT${safe}S`;
}

export function toAbsoluteUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${SITE}${value}`;
  return `${SITE}/${value.replace(/^\/+/, '')}`;
}

export function parseAspectRatio(value?: string | null): AspectRatio {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [w, h] = trimmed.split(':');
    const width = Number.parseFloat(w);
    const height = Number.parseFloat(h);
    if (Number.isFinite(width) && Number.isFinite(height) && height > 0) return { width, height };
    return null;
  }
  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return { width: numeric, height: 1 };
  }
  return null;
}

export function getDetailValue(rows: DetailRow[], key: string): string | null {
  return rows.find((row) => row.key === key)?.value ?? null;
}

export function formatWatchDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function humanizeTag(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isRenderable(page: Awaited<ReturnType<typeof getVideoWatchPageDataById>>): page is WatchPageData {
  if (!page?.video) return false;
  if (page.video.visibility !== 'public') return false;
  if (!page.video.indexable) return false;
  if (!page.video.videoUrl) return false;
  return true;
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
