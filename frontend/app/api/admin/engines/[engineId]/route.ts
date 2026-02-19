import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { upsertEngineOverride } from '@/server/engine-overrides';
import {
  ensureEngineSettingsSeed,
  fetchEngineSettings,
  removeEngineSettings,
  upsertEngineSettings,
} from '@/server/engine-settings';
import { getConfiguredEngine } from '@/server/engines';
import type { EnginePricingDetails } from '@/types/engines';

export const runtime = 'nodejs';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeOptions(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (typeof payload.label === 'string') result.label = payload.label.trim();
  if (typeof payload.provider === 'string') result.provider = payload.provider.trim();
  if (typeof payload.maxDurationSec === 'number') result.maxDurationSec = Math.max(1, Math.round(payload.maxDurationSec));
  if (Array.isArray(payload.modes)) {
    result.modes = payload.modes.filter((entry) => typeof entry === 'string');
  }
  if (Array.isArray(payload.resolutions)) {
    result.resolutions = payload.resolutions.filter((entry) => typeof entry === 'string');
  }
  if (Array.isArray(payload.aspectRatios)) {
    result.aspectRatios = payload.aspectRatios.filter((entry) => typeof entry === 'string');
  }
  if (Array.isArray(payload.fps)) {
    result.fps = payload.fps
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
      .map((entry) => Math.round(Number(entry)));
  }
  if (typeof payload.audio === 'boolean') result.audio = payload.audio;
  if (typeof payload.upscale4k === 'boolean') result.upscale4k = payload.upscale4k;
  if (typeof payload.extend === 'boolean') result.extend = payload.extend;
  if (typeof payload.motionControls === 'boolean') result.motionControls = payload.motionControls;
  if (typeof payload.keyframes === 'boolean') result.keyframes = payload.keyframes;
  if (typeof payload.availability === 'string') result.availability = payload.availability;
  if (typeof payload.latencyTier === 'string') result.latencyTier = payload.latencyTier;
  if (typeof payload.apiAvailability === 'string') result.apiAvailability = payload.apiAvailability;
  if (typeof payload.brandId === 'string') result.brandId = payload.brandId;

  if (isPlainObject(payload.inputLimits)) {
    const limits: Record<string, unknown> = {};
    if (payload.inputLimits.imageMaxMB != null) {
      const value = Number(payload.inputLimits.imageMaxMB);
      if (Number.isFinite(value)) limits.imageMaxMB = value;
    }
    if (payload.inputLimits.videoMaxMB != null) {
      const value = Number(payload.inputLimits.videoMaxMB);
      if (Number.isFinite(value)) limits.videoMaxMB = value;
    }
    if (payload.inputLimits.videoMaxDurationSec != null) {
      const value = Number(payload.inputLimits.videoMaxDurationSec);
      if (Number.isFinite(value)) limits.videoMaxDurationSec = value;
    }
    if (Array.isArray(payload.inputLimits.videoCodecs)) {
      limits.videoCodecs = payload.inputLimits.videoCodecs.filter((entry: unknown) => typeof entry === 'string');
    }
    if (Object.keys(limits).length > 0) {
      result.inputLimits = limits;
    }
  }

  if (isPlainObject(payload.params)) {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload.params)) {
      if (!isPlainObject(value)) continue;
      const param: Record<string, unknown> = {};
      if (value.min != null && Number.isFinite(Number(value.min))) param.min = Number(value.min);
      if (value.max != null && Number.isFinite(Number(value.max))) param.max = Number(value.max);
      if (value.default != null && Number.isFinite(Number(value.default))) param.default = Number(value.default);
      if (value.step != null && Number.isFinite(Number(value.step))) param.step = Number(value.step);
      if (Object.keys(param).length > 0) {
        params[key] = param;
      }
    }
    if (Object.keys(params).length > 0) {
      result.params = params;
    }
  }

  return result;
}

function sanitizePricing(payload: Record<string, unknown>): EnginePricingDetails {
  const currency =
    typeof payload.currency === 'string' && payload.currency.trim()
      ? payload.currency.trim().toUpperCase()
      : 'USD';

  const perSecondCentsPayload = isPlainObject(payload.perSecondCents) ? payload.perSecondCents : undefined;
  const perSecond: EnginePricingDetails['perSecondCents'] | undefined = perSecondCentsPayload
    ? {
        default:
          perSecondCentsPayload.default != null && Number.isFinite(Number(perSecondCentsPayload.default))
            ? Math.max(0, Math.round(Number(perSecondCentsPayload.default)))
            : undefined,
        byResolution: isPlainObject(perSecondCentsPayload.byResolution)
          ? Object.fromEntries(
              Object.entries(perSecondCentsPayload.byResolution).reduce<Array<[string, number]>>((acc, [key, value]) => {
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                  acc.push([key, Math.max(0, Math.round(numeric))]);
                }
                return acc;
              }, [])
            )
          : undefined,
      }
    : undefined;

  const flatPayload = isPlainObject(payload.flatCents) ? payload.flatCents : undefined;
  const flatCents = flatPayload
    ? {
        default:
          flatPayload.default != null && Number.isFinite(Number(flatPayload.default))
            ? Math.max(0, Math.round(Number(flatPayload.default)))
            : undefined,
        byResolution: isPlainObject(flatPayload.byResolution)
          ? Object.fromEntries(
              Object.entries(flatPayload.byResolution).reduce<Array<[string, number]>>((acc, [key, value]) => {
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                  acc.push([key, Math.max(0, Math.round(numeric))]);
                }
                return acc;
              }, [])
            )
          : undefined,
      }
    : undefined;

  const maxDurationSec =
    payload.maxDurationSec != null && Number.isFinite(Number(payload.maxDurationSec))
      ? Math.max(1, Math.round(Number(payload.maxDurationSec)))
      : undefined;

  const details: EnginePricingDetails = {
    currency,
    perSecondCents: perSecond,
    flatCents,
    maxDurationSec,
  };

  return details;
}

export async function PATCH(req: NextRequest, { params }: { params: { engineId: string } }) {
  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
  }

  const engineId = params.engineId?.trim();
  if (!engineId) {
    return NextResponse.json({ error: 'Missing engineId' }, { status: 400 });
  }

  await ensureEngineSettingsSeed(adminId);

  const engine = await getConfiguredEngine(engineId, true);
  if (!engine) {
    return NextResponse.json({ error: 'Unknown engine' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const settingsMap = await fetchEngineSettings();
  const currentSettings = settingsMap.get(engineId) ?? null;

  let nextOptions = currentSettings?.options ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'options')) {
    if (body.options === null) {
      nextOptions = null;
    } else if (isPlainObject(body.options)) {
      nextOptions = sanitizeOptions(body.options);
    } else {
      return NextResponse.json({ error: 'Invalid options payload' }, { status: 400 });
    }
  }

  let nextPricing = currentSettings?.pricing ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'pricing')) {
    if (body.pricing === null) {
      nextPricing = null;
    } else if (isPlainObject(body.pricing)) {
      nextPricing = sanitizePricing(body.pricing);
    } else {
      return NextResponse.json({ error: 'Invalid pricing payload' }, { status: 400 });
    }
  }

  const overrideSource = isPlainObject(body.override) ? body.override : body;
  const hasActive = Object.prototype.hasOwnProperty.call(overrideSource, 'active');
  const hasAvailability = Object.prototype.hasOwnProperty.call(overrideSource, 'availability');
  const hasStatus = Object.prototype.hasOwnProperty.call(overrideSource, 'status');
  const hasLatency = Object.prototype.hasOwnProperty.call(overrideSource, 'latencyTier');

  const active =
    hasActive && typeof overrideSource.active === 'boolean' ? overrideSource.active : undefined;
  const availability =
    hasAvailability && typeof overrideSource.availability === 'string'
      ? overrideSource.availability
      : undefined;
  const status =
    hasStatus && typeof overrideSource.status === 'string' ? overrideSource.status : undefined;
  const latencyTier =
    hasLatency && typeof overrideSource.latencyTier === 'string'
      ? overrideSource.latencyTier
      : undefined;

  const shouldUpdateOverride = hasActive || hasAvailability || hasStatus || hasLatency;

  try {
    if (body.reset === true) {
      await removeEngineSettings(engineId);
    } else if (Object.prototype.hasOwnProperty.call(body, 'options') || Object.prototype.hasOwnProperty.call(body, 'pricing')) {
      await upsertEngineSettings(engineId, nextOptions, nextPricing as EnginePricingDetails | null, adminId);
    }

    if (shouldUpdateOverride) {
      await upsertEngineOverride(
        engineId,
        {
          active,
          availability: availability ?? null,
          status: status ?? null,
          latency_tier: latencyTier ?? null,
        },
        adminId
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updated = await getConfiguredEngine(engineId, true);
  return NextResponse.json({ ok: true, engine: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { engineId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
  }

  const engineId = params.engineId?.trim();
  if (!engineId) {
    return NextResponse.json({ error: 'Missing engineId' }, { status: 400 });
  }

  await removeEngineSettings(engineId);
  return NextResponse.json({ ok: true });
}
