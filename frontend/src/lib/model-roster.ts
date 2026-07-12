import modelRoster from '@/config/model-roster.json';
import type { EngineLogoPolicy } from '@/config/falEngines';
import { getRuntimeModelById, toLegacyModelSurfaces } from '@/config/model-runtime';

export type LogoPolicy = EngineLogoPolicy;
export type ModelAvailability = 'available' | 'limited' | 'waitlist' | 'paused';

export interface ModelRosterEntry {
  engineId: string;
  marketingName: string;
  brandId: string;
  modelSlug: string;
  family?: string;
  versionLabel: string;
  availability: ModelAvailability;
  logoPolicy: LogoPolicy;
  billingNote?: string;
  surfaces?: {
    modelPage?: {
      indexable?: boolean;
      includeInSitemap?: boolean;
    };
  };
}

const rosterEntries = (modelRoster as ModelRosterEntry[]).map((entry) => {
  const model = getRuntimeModelById(entry.engineId);
  if (!model) {
    throw new Error(`Model roster references missing registry id "${entry.engineId}"`);
  }
  return {
    ...entry,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    surfaces: { modelPage: toLegacyModelSurfaces(model).modelPage },
  };
});

const rosterBySlug = new Map<string, ModelRosterEntry>();
const rosterByEngine = new Map<string, ModelRosterEntry>();

for (const entry of rosterEntries) {
  rosterBySlug.set(entry.modelSlug, entry);
  rosterByEngine.set(entry.engineId, entry);
}

export function getModelRoster(): ModelRosterEntry[] {
  return rosterEntries.slice();
}

export function getModelBySlug(slug: string): ModelRosterEntry | undefined {
  return rosterBySlug.get(slug);
}

export function getModelByEngineId(engineId: string): ModelRosterEntry | undefined {
  return rosterByEngine.get(engineId);
}

export function listAvailableModels(includeLimited = true): ModelRosterEntry[] {
  return rosterEntries.filter((entry) => {
    if (entry.availability === 'paused') return false;
    if (!includeLimited && entry.availability !== 'available') return false;
    return true;
  });
}
