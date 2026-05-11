import type { ExampleSort } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { normalizeEngineId } from '@/lib/engine-alias';
import { orderExamplesHubFamilyIds } from '@/lib/examples/familyOrder';
import {
  getExampleFamilyDescriptor,
  getExampleFamilyCurrentModelSlugs,
  getExampleFamilyIds,
  getExampleFamilyModelSlugs,
  getExampleFamilyPrimaryModelSlug,
} from '@/lib/model-families';

const ENGINE_LINK_ALIASES = (() => {
  const map = new Map<string, string>();
  const register = (key: string | null | undefined, alias: string) => {
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    map.set(normalized, alias);
  };

  listFalEngines().forEach((entry) => {
    register(entry.id, entry.id);
    register(entry.modelSlug, entry.id);
    register(entry.defaultFalModelId, entry.id);
    entry.modes.forEach((mode) => register(mode.falModelId, entry.id));
  });

  return map;
})();

export function resolveEngineLinkId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId) ?? engineId;
  const alias = ENGINE_LINK_ALIASES.get(normalized.trim().toLowerCase());
  if (alias) return alias;
  const fallback = ENGINE_LINK_ALIASES.get(engineId.trim().toLowerCase());
  if (fallback) return fallback;
  return normalized;
}

export const ENGINE_META = (() => {
  const map = new Map<
    string,
    {
      id: string;
      label: string;
      brandId?: string;
      modelSlug?: string;
    }
  >();
  listFalEngines().forEach((entry) => {
    const identity = {
      id: entry.id,
      label: entry.engine.label,
      brandId: entry.engine.brandId ?? entry.brandId,
      modelSlug: entry.modelSlug,
    };
    const register = (key: string | null | undefined) => {
      if (!key) return;
      map.set(key.toLowerCase(), identity);
    };
    register(entry.id);
    register(entry.modelSlug);
    register(entry.defaultFalModelId);
    entry.modes.forEach((mode) => register(mode.falModelId));
  });
  return map;
})();

export const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || SITE_BASE_URL;
export const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const MODEL_SLUG_MAP = buildSlugMap('models');
const COMPARE_SLUG_MAP = buildSlugMap('compare');
const PRICING_SLUG_MAP = buildSlugMap('pricing');
export const DEFAULT_SORT: ExampleSort = 'playlist';
export const EXAMPLES_PAGE_SIZE = 60;
export const HUB_INITIAL_DESKTOP_GALLERY_BATCH = 8;
export const FAMILY_INITIAL_DESKTOP_GALLERY_BATCH = 12;
export const INITIAL_MOBILE_GALLERY_BATCH = 4;
export const HERO_POSTER_OPTIONS = { width: 1080, quality: 60 } as const;
export const GALLERY_POSTER_OPTIONS = { width: 640, quality: 56 } as const;
export const ALLOWED_QUERY_KEYS = new Set(['sort', 'engine', 'page', '__engineFromPath']);
const POSTER_PLACEHOLDERS: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};
export const PREFERRED_ENGINE_ORDER = orderExamplesHubFamilyIds(getExampleFamilyIds());
export const normalizeFilterId = (value: string) => value.trim().toLowerCase();

export function getEngineAccentOutlineStyle(brandId?: string) {
  if (!brandId) return undefined;
  return {
    borderColor: `var(--engine-${brandId}-bg)`,
    boxShadow: `inset 0 0 0 1px var(--engine-${brandId}-bg)`,
  };
}

export const ENGINE_MODEL_LINKS_BY_GROUP: Record<string, string[]> = Object.fromEntries(
  PREFERRED_ENGINE_ORDER.map((familyId) => [familyId, getExampleFamilyModelSlugs(familyId)])
);
export const CURRENT_ENGINE_MODEL_LINKS_BY_GROUP: Record<string, string[]> = Object.fromEntries(
  PREFERRED_ENGINE_ORDER.map((familyId) => [familyId, getExampleFamilyCurrentModelSlugs(familyId)])
);
export const ENGINE_MODEL_LINKS: Record<string, string> = Object.fromEntries(
  PREFERRED_ENGINE_ORDER.flatMap((familyId) => {
    const primarySlug = getExampleFamilyPrimaryModelSlug(familyId);
    return primarySlug ? [[familyId, primarySlug]] : [];
  })
) as Record<string, string>;

export function getPlaceholderPoster(aspect?: string | null): string {
  if (!aspect) return POSTER_PLACEHOLDERS['16:9'];
  const normalized = aspect.trim();
  return POSTER_PLACEHOLDERS[normalized] ?? POSTER_PLACEHOLDERS['16:9'];
}

export function buildModelHref(locale: AppLocale, slug: string): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = MODEL_SLUG_MAP[locale] ?? MODEL_SLUG_MAP.en ?? 'models';
  return `${prefix}/${segment}/${slug}`.replace(/\/{2,}/g, '/');
}

export function buildCompareHref(locale: AppLocale, slug: string): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = COMPARE_SLUG_MAP[locale] ?? COMPARE_SLUG_MAP.en ?? 'ai-video-engines';
  return `${prefix}/${segment}/${slug}`.replace(/\/{2,}/g, '/');
}

export function buildPricingHref(locale: AppLocale): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en ?? 'pricing';
  return `${prefix}/${segment}`.replace(/\/{2,}/g, '/');
}

export function formatModelSlugLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => (/\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function isTrackingParam(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith('utm_') || normalized === 'gclid' || normalized === 'fbclid';
}

export function appendTrackingParams(
  target: URLSearchParams,
  source: Record<string, string | string[] | undefined>
): void {
  Object.entries(source).forEach(([key, value]) => {
    if (!isTrackingParam(key)) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && entry.length) target.append(key, entry);
      });
      return;
    }
    if (typeof value === 'string' && value.length) {
      target.set(key, value);
    }
  });
}

export function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function resolveCanonicalEngineParam(raw: string | string[] | undefined): string {
  const engineParam = Array.isArray(raw) ? raw[0] : raw;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  if (!engineParamValue) return '';
  const canonicalEngineParam = normalizeEngineId(engineParamValue) ?? engineParamValue;
  const engineMeta = ENGINE_META.get(canonicalEngineParam.toLowerCase()) ?? null;
  const descriptor = resolveFilterDescriptor(canonicalEngineParam, engineMeta);
  return descriptor?.id.toLowerCase() ?? canonicalEngineParam.toLowerCase();
}

export function resolveEngineLabel(raw: string | string[] | undefined): string | null {
  const engineParam = Array.isArray(raw) ? raw[0] : raw;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  if (!engineParamValue) return null;
  const canonicalEngineParam = normalizeEngineId(engineParamValue) ?? engineParamValue;
  const engineMeta = ENGINE_META.get(canonicalEngineParam.toLowerCase()) ?? null;
  const descriptor = resolveFilterDescriptor(canonicalEngineParam, engineMeta);
  return descriptor?.label ?? engineMeta?.label ?? canonicalEngineParam;
}

export function getSort(value: string | undefined): ExampleSort {
  if (
    value === 'playlist' ||
    value === 'date-asc' ||
    value === 'date-desc' ||
    value === 'duration-asc' ||
    value === 'duration-desc' ||
    value === 'engine-asc'
  ) {
    return value;
  }
  return DEFAULT_SORT;
}

export function formatPromptExcerpt(prompt: string, maxWords = 18): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

export function compactLeadCopy(value: string, maxChars = 130): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  const sentenceBreak = normalized.slice(0, maxChars).lastIndexOf('.');
  if (sentenceBreak > Math.floor(maxChars * 0.45)) {
    return normalized.slice(0, sentenceBreak + 1);
  }
  const wordBreak = normalized.slice(0, maxChars).lastIndexOf(' ');
  const end = wordBreak > 0 ? wordBreak : maxChars;
  return `${normalized.slice(0, end).trim()}...`;
}

export function buildMainVideoHeroLine(locale: AppLocale, modelLabel: string, specificLine?: string | null): string {
  const normalizedSpecificLine = specificLine?.replace(/\s+/g, ' ').trim();
  if (normalizedSpecificLine) {
    return compactLeadCopy(normalizedSpecificLine, 110);
  }
  if (locale === 'fr') {
    return `Exemple de video IA ${modelLabel} avec prompt, reglages, duree, format et prix.`;
  }
  if (locale === 'es') {
    return `Ejemplo de video con IA de ${modelLabel} con prompt, ajustes, duracion, formato y precio.`;
  }
  return `${modelLabel} AI video example with prompt, settings, duration, aspect ratio, and pricing.`;
}

export function buildLocalizedExampleLabel(
  locale: AppLocale,
  modelLabel: string,
  aspectRatio?: string | null,
  durationSec?: number | null
): string {
  const ratio = aspectRatio ?? 'Auto';
  const duration = typeof durationSec === 'number' ? (locale === 'es' ? `${durationSec} s` : `${durationSec}s`) : null;
  if (locale === 'fr') {
    return duration ? `Exemple ${modelLabel} · ${ratio} · ${duration}` : `Exemple ${modelLabel} · ${ratio}`;
  }
  if (locale === 'es') {
    return duration ? `Ejemplo de ${modelLabel} · ${ratio} · ${duration}` : `Ejemplo de ${modelLabel} · ${ratio}`;
  }
  return duration ? `${modelLabel} video example · ${ratio} · ${duration}` : `${modelLabel} video example · ${ratio}`;
}

export function getAspectRatioStyle(aspectRatio?: string | null): string {
  if (!aspectRatio) return '16 / 9';
  const [width, height] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return '16 / 9';
  }
  return `${width} / ${height}`;
}

export function isPortraitAspectRatio(aspectRatio?: string | null): boolean {
  if (!aspectRatio) return false;
  const [width, height] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return false;
  }
  return width / height < 1;
}

export function getVideoMimeType(videoUrl?: string | null): string {
  const normalized = (videoUrl ?? '').toLowerCase();
  return normalized.includes('.webm') ? 'video/webm' : 'video/mp4';
}

export type EngineFilterOption = {
  id: string;
  key: string;
  label: string;
  brandId?: string;
  count: number;
};

export function resolveFilterDescriptor(
  canonicalEngineId: string | null | undefined,
  engineMeta: { brandId?: string | undefined } | null
): { id: string; label: string; brandId?: string } | null {
  return getExampleFamilyDescriptor(canonicalEngineId, { brandId: engineMeta?.brandId }) ?? null;
}
