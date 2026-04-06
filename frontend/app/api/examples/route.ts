import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { listExampleFamilyPage, listExamplesPage, type ExampleSort, type GalleryVideo } from '@/server/videos';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { listFalEngines } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getExampleFamilyDescriptor, getExampleFamilyPrimaryModelSlug } from '@/lib/model-families';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL_HEADER = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
const HERO_POSTER_OPTIONS = { width: 1080, quality: 60 } as const;
const GALLERY_POSTER_OPTIONS = { width: 640, quality: 56 } as const;

function parseSort(raw: string | null): ExampleSort {
  switch (raw) {
    case 'playlist':
      return 'playlist';
    case 'date-asc':
    case 'duration-asc':
    case 'duration-desc':
    case 'engine-asc':
      return raw;
    case 'date-desc':
    default:
      return 'date-desc';
  }
}

const ENGINE_META = (() => {
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

const POSTER_PLACEHOLDERS: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

const MODEL_SLUG_MAP = buildSlugMap('models');

function resolveEngineLinkId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId) ?? engineId;
  const alias = ENGINE_LINK_ALIASES.get(normalized.trim().toLowerCase());
  if (alias) return alias;
  const fallback = ENGINE_LINK_ALIASES.get(engineId.trim().toLowerCase());
  if (fallback) return fallback;
  const key = normalized.trim().toLowerCase();
  return key || null;
}

function resolveFilterDescriptor(
  canonicalEngineId: string,
  engineMeta: { brandId?: string } | null
) {
  return getExampleFamilyDescriptor(canonicalEngineId, { brandId: engineMeta?.brandId }) ?? null;
}

function formatPrice(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
}

function formatPromptExcerpt(prompt: string, maxWords = 22): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function getPlaceholderPoster(aspect?: string | null): string {
  if (!aspect) return POSTER_PLACEHOLDERS['16:9'];
  const normalized = aspect.trim();
  return POSTER_PLACEHOLDERS[normalized] ?? POSTER_PLACEHOLDERS['16:9'];
}

function buildModelHref(locale: AppLocale, slug: string): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = MODEL_SLUG_MAP[locale] ?? MODEL_SLUG_MAP.en ?? 'models';
  return `${prefix}/${segment}/${slug}`.replace(/\/{2,}/g, '/');
}

function toExampleCard(video: GalleryVideo, locale: AppLocale) {
  const canonicalEngineId = resolveEngineLinkId(video.engineId);
  const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
  const engineMeta = engineKey ? ENGINE_META.get(engineKey) ?? null : null;
  const descriptor = canonicalEngineId ? resolveFilterDescriptor(canonicalEngineId, engineMeta) : null;
  const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
  const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const modelSlug = engineMeta?.modelSlug ?? (descriptor ? getExampleFamilyPrimaryModelSlug(descriptor.id) : null);
  const modelHref = modelSlug ? buildModelHref(locale, modelSlug) : null;
  return {
    id: video.id,
    href: `/video/${encodeURIComponent(video.id)}`,
    engineLabel: engineMeta?.label ?? video.engineLabel ?? 'Engine',
    engineIconId: engineMeta?.id ?? canonicalEngineId ?? video.engineId ?? 'engine',
    engineBrandId: engineMeta?.brandId,
    priceLabel,
    prompt: promptDisplay,
    promptFull: video.prompt ?? null,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    heroPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl, HERO_POSTER_OPTIONS) : null,
    optimizedPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl, GALLERY_POSTER_OPTIONS) : null,
    rawPosterUrl: video.thumbUrl ?? getPlaceholderPoster(video.aspectRatio ?? null),
    videoUrl: video.videoUrl ?? null,
    modelHref,
  };
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const sort = parseSort(url.searchParams.get('sort'));
    const limit = Math.min(120, Math.max(1, Number(url.searchParams.get('limit') ?? '60')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));
    const engineFilterRaw = (url.searchParams.get('engine') ?? '').trim().toLowerCase();
    const canonicalEngineFilter = engineFilterRaw ? resolveExampleCanonicalSlug(engineFilterRaw) : null;
    const engineFilter = canonicalEngineFilter ?? engineFilterRaw;
    const localeParam = (url.searchParams.get('locale') ?? 'en') as AppLocale;
    const locale: AppLocale = localeParam === 'fr' || localeParam === 'es' ? localeParam : 'en';

    const page = canonicalEngineFilter
      ? await listExampleFamilyPage(engineFilter, { sort, limit, offset })
      : await listExamplesPage({ sort, limit, offset, engineGroup: engineFilter || undefined });
    const items = page.items;
    const cards = items.map((video) => toExampleCard(video, locale));
    const response = NextResponse.json({
      ok: true,
      cards,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
    });
    response.headers.set('Cache-Control', CACHE_CONTROL_HEADER);
    return response;
  } catch (error) {
    console.error('[api/examples] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
