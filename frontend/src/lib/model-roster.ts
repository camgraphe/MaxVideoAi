import { listFalEngines, type EngineLogoPolicy } from '@/config/falEngines';

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
}

const rosterEntries: ModelRosterEntry[] = listFalEngines().map((engine) => ({
  engineId: engine.id,
  marketingName: engine.marketingName,
  brandId: engine.brandId,
  modelSlug: engine.modelSlug,
  family: engine.family,
  versionLabel: engine.versionLabel ?? '',
  availability: engine.availability,
  logoPolicy: engine.logoPolicy,
  billingNote: engine.billingNote,
}));

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
