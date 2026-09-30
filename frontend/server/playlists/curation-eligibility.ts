import { listRuntimeModels } from '@/config/model-runtime';
import { PUBLIC_VIDEO_SOURCE_ELIGIBILITY } from '../videos-query';

export const CURATION_ELIGIBILITY = `visibility='public' AND indexable IS TRUE AND ${PUBLIC_VIDEO_SOURCE_ELIGIBILITY}`;

/** Keep preview evidence aligned with the public catalog’s historical input aliases. */
export function expandCatalogAliases(values: string[]) {
  const expanded = new Set(values.map(alias => alias.toLowerCase()));
  for (const model of listRuntimeModels()) {
    if (expanded.has(model.id) || expanded.has(model.slug)) {
      model.aliases.internal.forEach(alias => expanded.add(alias.toLowerCase()));
    }
  }
  return [...expanded];
}
