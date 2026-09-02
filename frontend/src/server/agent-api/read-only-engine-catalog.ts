import {
  cloneEngine,
  getBaseEngineIncludingHidden,
  getBaseEnginesByCategory,
  type EngineCategory,
} from '@/lib/engines';
import type { TransactionQueryExecutor } from '@/lib/db';
import {
  fetchEngineOverridesReadOnly,
  fetchEngineOverridesReadOnlyWithExecutor,
  fetchEngineSettingsReadOnly,
  fetchEngineSettingsReadOnlyWithExecutor,
  type EngineOverride,
  type EngineSettingsRecord,
} from '@/server/engine-configuration-read';
import {
  applyConfiguredEngineRuntimeOptions,
  projectConfiguredEngine,
} from '@/server/engine-configuration-projection';
import type { EngineCaps } from '@/types/engines';

export type ReadOnlyEngineCatalogDependencies = Readonly<{
  databaseConfigured(): boolean;
  fetchSettings(): Promise<Map<string, EngineSettingsRecord>>;
  fetchOverrides(): Promise<Map<string, EngineOverride>>;
}>;

const defaultDependencies: ReadOnlyEngineCatalogDependencies = Object.freeze({
  databaseConfigured: () => Boolean(process.env.DATABASE_URL),
  fetchSettings: fetchEngineSettingsReadOnly,
  fetchOverrides: fetchEngineOverridesReadOnly,
});

async function projectReadOnlyEngines(
  baseEngines: EngineCaps[],
  includeDisabled: boolean,
  dependencies: ReadOnlyEngineCatalogDependencies,
): Promise<EngineCaps[]> {
  if (!dependencies.databaseConfigured()) return baseEngines.map(cloneEngine);
  const [settings, overrides] = await Promise.all([
    dependencies.fetchSettings(),
    dependencies.fetchOverrides(),
  ]);
  return baseEngines
    .map((engine) => projectConfiguredEngine(engine, settings, overrides))
    .filter((entry) => includeDisabled || !entry.disabled)
    .map((entry) => applyConfiguredEngineRuntimeOptions(entry.engine));
}

export function getReadOnlyConfiguredEnginesByCategory(
  category: EngineCategory = 'video',
  includeDisabled = false,
  dependencies: ReadOnlyEngineCatalogDependencies = defaultDependencies,
): Promise<EngineCaps[]> {
  return projectReadOnlyEngines(getBaseEnginesByCategory(category), includeDisabled, dependencies);
}

export async function getReadOnlyConfiguredEngineIncludingHidden(
  engineId: string,
  includeDisabled = false,
  dependencies: ReadOnlyEngineCatalogDependencies = defaultDependencies,
): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const base = getBaseEngineIncludingHidden(engineId);
  if (!base) return undefined;
  const [configured] = await projectReadOnlyEngines([base], includeDisabled, dependencies);
  return configured;
}

async function readExecutorSnapshot(executor: TransactionQueryExecutor) {
  await executor.query('LOCK TABLE engine_settings, engine_overrides IN SHARE MODE');
  const [settings, overrides] = await Promise.all([
    fetchEngineSettingsReadOnlyWithExecutor(executor),
    fetchEngineOverridesReadOnlyWithExecutor(executor),
  ]);
  return { settings, overrides };
}

export async function getReadOnlyConfiguredEnginesByCategoryInExecutor(
  category: EngineCategory,
  executor: TransactionQueryExecutor,
): Promise<EngineCaps[]> {
  const { settings, overrides } = await readExecutorSnapshot(executor);
  return getBaseEnginesByCategory(category)
    .map((engine) => projectConfiguredEngine(engine, settings, overrides))
    .filter((entry) => !entry.disabled)
    .map((entry) => applyConfiguredEngineRuntimeOptions(entry.engine));
}

export async function getReadOnlyConfiguredEngineIncludingHiddenInExecutor(
  engineId: string,
  executor: TransactionQueryExecutor,
): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const base = getBaseEngineIncludingHidden(engineId);
  if (!base) return undefined;
  const { settings, overrides } = await readExecutorSnapshot(executor);
  const projected = projectConfiguredEngine(base, settings, overrides);
  return projected.disabled ? undefined : applyConfiguredEngineRuntimeOptions(projected.engine);
}
