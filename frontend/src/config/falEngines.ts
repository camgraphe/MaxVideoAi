import {
  resolveRuntimePublicSlug,
} from '../../config/model-runtime';
import { RAW_FAL_ENGINE_REGISTRY } from './fal-engines/registry';
import { materializeFalEngineEntry } from './fal-engine-materialization';
import type { FalEngineEntry } from './fal-engines/types';

export type {
  EngineLogoPolicy,
  EngineUiCaps,
  EngineUiDurationCaps,
  FalEngineEntry,
  FalEngineFaqEntry,
  FalEngineMedia,
  FalEngineModeConfig,
  FalEnginePricingHint,
  FalEnginePromptHint,
  FalEngineSeoMeta,
} from './fal-engines/types';

export const FAL_ENGINE_REGISTRY: readonly FalEngineEntry[] = RAW_FAL_ENGINE_REGISTRY.map(materializeFalEngineEntry);

export function listFalEngines(): FalEngineEntry[] {
  return FAL_ENGINE_REGISTRY.slice();
}

export function getEngineAliases(entry: FalEngineEntry): string[] {
  const aliases = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length) {
      aliases.add(value.trim());
    }
  };
  add(entry.id);
  add(entry.engine.id);
  add(entry.defaultFalModelId);
  if (entry.engine?.providerMeta && typeof entry.engine.providerMeta.modelSlug === 'string') {
    add(entry.engine.providerMeta.modelSlug);
  }
  entry.modes.forEach((mode) => {
    add(mode.falModelId);
  });
  return Array.from(aliases);
}

export function listImageEngineAliases(): string[] {
  const aliasSet = new Set<string>();
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .forEach((entry) => {
      getEngineAliases(entry).forEach((alias) => aliasSet.add(alias));
    });
  return Array.from(aliasSet);
}

export function getFalEngineById(id: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.id === id);
}

export function canonicalizeFalModelSlug(slug: string): string {
  return resolveRuntimePublicSlug(slug)?.slug ?? slug.trim().toLowerCase();
}

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  const model = resolveRuntimePublicSlug(slug);
  if (model) return getFalEngineById(model.id);
  const normalized = slug.trim().toLowerCase();
  return FAL_ENGINE_REGISTRY.find((entry) =>
    getEngineAliases(entry).some((alias) => alias.trim().toLowerCase() === normalized),
  );
}
