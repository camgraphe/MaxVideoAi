import { buildLocalizedModelPath } from '@/config/model-registry';
import { getRuntimeModelById } from '@/config/model-runtime';
import { localeRegions, normalizeAppLocale, type AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { buildPublicPricingFacts } from '@/lib/pricing-public-facts';
import { quotePublicPricing } from '@/lib/pricing-public-quote';
import { getModelByEngineId, type ModelRosterEntry } from '@/lib/model-roster';
import type { EngineInputField } from '@/types/engines';

export type McpBudgetAudioState = 'enabled' | 'optional' | 'silent';

export type McpBudgetOption = {
  slot: 'included_trial' | 'lowest_paid' | 'affordable_upgrade';
  engineId: string;
  modelSlug: string;
  name: string;
  mode: 't2v';
  durationSeconds: number;
  resolution: string;
  audioState: McpBudgetAudioState;
  amountCents: number | null;
  currency: string;
  priceLabel: string;
  scenarioLabel: string;
  modelHref: string;
  priceSource: 'included_trial' | 'canonical_public_quote';
};

export type McpBudgetOptionsDependencies = {
  listEngines: typeof listFalEngines;
  getRosterByEngineId: typeof getModelByEngineId;
  getRuntimeByEngineId: typeof getRuntimeModelById;
  buildPricingFacts: typeof buildPublicPricingFacts;
  quotePricing: typeof quotePublicPricing;
};

type BudgetCandidate = {
  entry: FalEngineEntry;
  roster: ModelRosterEntry;
  durationSeconds: number;
  resolution: string;
  amountCents: number;
  currency: string;
  audioState: McpBudgetAudioState;
  supportsReferenceImages: boolean;
  supportsStructuredMultiShot: boolean;
};

const TRIAL_ENGINE_ID = 'seedance-2-0-mini';
const TRIAL_DURATION_SECONDS = 5;
const TRIAL_RESOLUTION = '480p';
const NON_PUBLIC_API_MARKERS = /\b(admin|internal|private|hidden|disabled|unavailable)\b/i;
const DEFAULT_DEPENDENCIES: McpBudgetOptionsDependencies = {
  listEngines: listFalEngines,
  getRosterByEngineId: getModelByEngineId,
  getRuntimeByEngineId: getRuntimeModelById,
  buildPricingFacts: buildPublicPricingFacts,
  quotePricing: quotePublicPricing,
};

const COPY: Record<
  AppLocale,
  { included: string; audioEnabled: string; audioOptional: string; silent: string }
> = {
  en: { included: 'Included', audioEnabled: 'Audio enabled', audioOptional: 'Optional audio', silent: 'Silent' },
  fr: { included: 'Inclus', audioEnabled: 'Audio activé', audioOptional: 'Audio en option', silent: 'Sans audio' },
  es: { included: 'Incluido', audioEnabled: 'Audio activado', audioOptional: 'Audio opcional', silent: 'Sin audio' },
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
  if (!modeResolutions?.length) return [];
  const values = modeResolutions;
  return [...new Set(values.flatMap((resolution) => {
    const canonical = engineResolutions.get(String(resolution).toLowerCase());
    return canonical && canonical.toLowerCase() !== 'auto' ? [canonical] : [];
  }))];
}

function findT2vInputField(entry: FalEngineEntry, ids: string[]): EngineInputField | undefined {
  const fields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ];
  return fields.find(
    (field) => ids.includes(field.id) && (!field.modes?.length || field.modes.includes('t2v'))
  );
}

function inputFieldSupportsDuration(entry: FalEngineEntry, durationSeconds: number): boolean {
  const field = findT2vInputField(entry, ['duration_seconds', 'duration']);
  if (!field) return true;
  const values = field.values
    ?.map(parseDurationSeconds)
    .filter((value): value is number => value !== null);
  if (values?.length && !values.includes(durationSeconds)) return false;
  if (typeof field.min === 'number' && durationSeconds < field.min) return false;
  if (typeof field.max === 'number' && durationSeconds > field.max) return false;
  if (typeof field.step === 'number' && field.step > 0) {
    const origin = typeof field.min === 'number' ? field.min : 0;
    if ((durationSeconds - origin) % field.step !== 0) return false;
  }
  return true;
}

function inputFieldSupportsResolution(entry: FalEngineEntry, resolution: string): boolean {
  const field = findT2vInputField(entry, ['resolution']);
  if (!field?.values?.length) return true;
  return field.values.some(
    (value) => String(value).toLowerCase() === resolution.toLowerCase()
  );
}

function hasExactT2vScenario(
  entry: FalEngineEntry,
  durationSeconds: number,
  resolution: string
): boolean {
  const t2v = entry.modes.find((mode) => mode.mode === 't2v');
  return Boolean(
    t2v &&
      entry.id === entry.engine.id &&
      entry.engine.modes.includes('t2v') &&
      t2v.ui.modes.includes('t2v') &&
      Number.isSafeInteger(durationSeconds) &&
      durationSeconds > 0 &&
      listDurations(entry).includes(durationSeconds) &&
      listResolutions(entry).includes(resolution) &&
      typeof t2v.ui.audioToggle === 'boolean' &&
      t2v.ui.audioToggle === entry.engine.audio &&
      inputFieldSupportsDuration(entry, durationSeconds) &&
      inputFieldSupportsResolution(entry, resolution)
  );
}

function isCurrentPublicEntry(
  entry: FalEngineEntry,
  dependencies: McpBudgetOptionsDependencies
): entry is FalEngineEntry {
  const roster = dependencies.getRosterByEngineId(entry.id);
  const runtime = dependencies.getRuntimeByEngineId(entry.id);
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

function resolveAudioControlState(field: EngineInputField): McpBudgetAudioState | null {
  if (field.type === 'boolean') return field.default === true ? 'enabled' : 'optional';
  if (field.type !== 'enum' || !field.values?.length) return null;
  if (field.values.some((value) => value !== 'true' && value !== 'false')) return null;
  if (!field.values.includes('true')) return 'silent';
  return field.default === 'true' ? 'enabled' : 'optional';
}

function resolveT2vAudioState(entry: FalEngineEntry): McpBudgetAudioState {
  const fields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ].filter((field) => !field.modes?.length || field.modes.includes('t2v'));
  const audioControl = fields.find(
    (field) =>
      (field.type === 'boolean' || field.type === 'enum') &&
      ['audio', 'generate_audio', 'audio_enabled', 'enable_audio'].includes(field.id),
  );
  if (audioControl) {
    const controlState = resolveAudioControlState(audioControl);
    if (controlState) return controlState;
  }

  const audioInput = fields.find(
    (field) => field.type === 'audio' || /^(?:audio|soundtrack)(?:_|$)/.test(field.id),
  );
  return audioInput ? 'optional' : 'silent';
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
  resolution: string,
  dependencies: McpBudgetOptionsDependencies
): BudgetCandidate | null {
  if (!hasExactT2vScenario(entry, durationSeconds, resolution)) return null;
  try {
    const scenarioId = `mcp-budget:${entry.id}:${durationSeconds}:${resolution}`;
    const facts = dependencies.buildPricingFacts({
      engine: entry.engine,
      durationSec: durationSeconds,
      resolution,
      mode: 't2v',
    });
    const quote = dependencies.quotePricing({
      facts: facts.facts,
      scenario: {
        id: scenarioId,
        engineId: entry.id,
        mode: 't2v',
        resolution,
        membershipTier: 'member',
      },
      compatibilityProfileId: facts.compatibilityProfileId,
    });
    if (
      facts.facts.engineId !== entry.id ||
      facts.facts.quantity !== durationSeconds ||
      facts.base.seconds !== durationSeconds ||
      (facts.base.unit != null && facts.base.unit !== facts.facts.unit) ||
      quote.engineId !== entry.id ||
      quote.scenarioId !== scenarioId ||
      quote.membershipTier !== 'member' ||
      quote.quantity !== durationSeconds ||
      quote.unit !== facts.facts.unit ||
      quote.currency !== facts.facts.currency ||
      !Number.isSafeInteger(quote.customerTotalCents) ||
      quote.customerTotalCents <= 0
    ) {
      return null;
    }
    return {
      entry,
      roster,
      durationSeconds,
      resolution,
      amountCents: quote.customerTotalCents,
      currency: quote.currency,
      audioState: resolveT2vAudioState(entry),
      supportsReferenceImages: supportsReferenceImages(entry),
      supportsStructuredMultiShot: hasStructuredMultiShot(entry),
    };
  } catch {
    return null;
  }
}

function buildCandidates(dependencies: McpBudgetOptionsDependencies): BudgetCandidate[] {
  return dependencies.listEngines()
    .filter((entry) => isCurrentPublicEntry(entry, dependencies))
    .flatMap((entry) => {
      const roster = dependencies.getRosterByEngineId(entry.id);
      if (!roster) return [];
      const scenarios = listDurations(entry).flatMap((durationSeconds) =>
        listResolutions(entry).flatMap((resolution) => {
          const candidate = quoteCandidate(
            entry,
            roster,
            durationSeconds,
            resolution,
            dependencies
          );
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
  audioState: McpBudgetAudioState
): string {
  const duration = new Intl.NumberFormat(localeRegions[locale]).format(durationSeconds);
  const durationLabel = locale === 'en' ? `${duration}s` : `${duration} s`;
  const resolutionLabel = resolution.toLowerCase() === '4k' ? '4K' : resolution;
  return `${durationLabel} · ${resolutionLabel} · ${
    audioState === 'enabled'
      ? COPY[locale].audioEnabled
      : audioState === 'optional'
        ? COPY[locale].audioOptional
        : COPY[locale].silent
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
    audioState: candidate.audioState,
    amountCents: candidate.amountCents,
    currency: candidate.currency,
    priceLabel: formatPrice(locale, candidate.currency, candidate.amountCents),
    scenarioLabel: formatScenario(
      locale,
      candidate.durationSeconds,
      candidate.resolution,
      candidate.audioState
    ),
    modelHref: buildLocalizedModelPath(locale, candidate.roster.modelSlug),
    priceSource: 'canonical_public_quote',
  };
}

function toTrialOption(
  locale: AppLocale,
  candidates: BudgetCandidate[],
  dependencies: McpBudgetOptionsDependencies
): McpBudgetOption | null {
  const source = candidates.find((item) => item.entry.id === TRIAL_ENGINE_ID);
  const candidate = source
    ? quoteCandidate(
        source.entry,
        source.roster,
        TRIAL_DURATION_SECONDS,
        TRIAL_RESOLUTION,
        dependencies
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
    audioState: candidate.audioState,
    amountCents: null,
    currency: candidate.currency,
    priceLabel: COPY[locale].included,
    scenarioLabel: formatScenario(
      locale,
      candidate.durationSeconds,
      candidate.resolution,
      candidate.audioState
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
  publication: McpPublicationState,
  dependencies: McpBudgetOptionsDependencies = DEFAULT_DEPENDENCIES
): McpBudgetOption[] {
  if (!publication.renderPublicPage) return [];
  const resolvedLocale = normalizeAppLocale(locale);
  const candidates = buildCandidates(dependencies);
  const trial = publication.showTrialClaim ? toTrialOption(resolvedLocale, candidates, dependencies) : null;
  const options: McpBudgetOption[] = trial ? [trial] : [];
  if (!publication.showPaidGenerationClaim) return options;

  const paidCandidates = trial
    ? candidates.filter((candidate) => candidate.entry.id !== TRIAL_ENGINE_ID)
    : candidates;
  const lowest = paidCandidates[0];
  if (!lowest) return options;
  options.push(toPaidOption(resolvedLocale, 'lowest_paid', lowest));

  const upgrade = paidCandidates.find(
    (candidate) =>
      candidate.entry.id !== lowest.entry.id &&
      candidate.amountCents > lowest.amountCents &&
      addsMaterialCapability(candidate, lowest, publication.showReferenceClaim)
  );
  if (upgrade) options.push(toPaidOption(resolvedLocale, 'affordable_upgrade', upgrade));
  return options;
}
