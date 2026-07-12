import { revalidatePath } from 'next/cache';

import { listFalEngines } from '@/config/falEngines';
import type { PricingChangePreview } from './policy-service';

const PRICING_PATHS = ['/pricing', '/fr/tarifs', '/es/precios'] as const;
const MODEL_SURFACES = new Set(['model-page', 'json-ld', 'estimator', 'price-chip']);

function resolveModelSlug(engineId: string): string | null {
  const entry = listFalEngines().find(
    (candidate) => candidate.id === engineId || candidate.engine.id === engineId
  );
  return entry?.modelSlug ?? null;
}

export function revalidatePricingChangeSurfaces(
  preview: PricingChangePreview,
  invalidatePath: (path: string) => void = revalidatePath
): void {
  const paths = new Set<string>();
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
}
