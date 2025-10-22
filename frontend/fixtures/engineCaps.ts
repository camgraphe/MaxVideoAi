import { listFalEngines, type EngineUiCaps, type FalEngineModeConfig } from '../src/config/falEngines.ts';
import type { Mode as EngineMode } from '../types/engines.ts';

export type Mode = EngineMode;

export type DurationCaps = EngineUiCaps['duration'];

export type EngineCaps = EngineUiCaps;

const registry = listFalEngines();

export const ENGINE_CAPS: Record<string, EngineCaps> = registry
  .flatMap((engine) => engine.modes)
  .reduce<Record<string, EngineCaps>>((acc, modeConfig) => {
    acc[modeConfig.falModelId] = modeConfig.ui;
    return acc;
  }, {});

export type EngineCapsKey = keyof typeof ENGINE_CAPS;

type ModeCapsMap = Partial<Record<Mode, EngineCapsKey>>;

export const ENGINE_CAP_INDEX: Record<string, ModeCapsMap> = registry.reduce<Record<string, ModeCapsMap>>(
  (acc, engine) => {
    const map: ModeCapsMap = {};
    engine.modes.forEach((modeConfig: FalEngineModeConfig) => {
      map[modeConfig.mode] = modeConfig.falModelId;
    });
    acc[engine.id] = map;
    return acc;
  },
  {}
);

export function resolveEngineCapsKey(engineId: string, mode?: Mode): EngineCapsKey | undefined {
  const entry = ENGINE_CAP_INDEX[engineId];
  if (!entry) return undefined;
  if (mode && entry[mode]) return entry[mode];
  return (mode ? undefined : Object.values(entry).find(Boolean)) as EngineCapsKey | undefined;
}

export function getEngineCaps(engineId: string, mode?: Mode): EngineCaps | undefined {
  const key = resolveEngineCapsKey(engineId, mode);
  return key ? ENGINE_CAPS[key] : undefined;
}
