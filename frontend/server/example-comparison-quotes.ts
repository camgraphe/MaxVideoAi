import { listFalEngines } from '@/config/falEngines';
import { getBaseEngines } from '@/lib/engines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildEngineAddonInput } from '@/lib/pricing-addons';
import type { PricingContext } from '@/lib/pricing-context';
import { buildExampleRecreationHref, normalizeExampleResolution, type ExampleRecreationSettings } from '@/lib/example-recreation';
import type { ExampleComparisonQuote } from '@/lib/example-watch-detail';
import { buildExampleRecreationSnapshot } from '@/app/(core)/(workspace)/app/_lib/workspace-example-recreation';
import { getModeCaps } from '@/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { GalleryVideo } from './videos-normalization';

export type ExampleQuoteProvider = (context: PricingContext) => Promise<{ totalCents: number; currency: string }>;
const pixels = (resolution: string) => resolution === '4k' ? 2160 : parseInt(resolution, 10);
const ratio = (aspect: string) => { const [w, h] = aspect.split(':').map(Number); return w / h; };
const compareRank = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.000001) return a[i] - b[i];
  return 0;
};

/** Find executable proposals first; quote once per model using the canonical price owner.
 * Duration takes precedence over format, resolution and audio. Unknown source settings
 * remain unknown: proposals show their own complete configuration instead.
 */
export async function buildExampleComparisonQuotes(video: GalleryVideo, source: ExampleRecreationSettings | null, quote: ExampleQuoteProvider): Promise<ExampleComparisonQuote[]> {
  const published = new Set(listFalEngines().filter(entry => entry.surfaces.app.enabled && entry.surfaces.modelPage.indexable).map(entry => entry.id));
  const engines = getBaseEngines().filter(engine => published.has(engine.id) && engine.modes.includes('t2v'));
  const sourceId = normalizeEngineId(video.engineId) ?? video.engineId;
  const targetDuration = Number.isFinite(video.durationSec) && video.durationSec > 0 ? video.durationSec : 5;
  const measuredRatio = video.outputWidth && video.outputHeight ? video.outputWidth / video.outputHeight : ratio(video.aspectRatio ?? '');
  const targetRatio = Number.isFinite(measuredRatio) && measuredRatio > 0 ? measuredRatio : 16 / 9;
  const targetPixels = source ? pixels(source.resolution) : video.outputWidth && video.outputHeight ? Math.min(video.outputWidth, video.outputHeight) : 720;
  const rank = (settings: ExampleRecreationSettings) => [Math.abs(settings.durationSec - targetDuration), Math.abs(Math.log(ratio(settings.aspectRatio) / targetRatio)), Math.abs(Math.log(pixels(settings.resolution) / targetPixels)), Number(settings.audio !== video.hasAudio)];
  const shared = { ...video, outputWidth: video.outputWidth ?? undefined, outputHeight: video.outputHeight ?? undefined };
  const results = await Promise.all(engines.map(async engine => {
    const caps = getModeCaps(engine, 't2v');
    const resolutions = [...new Set((caps?.resolution ?? engine.resolutions).map(normalizeExampleResolution))].filter(value => /^(480p|512p|540p|720p|768p|1080p|1440p|4k)$/.test(value));
    const aspects = (caps?.aspectRatio ?? engine.aspectRatios).filter(value => /^(16:9|9:16|1:1|4:3|3:4|21:9)$/.test(value));
    const audioOptions = engine.audio ? caps?.audioToggle ? [true, false] : [true] : [false];
    // The public URL contract accepts integer seconds up to 120. The workspace
    // validator below owns discrete durations, frame-based modes and coupled caps.
    const durations = Array.from({ length: Math.min(120, engine.maxDurationSec) }, (_, i) => i + 1).sort((a, b) => Math.abs(a - targetDuration) - Math.abs(b - targetDuration) || a - b);
    let selected: { settings: ExampleRecreationSettings; href: string } | undefined;
    for (const durationSec of durations) {
      const candidates = resolutions.flatMap(resolution => aspects.flatMap(aspectRatio => audioOptions.map(audio => ({ durationSec, resolution, aspectRatio, audio, mode: 't2v' as const })))).sort((a, b) => compareRank(rank(a), rank(b)));
      for (const settings of candidates) {
        const href = buildExampleRecreationHref(video.id, engine.id, settings);
        if (buildExampleRecreationSnapshot(shared, href.split('?')[1], engines)) { selected = { settings, href }; break; }
      }
      if (selected) break;
    }
    if (!selected) return null;
    const { settings, href } = selected;
    const resolution = engine.resolutions.find(value => normalizeExampleResolution(value) === settings.resolution);
    if (!resolution) return null;
    try {
      const result = await quote({ engine, durationSec: settings.durationSec, durationOption: settings.durationSec, resolution, aspectRatio: settings.aspectRatio, mode: 't2v', referenceImageCount: 0, addons: buildEngineAddonInput(engine, { audioEnabled: settings.audio }) });
      if (!Number.isFinite(result.totalCents) || result.totalCents < 0 || !/^[A-Z]{3}$/.test(result.currency)) return null;
      const known = { durationSec: video.durationSec, audio: video.hasAudio, resolution: source?.resolution, aspectRatio: source?.aspectRatio };
      const changed = (['durationSec', 'resolution', 'aspectRatio', 'audio'] as const).filter(key => settings[key] !== known[key]);
      return { engineId: engine.id, label: engine.label, amountCents: result.totalCents, currency: result.currency, href, original: engine.id === sourceId, settings, changed };
    } catch { return null; }
  }));
  const valid = results.filter(value => value !== null);
  const baseline = valid.find(value => value.original)?.amountCents ?? video.finalPriceCents ?? 0;
  const remaining = valid.sort((a, b) => compareRank(rank(a.settings), rank(b.settings)) || Number(b.original) - Number(a.original) || Math.abs(a.amountCents - baseline) - Math.abs(b.amountCents - baseline) || a.engineId.localeCompare(b.engineId));
  const selected: ExampleComparisonQuote[] = [];
  while (remaining.length && selected.length < 3) {
    const durationDistance = rank(remaining[0].settings)[0];
    // Prefer genuinely different prices without sacrificing the closest duration.
    const distinct = remaining.findIndex(candidate => rank(candidate.settings)[0] === durationDistance && !selected.some(previous => previous.amountCents === candidate.amountCents && previous.currency === candidate.currency));
    const [next] = remaining.splice(distinct < 0 ? 0 : distinct, 1);
    selected.push(next);
  }
  return selected;
}
