import {
  isBytePlusModelArkEnabled,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceSubmissionEnabled,
  resolveBytePlusSeedanceRouteProfile,
} from '@/server/video-providers/byteplus-modelark';
import type { EngineCaps } from '@/types/engines';
import {
  isBytePlusSeedreamEngine,
  resolveBytePlusSeedreamReadiness,
} from '@/server/images/byteplus-seedream-policy';
import { ENV } from '@/lib/env';

export type AgentGenerationExecutabilityDecision = Readonly<{
  executable: boolean;
  reason:
    | 'available'
    | 'provider_disabled'
    | 'provider_credentials_missing'
    | 'provider_admin_only'
    | 'profile_invalid';
}>;

export type AgentGenerationExecutabilityEnvironment = Readonly<{
  bytePlusEnabled: boolean;
  bytePlusApiKey: string | undefined;
}>;

function defaultEnvironment(): AgentGenerationExecutabilityEnvironment {
  return {
    bytePlusEnabled: isBytePlusModelArkEnabled(),
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
  };
}

export function resolveAgentGenerationEngineExecutability(
  engine: EngineCaps,
  environment: AgentGenerationExecutabilityEnvironment = defaultEnvironment(),
): AgentGenerationExecutabilityDecision {
  if (isBytePlusSeedreamEngine(engine)) {
    const readiness = resolveBytePlusSeedreamReadiness(engine, environment);
    if (readiness.reason === 'model_unsupported') {
      return { executable: false, reason: 'profile_invalid' };
    }
    return { executable: readiness.executable, reason: readiness.reason };
  }

  try {
    const bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
      engine.id,
      engine.providerMeta?.provider,
    );
    if (!bytePlusProfile) return { executable: true, reason: 'available' };
    if (!environment.bytePlusEnabled || !isBytePlusSeedanceSubmissionEnabled(engine.id)) {
      return { executable: false, reason: 'provider_disabled' };
    }
    if (isBytePlusSeedanceAdminOnly(engine.id)) {
      return { executable: false, reason: 'provider_admin_only' };
    }
    return { executable: true, reason: 'available' };
  } catch {
    return { executable: false, reason: 'profile_invalid' };
  }
}

export function isAgentGenerationEngineExecutable(engine: EngineCaps): boolean {
  return resolveAgentGenerationEngineExecutability(engine).executable;
}
