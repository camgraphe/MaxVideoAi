import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';
import { normalizeEngineId } from '@/lib/engine-alias';
import type { LocalizedLinkHref } from '@/i18n/navigation';

const EXAMPLE_SLUG_SET = new Set(MARKETING_EXAMPLE_SLUGS.map((slug) => slug.toLowerCase()));
const EXAMPLE_SLUG_ALIASES: Record<string, string> = {
  sora: 'sora',
  'sora-2': 'sora',
  'sora-2-pro': 'sora',
  veo: 'veo',
  'veo-3-1': 'veo',
  'veo-3-1-fast': 'veo',
  'veo-3-1-first-last': 'veo',
  'veo-3-1-first-last-fast': 'veo',
  'veo-3': 'veo',
  'veo-3-fast': 'veo',
  kling: 'kling',
  'kling-2-5-turbo': 'kling',
  'kling-2-6-pro': 'kling',
  'kling-3-standard': 'kling',
  'kling-3-pro': 'kling',
  wan: 'wan',
  'wan-2-5': 'wan',
  'wan-2-6': 'wan',
  seedance: 'seedance',
  'seedance-1-5-pro': 'seedance',
  'ltx-2-fast': 'ltx-2',
  'ltx-2': 'ltx-2',
  pika: 'pika',
  'pika-text-to-video': 'pika',
  'pika-image-to-video': 'pika',
  'pika-2-2': 'pika',
  'pika-22': 'pika',
  pika22: 'pika',
  hailuo: 'hailuo',
  'minimax-hailuo-02': 'hailuo',
  'minimax-hailuo-02-text': 'hailuo',
  'minimax-hailuo-02-image': 'hailuo',
};

export function resolveExampleCanonicalSlug(engineSlug?: string | null): string | null {
  if (!engineSlug) return null;
  const normalizedRaw = normalizeEngineId(engineSlug) ?? engineSlug;
  const normalized = normalizedRaw.trim().toLowerCase();
  if (!normalized) return null;
  const candidate = EXAMPLE_SLUG_ALIASES[normalized] ?? normalized;
  return EXAMPLE_SLUG_SET.has(candidate) ? candidate : null;
}

export function getExamplesHref(engineSlug?: string | null): LocalizedLinkHref | null {
  if (!engineSlug) return null;
  const canonicalSlug = resolveExampleCanonicalSlug(engineSlug);
  if (canonicalSlug) {
    return { pathname: '/examples/[model]', params: { model: canonicalSlug } };
  }
  return { pathname: '/examples', query: { engine: engineSlug } };
}
