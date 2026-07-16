import { createHash } from 'node:crypto';

import type { AgentPublicGenerationEngine } from './model-catalog';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(',')}}`;
}

function canonicalCapabilityValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const items = value
      .map(canonicalCapabilityValue)
      .filter((item): item is JsonValue => item !== undefined);
    return items.sort((left, right) => compareCodeUnits(stableJson(left), stableJson(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .flatMap(([key, entry]) => {
          const canonical = canonicalCapabilityValue(entry);
          return canonical === undefined ? [] : [[key, canonical]];
        }),
    );
  }
  return undefined;
}

function projectEngine(candidate: AgentPublicGenerationEngine): JsonValue {
  const { engine } = candidate;
  return canonicalCapabilityValue({
    surface: candidate.surface,
    publicModes: candidate.publicModes,
    modeCaps: candidate.modeCaps,
    engine: {
      id: engine.id,
      label: engine.label,
      status: engine.status,
      isLab: engine.isLab ?? false,
      availability: engine.availability,
      apiAvailability: engine.apiAvailability ?? null,
      modes: engine.modes,
      maxDurationSec: engine.maxDurationSec,
      resolutions: engine.resolutions,
      aspectRatios: engine.aspectRatios,
      fps: engine.fps,
      audio: engine.audio,
      inputLimits: engine.inputLimits,
      inputSchema: engine.inputSchema ?? null,
      updatedAt: engine.updatedAt,
    },
  }) as JsonValue;
}

export function computeGenerationCatalogRevision(
  engines: readonly AgentPublicGenerationEngine[],
): string {
  const projection = canonicalCapabilityValue({
    schemaVersion: 2,
    engines: engines.map(projectEngine),
  });
  if (!projection) throw new Error('Unable to project the public generation catalog.');
  const digest = createHash('sha256')
    .update(stableJson(projection), 'utf8')
    .digest('hex');
  return `mcp-catalog-v2:${digest}`;
}
