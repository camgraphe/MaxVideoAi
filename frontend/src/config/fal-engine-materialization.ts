import { getPartnerByBrandId } from '../lib/brand-partners';
import {
  getRuntimeModelById,
  toLegacyModelSurfaces,
} from '../../config/model-runtime';
import type { FalEngineEntry, RawFalEngineEntry } from './fal-engines/types';

export function materializeFalEngineEntry(entry: RawFalEngineEntry): FalEngineEntry {
  const partnerBrand = getPartnerByBrandId(entry.brandId);
  const model = getRuntimeModelById(entry.id);
  if (!model) throw new Error(`Missing model registry entry for engine "${entry.id}"`);
  return {
    ...entry,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    category: model.category,
    lifecycle: model.lifecycle,
    successorId: model.successorId,
    successorSlug: model.successorSlug,
    isLegacy: model.lifecycle !== 'current',
    logoPolicy: partnerBrand?.policy.logoAllowed ? 'logoAllowed' : entry.logoPolicy,
    surfaces: toLegacyModelSurfaces(model),
  };
}
