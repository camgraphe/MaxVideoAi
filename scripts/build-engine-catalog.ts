import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines';
import { getEngineCatalogOverrides, type EngineCatalogOverride, type EngineCatalogFeature } from '../frontend/src/config/engineCatalog.overrides';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'frontend', 'config', 'engine-catalog.json');

type EngineCatalogEntry = {
  engineId: string;
  modelSlug: string;
  marketingName: string;
  provider: string;
  brandId: string;
  versionLabel?: string;
  availability: string;
  logoPolicy: string;
  engine: FalEngineEntry['engine'];
  modes: FalEngineEntry['modes'];
  features: Record<string, EngineCatalogFeature>;
  bestFor?: string;
  notes?: Record<string, string>;
};

function mergeFeatures(
  base: Record<string, EngineCatalogFeature>,
  override?: Record<string, EngineCatalogFeature>
) {
  if (!override) return base;
  const merged: Record<string, EngineCatalogFeature> = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (!value) return;
    const existing = merged[key] ?? {};
    merged[key] = { ...existing, ...value };
  });
  return merged;
}

function buildDefaultFeatures(engine: FalEngineEntry): Record<string, EngineCatalogFeature> {
  return {
    audio: { value: Boolean(engine.engine.audio) },
    motionControls: { value: Boolean(engine.engine.motionControls) },
    keyframes: { value: Boolean(engine.engine.keyframes) },
    extend: { value: Boolean(engine.engine.extend) },
  };
}

function toCatalogEntry(engine: FalEngineEntry, override?: EngineCatalogOverride): EngineCatalogEntry {
  const features = mergeFeatures(buildDefaultFeatures(engine), override?.features);
  return {
    engineId: engine.id,
    modelSlug: engine.modelSlug,
    marketingName: override?.marketingName ?? engine.marketingName,
    provider: engine.provider,
    brandId: engine.brandId,
    versionLabel: override?.versionLabel ?? engine.versionLabel ?? undefined,
    availability: engine.availability,
    logoPolicy: engine.logoPolicy,
    engine: engine.engine,
    modes: engine.modes,
    features,
    bestFor: override?.bestFor,
    notes: override?.notes,
  };
}

function validateCatalog(catalog: EngineCatalogEntry[]) {
  const slugSet = new Set<string>();
  catalog.forEach((entry) => {
    if (!entry.modelSlug) {
      throw new Error(`engineCatalog: missing modelSlug for engineId "${entry.engineId}"`);
    }
    if (slugSet.has(entry.modelSlug)) {
      throw new Error(`engineCatalog: duplicate modelSlug "${entry.modelSlug}"`);
    }
    slugSet.add(entry.modelSlug);
    entry.modes.forEach((mode) => {
      if (!mode.falModelId) {
        throw new Error(`engineCatalog: missing falModelId for engineId "${entry.engineId}" mode "${mode.mode}"`);
      }
    });
  });
}

async function main() {
  const overrides = getEngineCatalogOverrides();
  const engines = listFalEngines();
  const catalog = engines.map((engine) => toCatalogEntry(engine, overrides[engine.id]));

  const unknownOverrides = Object.keys(overrides).filter((engineId) => !engines.some((engine) => engine.id === engineId));
  if (unknownOverrides.length) {
    console.warn(`[engine-catalog] Overrides defined for unknown engine IDs: ${unknownOverrides.join(', ')}`);
  }

  validateCatalog(catalog);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Generated engine catalog with ${catalog.length} entries.`);
}

main().catch((error) => {
  console.error('[engine-catalog] Failed to generate catalog:', error);
  process.exitCode = 1;
});
