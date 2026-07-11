import {
  listAgentModelCandidates,
  type AgentModelCandidate,
  type AgentModelCatalogDeps,
} from './model-catalog';
import type {
  AgentModelRecommendation,
  AgentModelRecommendationInput,
  AgentModelRecommendationResult,
} from './types';

function resolutionQuality(resolutions: string[]): number {
  const normalized = resolutions.map((value) => value.toLowerCase());
  if (normalized.some((value) => value === '4k' || value.startsWith('4096') || value.startsWith('4704') || value.startsWith('5120'))) return 3;
  if (normalized.some((value) => value === '2k' || value === '3k' || value === '1440p')) return 2;
  if (normalized.some((value) => value === '1080p')) return 1;
  return 0;
}

function costRank(candidate: AgentModelCandidate, candidates: AgentModelCandidate[]): number {
  if (candidate.indicativeCost == null) return 0;
  const priced = candidates
    .map((entry) => entry.indicativeCost)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  if (priced.length < 2) return 1;
  const index = priced.indexOf(candidate.indicativeCost);
  return index < 0 ? 0 : 1 - index / (priced.length - 1);
}

function scoreCandidate(
  candidate: AgentModelCandidate,
  candidates: AgentModelCandidate[],
  input: AgentModelRecommendationInput
): number {
  let score = candidate.model.availability === 'available' ? 10 : 0;
  const quality = resolutionQuality(candidate.model.resolutions);
  const affordable = costRank(candidate, candidates);

  if (input.speedPreference === 'fastest') score += candidate.latencyTier === 'fast' ? 100 : 0;
  if (input.speedPreference === 'balanced') score += candidate.latencyTier === 'fast' ? 10 : 5;
  if (input.speedPreference === 'quality') score += quality * 20;

  if (input.budgetPreference === 'lowest') score += affordable * 40;
  if (input.budgetPreference === 'balanced') score += affordable * 10;

  if (input.qualityPreference === 'highest') score += quality * 100;
  if (input.qualityPreference === 'balanced') score += quality * 10;
  if (input.qualityPreference === 'draft') score += candidate.latencyTier === 'fast' ? 20 : 0;

  return score;
}

function describeCandidate(
  candidate: AgentModelCandidate,
  input: AgentModelRecommendationInput
): Pick<AgentModelRecommendation, 'reasons' | 'tradeoffs'> {
  const { model } = candidate;
  const reasons: string[] = [`Supports ${model.surface} generation.`];
  const tradeoffs: string[] = [];

  if (input.mode) reasons.push(`Supports the requested ${input.mode} mode.`);
  if (input.aspectRatio) reasons.push(`Supports the requested ${input.aspectRatio} aspect ratio.`);
  if (input.resolution) reasons.push(`Supports the requested ${input.resolution} resolution.`);
  if (input.maxDurationSec != null) reasons.push(`Supports at least ${input.maxDurationSec} seconds.`);
  if (input.audio === true) reasons.push('Supports generated audio.');
  if (input.referenceImages === true) reasons.push('Accepts reference image input.');
  if (input.speedPreference === 'fastest' && candidate.latencyTier === 'fast') reasons.push('Classified in the fast latency tier.');

  const quality = resolutionQuality(model.resolutions);
  if (input.qualityPreference === 'highest' || input.speedPreference === 'quality') {
    if (quality >= 3) reasons.push('Offers a 4K-class output option.');
    else {
      const highest = model.resolutions.at(-1) ?? 'its listed maximum';
      tradeoffs.push(`Highest listed resolution is ${highest}, below a 4K-class option.`);
    }
  }
  if (input.speedPreference === 'fastest' && candidate.latencyTier !== 'fast') {
    tradeoffs.push('Uses the standard latency tier rather than the fast tier.');
  }
  if (model.availability === 'limited') tradeoffs.push('Current availability is limited.');
  if (candidate.indicativeCost == null && input.budgetPreference) {
    tradeoffs.push('No comparable catalog cost signal is available for budget ranking.');
  }

  return { reasons, tradeoffs };
}

export async function recommendAgentModels(
  input: AgentModelRecommendationInput,
  deps?: AgentModelCatalogDeps
): Promise<AgentModelRecommendationResult> {
  const candidates = await listAgentModelCandidates(input, deps);
  if (!candidates.length) {
    return {
      recommendations: [],
      nextAction: 'clarify_requirements',
      message: 'No public model matches all requested capabilities. Relax or clarify one or more requirements.',
    };
  }

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, candidates, input) }))
    .sort((a, b) => b.score - a.score || a.candidate.model.id.localeCompare(b.candidate.model.id))
    .slice(0, 3);

  return {
    recommendations: ranked.map(({ candidate }, index) => ({
      rank: index + 1,
      model: candidate.model,
      ...describeCandidate(candidate, input),
      nextAction: 'prepare_generation',
    })),
    nextAction: 'prepare_generation',
  };
}
