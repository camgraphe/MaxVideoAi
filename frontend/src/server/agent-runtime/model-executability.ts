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
import type { GeneratePayload } from '@/lib/fal';
import {
  isLumaAgentsVideoEngine,
  resolveLumaAgentsVideoSupport,
} from '@/server/video-providers/luma-agents/model-map';
import { resolveVideoProviderRoutingPlan } from '@/server/video-providers/router';
import { ENV } from '@/lib/env';
import type { CanonicalGenerationRequest } from '@/server/agent-api/generation-types';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import { parseGoogleVertexServiceAccount } from '@/server/video-providers/google-vertex-auth';
import {
  isMinimaxH3MaxEngineId,
  isMinimaxH3MaxRuntimeModeAvailable,
} from '@/lib/minimax-h3-max';

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

export function createAgentGenerationExecutabilityEnvironment(
  providerEnv: Readonly<Record<string, string | undefined>> = process.env,
): AgentGenerationExecutabilityEnvironment {
  return {
    bytePlusEnabled: isBytePlusModelArkEnabled(),
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    bytePlusLasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    bytePlusLasEnabled: isBytePlusLasExecutionEnabled(),
    falApiKey: ENV.FAL_API_KEY,
    providerEnv,
  };
}

function defaultEnvironment(): AgentGenerationExecutabilityEnvironment {
  return createAgentGenerationExecutabilityEnvironment();
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
  if (!configured(projectId) || !configured(serviceAccount)) return false;
  try {
    parseGoogleVertexServiceAccount(serviceAccount);
    return true;
  } catch {
    return false;
  }
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

function googleVertexImageMcpEnabled(
  engineId: string,
  providerEnv: Readonly<Record<string, string | undefined>>,
): boolean {
  if (
    !flagEnabled(providerEnv.GOOGLE_VERTEX_IMAGE_MCP_ENABLED)
    || !flagEnabled(providerEnv.GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED)
  ) return false;
  const allowlist = new Set(
    (providerEnv.GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowlist.has(engineId);
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

  if (isMinimaxH3MaxEngineId(engine.id) && !isMinimaxH3MaxRuntimeModeAvailable(mode)) {
    return { executable: false, reason: 'profile_invalid' };
  }

  const providerEnv = environment.providerEnv ?? process.env;

  if (engine.providerMeta?.provider === 'google_vertex_image') {
    if (!configured(engine.providerMeta.modelSlug)) {
      return { executable: false, reason: 'profile_invalid' };
    }
    if (!googleVertexImageMcpEnabled(engine.id, providerEnv)) {
      return { executable: false, reason: 'provider_disabled' };
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

function lumaRequestPayload(
  request: CanonicalGenerationRequest,
  resolvedReferences: readonly ResolvedReference[],
): GeneratePayload {
  const settings = request.settings;
  const mediaKind = (reference: CanonicalGenerationRequest['references'][number]) => {
    if (reference.kind === 'https') return reference.mediaKind;
    return resolvedReferences.find((candidate) =>
      candidate.assetId === reference.assetId
      && candidate.role === reference.role
      && candidate.slot === reference.slot)?.mediaKind ?? null;
  };
  const referenceImages = request.references.filter((reference) =>
    reference.role === 'reference' && mediaKind(reference) === 'image');
  const hasEndImage = request.references.some((reference) =>
    reference.role === 'last_frame' && mediaKind(reference) === 'image');
  const durationSec = typeof settings.durationSec === 'number' ? settings.durationSec : undefined;
  const extraInputValues: Record<string, unknown> = {};
  if (typeof settings.hdr === 'boolean') extraInputValues.hdr = settings.hdr;
  if (typeof settings.exrExport === 'boolean') extraInputValues.exr_export = settings.exrExport;
  return {
    engineId: request.engineId,
    prompt: request.prompt,
    mode: request.mode as GeneratePayload['mode'],
    ...(durationSec === undefined ? {} : { durationSec, durationOption: `${durationSec}s` }),
    ...(typeof settings.aspectRatio === 'string' ? { aspectRatio: settings.aspectRatio } : {}),
    ...(typeof settings.resolution === 'string' ? { resolution: settings.resolution } : {}),
    ...(typeof settings.loop === 'boolean' ? { loop: settings.loop } : {}),
    ...(referenceImages.length
      ? { referenceImages: referenceImages.map((_, index) => `https://references.invalid/${index}.png`) }
      : {}),
    ...(hasEndImage ? { endImageUrl: 'https://references.invalid/end.png' } : {}),
    ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
  };
}

export function resolveAgentGenerationRequestExecutability(
  request: CanonicalGenerationRequest,
  engine: EngineCaps,
  resolvedReferences: readonly ResolvedReference[] = [],
  environment: AgentGenerationExecutabilityEnvironment = defaultEnvironment(),
): AgentGenerationExecutabilityDecision {
  if (request.surface === 'video' && isLumaAgentsVideoEngine(engine.id)) {
    const providerEnv = environment.providerEnv ?? process.env;
    const support = resolveLumaAgentsVideoSupport({
      engineId: engine.id,
      mode: request.mode,
      falPayload: lumaRequestPayload(request, resolvedReferences),
      advancedDirectOnlyEnabled: flagEnabled(
        providerEnv.LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED,
      ),
    });
    if (!support.supported) {
      return support.fallbackCompatible
        ? credentialDecision(configured(environment.falApiKey))
        : { executable: false, reason: 'profile_invalid' };
    }
  }
  return resolveAgentGenerationModeExecutability(engine, request.mode as Mode, environment);
}

export function isAgentGenerationEngineExecutable(engine: EngineCaps): boolean {
  return resolveAgentGenerationEngineExecutability(engine).executable;
}

export function isAgentGenerationModeExecutable(engine: EngineCaps, mode: Mode): boolean {
  return resolveAgentGenerationModeExecutability(engine, mode).executable;
}
