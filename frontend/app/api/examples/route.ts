import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listExamplesPage, type ExampleSort, type GalleryVideo } from '@/server/videos';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { listFalEngines } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { localePathnames, type AppLocale } from '@/i18n/locales';

export const dynamic = 'force-dynamic';

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

const ENGINE_FILTER_GROUPS: Record<string, { id: string; label: string; brandId?: string }> = {
  sora: { id: 'sora', label: 'Sora 2', brandId: 'openai' },
  'sora-2': { id: 'sora', label: 'Sora 2', brandId: 'openai' },
  'sora-2-pro': { id: 'sora', label: 'Sora 2', brandId: 'openai' },
  veo: { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  pika: { id: 'pika', label: 'Pika', brandId: 'pika' },
  kling: { id: 'kling', label: 'Kling', brandId: 'kling' },
  wan: { id: 'wan', label: 'Wan', brandId: 'wan' },
  seedance: { id: 'seedance', label: 'Seedance', brandId: 'bytedance' },
  hailuo: { id: 'hailuo', label: 'MiniMax Hailuo', brandId: 'minimax' },
  'ltx-2': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
};

const ENGINE_MODEL_LINKS: Record<string, string> = {
  sora: 'sora-2-pro',
  veo: 'veo-3-1',
  seedance: 'seedance-1-5-pro',
  kling: 'kling-3-pro',
  wan: 'wan-2-6',
  pika: 'pika-text-to-video',
  hailuo: 'minimax-hailuo-02-text',
  'ltx-2': 'ltx-2',
};

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
  engineMeta: { label?: string; brandId?: string } | null,
  fallbackLabel?: string | null
) {
  const normalized = canonicalEngineId.trim().toLowerCase();
  const directMatch = ENGINE_FILTER_GROUPS[normalized];
  let group = directMatch;

  if (!group) {
    if (normalized.startsWith('veo-3') || normalized.startsWith('veo3')) {
      group = ENGINE_FILTER_GROUPS['veo'];
    } else if (normalized.startsWith('sora-2') || normalized.startsWith('sora')) {
      group = ENGINE_FILTER_GROUPS['sora'];
    } else if (normalized.startsWith('pika')) {
      group = ENGINE_FILTER_GROUPS['pika'];
    } else if (normalized.includes('hailuo')) {
      group = ENGINE_FILTER_GROUPS['hailuo'];
    } else if (normalized.startsWith('kling')) {
      group = ENGINE_FILTER_GROUPS['kling'];
    } else if (normalized.startsWith('wan')) {
      group = ENGINE_FILTER_GROUPS['wan'];
    } else if (normalized.startsWith('seedance')) {
      group = ENGINE_FILTER_GROUPS['seedance'];
    } else if (normalized.startsWith('ltx-2')) {
      group = ENGINE_FILTER_GROUPS['ltx-2'];
    }
  }

  const targetId = group?.id ?? normalized;
  const targetOverride = ENGINE_FILTER_GROUPS[targetId];
  const label = group?.label ?? targetOverride?.label ?? engineMeta?.label ?? fallbackLabel ?? canonicalEngineId;
  const brandId = group?.brandId ?? targetOverride?.brandId ?? engineMeta?.brandId;
  return { id: targetId, label, brandId };
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
  const descriptor = canonicalEngineId ? resolveFilterDescriptor(canonicalEngineId, engineMeta, video.engineLabel) : null;
  const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
  const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const modelSlug = engineMeta?.modelSlug ?? (descriptor ? ENGINE_MODEL_LINKS[descriptor.id.toLowerCase()] : null);
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
    optimizedPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl) : null,
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
    await ensureBillingSchema();
    const url = new URL(req.url);
    const sort = parseSort(url.searchParams.get('sort'));
    const limit = Math.min(120, Math.max(1, Number(url.searchParams.get('limit') ?? '60')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));
    const engineFilterRaw = (url.searchParams.get('engine') ?? '').trim().toLowerCase();
    const engineFilter = engineFilterRaw
      ? resolveExampleCanonicalSlug(engineFilterRaw) ?? engineFilterRaw
      : '';
    const localeParam = (url.searchParams.get('locale') ?? 'en') as AppLocale;
    const locale: AppLocale = localeParam === 'fr' || localeParam === 'es' ? localeParam : 'en';

    const page = await listExamplesPage({ sort, limit, offset, engineGroup: engineFilter || undefined });
    const items = page.items;
    const cards = items.map((video) => toExampleCard(video, locale));
    return NextResponse.json({
      ok: true,
      cards,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
    });
  } catch (error) {
    console.error('[api/examples] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
