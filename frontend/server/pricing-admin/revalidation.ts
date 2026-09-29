import { revalidatePath } from 'next/cache';

import { listFalEngines } from '@/config/falEngines';
import type { PricingChangePreview } from '@/lib/admin/pricing-change-contract';

const PRICING_PATHS = ['/pricing', '/fr/tarifs', '/es/precios'] as const;
const CURRENT_EXAMPLE_PATHS = [
  '/', '/fr', '/es',
  '/examples', '/fr/galerie', '/es/galeria',
  '/pay-as-you-go-ai-video-generator', '/fr/pay-as-you-go-ai-video-generator', '/es/pay-as-you-go-ai-video-generator',
] as const;
const CURRENT_EXAMPLE_DYNAMIC_PATHS = ['/examples/[model]', '/fr/galerie/[model]', '/es/galeria/[model]', '/video/[id]'] as const;
const MODEL_SURFACES = new Set(['model-page', 'json-ld', 'estimator', 'price-chip']);

function resolveModelSlug(engineId: string): string | null {
  const entry = listFalEngines().find(
    (candidate) => candidate.id === engineId || candidate.engine.id === engineId
  );
  return entry?.modelSlug ?? null;
}

export function revalidatePricingChangeSurfaces(
  preview: PricingChangePreview,
  invalidatePath: (path: string, type?: 'page' | 'layout') => void = revalidatePath
): void {
  const paths = new Set<string>();
  CURRENT_EXAMPLE_PATHS.forEach((path) => paths.add(path));
  if (preview.affectedSurfaces.includes('pricing-hub')) {
    PRICING_PATHS.forEach((path) => paths.add(path));
  }

  for (const row of preview.rows) {
    if (!MODEL_SURFACES.has(row.surface)) continue;
    const slug = resolveModelSlug(row.engineId);
    if (!slug) continue;
    paths.add(`/models/${slug}`);
    paths.add(`/fr/modeles/${slug}`);
    paths.add(`/es/modelos/${slug}`);
  }

  paths.forEach((path) => invalidatePath(path));
  CURRENT_EXAMPLE_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
}
