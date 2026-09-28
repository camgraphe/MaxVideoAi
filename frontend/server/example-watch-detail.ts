import { listFalEngines } from '@/config/falEngines';
import type { VideoSeoEditorialEntry } from '@/config/video-seo-editorial';
import { getBaseEngines } from '@/lib/engines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildEngineAddonInput } from '@/lib/pricing-addons';
import type { PricingContext } from '@/lib/pricing-context';
import { buildExampleRecreationHref, normalizeExampleResolution, parseExampleRecreationSettings, publicExampleResolution } from '@/lib/example-recreation';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { buildExampleRecreationSnapshot } from '@/app/(core)/(workspace)/app/_lib/workspace-example-recreation';
import { deriveWatchPageSignals } from './watch-page-signals';
import { parseSnapshot } from './watch-page-signals/snapshot';
import type { GalleryVideo } from './videos-normalization';

type Quote = (context: PricingContext) => Promise<{ totalCents: number; currency: string }>;

/** Explicit public DTO: never serialize ownership or the raw generation snapshot. */
export async function projectExampleWatchDetail(video: GalleryVideo, editorial: VideoSeoEditorialEntry | null, quote: Quote): Promise<ExampleWatchDetail | null> {
  if (video.visibility !== 'public' || !video.indexable || !video.videoUrl) return null;
  const signals = deriveWatchPageSignals({ video, editorial });
  const snapshot = parseSnapshot(video);
  const measuredResolution = publicExampleResolution(video.outputWidth ?? undefined, video.outputHeight ?? undefined);
  // Measured output wins over authored settings. Unknown measured sizes cannot claim a different resolution.
  const resolution = video.outputWidth && video.outputHeight ? measuredResolution : snapshot.core.resolution;
  const ratio = video.outputWidth && video.outputHeight ? video.outputWidth / video.outputHeight : Number((snapshot.core.aspectRatio ?? '').split(':')[0]) / Number((snapshot.core.aspectRatio ?? '').split(':')[1]);
  const aspectRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].find(value => {
    const [w, h] = value.split(':').map(Number); return Math.abs(ratio / (w / h) - 1) < 0.02;
  });
  const proposed = { durationSec: video.durationSec, resolution: resolution ?? '', aspectRatio: aspectRatio ?? '', audio: video.hasAudio, mode: 't2v' as const };
  const scenario = parseExampleRecreationSettings(new URLSearchParams(buildExampleRecreationHref(video.id, video.engineId, proposed).split('?')[1]));
  const published = new Set(listFalEngines().filter(entry => entry.surfaces.app.enabled && entry.surfaces.modelPage.indexable).map(entry => entry.id));
  const engines = getBaseEngines().filter(engine => published.has(engine.id));
  const sourceId = normalizeEngineId(video.engineId) ?? video.engineId;
  const quotes = scenario ? (await Promise.all(engines.map(async engine => {
    const href = buildExampleRecreationHref(video.id, engine.id, scenario);
    const shared = { ...video, outputWidth: video.outputWidth ?? undefined, outputHeight: video.outputHeight ?? undefined };
    if (!buildExampleRecreationSnapshot(shared, href.split('?')[1], engines)) return null;
    // Pricing catalog spelling and app provider spelling can differ (4k / 2160p).
    const quoteResolution = engine.resolutions.find(value => normalizeExampleResolution(value) === scenario.resolution);
    if (!quoteResolution) return null;
    try {
      const result = await quote({ engine, durationSec: scenario.durationSec, durationOption: scenario.durationSec,
        resolution: quoteResolution, aspectRatio: scenario.aspectRatio, mode: 't2v', referenceImageCount: 0,
        addons: buildEngineAddonInput(engine, { audioEnabled: scenario.audio }) });
      if (!Number.isFinite(result.totalCents) || result.totalCents < 0 || !/^[A-Z]{3}$/.test(result.currency)) return null;
      return { engineId: engine.id, label: engine.label, amountCents: result.totalCents, currency: result.currency, href, original: engine.id === sourceId };
    } catch { return null; }
  }))).filter(value => value !== null) : [];
  const ownQuote = quotes.find(value => value.original);
  const baseline = ownQuote?.amountCents ?? video.finalPriceCents ?? 0;
  const alternatives = quotes.filter(value => !value.original && (!ownQuote || value.currency === ownQuote.currency))
    .sort((a, b) => Math.abs(a.amountCents - baseline) - Math.abs(b.amountCents - baseline) || a.engineId.localeCompare(b.engineId)).slice(0, 3);
  return {
    id: video.id, title: signals.title, prompt: signals.promptText, videoUrl: video.videoUrl,
    posterUrl: video.thumbUrl ?? null, engineLabel: signals.engineLabel,
    watchHref: new URL(signals.canonicalUrl).pathname, modelHref: signals.modelPath,
    recreateHref: engines.some(engine => engine.id === sourceId) ? signals.recreatePath : null,
    aspectRatio: video.outputWidth && video.outputHeight ? `${video.outputWidth}:${video.outputHeight}` : video.aspectRatio ?? '16:9',
    durationSec: video.durationSec, hasAudio: video.hasAudio,
    historicalCost: typeof video.finalPriceCents === 'number' && video.currency ? { amountCents: video.finalPriceCents, currency: video.currency } : null,
    scenario, quotes: [...(ownQuote ? [ownQuote] : []), ...alternatives],
    references: signals.sourceImages.map(({ key, label, url, alt }) => ({ key, label, url, alt })),
  };
}
