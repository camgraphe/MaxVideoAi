import {
  isBytePlusModelArkEnabled,
  isBytePlusLasExecutionEnabled,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceSubmissionEnabled,
  getBytePlusSeedanceAllowedModes,
  resolveBytePlusTransport,
  resolveBytePlusSeedanceRouteProfile,
} from '@/server/video-providers/byteplus-modelark';
import type { EngineCaps, Mode } from '@/types/engines';
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
  bytePlusLasApiKey?: string | undefined;
  bytePlusLasEnabled?: boolean;
}>;

function defaultEnvironment(): AgentGenerationExecutabilityEnvironment {
  return {
    bytePlusEnabled: isBytePlusModelArkEnabled(),
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    bytePlusLasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    bytePlusLasEnabled: isBytePlusLasExecutionEnabled(),
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

  const decisions = engine.modes.map((mode) =>
    resolveAgentGenerationModeExecutability(engine, mode, environment)
  );
  return decisions.find((decision) => decision.executable)
    ?? decisions[0]
    ?? { executable: false, reason: 'profile_invalid' };
}

export function resolveAgentGenerationModeExecutability(
  engine: EngineCaps,
  mode: Mode,
  environment: AgentGenerationExecutabilityEnvironment = defaultEnvironment(),
): AgentGenerationExecutabilityDecision {
  if (isBytePlusSeedreamEngine(engine)) {
    return resolveAgentGenerationEngineExecutability(engine, environment);
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
    if (
      !bytePlusProfile.supportedModes.includes(mode)
      || !getBytePlusSeedanceAllowedModes(engine.id).includes(mode)
    ) {
      return { executable: false, reason: 'profile_invalid' };
    }
    const transport = resolveBytePlusTransport(engine.id, mode);
    if (transport === 'las' && !environment.bytePlusLasEnabled) {
      return { executable: false, reason: 'provider_disabled' };
    }
    const apiKey = transport === 'las'
      ? environment.bytePlusLasApiKey
      : environment.bytePlusApiKey;
    if (!apiKey?.trim()) {
      return { executable: false, reason: 'provider_credentials_missing' };
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

export function isAgentGenerationModeExecutable(engine: EngineCaps, mode: Mode): boolean {
  return resolveAgentGenerationModeExecutability(engine, mode).executable;
}
