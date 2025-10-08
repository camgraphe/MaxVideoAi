import roster from '../../config/model-roster.json' assert { type: 'json' };

export type LogoPolicy = 'logoAllowed' | 'textOnly';
export type ModelAvailability = 'available' | 'limited' | 'waitlist' | 'paused';

export interface ModelRosterEntry {
  engineId: string;
  marketingName: string;
  brandId: string;
  modelSlug: string;
  versionLabel: string;
  availability: ModelAvailability;
  logoPolicy: LogoPolicy;
}

const rosterEntries = roster as ModelRosterEntry[];

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
