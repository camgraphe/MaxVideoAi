import { revalidatePath } from 'next/cache';

import { listFalEngines } from '@/config/falEngines';
import type { PricingChangePreview } from '@/lib/admin/pricing-change-contract';

const PRICING_PATHS = ['/pricing', '/fr/tarifs', '/es/precios'] as const;
const MODEL_INDEX_PATHS = ['/models', '/models/video', '/models/image', '/fr/modeles', '/es/modelos'] as const;
const CURRENT_EXAMPLE_PATHS = [
  '/', '/fr', '/es',
  '/examples', '/fr/galerie', '/es/galeria',
  '/pay-as-you-go-ai-video-generator', '/fr/pay-as-you-go-ai-video-generator', '/es/pay-as-you-go-ai-video-generator',
] as const;
const CURRENT_EXAMPLE_DYNAMIC_PATHS = ['/examples/[model]', '/fr/galerie/[model]', '/es/galeria/[model]', '/video/[id]'] as const;
// Use actual route patterns, including the localized route behind translated URLs.
const COMPARISON_DYNAMIC_PATHS = ['/ai-video-engines/[slug]', '/[locale]/ai-video-engines/[slug]'] as const;
const MODEL_DYNAMIC_PATHS = ['/models/[slug]', '/[locale]/models/[slug]'] as const;
const LOCALIZED_PRICE_DYNAMIC_PATHS = [
  '/[locale]/pricing', '/[locale]/models', '/[locale]/models/video', '/[locale]/models/image',
  '/[locale]', '/[locale]/examples', '/[locale]/examples/[model]', '/[locale]/video/[videoId]',
  '/[locale]/pay-as-you-go-ai-video-generator',
] as const;
const MODEL_SURFACES = new Set(['model-page', 'json-ld', 'estimator', 'price-chip']);

function resolveModelSlug(engineId: string): string | null {
  const entry = listFalEngines().find(
    (candidate) => candidate.id === engineId || candidate.engine.id === engineId
  );
  return entry?.modelSlug ?? null;
}

export function revalidateCustomerTariffChangeSurfaces(
  modelId: string,
  invalidatePath: (path: string, type?: 'page' | 'layout') => void = revalidatePath,
): void {
  const paths = new Set<string>([...PRICING_PATHS, ...MODEL_INDEX_PATHS, ...CURRENT_EXAMPLE_PATHS]);
  const slug = resolveModelSlug(modelId);
  if (slug) for (const prefix of ['/models', '/fr/modeles', '/es/modelos']) paths.add(`${prefix}/${slug}`);
  paths.forEach((path) => invalidatePath(path));
  CURRENT_EXAMPLE_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  COMPARISON_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  MODEL_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  LOCALIZED_PRICE_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
}

export function revalidatePricingChangeSurfaces(
  preview: PricingChangePreview,
  invalidatePath: (path: string, type?: 'page' | 'layout') => void = revalidatePath
): void {
  const paths = new Set<string>(PRICING_PATHS);
  CURRENT_EXAMPLE_PATHS.forEach((path) => paths.add(path));
  MODEL_INDEX_PATHS.forEach((path) => paths.add(path));

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
  COMPARISON_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  // A global or scoped policy can affect a model absent from sampled preview rows.
  MODEL_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  LOCALIZED_PRICE_DYNAMIC_PATHS.forEach((path) => invalidatePath(path, 'page'));
  if (preview.affectedSurfaces.includes('tool')) {
    invalidatePath('/tools/[slug]', 'page');
    invalidatePath('/[locale]/tools/[slug]', 'page');
  }
}
