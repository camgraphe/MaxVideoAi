import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { getBaseEngineIncludingHidden } from '@/lib/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { getConfiguredEngine, getConfiguredEngineIncludingHidden } from '@/server/engines';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  BytePlusModelArkError,
  assertBytePlusSeedanceSubmissionEnabled,
  assertBytePlusTransportConfigured,
  getBytePlusArkConfig,
  getBytePlusSeedanceAllowedModes,
  isBytePlusModelArkEnabled,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceHiddenEngine,
  resolveBytePlusSeedanceModelId,
  resolveBytePlusSeedanceRouteProfile,
  shouldRouteSeedanceEngineToBytePlus,
  type BytePlusSeedanceProfile,
} from '@/server/video-providers/byteplus-modelark';
import { requiresBytePlusSeedanceEarlyGate } from '@/server/video-providers/byteplus-modelark-profile-policy';
import {
  resolveVideoProviderRoutingPlan,
  shouldRouteKlingDirectSourceElementsToFal,
  type VideoProviderRoutingEnv,
  type VideoProviderRoutingPlan,
} from '@/server/video-providers/router';
import { isGoogleVertexOmniEngine } from '@/server/video-providers/google-vertex-omni/model-map';
import { isGoogleVertexVeoEngine } from '@/server/video-providers/google-vertex-veo/model-map';
import { isKlingDirectEngine } from '@/server/video-providers/kling-direct/model-map';
import { isLumaAgentsVideoEngine } from '@/server/video-providers/luma-agents/model-map';
import { isMinimaxH3MaxEngineId, isMinimaxH3MaxRuntimeModeAvailable } from '@/lib/minimax-h3-max';
import type { EngineCaps, Mode } from '@/types/engines';
import type { PaymentMode } from './initial-video-job';
import { isVideoMode } from './request-options';
import {
  getPrivateRuntimeEngineById,
  isPrivateRuntimeEngineId,
} from '@/server/video-generation/private-engine-registry';
import {
  resolveLaunchCanaryRequestContext,
  type LaunchCanaryRequestContext,
} from '@/server/model-launch-canary-request';
import { resolveAgentGenerationModeExecutability } from '@/server/agent-runtime/model-executability';
import { validateRuntimeRequestSettings } from './runtime-schema-options';
import { resolveRuntimeResolutionPolicy } from '@/server/video-generation/runtime-resolution';

export type GenerateRouteContext = {
  engine: EngineCaps;
  isBytePlusV1a: boolean;
  jobId: string;
  mode: Mode;
  payment: { mode?: PaymentMode; paymentIntentId?: string | null };
  providerKey: string;
  providerRoutingPlan: VideoProviderRoutingPlan;
};

export type GenerateRouteContextResult =
  | { ok: true; context: GenerateRouteContext }
  | { ok: false; status: number; body: Record<string, unknown> };

type GenerateRouteContextBoundaries = {
  ensureBillingSchema: typeof ensureBillingSchema;
  getConfiguredEngine: typeof getConfiguredEngine;
  getConfiguredEngineIncludingHidden: typeof getConfiguredEngineIncludingHidden;
  isDatabaseConfigured: typeof isDatabaseConfigured;
  requireAdmin: typeof requireAdmin;
  resolveLaunchCanaryRequestContext: typeof resolveLaunchCanaryRequestContext;
};

const defaultGenerateRouteContextBoundaries: GenerateRouteContextBoundaries = {
  ensureBillingSchema,
  getConfiguredEngine,
  getConfiguredEngineIncludingHidden,
  isDatabaseConfigured,
  requireAdmin,
  resolveLaunchCanaryRequestContext,
};

export function resolveTrustedPaidGenerateRouteContext(params: {
  body: Record<string, unknown>;
  engine: EngineCaps;
  jobId: string;
  mode: Mode;
  providerEnv?: VideoProviderRoutingEnv;
}): GenerateRouteContextResult {
  const { body, engine, jobId, mode, providerEnv } = params;
  if (isMinimaxH3MaxEngineId(engine.id) && !isMinimaxH3MaxRuntimeModeAvailable(mode)) {
    return { ok: false, status: 503, body: { ok: false, error: 'Engine unavailable' } };
  }
  let bytePlusProfile: BytePlusSeedanceProfile | null;

  try {
    bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
      engine.id,
      engine.providerMeta?.provider
    );
    if (bytePlusProfile) {
      if (isBytePlusSeedanceAdminOnly(engine.id)) {
        return { ok: false, status: 400, body: { ok: false, error: 'Engine unavailable' } };
      }
      assertBytePlusSeedanceSubmissionEnabled(engine.id);
      resolveBytePlusSeedanceModelId(engine.id, getBytePlusArkConfig());
      assertBytePlusTransportConfigured(engine.id, mode);
    }
  } catch (error) {
    if (error instanceof BytePlusModelArkError) {
      const unavailable = error.code === 'BYTEPLUS_ENGINE_DISABLED';
      return {
        ok: false,
        status: unavailable ? 404 : error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING' ? 400 : 503,
        body: {
          ok: false,
          error: unavailable ? 'Engine unavailable' : error.code ?? 'BYTEPLUS_PROFILE_PREFLIGHT_FAILED',
        },
      };
    }
    throw error;
  }

  const isBytePlusV1a = bytePlusProfile !== null;
  if (
    (isBytePlusV1a && !isBytePlusModelArkEnabled())
    || (isBytePlusV1a && !getBytePlusSeedanceAllowedModes(engine.id).includes(mode))
  ) {
    return { ok: false, status: 400, body: { ok: false, error: 'Engine unavailable' } };
  }

  let providerRoutingPlan: VideoProviderRoutingPlan = isBytePlusV1a
    ? { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
    : resolveVideoProviderRoutingPlan({ engineId: engine.id, mode, isAdmin: false, env: providerEnv });
  if (shouldRouteKlingDirectSourceElementsToFal({
    providerRoutingPlan,
    elementCount: Array.isArray(body.elements) ? body.elements.length : 0,
  })) {
    providerRoutingPlan = { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false };
  }
  if (providerRoutingPlan.kind === 'google_vertex_unavailable') {
    return { ok: false, status: 503, body: { ok: false, error: 'Engine unavailable' } };
  }

  return {
    ok: true,
    context: {
      engine,
      isBytePlusV1a,
      jobId,
      mode,
      payment: { mode: 'wallet' },
      providerKey: isBytePlusV1a ? BYTEPLUS_MODELARK_PROVIDER : providerRoutingPlan.primaryProvider,
      providerRoutingPlan,
    },
  };
}

export async function resolveGenerateRouteContext(params: {
  boundaryOverrides?: Partial<GenerateRouteContextBoundaries>;
  body: Record<string, unknown>;
  req: NextRequest;
}): Promise<GenerateRouteContextResult> {
  const { body, req } = params;
  const boundaries = {
    ...defaultGenerateRouteContextBoundaries,
    ...params.boundaryOverrides,
  };
  const requestedEngineId = String(body.engineId || '');
  let launchCanaryContext: LaunchCanaryRequestContext | null = null;
  if (isPrivateRuntimeEngineId(requestedEngineId)) {
    launchCanaryContext = await boundaries.resolveLaunchCanaryRequestContext(req);
    if (!launchCanaryContext?.access.allowedModelIds.has(requestedEngineId)) {
      return { ok: false, status: 404, body: { ok: false, error: 'Engine unavailable' } };
    }
  }
  if (requiresBytePlusSeedanceEarlyGate(requestedEngineId)) {
    try {
      assertBytePlusSeedanceSubmissionEnabled(requestedEngineId);
    } catch (error) {
      if (
        error instanceof BytePlusModelArkError &&
        error.code === 'BYTEPLUS_ENGINE_DISABLED'
      ) {
        return {
          ok: false,
          status: 404,
          body: { ok: false, error: 'Engine unavailable' },
        };
      }
      throw error;
    }
  }
  const registeredBaseEngine =
    getBaseEngineIncludingHidden(requestedEngineId)
    ?? getPrivateRuntimeEngineById(requestedEngineId);
  if (!registeredBaseEngine) {
    return { ok: false, status: 400, body: { ok: false, error: 'Unknown engine' } };
  }
  const bytePlusRequiresEarlyAdmin =
    shouldRouteSeedanceEngineToBytePlus(requestedEngineId) &&
    isBytePlusSeedanceAdminOnly(requestedEngineId);
  if (bytePlusRequiresEarlyAdmin) {
    try {
      await boundaries.requireAdmin(req);
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return { ok: false, status: error.status, body: { ok: false, error: error.message } };
      }
      console.error('[api/generate] failed to check BytePlus admin access', error);
      return { ok: false, status: 500, body: { ok: false, error: 'Server error' } };
    }
  }

  const publicEngine = await boundaries.getConfiguredEngine(requestedEngineId);
  const engine =
    publicEngine ??
    (isBytePlusSeedanceHiddenEngine(requestedEngineId) || isPrivateRuntimeEngineId(requestedEngineId)
      ? await boundaries.getConfiguredEngineIncludingHidden(requestedEngineId)
      : undefined);
  if (!engine) {
    const disabledEngine = await boundaries.getConfiguredEngine(requestedEngineId, true);
    if (disabledEngine) {
      console.info('[api/generate] runtime lock active; generation blocked', { engineId: requestedEngineId });
      return { ok: false, status: 400, body: { ok: false, error: 'Engine unavailable' } };
    }
    return { ok: false, status: 400, body: { ok: false, error: 'Unknown engine' } };
  }

  let bytePlusProfile: BytePlusSeedanceProfile | null;
  try {
    bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
      engine.id,
      engine.providerMeta?.provider
    );
    if (bytePlusProfile) {
      assertBytePlusSeedanceSubmissionEnabled(engine.id);
      resolveBytePlusSeedanceModelId(engine.id, getBytePlusArkConfig());
    }
  } catch (error) {
    if (error instanceof BytePlusModelArkError) {
      if (error.code === 'BYTEPLUS_ENGINE_DISABLED') {
        return {
          ok: false,
          status: 404,
          body: { ok: false, error: 'Engine unavailable' },
        };
      }
      return {
        ok: false,
        status: error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING' ? 400 : 503,
        body: {
          ok: false,
          error: error.code ?? 'BYTEPLUS_PROFILE_PREFLIGHT_FAILED',
          message:
            error.code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
              ? 'This engine is not configured for BytePlus.'
              : 'This engine is temporarily unavailable.',
        },
      };
    }
    throw error;
  }
  const isBytePlusV1a = bytePlusProfile !== null;

  const requestedJobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : null;
  const jobId = requestedJobId ?? `job_${randomUUID()}`;
  const hasExplicitMode = Object.prototype.hasOwnProperty.call(body, 'mode');
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  if (hasExplicitMode && !isVideoMode(rawMode)) {
    return { ok: false, status: 400, body: { ok: false, error: 'Invalid mode' } };
  }
  const mode: Mode = isVideoMode(rawMode)
    ? rawMode
    : engine.modes.includes('t2v')
      ? 't2v'
      : engine.modes[0] ?? 't2v';

  if (isMinimaxH3MaxEngineId(engine.id) && !isMinimaxH3MaxRuntimeModeAvailable(mode)) {
    return { ok: false, status: 503, body: { ok: false, error: 'Engine unavailable' } };
  }

  if (
    launchCanaryContext
    && !resolveAgentGenerationModeExecutability(
      engine,
      mode,
      launchCanaryContext.generationEnvironment,
    ).executable
  ) {
    return { ok: false, status: 503, body: { ok: false, error: 'Engine unavailable' } };
  }
  if (launchCanaryContext || resolveRuntimeResolutionPolicy(engine, mode).usesSchemaDefaults) {
    const settingsValidation = validateRuntimeRequestSettings({
      engine,
      mode,
      durationSec: body.durationSec ?? body.duration,
      resolution: body.resolution,
      aspectRatio: body.aspectRatio,
      fps: body.fps,
    });
    if (!settingsValidation.ok) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error: settingsValidation.error.code,
          message: settingsValidation.error.message,
        },
      };
    }
  }

  if (isBytePlusV1a && !isBytePlusModelArkEnabled()) {
    return { ok: false, status: 404, body: { ok: false, error: 'Engine unavailable' } };
  }

  if (isBytePlusV1a) {
    try {
      assertBytePlusTransportConfigured(engine.id, mode);
    } catch (error) {
      if (error instanceof BytePlusModelArkError) {
        return {
          ok: false,
          status: 503,
          body: {
            ok: false,
            error: error.code ?? 'BYTEPLUS_PROFILE_PREFLIGHT_FAILED',
            message: 'This engine is temporarily unavailable.',
          },
        };
      }
      throw error;
    }
  }

  if (!boundaries.isDatabaseConfigured()) {
    return { ok: false, status: 503, body: { ok: false, error: 'Database unavailable' } };
  }

  try {
    await boundaries.ensureBillingSchema();
  } catch {
    return { ok: false, status: 503, body: { ok: false, error: 'Database unavailable' } };
  }

  let isAdminForDirectProvider = false;
  if (
    !isBytePlusV1a &&
    (isKlingDirectEngine(engine.id) ||
      isGoogleVertexVeoEngine(engine.id) ||
      isGoogleVertexOmniEngine(engine.id) ||
      isLumaAgentsVideoEngine(engine.id))
  ) {
    try {
      await boundaries.requireAdmin(req);
      isAdminForDirectProvider = true;
    } catch {
      isAdminForDirectProvider = false;
    }
  }
  let providerRoutingPlan: VideoProviderRoutingPlan = isBytePlusV1a
    ? ({ kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false } as const)
    : resolveVideoProviderRoutingPlan({ engineId: engine.id, mode, isAdmin: isAdminForDirectProvider });
  if (
    shouldRouteKlingDirectSourceElementsToFal({
      providerRoutingPlan,
      elementCount: Array.isArray(body.elements) ? body.elements.length : 0,
    })
  ) {
    providerRoutingPlan = { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false };
  }
  if (providerRoutingPlan.kind === 'google_vertex_unavailable') {
    return { ok: false, status: 503, body: { ok: false, error: 'Engine unavailable' } };
  }
  const providerKey = isBytePlusV1a ? BYTEPLUS_MODELARK_PROVIDER : providerRoutingPlan.primaryProvider;

  if (
    isBytePlusV1a &&
    !getBytePlusSeedanceAllowedModes(engine.id).includes(mode)
  ) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: 'This Seedance route only supports the configured modes.' },
    };
  }

  const payment: { mode?: PaymentMode; paymentIntentId?: string | null } =
    typeof body.payment === 'object' && body.payment
      ? {
          mode: (body.payment as { mode?: PaymentMode }).mode,
          paymentIntentId: (body.payment as { paymentIntentId?: string | null }).paymentIntentId,
        }
      : {};

  return {
    ok: true,
    context: {
      engine,
      isBytePlusV1a,
      jobId,
      mode,
      payment,
      providerKey,
      providerRoutingPlan,
    },
  };
}
