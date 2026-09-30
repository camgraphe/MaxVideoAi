import { getFalEngineById, type FalEngineEntry } from '@/config/falEngines';
import { resolveRuntimeEngineInput } from '@/config/model-runtime';
import type { PricingContext } from '@/lib/pricing-context';
import type { Mode, PricingSnapshot } from '@/types/engines';
import type { GalleryVideo } from '@/server/videos';
import { computeCurrentPublicSnapshot } from '@/server/pricing/quote-public';

export type CurrentExamplePrice =
  | { kind: 'exact' | 'reference'; amountCents: number; currency: string; modelId: string; scenarioLabel: string; revision?: string }
  | { kind: 'unavailable'; modelId: string | null };

export type CurrentExampleQuoteDependencies = {
  quote?: typeof computeCurrentPublicSnapshot;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function supportedDuration(entry: FalEngineEntry, mode: Mode, seconds: number): boolean {
  const duration = entry.modes.find((candidate) => candidate.mode === mode)?.ui.duration;
  if (!duration) return seconds <= entry.engine.maxDurationSec;
  if ('options' in duration) return duration.options.some((value) => Number(value) === seconds);
  return seconds >= duration.min && seconds <= entry.engine.maxDurationSec;
}

function defaultDuration(entry: FalEngineEntry): number | null {
  const duration = entry.modes.find((candidate) => candidate.mode === 't2v')?.ui.duration;
  const proposed = duration && 'default' in duration ? Number(duration.default) : NaN;
  if (Number.isFinite(proposed) && proposed > 0 && supportedDuration(entry, 't2v', proposed)) return proposed;
  if (duration && 'options' in duration) {
    const first = Number(duration.options[0]);
    if (Number.isFinite(first) && first > 0) return first;
  }
  const hinted = entry.pricingHint?.durationSeconds;
  return hinted && supportedDuration(entry, 't2v', hinted) ? hinted : null;
}

function scenarioLabel(mode: Mode, durationSec: number, resolution: string): string {
  const modeName = mode === 't2v' ? 'Text to video' : mode === 'i2v' ? 'Image to video' : mode;
  return `${modeName} · ${durationSec}s · ${resolution}`;
}

function hasUnpricedPrivateInputs(settings: Record<string, unknown>): boolean {
  const refs = record(settings.refs);
  if (refs && Object.values(refs).some((value) =>
    (typeof value === 'string' && Boolean(value.trim())) ||
    (Array.isArray(value) && value.length > 0)
  )) return true;
  return ['inputVideoDurationSec', 'referenceTokenBudget', 'verifiedReferenceTokenCount', 'inputImageCount', 'referenceImageCount']
    .some((key) => positiveNumber(settings[key]) != null);
}

function exactContext(video: GalleryVideo, entry: FalEngineEntry): PricingContext | null {
  const settings = record(video.settingsSnapshot);
  const core = record(settings?.core);
  const mode = settings?.inputMode;
  const durationSec = positiveNumber(core?.durationSec);
  const resolution = core?.resolution;
  const aspectRatio = core?.aspectRatio;
  // Unknown saved controls may affect price. A same-model reference is safer
  // than claiming that an incomplete projection reproduces the old render.
  const knownSettings = new Set(['inputMode', 'core', 'refs']);
  const knownCore = new Set(['durationSec', 'resolution', 'aspectRatio', 'audio']);
  if (!settings || !core || typeof mode !== 'string' || !entry.engine.modes.includes(mode as Mode) ||
      Object.keys(settings).some((key) => !knownSettings.has(key)) ||
      Object.keys(core).some((key) => !knownCore.has(key)) ||
      mode !== 't2v' || durationSec == null || durationSec !== video.durationSec ||
      !supportedDuration(entry, mode as Mode, durationSec) ||
      typeof resolution !== 'string' || !entry.engine.resolutions.some((supported) => supported === resolution) ||
      typeof aspectRatio !== 'string' || !entry.engine.aspectRatios.some((supported) => supported === aspectRatio) ||
      (entry.engine.audio && typeof core.audio !== 'boolean') ||
      hasUnpricedPrivateInputs(settings)) return null;

  return {
    engine: entry.engine,
    durationSec,
    resolution,
    aspectRatio,
    mode: mode as Mode,
    referenceImageCount: 0,
    inputImageCount: 0,
    ...(entry.engine.audio && core.audio === false ? { addons: { audio_off: true } } : {}),
  };
}

function referenceContext(entry: FalEngineEntry): PricingContext | null {
  if (!entry.engine.modes.includes('t2v')) return null;
  const durationSec = defaultDuration(entry);
  const hintedResolution = entry.pricingHint?.resolution;
  const resolution = hintedResolution && entry.engine.resolutions.some((supported) => supported === hintedResolution)
    ? hintedResolution
    : entry.engine.resolutions[0];
  if (durationSec == null || !resolution) return null;
  return {
    engine: entry.engine,
    durationSec,
    resolution,
    mode: 't2v',
    aspectRatio: entry.engine.aspectRatios[0] ?? null,
    referenceImageCount: 0,
    inputImageCount: 0,
  };
}

function priceFromSnapshot(snapshot: PricingSnapshot, kind: 'exact' | 'reference', entry: FalEngineEntry, context: PricingContext): CurrentExamplePrice {
  if (!Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents < 0 || !snapshot.currency?.trim()) {
    return { kind: 'unavailable', modelId: entry.id };
  }
  const revision = snapshot.meta?.customerTariffRevision;
  return {
    kind,
    modelId: entry.id,
    amountCents: snapshot.totalCents,
    currency: snapshot.currency,
    scenarioLabel: scenarioLabel(context.mode ?? 't2v', context.durationSec, context.resolution),
    ...(typeof revision === 'string' ? { revision } : {}),
  };
}

export async function quoteCurrentExamplePrice(
  video: GalleryVideo,
  dependencies: CurrentExampleQuoteDependencies = {},
): Promise<CurrentExamplePrice> {
  const model = resolveRuntimeEngineInput(video.engineId);
  const modelId = model?.id ?? null;
  if (!model?.publication.app.published) return { kind: 'unavailable', modelId };
  const entry = getFalEngineById(model.id);
  if (!entry || entry.category === 'image') return { kind: 'unavailable', modelId };
  const exact = exactContext(video, entry);
  const context = exact ?? referenceContext(entry);
  if (!context) return { kind: 'unavailable', modelId };
  try {
    const snapshot = await (dependencies.quote ?? computeCurrentPublicSnapshot)(context);
    return priceFromSnapshot(snapshot, exact ? 'exact' : 'reference', entry, context);
  } catch {
    return { kind: 'unavailable', modelId };
  }
}

export async function quoteCurrentExamplePrices(
  videos: readonly GalleryVideo[],
  dependencies: CurrentExampleQuoteDependencies = {},
): Promise<Map<string, CurrentExamplePrice>> {
  const quote = dependencies.quote ?? computeCurrentPublicSnapshot;
  const pending = new Map<string, Promise<PricingSnapshot>>();
  const cachedQuote = (context: PricingContext): Promise<PricingSnapshot> => {
    const key = JSON.stringify([
      context.engine.id, context.mode, context.durationSec, context.resolution,
      context.aspectRatio, context.referenceImageCount, context.inputImageCount, context.addons,
    ]);
    const existing = pending.get(key);
    if (existing) return existing;
    const result = quote(context);
    pending.set(key, result);
    return result;
  };
  const prices = await Promise.all(videos.map(async (video) => [
    video.id,
    await quoteCurrentExamplePrice(video, { quote: cachedQuote }),
  ] as const));
  return new Map(prices);
}
