import { getEngineCaps } from '@/fixtures/engineCaps';
import { resolveActiveVideoInputField } from '@/lib/video-input-schema';
import { isKling3TurboEngineId } from '@/lib/kling-3-turbo';
import { isMinimaxH3MaxEngineId } from '@/lib/minimax-h3-max';
import { isFlux3MaxEngineId } from '@/lib/flux-3-max';
import type { EngineCaps, Mode } from '@/types/engines';
import { isPrivateRuntimeEngineId } from './private-engine-registry';

export type RuntimeResolutionPolicy = Readonly<{
  supportsResolution: boolean;
  usesSchemaDefaults: boolean;
  defaultResolution?: string;
  pricingFallbackResolution: string;
}>;

export function getKlingV4Native4kAvailabilityError(engine: EngineCaps, resolution?: string): string | null {
  return engine.id === 'kling-v4' && resolution === '4k' && !engine.resolutions.includes('4k')
    ? 'Native 4K is currently unavailable for Kling 4.0.'
    : null;
}

export function resolveRuntimeResolutionPolicy(
  engine: EngineCaps,
  mode: Mode,
): RuntimeResolutionPolicy {
  const usesSchemaDefaults = isPrivateRuntimeEngineId(engine.id)
    || isFlux3MaxEngineId(engine.id)
    || isKling3TurboEngineId(engine.id)
    || isMinimaxH3MaxEngineId(engine.id);
  const schemaField = resolveActiveVideoInputField({
    inputSchema: engine.inputSchema,
    mode,
    candidateFieldIds: ['resolution'],
    type: 'enum',
  });
  const registeredCapability = getEngineCaps(engine.id, mode);
  const supportsResolution = usesSchemaDefaults
    ? Boolean(schemaField?.values?.length)
    : registeredCapability
      ? Boolean(registeredCapability.resolution?.length)
      : true;
  const schemaDefault = usesSchemaDefaults && typeof schemaField?.default === 'string'
    ? schemaField.default.trim() || undefined
    : undefined;
  const pricingFallbackResolution =
    engine.resolutions.find((value) => value !== 'auto')
    ?? engine.resolutions[0]
    ?? '1080p';

  return {
    supportsResolution,
    usesSchemaDefaults,
    ...(supportsResolution
      ? {
          defaultResolution:
            schemaDefault
            ?? registeredCapability?.resolution?.[0]
            ?? engine.resolutions[0]
            ?? pricingFallbackResolution,
        }
      : {}),
    pricingFallbackResolution,
  };
}
