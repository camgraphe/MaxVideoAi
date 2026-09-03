import { getEngineCaps } from '@/fixtures/engineCaps';
import { resolveActiveVideoInputField } from '@/lib/video-input-schema';
import type { EngineCaps, Mode } from '@/types/engines';
import { isPrivateRuntimeEngineId } from './private-engine-registry';

export type RuntimeResolutionPolicy = Readonly<{
  supportsResolution: boolean;
  defaultResolution?: string;
  pricingFallbackResolution: string;
}>;

export function resolveRuntimeResolutionPolicy(
  engine: EngineCaps,
  mode: Mode,
): RuntimeResolutionPolicy {
  const privateRuntime = isPrivateRuntimeEngineId(engine.id);
  const schemaField = resolveActiveVideoInputField({
    inputSchema: engine.inputSchema,
    mode,
    candidateFieldIds: ['resolution'],
    type: 'enum',
  });
  const registeredCapability = getEngineCaps(engine.id, mode);
  const supportsResolution = privateRuntime
    ? Boolean(schemaField?.values?.length)
    : registeredCapability
      ? Boolean(registeredCapability.resolution?.length)
      : true;
  const schemaDefault = privateRuntime && typeof schemaField?.default === 'string'
    ? schemaField.default.trim() || undefined
    : undefined;
  const pricingFallbackResolution =
    engine.resolutions.find((value) => value !== 'auto')
    ?? engine.resolutions[0]
    ?? '1080p';

  return {
    supportsResolution,
    ...(supportsResolution
      ? {
          defaultResolution:
            schemaDefault
            ?? engine.resolutions[0]
            ?? pricingFallbackResolution,
        }
      : {}),
    pricingFallbackResolution,
  };
}
