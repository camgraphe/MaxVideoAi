import fs from 'node:fs/promises';
import path from 'node:path';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import { ENV } from '@/lib/env';
import { buildFalProxyUrl } from '@/lib/fal-proxy';

const CATALOG_TTL_MS = 5 * 60 * 1000;

const ENGINE_ID_OVERRIDES: Record<string, string> = {
  'fal-ai/pika/v2.2/text-to-video': 'pika22',
  'fal-ai/pika/v2.2/image-to-video': 'pika22',
  'fal-ai/luma-dream-machine': 'lumaDM',
  'fal-ai/luma-dream-machine/image-to-video': 'lumaDM',
  'fal-ai/luma-dream-machine/modify': 'lumaDM',
  'fal-ai/luma-dream-machine/ray-2': 'lumaRay2',
  'fal-ai/luma-dream-machine/ray-2/image-to-video': 'lumaRay2',
  'fal-ai/luma-dream-machine/ray-2/modify': 'lumaRay2_modify',
  'fal-ai/luma-dream-machine/ray-2/reframe': 'lumaRay2_reframe',
  'fal-ai/luma-dream-machine/ray-2-flash': 'lumaRay2_flash',
  'fal-ai/luma-dream-machine/ray-2-flash/image-to-video': 'lumaRay2_flash',
  'fal-ai/luma-dream-machine/ray-2-flash/reframe': 'lumaRay2_flash_reframe',
  'fal-ai/veo3': 'veo3',
  'fal-ai/veo3/image-to-video': 'veo3',
  'fal-ai/veo3/fast': 'veo3fast',
  'fal-ai/minimax/video-01': 'minimax_video_01',
  'fal-ai/minimax/hailuo-02/pro': 'minimax_hailuo_02_pro',
  'fal-ai/hunyuan-video': 'hunyuan_video',
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video': 'kling25_turbo_pro',
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': 'kling25_turbo_pro',
  'fal-ai/sora-2/text-to-video': 'sora-2',
  'fal-ai/sora-2/text-to-video/pro': 'sora-2-pro',
  'fal-ai/sora-2/image-to-video': 'sora-2',
  'fal-ai/sora-2/image-to-video/pro': 'sora-2-pro'
};

const DEFAULT_MODEL_MAP: Record<string, string> = {
  'sora-2': 'fal-ai/sora-2/text-to-video',
  'sora2': 'fal-ai/sora-2/text-to-video',
  'sora-2-pro': 'fal-ai/sora-2/text-to-video/pro',
  'sora2pro': 'fal-ai/sora-2/text-to-video/pro',
  'veo3': 'fal-ai/veo3',
  'veo3fast': 'fal-ai/veo3/fast',
  'kling25_turbo_pro': 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
  'lumaDM': 'fal-ai/luma-dream-machine',
  'lumaRay2': 'fal-ai/luma-dream-machine/ray-2',
  'lumaRay2_flash': 'fal-ai/luma-dream-machine/ray-2-flash',
  'lumaRay2_modify': 'fal-ai/luma-dream-machine/ray-2/modify',
  'lumaRay2_reframe': 'fal-ai/luma-dream-machine/ray-2/reframe',
  'lumaRay2_flash_reframe': 'fal-ai/luma-dream-machine/ray-2-flash/reframe',
  'pika-22': 'fal-ai/pika/v2.2/text-to-video',
  'pika22': 'fal-ai/pika/v2.2/text-to-video',
  'minimax_video_01': 'fal-ai/minimax/video-01',
  'minimax_hailuo_02_pro': 'fal-ai/minimax/hailuo-02/pro',
  'hunyuan_video': 'fal-ai/hunyuan-video'
};

type EngineCatalog = {
  engines: EngineCaps[];
  modelMap: Record<string, string>;
  pricing: Record<string, EnginePricingDetails>;
  fetchedAt: number;
};

type FalModel = Record<string, unknown>;

let catalogCache: EngineCatalog | null = null;

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  return [];
}

function toNumberArray(value: unknown): number[] {
  return toStringArray(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function normaliseResolution(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower === '1080' || lower === '1080p') return '1080p';
  if (lower === '720' || lower === '720p') return '720p';
  if (lower === '4k' || lower === '2160' || lower === '2160p') return '4k';
  if (lower === '512' || lower === '512p') return '512P';
  if (lower === '768' || lower === '768p') return '768P';
  return value as string;
}

function normaliseAspectRatio(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes(':')) return trimmed;
  const parts = trimmed.split(':');
  if (parts.length !== 2) return trimmed;
  return `${parts[0]}:${parts[1]}`;
}

function deriveEngineId(modelId: string): string {
  if (ENGINE_ID_OVERRIDES[modelId]) {
    return ENGINE_ID_OVERRIDES[modelId]!;
  }
  for (const [engineId, mappedSlug] of Object.entries(DEFAULT_MODEL_MAP)) {
    if (mappedSlug === modelId) {
      return engineId;
    }
  }
  return modelId.split('/').slice(-1)[0];
}

function mapFalModel(model: FalModel): { engine: EngineCaps; pricing: EnginePricingDetails; slug: string } | null {
  const slug = String(model.id ?? model.slug ?? model.name ?? '').trim();
  if (!slug) return null;
  const engineId = deriveEngineId(slug);
  const displayName = String(model.display_name ?? model.label ?? model.title ?? engineId).trim();
  const provider = String(model.provider ?? model.publisher ?? slug.split('/')[1] ?? 'unknown').trim();
  const version = model.version ? String(model.version) : undefined;
  const status = String(model.status ?? 'live') as EngineCaps['status'];
  const latencyTier = (String(model.latency_tier ?? model.latency ?? 'standard').toLowerCase() === 'fast' ? 'fast' : 'standard') as EngineCaps['latencyTier'];
  const queueDepth = toNumber(model.queue_depth);
  const region = model.region ? String(model.region) : undefined;
  const vendorAccountId = model.vendor_account_id ? String(model.vendor_account_id) : undefined;
  const modes = toStringArray(model.modes ?? model.supported_modes);
  const capabilities = (model.capabilities as Record<string, unknown>) || {};
  const maxDurationSec = toNumber(capabilities.max_duration_seconds ?? capabilities.max_duration_sec ?? model.max_duration_sec ?? model.max_duration_seconds) ?? 8;
  const resolutions = toStringArray(capabilities.resolutions ?? model.resolutions ?? model.supported_resolutions).map(normaliseResolution);
  const aspectRatios = toStringArray(capabilities.aspect_ratios ?? capabilities.ratios ?? model.aspect_ratios ?? ['16:9']).map(normaliseAspectRatio);
  const fps = toNumberArray(capabilities.fps ?? capabilities.frames_per_second ?? model.fps ?? [24]);
  const audioCapable = toBoolean(capabilities.audio ?? capabilities.enable_audio ?? model.audio);
  const upscaleCapable = toBoolean(capabilities.upscale_4k ?? capabilities.upscale ?? model.upscale4k ?? model.upscale);
  const extendCapable = toBoolean(capabilities.extend ?? model.extend);
  const motionControls = toBoolean(capabilities.motion_controls ?? capabilities.motion ?? model.motionControls);
  const keyframes = toBoolean(capabilities.keyframes ?? capabilities.key_frames ?? model.keyframes);
  const params = (model.params as EngineCaps['params']) ?? {};
  const inputLimits = (model.input_limits as EngineCaps['inputLimits']) ?? {};
  const updatedAt = String(model.updated_at ?? model.modified_at ?? new Date().toISOString());
  const ttlSec = toNumber(model.ttl_sec ?? model.ttl_seconds) ?? 300;

  const pricingRaw = (model.pricing as Record<string, unknown>) ?? {};
  const pricingDetails = extractPricingDetails(pricingRaw, maxDurationSec);

  const engine: EngineCaps = {
    id: engineId,
    label: displayName,
    provider,
    version,
    status: (['live', 'busy', 'degraded', 'maintenance', 'early_access'].includes(status) ? status : 'live') as EngineCaps['status'],
    latencyTier,
    queueDepth: queueDepth ?? undefined,
    region,
    vendorAccountId,
    modes: modes.length ? (modes as EngineCaps['modes']) : ['t2v'],
    maxDurationSec: pricingDetails.maxDurationSec ?? maxDurationSec,
    resolutions: (resolutions.length ? (resolutions as EngineCaps['resolutions']) : ['720p', '1080p']) as EngineCaps['resolutions'],
    aspectRatios: (aspectRatios.length ? (aspectRatios as EngineCaps['aspectRatios']) : ['16:9']) as EngineCaps['aspectRatios'],
    fps: fps.length ? fps : [24],
    audio: audioCapable,
    upscale4k: upscaleCapable,
    extend: extendCapable,
    motionControls,
    keyframes,
    params,
    inputLimits,
    pricing: {
      unit: 'sec',
      base: pricingDetails.perSecondCents?.default != null ? pricingDetails.perSecondCents.default / 100 : undefined,
      byResolution:
        pricingDetails.perSecondCents?.byResolution
          ? Object.fromEntries(
              Object.entries(pricingDetails.perSecondCents.byResolution).map(([key, value]) => [key, value / 100])
            )
          : undefined,
      notes: 'Fetched from Fal.ai',
      currency: pricingDetails.currency,
      addons: pricingDetails.addons
        ? Object.fromEntries(
            Object.entries(pricingDetails.addons)
              .filter((entry): entry is [string, NonNullable<(typeof pricingDetails.addons)[string]>] => {
                const [, value] = entry;
                return value != null;
              })
              .map(([key, value]) => [
                key,
                {
                  perSecond: value.perSecondCents != null ? value.perSecondCents / 100 : undefined,
                  flat: value.flatCents != null ? value.flatCents / 100 : undefined,
                },
              ])
          )
        : undefined,
    },
    apiAvailability: model.api_availability ? String(model.api_availability) : undefined,
    updatedAt,
    ttlSec,
    providerMeta: {
      provider,
      modelSlug: slug,
    },
    pricingDetails,
    availability: 'available',
  };

  return { engine, pricing: pricingDetails, slug };
}

function extractPricingDetails(pricingRaw: Record<string, unknown>, maxDurationSec: number): EnginePricingDetails {
  const currency = String(pricingRaw.currency ?? pricingRaw.currency_code ?? 'USD');

  const toCents = (value: unknown, hintIsCents = false, debugLabel?: string): number | undefined => {
    const numeric = toNumber(value);
    if (numeric == null || !Number.isFinite(numeric)) return undefined;
    if (hintIsCents) {
      return Math.round(numeric);
    }
    if (Number.isInteger(numeric)) {
      if (Math.abs(numeric) >= 1000) {
        const adjusted = Math.round(numeric / 100);
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[fal-catalog] large integer pricing detected for ${debugLabel ?? 'value'} (${numeric}); assuming cents and scaling down to ${adjusted}`
          );
        }
        return adjusted;
      }
      return Math.round(numeric);
    }
    return Math.round(numeric * 100);
  };

  const defaultPerSecond =
    toCents(pricingRaw.per_second_cents, true, 'per_second_cents') ??
    toCents(pricingRaw.per_second, false, 'per_second') ??
    toCents(pricingRaw.perSecond, false, 'perSecond');

  const resolutionsRaw = pricingRaw.resolutions ?? pricingRaw.by_resolution ?? pricingRaw.byResolution;
  const perResolution: Record<string, number> = {};
  const flatByResolution: Record<string, number> = {};
  if (resolutionsRaw && typeof resolutionsRaw === 'object') {
    for (const [key, entry] of Object.entries(resolutionsRaw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const perSecond =
        toCents((entry as Record<string, unknown>).per_second_cents, true, `${key}.per_second_cents`) ??
        toCents((entry as Record<string, unknown>).per_second, false, `${key}.per_second`);
      if (perSecond != null) {
        perResolution[key] = perSecond;
      }
      const flat =
        toCents((entry as Record<string, unknown>).flat_cents, true, `${key}.flat_cents`) ??
        toCents((entry as Record<string, unknown>).flat, false, `${key}.flat`);
      if (flat != null) {
        flatByResolution[key] = flat;
      }
    }
  }

  const flatDefaultCents =
    toCents(pricingRaw.flat_cents, true, 'flat_cents') ??
    toCents(pricingRaw.flat, false, 'flat') ??
    toCents(pricingRaw.base_cents, true, 'base_cents') ??
    toCents(pricingRaw.base, false, 'base');

  const addonsRaw = pricingRaw.addons ?? pricingRaw.add_ons ?? pricingRaw.features;
  const addons: EnginePricingDetails['addons'] = {};
  if (addonsRaw && typeof addonsRaw === 'object') {
    for (const [key, value] of Object.entries(addonsRaw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const perSecondCents =
        toCents((value as Record<string, unknown>).per_second_cents, true, `${key}.per_second_cents`) ??
        toCents((value as Record<string, unknown>).per_second, false, `${key}.per_second`);
      const flatCents =
        toCents((value as Record<string, unknown>).flat_cents, true, `${key}.flat_cents`) ??
        toCents((value as Record<string, unknown>).flat, false, `${key}.flat`);
      if (perSecondCents != null || flatCents != null) {
        addons![key] = { perSecondCents: perSecondCents ?? undefined, flatCents: flatCents ?? undefined };
      }
    }
  }

  return {
    currency,
    perSecondCents: {
      default: defaultPerSecond ?? undefined,
      byResolution: Object.keys(perResolution).length ? perResolution : undefined,
    },
    flatCents:
      flatDefaultCents != null || Object.keys(flatByResolution).length
        ? {
            default: flatDefaultCents ?? undefined,
            byResolution: Object.keys(flatByResolution).length ? flatByResolution : undefined,
          }
        : undefined,
    addons: addons && Object.keys(addons).length ? addons : undefined,
    maxDurationSec,
  };
}

async function fetchFalCatalogFromApi(): Promise<Omit<EngineCatalog, 'fetchedAt'> | null> {
  if (!ENV.FAL_API_KEY) return null;
  try {
    const res = await fetch(buildFalProxyUrl('/models'));
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    const models: FalModel[] = Array.isArray(json?.models) ? (json.models as FalModel[]) : Array.isArray(json) ? (json as FalModel[]) : [];
    if (!models.length) return null;
    const engines: EngineCaps[] = [];
    const mapping: Record<string, string> = {};
    const pricing: Record<string, EnginePricingDetails> = {};
    for (const model of models) {
      const mapped = mapFalModel(model);
      if (!mapped) continue;
      engines.push(mapped.engine);
      mapping[mapped.engine.id] = mapped.slug;
      pricing[mapped.engine.id] = mapped.pricing;
    }
    if (!engines.length) return null;
    return { engines, modelMap: mapping, pricing };
  } catch {
    return null;
  }
}

async function loadFixtureCatalog(): Promise<Omit<EngineCatalog, 'fetchedAt'> | null> {
  try {
    const candidates = [
      path.join(process.cwd(), 'fixtures', 'fal-models.json'),
      path.join(process.cwd(), '..', 'fixtures', 'fal-models.json'),
    ];
    let raw: string | null = null;
    for (const candidate of candidates) {
      try {
        raw = await fs.readFile(candidate, 'utf-8');
        break;
      } catch {
        // Try next location — monorepo vs standalone build layouts differ.
      }
    }
    if (!raw) return null;
    const json = JSON.parse(raw) as { models?: FalModel[] };
    const models = Array.isArray(json?.models) ? json.models : [];
    if (!models.length) return null;
    const engines: EngineCaps[] = [];
    const mapping: Record<string, string> = {};
    const pricing: Record<string, EnginePricingDetails> = {};
    for (const model of models) {
      const mapped = mapFalModel(model);
      if (!mapped) continue;
      engines.push(mapped.engine);
      mapping[mapped.engine.id] = mapped.slug;
      pricing[mapped.engine.id] = mapped.pricing;
    }
    if (!engines.length) return null;
    return { engines, modelMap: mapping, pricing };
  } catch {
    return null;
  }
}

export async function getFalCatalog(): Promise<EngineCatalog | null> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return catalogCache;
  }

  const attempts: Array<Promise<Omit<EngineCatalog, 'fetchedAt'> | null>> = [];
  if (ENV.FAL_API_KEY) {
    attempts.push(fetchFalCatalogFromApi());
  }
  attempts.push(loadFixtureCatalog());

  for (const attempt of attempts) {
    const result = await attempt;
    if (result && result.engines.length) {
      catalogCache = { ...result, fetchedAt: Date.now() };
      return catalogCache;
    }
  }

  return null;
}

export function getDefaultModelMap(): Record<string, string> {
  return { ...DEFAULT_MODEL_MAP };
}

export function invalidateFalCatalogCache(): void {
  catalogCache = null;
}

export async function resolveFalModelId(engineId: string): Promise<string | undefined> {
  const envKey = `FAL_MODEL_${engineId.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
  const override = process.env[envKey];
  if (override && override.trim()) {
    return override.trim();
  }
  const catalog = await getFalCatalog();
  if (catalog?.modelMap?.[engineId]) {
    return catalog.modelMap[engineId];
  }
  if (DEFAULT_MODEL_MAP[engineId]) {
    return DEFAULT_MODEL_MAP[engineId];
  }
  const normalized = engineId.replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase();
  return `fal-ai/video/${normalized}`;
}

export async function getPricingDetails(engineId: string): Promise<EnginePricingDetails | undefined> {
  const catalog = await getFalCatalog();
  if (catalog?.pricing?.[engineId]) {
    return catalog.pricing[engineId];
  }
  return undefined;
}
