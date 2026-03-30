import type { LocalizedLinkHref } from '@/i18n/navigation';
import { resolveExampleFamilyId } from '@/lib/model-families';

export function resolveExampleCanonicalSlug(engineSlug?: string | null): string | null {
  return resolveExampleFamilyId(engineSlug ?? null);
}

export function getExamplesHref(engineSlug?: string | null): LocalizedLinkHref | null {
  if (!engineSlug) return null;
  const canonicalSlug = resolveExampleCanonicalSlug(engineSlug);
  if (canonicalSlug) {
    return { pathname: '/examples/[model]', params: { model: canonicalSlug } };
  }
  return { pathname: '/examples', query: { engine: engineSlug } };
}
