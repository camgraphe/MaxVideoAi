import { getFalEngineById } from '@/config/falEngines';
import { numericTariffDuration } from '@/lib/pricing-audit/manual-tariff-durations';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import type { MarketingPricePoint } from '@/lib/pricing-marketing';
import { computeCurrentPublicSnapshot } from '@/server/pricing/quote-public';
import type { PricingContext } from '@/lib/pricing-context';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { EngineCaps } from '@/types/engines';

export type ComparePricePoint = MarketingPricePoint & {
  scenario?: PublicModelQuoteInput & { amountCents: number };
};

type CompareQuote = Pick<Extract<PublicModelQuote, { status: 'exact' }>, 'status' | 'amountCents' | 'currency'> | { status: 'unavailable' };
type CompareSnapshotReader = (context: PricingContext) => Promise<PricingSnapshot>;

async function quoteCurrentScenario(engine: EngineCaps, input: PublicModelQuoteInput, currentSnapshot: CompareSnapshotReader): Promise<CompareQuote> {
  const pricingEngine = applyEngineVariantPricing(engine, 't2v');
  try {
    const snapshot = await currentSnapshot({
      engine: pricingEngine, mode: 't2v', durationSec: input.durationSec, resolution: input.resolution,
      aspectRatio: input.aspectRatio, membershipTier: 'member', hasVideoInput: false, inputVideoDurationSec: 0,
      addons: { ...buildEngineAddonInput(pricingEngine, { audioEnabled: input.audio }), audio: input.audio },
    });
    if (!Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents < 0 || !snapshot.currency) return { status: 'unavailable' };
    return { status: 'exact', amountCents: snapshot.totalCents, currency: snapshot.currency };
  } catch {
    return { status: 'unavailable' };
  }
}

function textVideoDurations(engine?: EngineCaps | null): number[] {
  if (!engine) return [];
  const duration = getFalEngineById(engine.id)?.modes.find(mode => mode.mode === 't2v')?.ui.duration;
  if (!duration) return [];
  const values = 'options' in duration ? duration.options : [duration.min, duration.default];
  return [...new Set(values.map(numericTariffDuration).filter((value): value is number => value !== null && value > 0))];
}

function nearestDuration(durations: number[], preferred: number) {
  return [...durations].sort((left, right) => Math.abs(left - preferred) - Math.abs(right - preferred) || left - right)[0];
}

/** A shared admitted duration makes the two reference clips easier to compare. */
export function getCompareReferenceDuration(left?: EngineCaps | null, right?: EngineCaps | null) {
  const rightDurations = new Set(textVideoDurations(right));
  return nearestDuration(textVideoDurations(left).filter(duration => rightDurations.has(duration)), 5);
}

/** Select a real text-to-video scenario; effective retail quotes remain the sole price owner. */
export async function computeComparePricingPoints(
  engine: EngineCaps,
  preferredDurationSec = 5,
  quote?: (input: PublicModelQuoteInput) => Promise<CompareQuote>,
  currentSnapshot: CompareSnapshotReader = computeCurrentPublicSnapshot,
): Promise<ComparePricePoint[]> {
  const entry = getFalEngineById(engine.id);
  const mode = entry?.modes.find(candidate => candidate.mode === 't2v');
  const durationSec = nearestDuration(textVideoDurations(engine), preferredDurationSec);
  if (!mode || !durationSec) return [];
  const availableResolutions = mode.ui.resolution ?? engine.resolutions;
  const priorities = ['720p', '1080p', '480p', '4k'];
  const resolutions = [...availableResolutions].filter(value => value !== 'auto')
    .sort((left, right) => {
      const order = (value: string) => { const index = priorities.indexOf(value.toLowerCase()); return index < 0 ? priorities.length : index; };
      return order(left) - order(right);
    }).slice(0, 3);
  const aspects = mode.ui.aspectRatio ?? engine.aspectRatios;
  const aspectRatio = aspects.includes('16:9') ? '16:9' : aspects[0];
  const points = await Promise.all(resolutions.map(async resolution => {
    const input: PublicModelQuoteInput = { modelId: engine.id, mode: 't2v', durationSec, resolution,
      audio: Boolean(engine.audio), ...(aspectRatio ? { aspectRatio } : {}) };
    const current = await (quote ? quote(input) : quoteCurrentScenario(engine, input, currentSnapshot));
    if (current.status !== 'exact') return null;
    return { resolution, cents: current.amountCents / durationSec, currency: current.currency,
      scenario: { ...input, amountCents: current.amountCents } } satisfies ComparePricePoint;
  }));
  return points.filter((point): point is NonNullable<typeof point> => point !== null);
}
