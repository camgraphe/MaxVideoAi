import { buildLocalizedModelPath } from '@/config/model-registry';
import { getRuntimeModelById } from '@/config/model-runtime';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { buildPublicPricingFacts } from '@/lib/pricing-public-facts';
import { quotePublicPricing } from '@/lib/pricing-public-quote';
import { getModelByEngineId, type ModelRosterEntry } from '@/lib/model-roster';

export type McpBudgetOption = {
  slot: 'included_trial' | 'lowest_paid' | 'affordable_upgrade';
  engineId: string;
  modelSlug: string;
  name: string;
  mode: 't2v';
  durationSeconds: number;
  resolution: string;
  audioIncluded: boolean;
  amountCents: number | null;
  currency: string;
  priceLabel: string;
  scenarioLabel: string;
  modelHref: string;
  priceSource: 'included_trial' | 'canonical_public_quote';
};

type BudgetCandidate = {
  entry: FalEngineEntry;
  roster: ModelRosterEntry;
  durationSeconds: number;
  resolution: string;
  amountCents: number;
  currency: string;
  supportsReferenceImages: boolean;
  supportsStructuredMultiShot: boolean;
};

const TRIAL_ENGINE_ID = 'seedance-2-0-mini';
const TRIAL_DURATION_SECONDS = 5;
const TRIAL_RESOLUTION = '480p';
const NON_PUBLIC_API_MARKERS = /\b(admin|internal|private|hidden|disabled|unavailable)\b/i;

const COPY: Record<
  AppLocale,
  { included: string; audioIncluded: string; silent: string }
> = {
  en: { included: 'Included', audioIncluded: 'Audio included', silent: 'Silent' },
  fr: { included: 'Inclus', audioIncluded: 'Audio inclus', silent: 'Sans audio' },
  es: { included: 'Incluido', audioIncluded: 'Audio incluido', silent: 'Sin audio' },
};

function parseDurationSeconds(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function listDurations(entry: FalEngineEntry): number[] {
  const duration = entry.modes.find((mode) => mode.mode === 't2v')?.ui.duration;
  const values = duration && 'options' in duration ? duration.options : [duration?.default];
  return [...new Set(values.map(parseDurationSeconds).filter((value): value is number => value !== null))]
    .sort((left, right) => left - right);
}

function listResolutions(entry: FalEngineEntry): string[] {
  const engineResolutions = new Map(
    entry.engine.resolutions.map((resolution) => [String(resolution).toLowerCase(), String(resolution)])
  );
  const modeResolutions = entry.modes.find((mode) => mode.mode === 't2v')?.ui.resolution;
  const values = modeResolutions?.length ? modeResolutions : entry.engine.resolutions.map(String);
  return [...new Set(values.flatMap((resolution) => {
    const canonical = engineResolutions.get(String(resolution).toLowerCase());
    return canonical && canonical.toLowerCase() !== 'auto' ? [canonical] : [];
  }))];
}

function isCurrentPublicEntry(entry: FalEngineEntry): entry is FalEngineEntry {
  const roster = getModelByEngineId(entry.id);
  const runtime = getRuntimeModelById(entry.id);
  const apiAvailability = entry.engine.apiAvailability;
  return Boolean(
    roster &&
      runtime &&
      (entry.category ?? 'video') === 'video' &&
      !entry.isLegacy &&
      !entry.engine.isLab &&
      entry.availability === 'available' &&
      entry.engine.availability === 'available' &&
      entry.engine.status === 'live' &&
      (!apiAvailability || !NON_PUBLIC_API_MARKERS.test(apiAvailability)) &&
      entry.engine.modes.includes('t2v') &&
      entry.modes.some((mode) => mode.mode === 't2v') &&
      entry.surfaces.app.enabled &&
      entry.surfaces.pricing.includeInEstimator &&
      entry.surfaces.modelPage.indexable &&
      roster.availability === 'available' &&
      roster.surfaces?.modelPage?.indexable === true &&
      runtime.publication.model.published &&
      runtime.publication.examples.current &&
      runtime.publication.app.published &&
      runtime.publication.pricing.published
  );
}

function hasStructuredMultiShot(entry: FalEngineEntry): boolean {
  const fields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ];
  return fields.some(
    (field) => field.id === 'multi_shots' && (!field.modes || field.modes.includes('t2v'))
  );
}

function supportsReferenceImages(entry: FalEngineEntry): boolean {
  return entry.modes.some((mode) => mode.mode === 'i2v' || mode.mode === 'ref2v');
}

function compareCandidates(left: BudgetCandidate, right: BudgetCandidate): number {
  return (
    left.amountCents - right.amountCents ||
    left.entry.id.localeCompare(right.entry.id) ||
    left.durationSeconds - right.durationSeconds ||
    left.resolution.localeCompare(right.resolution)
  );
}

function quoteCandidate(
  entry: FalEngineEntry,
  roster: ModelRosterEntry,
  durationSeconds: number,
  resolution: string
): BudgetCandidate | null {
  try {
    const facts = buildPublicPricingFacts({
      engine: entry.engine,
      durationSec: durationSeconds,
      resolution,
      mode: 't2v',
    });
    const quote = quotePublicPricing({
      facts: facts.facts,
      scenario: {
        id: `mcp-budget:${entry.id}:${durationSeconds}:${resolution}`,
        engineId: entry.id,
        mode: 't2v',
        resolution,
        membershipTier: 'member',
      },
      compatibilityProfileId: facts.compatibilityProfileId,
    });
    if (!Number.isSafeInteger(quote.customerTotalCents) || quote.customerTotalCents <= 0) return null;
    return {
      entry,
      roster,
      durationSeconds,
      resolution,
      amountCents: quote.customerTotalCents,
      currency: quote.currency,
      supportsReferenceImages: supportsReferenceImages(entry),
      supportsStructuredMultiShot: hasStructuredMultiShot(entry),
    };
  } catch {
    return null;
  }
}

function buildCandidates(): BudgetCandidate[] {
  return listFalEngines()
    .filter(isCurrentPublicEntry)
    .flatMap((entry) => {
      const roster = getModelByEngineId(entry.id);
      if (!roster) return [];
      const scenarios = listDurations(entry).flatMap((durationSeconds) =>
        listResolutions(entry).flatMap((resolution) => {
          const candidate = quoteCandidate(entry, roster, durationSeconds, resolution);
          return candidate ? [candidate] : [];
        })
      );
      return scenarios.sort(compareCandidates).slice(0, 1);
    })
    .sort(compareCandidates);
}

function formatPrice(locale: AppLocale, currency: string, amountCents: number): string {
  return new Intl.NumberFormat(localeRegions[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatScenario(
  locale: AppLocale,
  durationSeconds: number,
  resolution: string,
  audioIncluded: boolean
): string {
  const duration = new Intl.NumberFormat(localeRegions[locale]).format(durationSeconds);
  const durationLabel = locale === 'en' ? `${duration}s` : `${duration} s`;
  const resolutionLabel = resolution.toLowerCase() === '4k' ? '4K' : resolution;
  return `${durationLabel} · ${resolutionLabel} · ${
    audioIncluded ? COPY[locale].audioIncluded : COPY[locale].silent
  }`;
}

function toPaidOption(
  locale: AppLocale,
  slot: 'lowest_paid' | 'affordable_upgrade',
  candidate: BudgetCandidate
): McpBudgetOption {
  return {
    slot,
    engineId: candidate.entry.id,
    modelSlug: candidate.roster.modelSlug,
    name: candidate.roster.marketingName,
    mode: 't2v',
    durationSeconds: candidate.durationSeconds,
    resolution: candidate.resolution,
    audioIncluded: candidate.entry.engine.audio,
    amountCents: candidate.amountCents,
    currency: candidate.currency,
    priceLabel: formatPrice(locale, candidate.currency, candidate.amountCents),
    scenarioLabel: formatScenario(
      locale,
      candidate.durationSeconds,
      candidate.resolution,
      candidate.entry.engine.audio
    ),
    modelHref: buildLocalizedModelPath(locale, candidate.roster.modelSlug),
    priceSource: 'canonical_public_quote',
  };
}

function toTrialOption(locale: AppLocale, candidates: BudgetCandidate[]): McpBudgetOption | null {
  const source = candidates.find((item) => item.entry.id === TRIAL_ENGINE_ID);
  const candidate = source
    ? quoteCandidate(
        source.entry,
        source.roster,
        TRIAL_DURATION_SECONDS,
        TRIAL_RESOLUTION
      )
    : null;
  if (!candidate) return null;
  return {
    slot: 'included_trial',
    engineId: candidate.entry.id,
    modelSlug: candidate.roster.modelSlug,
    name: candidate.roster.marketingName,
    mode: 't2v',
    durationSeconds: candidate.durationSeconds,
    resolution: candidate.resolution,
    audioIncluded: candidate.entry.engine.audio,
    amountCents: null,
    currency: candidate.currency,
    priceLabel: COPY[locale].included,
    scenarioLabel: formatScenario(
      locale,
      candidate.durationSeconds,
      candidate.resolution,
      candidate.entry.engine.audio
    ),
    modelHref: buildLocalizedModelPath(locale, candidate.roster.modelSlug),
    priceSource: 'included_trial',
  };
}

function addsMaterialCapability(
  candidate: BudgetCandidate,
  lowest: BudgetCandidate,
  allowReferenceClaim: boolean
): boolean {
  if (candidate.supportsStructuredMultiShot && !lowest.supportsStructuredMultiShot) return true;
  return Boolean(
    allowReferenceClaim &&
      candidate.supportsReferenceImages &&
      !lowest.supportsReferenceImages
  );
}

export function buildMcpBudgetOptions(
  locale: AppLocale,
  publication: McpPublicationState
): McpBudgetOption[] {
  if (!publication.renderPublicPage) return [];
  const candidates = buildCandidates();
  const trial = publication.showTrialClaim ? toTrialOption(locale, candidates) : null;
  const options: McpBudgetOption[] = trial ? [trial] : [];
  if (!publication.showPaidGenerationClaim) return options;

  const paidCandidates = trial
    ? candidates.filter((candidate) => candidate.entry.id !== TRIAL_ENGINE_ID)
    : candidates;
  const lowest = paidCandidates[0];
  if (!lowest) return options;
  options.push(toPaidOption(locale, 'lowest_paid', lowest));

  const upgrade = paidCandidates.find(
    (candidate) =>
      candidate.entry.id !== lowest.entry.id &&
      candidate.amountCents > lowest.amountCents &&
      addsMaterialCapability(candidate, lowest, publication.showReferenceClaim)
  );
  if (upgrade) options.push(toPaidOption(locale, 'affordable_upgrade', upgrade));
  return options;
}
