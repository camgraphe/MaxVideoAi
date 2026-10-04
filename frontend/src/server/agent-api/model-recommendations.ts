import {
  listAgentModelCandidates,
  type AgentModelCandidate,
  type AgentModelCatalogDeps,
} from './model-catalog';
import { getAgentModelGuidance, getAgentModelEditorialGuidance, type AgentModelEditorialGuidance } from './model-guidance';
import { isAgentModelRecommendationEligible } from './model-editorial-policy';
import type {
  AgentModelPriority,
  AgentModelRecommendation,
  AgentModelRecommendationInput,
  AgentModelRecommendationResult,
} from './types';

function resolutionCapability(resolutions: readonly string[]): number {
  const normalized = resolutions.map((value) => value.toLowerCase());
  if (normalized.some((value) => value === '4k' || value.startsWith('4096') || value.startsWith('4704') || value.startsWith('5120'))) return 3;
  if (normalized.some((value) => value === '2k' || value === '3k' || value === '1440p')) return 2;
  if (normalized.some((value) => value === '1080p')) return 1;
  return 0;
}

function normalizedIds(values: readonly string[] | undefined): ReadonlySet<string> {
  return new Set(values?.map((value) => value.trim()).filter(Boolean));
}

function normalizedPriorities(values: readonly AgentModelPriority[] | undefined): readonly AgentModelPriority[] {
  const priorities: AgentModelPriority[] = [];
  for (const value of values ?? []) {
    if (!priorities.includes(value)) priorities.push(value);
    if (priorities.length === 6) break;
  }
  return priorities;
}

function prioritySignal(
  candidate: AgentModelCandidate,
  priority: AgentModelPriority,
  maximumDurationSec: number,
): number {
  const { model } = candidate;
  if (priority === 'speed') return candidate.latencyTier === 'fast' ? 1 : 0;
  if (priority === 'highest_resolution') return resolutionCapability(model.resolutions) / 3;
  if (priority === 'native_audio') return model.audio ? 1 : 0;
  if (priority === 'reference_control') return model.referenceImages ? 1 : 0;
  if (priority === 'longer_clips') return (model.maxDurationSec ?? 0) / maximumDurationSec;
  return 0;
}

function scoreCandidate(
  candidate: AgentModelCandidate,
  priorities: readonly AgentModelPriority[],
  maximumDurationSec: number,
): number {
  const { model } = candidate;
  let score = model.availability === 'available' ? 0.05 : 0;

  priorities.forEach((priority, index) => {
    const weight = 2 ** (priorities.length - index);
    score += prioritySignal(candidate, priority, maximumDurationSec) * weight;
  });

  return score;
}

function describeCandidate(
  candidate: AgentModelCandidate,
  input: AgentModelRecommendationInput,
  priorities: ReadonlySet<AgentModelPriority>,
  preferredModelIds: ReadonlySet<string>,
  editorial: AgentModelEditorialGuidance,
): Pick<AgentModelRecommendation, 'reasons' | 'tradeoffs'> {
  const { model } = candidate;
  const reasons: string[] = [`Supports ${model.surface} generation.`];
  const tradeoffs: string[] = [];
  const guidance = getAgentModelGuidance(model.id);

  if (input.mode) reasons.push(`Supports the requested ${input.mode} mode.`);
  if (input.aspectRatio) reasons.push(`Supports the requested ${input.aspectRatio} aspect ratio.`);
  if (input.resolution) reasons.push(`Supports the requested ${input.resolution} resolution.`);
  if (input.maxDurationSec != null) reasons.push(`Supports at least ${input.maxDurationSec} seconds.`);
  if (input.audio === true) reasons.push('Supports generated audio.');
  if (input.referenceImages === true) reasons.push('Accepts reference image input.');
  if (preferredModelIds.has(model.id)) reasons.push('Matches the user’s preferred public model choice.');
  if (editorial.reviewStatus === 'current') {
    reasons.push(`MaxVideoAI editorial ${editorial.level} preference: ${editorial.rationale}`);
    tradeoffs.push('Editorial preference is not a measured quality score or execution certification.');
  } else if (editorial.reviewStatus === 'unreviewed') {
    tradeoffs.push('This exact version has no editorial review; family membership and release date do not establish quality.');
  } else {
    tradeoffs.push(`Editorial review is ${editorial.reviewStatus}; it does not boost this recommendation.`);
  }

  if (priorities.has('speed') && candidate.latencyTier === 'fast') reasons.push('Classified in the fast latency tier.');
  if (priorities.has('highest_resolution') && resolutionCapability(model.resolutions) >= 3) {
    reasons.push('Offers a 4K-class output option.');
  }
  if (priorities.has('native_audio') && model.audio && input.audio !== true) {
    reasons.push('Supports generated audio.');
  }
  if (
    priorities.has('reference_control')
    && model.referenceImages
    && input.referenceImages !== true
  ) {
    reasons.push('Accepts reference image input.');
  }
  if (priorities.has('longer_clips') && model.maxDurationSec != null) {
    reasons.push(`Offers a longer clip limit of up to ${model.maxDurationSec} seconds.`);
  }
  if (input.useCase && guidance?.bestFor.includes(input.useCase)) {
    reasons.push(`Reviewed guidance identifies this model for ${input.useCase}.`);
  }

  if (priorities.has('speed') && candidate.latencyTier !== 'fast') {
    tradeoffs.push('Is not classified in the fast latency tier.');
  }
  if (priorities.has('highest_resolution') && resolutionCapability(model.resolutions) < 3) {
    tradeoffs.push('Does not list a 4K-class output option.');
  }
  if (priorities.has('native_audio') && !model.audio) tradeoffs.push('Does not list generated audio support.');
  if (priorities.has('reference_control') && !model.referenceImages) {
    tradeoffs.push('Does not list reference image input support.');
  }
  if (input.useCase && !guidance?.bestFor.includes(input.useCase)) {
    tradeoffs.push(`No reviewed guidance specifically matches ${input.useCase}.`);
  }
  if (model.availability === 'limited') tradeoffs.push('Current availability is limited.');

  return { reasons, tradeoffs };
}

function selectDiverseShortlist<T extends Readonly<{
  candidate: AgentModelCandidate;
}>>(ranked: readonly T[], limit: number): T[] {
  const selected: T[] = [];
  const groups = new Set<string>();
  for (const entry of ranked) {
    if (groups.has(entry.candidate.selectionGroup)) continue;
    groups.add(entry.candidate.selectionGroup);
    selected.push(entry);
    if (selected.length === limit) break;
  }
  return selected;
}

function reviewedFitDiscoveryRank(
  candidate: AgentModelCandidate,
  input: AgentModelRecommendationInput,
): number {
  if (!input.useCase || !getAgentModelGuidance(candidate.model.id)?.bestFor.includes(input.useCase)) {
    return Number.POSITIVE_INFINITY;
  }
  return candidate.discoveryRank ?? Number.POSITIVE_INFINITY;
}

function editorialPreference(guidance: AgentModelEditorialGuidance): number {
  if (guidance.reviewStatus !== 'current') return 0;
  return guidance.level === 'reference' ? 2 : guidance.level === 'alternative' ? 1 : 0;
}

export async function recommendAgentModels(
  input: AgentModelRecommendationInput,
  deps?: AgentModelCatalogDeps,
): Promise<AgentModelRecommendationResult> {
  const priorities = normalizedPriorities(input.priorities);
  const prioritySet = new Set(priorities);
  const preferredModelIds = normalizedIds([...(input.preferredModelIds ?? []),...(input.id ? [input.id] : [])]);
  const excludedModelIds = normalizedIds(input.excludedModelIds);
  const candidates = (await listAgentModelCandidates(input, deps, { generationEnabledOnly: true }))
    .filter((candidate) => !excludedModelIds.has(candidate.model.id))
    .filter((candidate) => isAgentModelRecommendationEligible(
      candidate.model.id,
      candidate.model.lifecycle,
      preferredModelIds.has(candidate.model.id),
    ));

  if (!candidates.length) {
    return {
      recommendations: [],
      nextAction: 'clarify_requirements',
      message: 'No public model matches all requested capabilities. Relax or clarify one or more requirements.',
    };
  }

  const hasCostIntent = prioritySet.has('lower_cost') || typeof input.budgetCeilingCents === 'number';
  const nextAction = hasCostIntent ? 'calculate_project_budget' : 'discuss_and_choose';
  const rankedPriorities = priorities.filter((priority) => priority !== 'lower_cost');
  const maximumDurationSec = Math.max(
    1,
    ...candidates.map((candidate) => candidate.model.maxDurationSec ?? 0),
  );
  const rankedCandidates = candidates
    .map((candidate) => ({
      candidate,
      editorial: getAgentModelEditorialGuidance(candidate.model.id),
      score: scoreCandidate(candidate, rankedPriorities, maximumDurationSec),
    }))
    .sort((a, b) =>
      Number(preferredModelIds.has(b.candidate.model.id)) - Number(preferredModelIds.has(a.candidate.model.id)) ||
      b.score - a.score ||
      editorialPreference(b.editorial) - editorialPreference(a.editorial) ||
      Number(Boolean(input.useCase && getAgentModelGuidance(b.candidate.model.id)?.bestFor.includes(input.useCase))) - Number(Boolean(input.useCase && getAgentModelGuidance(a.candidate.model.id)?.bestFor.includes(input.useCase))) ||
      reviewedFitDiscoveryRank(a.candidate, input) - reviewedFitDiscoveryRank(b.candidate, input) ||
      a.candidate.model.id.localeCompare(b.candidate.model.id)
    );
  const ranked = selectDiverseShortlist(rankedCandidates, 3);

  return {
    recommendations: ranked.map(({ candidate, editorial }, index) => ({
      rank: index + 1,
      model: candidate.model,
      ...describeCandidate(candidate, input, prioritySet, preferredModelIds, editorial),
      editorialGuidance: editorial,
      nextAction,
    })),
    nextAction,
    ...(hasCostIntent
      ? { message: 'Use calculate_project_budget to calculate current comparable scenarios before choosing a production plan.' }
      : { message: 'Discuss these factual matches and let the user choose before preparing any generation.' }),
  };
}
