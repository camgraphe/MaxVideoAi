import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';
import { normalizeEngineId } from '@/lib/engine-alias';

const EXAMPLE_SLUG_SET = new Set(MARKETING_EXAMPLE_SLUGS.map((slug) => slug.toLowerCase()));
const EXAMPLE_SLUG_ALIASES: Record<string, string> = {
  'pika-2-2': 'pika-text-to-video',
  'pika-22': 'pika-text-to-video',
  pika22: 'pika-text-to-video',
  pika: 'pika-text-to-video',
  'minimax-hailuo-02': 'minimax-hailuo-02-text',
  hailuo: 'minimax-hailuo-02-text',
  veo: 'veo-3-1',
  'veo-3-1-fast': 'veo-3-1',
  'sora-2-pro': 'sora-2',
  'ltx-2-fast': 'ltx-2',
  kling: 'kling-2-6-pro',
  'kling-2-5-turbo': 'kling-2-6-pro',
  wan: 'wan-2-6',
  'wan-2-5': 'wan-2-6',
};

export function resolveExampleCanonicalSlug(engineSlug?: string | null): string | null {
  if (!engineSlug) return null;
  const normalizedRaw = normalizeEngineId(engineSlug) ?? engineSlug;
  const normalized = normalizedRaw.trim().toLowerCase();
  if (!normalized) return null;
  const candidate = EXAMPLE_SLUG_ALIASES[normalized] ?? normalized;
  return EXAMPLE_SLUG_SET.has(candidate) ? candidate : null;
}

export function getExamplesHref(engineSlug?: string | null): string | null {
  if (!engineSlug) return null;
  const canonicalSlug = resolveExampleCanonicalSlug(engineSlug);
  if (canonicalSlug) {
    return `/examples/${canonicalSlug}`;
  }
  return `/examples?engine=${encodeURIComponent(engineSlug)}`;
}
