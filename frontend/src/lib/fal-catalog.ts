import fs from 'node:fs/promises';
import path from 'node:path';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import { ENV } from '@/lib/env';

const API_BASE = 'https://api.fal.ai/v1';
const CATALOG_TTL_MS = 5 * 60 * 1000;

const ENGINE_ID_OVERRIDES: Record<string, string> = {
  'fal-ai/video/pika-2-2': 'pika-22',
  'fal-ai/video/luma-dream-machine': 'luma-dm',
  'fal-ai/video/veo-3': 'veo-3',
};

const DEFAULT_MODEL_MAP: Record<string, string> = {
  'pika-22': 'fal-ai/video/pika-2-2',
  'pika22': 'fal-ai/video/pika-2-2',
  'pika22_keyframes': 'fal-ai/video/pika-2-2-keyframes',
  'luma-dm': 'fal-ai/video/luma-dream-machine',
  'lumadm': 'fal-ai/video/luma-dream-machine',
  'lumadm_fast': 'fal-ai/video/luma-dream-machine-fast',
  'lumaDM_fast': 'fal-ai/video/luma-dream-machine-fast',
  'veo-3': 'fal-ai/video/veo-3',
  'veo3': 'fal-ai/video/veo-3',
  'veo3fast': 'fal-ai/video/veo-3-fast',
  'veo-3-fast': 'fal-ai/video/veo-3-fast',
  'minimax': 'fal-ai/video/minimax',
  'kling25_turbo': 'fal-ai/video/kling-2-5-turbo',
  'haiper_video': 'fal-ai/video/haiper-video',
  'hunyuan_video': 'fal-ai/video/hunyuan-video',
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
  return ENGINE_ID_OVERRIDES[modelId] ?? modelId.split('/').slice(-1)[0];
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
  };

  return { engine, pricing: pricingDetails, slug };
}

function extractPricingDetails(pricingRaw: Record<string, unknown>, maxDurationSec: number): EnginePricingDetails {
  const currency = String(pricingRaw.currency ?? pricingRaw.currency_code ?? 'USD');

  const defaultPerSecond =
    toNumber(pricingRaw.per_second_cents) ??
    (pricingRaw.per_second != null ? Math.round((toNumber(pricingRaw.per_second) ?? 0) * 100) : undefined) ??
    (pricingRaw.perSecond != null ? Math.round((toNumber(pricingRaw.perSecond) ?? 0) * 100) : undefined);

  const resolutionsRaw = pricingRaw.resolutions ?? pricingRaw.by_resolution ?? pricingRaw.byResolution;
  const perResolution: Record<string, number> = {};
  const flatByResolution: Record<string, number> = {};
  if (resolutionsRaw && typeof resolutionsRaw === 'object') {
    for (const [key, entry] of Object.entries(resolutionsRaw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const perSecond = toNumber((entry as Record<string, unknown>).per_second_cents) ?? toNumber((entry as Record<string, unknown>).per_second);
      if (perSecond != null) {
        const cents = (entry as Record<string, unknown>).per_second_cents != null ? Math.round(Number(perSecond)) : Math.round(perSecond * 100);
        perResolution[key] = cents;
      }
      const flat = toNumber((entry as Record<string, unknown>).flat_cents) ?? toNumber((entry as Record<string, unknown>).flat);
      if (flat != null) {
        const cents = (entry as Record<string, unknown>).flat_cents != null ? Math.round(Number(flat)) : Math.round(flat * 100);
        flatByResolution[key] = cents;
      }
    }
  }

  const flatDefaultRaw = toNumber(pricingRaw.flat_cents) ?? toNumber(pricingRaw.flat) ?? toNumber(pricingRaw.base_cents) ?? toNumber(pricingRaw.base);
  const flatDefaultCents =
    flatDefaultRaw != null
      ? pricingRaw.flat_cents != null || pricingRaw.base_cents != null
        ? Math.round(Number(flatDefaultRaw))
        : Math.round(flatDefaultRaw * 100)
      : undefined;

  const addonsRaw = pricingRaw.addons ?? pricingRaw.add_ons ?? pricingRaw.features;
  const addons: EnginePricingDetails['addons'] = {};
  if (addonsRaw && typeof addonsRaw === 'object') {
    for (const [key, value] of Object.entries(addonsRaw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const perSecond = toNumber((value as Record<string, unknown>).per_second_cents) ?? toNumber((value as Record<string, unknown>).per_second);
      const flat = toNumber((value as Record<string, unknown>).flat_cents) ?? toNumber((value as Record<string, unknown>).flat);
      const perSecondCents =
        perSecond != null
          ? (value as Record<string, unknown>).per_second_cents != null
            ? Math.round(Number(perSecond))
            : Math.round(perSecond * 100)
          : undefined;
      const flatCents =
        flat != null
          ? (value as Record<string, unknown>).flat_cents != null
            ? Math.round(Number(flat))
            : Math.round(flat * 100)
          : undefined;
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
    const res = await fetch(`${API_BASE}/models`, {
      headers: {
        Authorization: `Key ${ENV.FAL_API_KEY}`,
      },
    });
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
    const file = path.join(process.cwd(), '..', 'fixtures', 'fal-models.json');
    const raw = await fs.readFile(file, 'utf-8');
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
