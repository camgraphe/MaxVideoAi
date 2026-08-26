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
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { resolveVideoProviderRoutingPlan } from '@/server/video-providers/router';
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
  falApiKey?: string | undefined;
  providerEnv?: Readonly<Record<string, string | undefined>>;
}>;

function defaultEnvironment(): AgentGenerationExecutabilityEnvironment {
  return {
    bytePlusEnabled: isBytePlusModelArkEnabled(),
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    bytePlusLasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    bytePlusLasEnabled: isBytePlusLasExecutionEnabled(),
    falApiKey: ENV.FAL_API_KEY,
    providerEnv: process.env,
  };
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function flagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function credentialDecision(ready: boolean): AgentGenerationExecutabilityDecision {
  return ready
    ? { executable: true, reason: 'available' }
    : { executable: false, reason: 'provider_credentials_missing' };
}

function googleVertexCredentialsConfigured(
  providerEnv: Readonly<Record<string, string | undefined>>,
  kind: 'veo' | 'omni',
): boolean {
  const projectId = kind === 'omni'
    ? providerEnv.GOOGLE_VERTEX_OMNI_PROJECT_ID ?? providerEnv.GOOGLE_VERTEX_PROJECT_ID
    : providerEnv.GOOGLE_VERTEX_PROJECT_ID;
  const serviceAccount = kind === 'omni'
    ? providerEnv.GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON
      ?? providerEnv.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON
    : providerEnv.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
  return configured(projectId) && configured(serviceAccount);
}

function googleVertexImageConfigured(
  providerEnv: Readonly<Record<string, string | undefined>>,
): boolean {
  return googleVertexCredentialsConfigured(providerEnv, 'veo')
    && configured(
      providerEnv.GOOGLE_VERTEX_INPUT_GCS_URI
      ?? providerEnv.GOOGLE_VERTEX_VEO_INPUT_GCS_URI,
    );
}

function lumaImageDirectEnabled(
  providerEnv: Readonly<Record<string, string | undefined>>,
): boolean {
  return flagEnabled(providerEnv.LUMA_AGENTS_ENABLED)
    && flagEnabled(providerEnv.LUMA_AGENTS_IMAGE_DIRECT_ENABLED)
    && flagEnabled(providerEnv.LUMA_AGENTS_PUBLIC_ROUTING_ENABLED)
    && !flagEnabled(providerEnv.LUMA_AGENTS_ADMIN_ONLY ?? 'true');
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

  const providerEnv = environment.providerEnv ?? process.env;

  if (engine.providerMeta?.provider === 'google_vertex_image') {
    if (!configured(engine.providerMeta.modelSlug)) {
      return { executable: false, reason: 'profile_invalid' };
    }
    return credentialDecision(googleVertexImageConfigured(providerEnv));
  }

  if (isLumaAgentsImageEngineId(engine.id)) {
    if (!lumaImageDirectEnabled(providerEnv)) {
      return credentialDecision(configured(environment.falApiKey));
    }
    return credentialDecision(configured(providerEnv.LUMA_AGENTS_API_KEY));
  }

  try {
    const bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
      engine.id,
      engine.providerMeta?.provider,
    );
    if (!bytePlusProfile) {
      const routingPlan = resolveVideoProviderRoutingPlan({
        engineId: engine.id,
        mode,
        isAdmin: false,
        env: providerEnv,
      });
      if (routingPlan.kind === 'google_vertex_unavailable') {
        return { executable: false, reason: 'provider_disabled' };
      }
      if (routingPlan.kind === 'fal_only') {
        return credentialDecision(configured(environment.falApiKey));
      }
      if (routingPlan.kind === 'kling_direct_primary') {
        return credentialDecision(
          configured(providerEnv.KLING_ACCESS_KEY)
          && configured(providerEnv.KLING_SECRET_KEY),
        );
      }
      if (routingPlan.kind === 'luma_agents_direct_primary') {
        return credentialDecision(configured(providerEnv.LUMA_AGENTS_API_KEY));
      }
      if (routingPlan.kind === 'google_vertex_veo_primary') {
        return credentialDecision(googleVertexCredentialsConfigured(providerEnv, 'veo'));
      }
      if (routingPlan.kind === 'google_vertex_omni_primary') {
        return credentialDecision(googleVertexCredentialsConfigured(providerEnv, 'omni'));
      }
      return { executable: false, reason: 'profile_invalid' };
    }
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
