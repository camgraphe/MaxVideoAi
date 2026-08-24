import {
  listAgentModelCandidates,
  type AgentModelCandidate,
  type AgentModelCatalogDeps,
} from './model-catalog';
import { getAgentModelGuidance } from './model-guidance';
import type {
  AgentModelPriority,
  AgentModelRecommendation,
  AgentModelRecommendationInput,
  AgentModelRecommendationResult,
} from './types';

function resolutionQuality(resolutions: readonly string[]): number {
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
  if (priority === 'highest_resolution') return resolutionQuality(model.resolutions) / 3;
  if (priority === 'native_audio') return model.audio ? 1 : 0;
  if (priority === 'reference_control') return model.referenceImages ? 1 : 0;
  if (priority === 'longer_clips') return (model.maxDurationSec ?? 0) / maximumDurationSec;
  return 0;
}

function scoreCandidate(
  candidate: AgentModelCandidate,
  input: AgentModelRecommendationInput,
  priorities: readonly AgentModelPriority[],
  preferredModelIds: ReadonlySet<string>,
  maximumDurationSec: number,
): number {
  const { model } = candidate;
  let score = model.availability === 'available' ? 0.05 : 0;

  priorities.forEach((priority, index) => {
    const weight = 2 ** (priorities.length - index);
    score += prioritySignal(candidate, priority, maximumDurationSec) * weight;
  });
  if (input.useCase && getAgentModelGuidance(model.id)?.bestFor.includes(input.useCase)) score += 1;
  if (preferredModelIds.has(model.id)) score += 0.25;

  return score;
}

function describeCandidate(
  candidate: AgentModelCandidate,
  input: AgentModelRecommendationInput,
  priorities: ReadonlySet<AgentModelPriority>,
  preferredModelIds: ReadonlySet<string>,
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

  if (priorities.has('speed') && candidate.latencyTier === 'fast') reasons.push('Classified in the fast latency tier.');
  if (priorities.has('highest_resolution') && resolutionQuality(model.resolutions) >= 3) {
    reasons.push('Offers a 4K-class output option.');
  }
  if (priorities.has('native_audio') && model.audio) reasons.push('Supports generated audio.');
  if (priorities.has('reference_control') && model.referenceImages) reasons.push('Accepts reference image input.');
  if (priorities.has('longer_clips') && model.maxDurationSec != null) {
    reasons.push(`Offers a longer clip limit of up to ${model.maxDurationSec} seconds.`);
  }
  if (input.useCase && guidance?.bestFor.includes(input.useCase)) {
    reasons.push(`Reviewed guidance identifies this model for ${input.useCase}.`);
  }

  if (priorities.has('speed') && candidate.latencyTier !== 'fast') {
    tradeoffs.push('Is not classified in the fast latency tier.');
  }
  if (priorities.has('highest_resolution') && resolutionQuality(model.resolutions) < 3) {
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

export async function recommendAgentModels(
  input: AgentModelRecommendationInput,
  deps?: AgentModelCatalogDeps,
): Promise<AgentModelRecommendationResult> {
  const priorities = normalizedPriorities(input.priorities);
  const prioritySet = new Set(priorities);
  const preferredModelIds = normalizedIds(input.preferredModelIds);
  const excludedModelIds = normalizedIds(input.excludedModelIds);
  const candidates = (await listAgentModelCandidates(input, deps, { generationEnabledOnly: true }))
    .filter((candidate) => !excludedModelIds.has(candidate.model.id));

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
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, input, rankedPriorities, preferredModelIds, maximumDurationSec),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.model.id.localeCompare(b.candidate.model.id))
    .slice(0, 3);

  return {
    recommendations: ranked.map(({ candidate }, index) => ({
      rank: index + 1,
      model: candidate.model,
      ...describeCandidate(candidate, input, prioritySet, preferredModelIds),
      nextAction,
    })),
    nextAction,
    ...(hasCostIntent
      ? { message: 'Use calculate_project_budget to calculate current comparable scenarios before choosing a production plan.' }
      : { message: 'Discuss these factual matches and let the user choose before preparing any generation.' }),
  };
}
