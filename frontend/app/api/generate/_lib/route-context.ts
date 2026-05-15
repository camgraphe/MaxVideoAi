import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { getConfiguredEngine, getConfiguredEngineIncludingHidden } from '@/server/engines';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  isBytePlusModelArkEnabled,
  isBytePlusSeedanceFastEngine,
  isSeedanceBytePlusModeAllowed,
  isSeedanceFastBytePlusModeAllowed,
  seedanceBytePlusAdminOnly,
  seedanceFastBytePlusAdminOnly,
  shouldRoutePublicSeedanceFastToBytePlus,
  shouldRoutePublicSeedanceToBytePlus,
} from '@/server/video-providers/byteplus-modelark';
import {
  resolveVideoProviderRoutingPlan,
  shouldRouteKlingDirectSourceElementsToFal,
  type VideoProviderRoutingPlan,
} from '@/server/video-providers/router';
import { isKlingDirectEngine } from '@/server/video-providers/kling-direct/model-map';
import type { EngineCaps, Mode } from '@/types/engines';
import type { PaymentMode } from './initial-video-job';
import { isVideoMode } from './request-options';

export type GenerateRouteContext = {
  engine: EngineCaps;
  isBytePlusV1a: boolean;
  isPublicSeedanceBytePlus: boolean;
  jobId: string;
  mode: Mode;
  payment: { mode?: PaymentMode; paymentIntentId?: string | null };
  providerKey: string;
  providerRoutingPlan: VideoProviderRoutingPlan;
};

export type GenerateRouteContextResult =
  | { ok: true; context: GenerateRouteContext }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function resolveGenerateRouteContext(params: {
  body: Record<string, unknown>;
  req: NextRequest;
}): Promise<GenerateRouteContextResult> {
  const { body, req } = params;
  const requestedEngineId = String(body.engineId || '');
  const publicEngine = await getConfiguredEngine(requestedEngineId);
  const engine =
    publicEngine ??
    (isBytePlusSeedanceFastEngine(requestedEngineId)
      ? await getConfiguredEngineIncludingHidden(requestedEngineId)
      : undefined);
  if (!engine) {
    const disabledEngine = await getConfiguredEngine(requestedEngineId, true);
    if (disabledEngine) {
      console.info('[api/generate] runtime lock active; generation blocked', { engineId: requestedEngineId });
      return { ok: false, status: 400, body: { ok: false, error: 'Engine unavailable' } };
    }
    return { ok: false, status: 400, body: { ok: false, error: 'Unknown engine' } };
  }

  const requestedJobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : null;
  const jobId = requestedJobId ?? `job_${randomUUID()}`;
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  const mode: Mode = isVideoMode(rawMode)
    ? rawMode
    : engine.modes.includes('t2v')
      ? 't2v'
      : engine.modes[0] ?? 't2v';

  const isPublicSeedanceBytePlus = shouldRoutePublicSeedanceToBytePlus(engine.id);
  const isPublicSeedanceFastBytePlus = shouldRoutePublicSeedanceFastToBytePlus(engine.id);
  const isBytePlusV1a =
    isBytePlusSeedanceFastEngine(engine.id) || isPublicSeedanceFastBytePlus || isPublicSeedanceBytePlus;

  if (isBytePlusV1a && !isBytePlusModelArkEnabled()) {
    return { ok: false, status: 404, body: { ok: false, error: 'Engine unavailable' } };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, status: 503, body: { ok: false, error: 'Database unavailable' } };
  }

  try {
    await ensureBillingSchema();
  } catch {
    return { ok: false, status: 503, body: { ok: false, error: 'Database unavailable' } };
  }

  let isAdminForKlingDirect = false;
  if (!isBytePlusV1a && isKlingDirectEngine(engine.id)) {
    try {
      await requireAdmin(req);
      isAdminForKlingDirect = true;
    } catch {
      isAdminForKlingDirect = false;
    }
  }
  let providerRoutingPlan: VideoProviderRoutingPlan = isBytePlusV1a
    ? ({ kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false } as const)
    : resolveVideoProviderRoutingPlan({ engineId: engine.id, mode, isAdmin: isAdminForKlingDirect });
  if (
    shouldRouteKlingDirectSourceElementsToFal({
      providerRoutingPlan,
      elementCount: Array.isArray(body.elements) ? body.elements.length : 0,
    })
  ) {
    providerRoutingPlan = { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false };
  }
  const providerKey = isBytePlusV1a ? BYTEPLUS_MODELARK_PROVIDER : providerRoutingPlan.primaryProvider;

  const bytePlusRequiresAdmin =
    isBytePlusV1a && (isPublicSeedanceBytePlus ? seedanceBytePlusAdminOnly() : seedanceFastBytePlusAdminOnly());
  if (bytePlusRequiresAdmin) {
    try {
      await requireAdmin(req);
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return { ok: false, status: error.status, body: { ok: false, error: error.message } };
      }
      console.error('[api/generate] failed to check BytePlus admin access', error);
      return { ok: false, status: 500, body: { ok: false, error: 'Server error' } };
    }
  }

  const bytePlusModeAllowed = isPublicSeedanceBytePlus
    ? isSeedanceBytePlusModeAllowed(mode)
    : isSeedanceFastBytePlusModeAllowed(mode);
  if (isBytePlusV1a && !bytePlusModeAllowed) {
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
      isPublicSeedanceBytePlus,
      jobId,
      mode,
      payment,
      providerKey,
      providerRoutingPlan,
    },
  };
}
