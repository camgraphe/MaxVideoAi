import { rankQuotedOffers, type PurchaseCandidate, type PurchaseProviderKey } from '@/lib/video-purchase-decision';
import { calculateMinimaxH3ProviderPrice } from '@/lib/minimax-h3-pricing';
import { calculateMinimaxH3MaxProviderCost } from '@/lib/minimax-h3-max-pricing';
import { MINIMAX_H3_RESOLUTIONS } from '@/config/fal-engines/minimax-h3';
import { MINIMAX_H3_MAX_RESOLUTIONS } from '@/config/fal-engines/minimax-h3-max';
import { quoteComparisonRequest, type ComparisonRequest } from './comparison-offers';
import type { CatalogueCard } from './catalogue/types';
import type { HistoricalReplayGroup, HistoricalReplayReport, ReplayChoice, ReplayOpportunity, ReplayTotals, ReplayTrace } from './historical-replay-types';

type Candidate = PurchaseCandidate<PurchaseProviderKey>;
type ReplayOptions = {
  cards?: readonly CatalogueCard[];
  engineId?: string;
  page?: number;
  pageSize?: number;
  alibabaStandardDiscount?: boolean;
  klingDirectFunded?: boolean;
};

function additionalOffer(offer: Candidate) {
  return offer.simulationOnly || offer.pilotOnly;
}

function firstChoice(ranking: ReturnType<typeof rankQuotedOffers<PurchaseProviderKey>>): ReplayChoice | null {
  const provider = ranking.order[0];
  const cost = ranking.candidates.find(c => c.provider === provider)?.costMicros;
  return provider && cost != null ? { provider, costMicros: cost, order: ranking.order } : null;
}

function comparableInput(r: ComparisonRequest) {
  if (!Number.isSafeInteger(r.durationSec) || r.durationSec <= 0 || !r.resolution || !r.mode ||
      !Number.isSafeInteger(r.images) || r.images < 0 ||
      [r.hasStartFrame, r.hasEndFrame, r.hasVideo, r.hasAudioReference, r.hasDocument].some(v => typeof v !== 'boolean'))
    return 'Incomplete duration, resolution, or media roles';
  if (r.hasUnpricedOptions !== false) return 'Options outside reviewed tariffs or unverified';
  if (r.engineId.startsWith('kling-') && typeof r.requiresDirectControls !== 'boolean')
    return 'Kling camera or direct controls are unverified';
  if (typeof r.audioEnabled !== 'boolean') return 'Generated audio setting is unverified';
  if (r.engineId.startsWith('wan-3') && r.requiresDirectControls)
    return 'Direct controls outside reviewed Wan profiles';
  if (r.hasVideo && (r.inputVideoSeconds == null || !Number.isFinite(r.inputVideoSeconds) || r.inputVideoSeconds <= 0))
    return 'Verified input video duration is missing';
  if (!r.hasVideo && (r.inputVideoSeconds ?? 0) !== 0) return 'Conflicting input video evidence';
  if (r.hasEndFrame && !r.hasStartFrame || r.hasStartFrame && r.images < 1 ||
      r.mode === 't2v' && (r.images > 0 || r.hasVideo || r.hasAudioReference || r.hasDocument) ||
      r.mode === 'ref2v' && (r.hasStartFrame || !(r.images || r.hasVideo || r.hasAudioReference || r.hasDocument)) ||
      r.mode === 'i2v' && (!r.hasStartFrame || r.images !== 1 || r.hasVideo || r.hasAudioReference || r.hasDocument))
    return 'Conflicting frame or reference roles';
  return null;
}

// Fal bills these completed H3 profiles by duration, resolution and reference count. Ratio never enters its tariff.
function deliveredFalH3Cost(r: ComparisonRequest): number | null {
  if (r.durationSec < 5 || r.durationSec > 15 || !['t2v','i2v','ref2v'].includes(r.mode) ||
      r.hasVideo || r.hasAudioReference || r.hasDocument || r.hasEndFrame || r.images > 9 || r.requiresDirectControls) return null;
  if (r.engineId === 'minimax-h3') {
    const resolution = MINIMAX_H3_RESOLUTIONS.find(v => v === r.resolution.toUpperCase());
    if (resolution) return Math.round(calculateMinimaxH3ProviderPrice({
      resolution, durationSec: r.durationSec, referenceImageCount: r.images,
    }).subtotalUsd * 1_000_000);
  }
  if (r.engineId === 'minimax-h3-max' && (r.mode === 't2v' || r.mode === 'i2v')) {
    const resolution = MINIMAX_H3_MAX_RESOLUTIONS.find(v => v === r.resolution.toUpperCase());
    if (resolution) return Math.round(calculateMinimaxH3MaxProviderCost({
      resolution, mode: r.mode, durationSec: r.durationSec,
    }).providerCostUsd * 1_000_000);
  }
  return null;
}

function evaluate(group: HistoricalReplayGroup, options: ReplayOptions): ReplayTrace {
  const r = group.request;
  const trace: ReplayTrace = {
    engineId: group.engineId, jobs: group.jobs, status: group.status, paidWallet: group.paidWallet,
    bucketAt: group.bucketAt ?? null, source: group.source ?? null, historicalProvider: group.historicalProvider,
    mode: r?.mode ?? group.mode ?? null, resolution: r?.resolution ?? group.resolution ?? null,
    durationSec: r?.durationSec ?? group.durationSec ?? null, ceilingMicros: null,
    historicalMicros: null, installed: null, all: null, additional: [], offers: [], excludedReason: null, profile: null,
  };
  const ineligibleOutcome = group.status !== 'completed' ? 'Job did not complete'
    : group.paidWallet !== true ? 'No completed wallet payment' : null;
  const exclude = (reason: string) => ({...trace, excludedReason: ineligibleOutcome ?? reason});
  if (group.missingReason) return exclude(group.missingReason);
  if (!r || r.engineId !== group.engineId) return exclude('Exact request profile is unavailable');
  const isH3 = r.engineId === 'minimax-h3' || r.engineId === 'minimax-h3-max';
  const inheritedRatio = isH3 && r.mode === 'i2v' && r.hasStartFrame && r.aspectRatio == null;
  const verifiedRatio = r.requestedRatioVerified === true && Boolean(r.aspectRatio?.trim());
  trace.profile = {
    aspectRatio: verifiedRatio ? r.aspectRatio : null, observedAspectRatio: r.observedAspectRatio ?? null,
    requestedRatioVerified: verifiedRatio, images: r.images, hasStartFrame: r.hasStartFrame === true, hasEndFrame: r.hasEndFrame,
    hasVideo: r.hasVideo, inputVideoSeconds: r.inputVideoSeconds, hasAudioReference: r.hasAudioReference,
    hasDocument: r.hasDocument, audioEnabled: r.audioEnabled ?? null,
  };
  if (r.engineId === 'minimax-h3-max' && r.mode === 'ref2v') return exclude('H3 Max reference pricing needs verified reference tokens');
  const invalid = comparableInput(r);
  if (invalid) return exclude(invalid);
  const paidFalH3 = isH3 && !ineligibleOutcome && group.historicalProvider === 'fal' ? deliveredFalH3Cost(r) : null;
  trace.historicalMicros = paidFalH3;
  // The original frame can be missing after the delivery webhook replaced it by a measured ratio.
  // Retain the proven owner only when the competing supplier is excluded for every possible original ratio.
  const quote = quoteComparisonRequest(r, options.cards);
  if (!quote) return exclude('Engine has no reviewed purchase policy');
  const retainFal = !verifiedRatio && !inheritedRatio && paidFalH3 != null &&
    quote.candidates.every(offer => offer.provider === 'fal' || (offer.excluded && offer.excludedAtEveryRatio));
  if (!verifiedRatio && !inheritedRatio && !retainFal) return exclude('Original requested aspect ratio is unverified');
  if (retainFal) trace.basisNote = 'Delivered by Fal. Its tariff is independent of framing, and no additional supplier qualifies at any frame ratio.';
  const ceiling = group.ceilingMicros;
  if (ceiling == null || !Number.isSafeInteger(ceiling) || ceiling < 0)
    return exclude('Trusted USD purchase ceiling is missing');

  const candidates = quote.candidates.map(c => {
    if (retainFal && c.provider === 'fal') return {...c, costMicros: paidFalH3, excluded: null};
    if (retainFal && c.provider !== 'fal') return {...c, costMicros: null, excluded: 'No matching tariff or equivalent prompt expansion'};
    return options.alibabaStandardDiscount && r.engineId === 'wan-3' && c.provider === 'alibaba_model_studio' && c.costMicros != null
      ? { ...c, costMicros: Math.round(c.costMicros * 0.7), tariff: c.tariff + ' · assumed 30% discount' } : c;
  });
  const historical = candidates.find(c => c.provider === group.historicalProvider);
  if (!ineligibleOutcome && historical && !historical.excluded && historical.costMicros != null && Number.isSafeInteger(historical.costMicros))
    trace.historicalMicros = historical.costMicros;
  const direct = retainFal ? paidFalH3 : r.engineId === 'wan-3' ? candidates.find(c => c.provider === 'alibaba_model_studio')?.costMicros : quote.baselineMicros;
  if (direct == null || !Number.isSafeInteger(direct) || direct < 0) return exclude('Baseline purchase tariff is missing');
  trace.ceilingMicros = Math.min(direct, ceiling);
  const limits = {
    ceilingMicros: trace.ceilingMicros,
    strategy: 'lowest-cost' as const,
    unavailable: options.klingDirectFunded ? {} : {kling_direct: 'Kling Direct pack on standby'},
  };
  const installed = candidates.filter(c => !additionalOffer(c));
  const additions = candidates.filter(additionalOffer);
  const all = rankQuotedOffers(candidates, limits);
  trace.offers = all.candidates.map(c => ({
    provider: c.provider, costMicros: c.costMicros, reason: c.excluded, tariff: c.tariff, sourceUrl: c.sourceUrl,
  }));
  trace.installed = firstChoice(rankQuotedOffers(installed, limits));
  trace.all = firstChoice(all);
  for (const offer of additions) {
    const choice = firstChoice(rankQuotedOffers([...installed, offer], limits));
    if (choice) trace.additional.push({candidate: offer.provider, choice});
  }
  if (ineligibleOutcome) return exclude(ineligibleOutcome);
  if (!group.historicalProvider) return exclude('Historical serving provider is unknown');
  if (trace.historicalMicros == null) return exclude('Historical provider has no comparable purchase tariff');
  if (!trace.installed) return exclude('No installed route qualifies under the purchase ceiling');
  return trace;
}

const blankTotals = (): ReplayTotals => ({
  jobs: 0, completedPaidJobs: 0, comparableJobs: 0, excludedJobs: 0, historicalPricedJobs: 0, historicalPricedMicros: 0, historicalMicros: 0, installedMicros: 0, allMicros: 0,
  installedSavingsMicros: 0, additionalSavingsMicros: 0,
});

function accumulate(totals: ReplayTotals, trace: ReplayTrace) {
  totals.jobs += trace.jobs;
  if (trace.paidWallet && trace.status === 'completed') {
    totals.completedPaidJobs += trace.jobs;
    if (trace.historicalMicros != null) {
      totals.historicalPricedJobs += trace.jobs;
      totals.historicalPricedMicros += trace.historicalMicros * trace.jobs;
    }
  }
  if (trace.excludedReason || trace.historicalMicros == null || !trace.installed || !trace.all) {
    totals.excludedJobs += trace.jobs;
    return;
  }
  totals.comparableJobs += trace.jobs;
  totals.historicalMicros += trace.jobs * trace.historicalMicros;
  totals.installedMicros += trace.jobs * trace.installed.costMicros;
  totals.allMicros += trace.jobs * trace.all.costMicros;
  totals.installedSavingsMicros += trace.jobs * (trace.historicalMicros - trace.installed.costMicros);
  totals.additionalSavingsMicros += trace.jobs * (trace.installed.costMicros - trace.all.costMicros);
}

function routeVolumes(traces: ReplayTrace[]) {
  const flows = new Map<string, HistoricalReplayReport['flows'][number]>();
  const singleRouteProfiles = new Map<string, HistoricalReplayReport['singleRouteProfiles'][number]>();
  const gaps = new Map<string, HistoricalReplayReport['coverageGaps'][number]>();
  for (const trace of traces) {
    if (trace.excludedReason && trace.paidWallet && trace.status === 'completed') {
      const {engineId, mode, resolution} = trace;
      const reason = trace.excludedReason;
      const aspectRatio = trace.profile?.aspectRatio ?? trace.profile?.observedAspectRatio ?? null;
      const gapKey = JSON.stringify([engineId, mode, resolution, aspectRatio, reason]);
      const gap = gaps.get(gapKey) ?? {engineId, mode, resolution, aspectRatio, reason, jobs: 0};
      gap.jobs += trace.jobs;
      gaps.set(gapKey, gap);
    }
    if (trace.excludedReason || trace.historicalMicros == null || !trace.historicalProvider || !trace.installed || !trace.all) continue;
    const key = JSON.stringify([trace.historicalProvider, trace.installed.provider, trace.all.provider]);
    const flow = flows.get(key) ?? {historicalProvider: trace.historicalProvider, installedProvider: trace.installed.provider,
      chosenProvider: trace.all.provider, jobs: 0, savingsMicros: 0};
    flow.jobs += trace.jobs;
    flow.savingsMicros += trace.jobs * (trace.historicalMicros - trace.all.costMicros);
    flows.set(key, flow);
    if (trace.all.order.length === 1) {
      const {engineId, mode, resolution} = trace;
      const provider = trace.all.provider;
      const profileKey = JSON.stringify([engineId, mode, resolution, provider]);
      const profile = singleRouteProfiles.get(profileKey) ?? {engineId, mode, resolution, provider, jobs: 0, historicalMicros: 0};
      profile.jobs += trace.jobs;
      profile.historicalMicros += trace.jobs * trace.historicalMicros;
      singleRouteProfiles.set(profileKey, profile);
    }
  }
  const sortedFlows = [...flows.values()].sort((a,b) => b.jobs - a.jobs || b.savingsMicros - a.savingsMicros ||
    a.historicalProvider.localeCompare(b.historicalProvider) || a.installedProvider.localeCompare(b.installedProvider) ||
    a.chosenProvider.localeCompare(b.chosenProvider));
  return { flows: sortedFlows, coverageGaps: [...gaps.values()].sort((a,b) => b.jobs - a.jobs || JSON.stringify(a).localeCompare(JSON.stringify(b))),
    singleRouteProfiles: [...singleRouteProfiles.values()].sort((a,b) =>
    b.jobs - a.jobs || b.historicalMicros - a.historicalMicros || a.engineId.localeCompare(b.engineId) ||
    (a.mode ?? '').localeCompare(b.mode ?? '') || (a.resolution ?? '').localeCompare(b.resolution ?? '') || a.provider.localeCompare(b.provider)) };
}

/** Greedily recommend the next supplier by its residual gain on each profile. */
function opportunities(traces: ReplayTrace[]): ReplayOpportunity[] {
  const rows = traces.flatMap(t => !t.excludedReason && t.installed
    ? [{ jobs: t.jobs, current: t.installed.costMicros, alternative: new Map(t.additional.map(a => [a.candidate, a.choice.costMicros])) }]
    : []);
  const remaining = new Set(rows.flatMap(r => [...r.alternative.keys()]));
  function marginal(provider: PurchaseProviderKey) {
    let micros = 0, jobs = 0;
    for (const row of rows) {
      const cost = row.alternative.get(provider);
      if (cost != null && cost < row.current) {
        micros += row.jobs * (row.current - cost);
        jobs += row.jobs;
      }
    }
    return {micros, jobs};
  }
  const standalone = new Map([...remaining].map(p => [p, marginal(p)]));
  const result: ReplayOpportunity[] = [];
  while (remaining.size) {
    const [next] = [...remaining].map(provider => ({provider, ...marginal(provider)}))
      .sort((a,b) => b.micros - a.micros || a.provider.localeCompare(b.provider));
    const individual = standalone.get(next.provider)!;
    result.push({provider: next.provider, standaloneSavingsMicros: individual.micros, jobsImproved: individual.jobs,
      incrementalSavingsMicros: next.micros, incrementalJobs: next.jobs});
    remaining.delete(next.provider);
    for (const row of rows) row.current = Math.min(row.current, row.alternative.get(next.provider) ?? row.current);
  }
  return result;
}

export function buildHistoricalReplay(groups: readonly HistoricalReplayGroup[], options: ReplayOptions = {}): HistoricalReplayReport {
  const totals = blankTotals();
  const byEngine = new Map<string, ReplayTotals>();
  const reasons = new Map<string, number>();
  const filtered: ReplayTrace[] = [];
  for (const group of groups) {
    if (!Number.isSafeInteger(group.jobs) || group.jobs < 1) throw new Error('Invalid historical job count');
    const trace = evaluate(group, options);
    const counts = byEngine.get(group.engineId) ?? blankTotals();
    accumulate(counts, trace);
    byEngine.set(group.engineId, counts);
    if (options.engineId && options.engineId !== group.engineId) continue;
    accumulate(totals, trace);
    filtered.push(trace);
    if (trace.excludedReason) reasons.set(trace.excludedReason, (reasons.get(trace.excludedReason) ?? 0) + group.jobs);
  }
  filtered.sort((a,b) => (b.bucketAt ?? '').localeCompare(a.bucketAt ?? '') || a.engineId.localeCompare(b.engineId)
    || (a.mode ?? '').localeCompare(b.mode ?? '') || (a.resolution ?? '').localeCompare(b.resolution ?? '')
    || (a.durationSec ?? 0) - (b.durationSec ?? 0) || (a.historicalProvider ?? '').localeCompare(b.historicalProvider ?? '')
    || a.status.localeCompare(b.status) || (a.excludedReason ?? '').localeCompare(b.excludedReason ?? '')
    || (a.source ?? '').localeCompare(b.source ?? '') || a.jobs - b.jobs || (a.ceilingMicros ?? -1) - (b.ceilingMicros ?? -1)
    || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const pageSize = Number.isSafeInteger(options.pageSize) ? Math.max(1, Math.min(100, options.pageSize!)) : 25;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Number.isSafeInteger(options.page) ? Math.max(1, Math.min(pages, options.page!)) : 1;
  return {
    pricingBasis: 'published-estimates', alibabaStandardDiscount: options.alibabaStandardDiscount === true, totals,
    coverage: [...byEngine].map(([engineId,v]) => ({engineId, ...v})).sort((a,b) => b.jobs - a.jobs || a.engineId.localeCompare(b.engineId)),
    opportunities: opportunities(filtered), ...routeVolumes(filtered), traces: filtered.slice((page - 1) * pageSize, page * pageSize),
    excludedReasons: [...reasons].map(([reason,jobs]) => ({reason, jobs})).sort((a,b) => b.jobs - a.jobs || a.reason.localeCompare(b.reason)),
    totalProfiles: filtered.length, page, pageSize,
  };
}
