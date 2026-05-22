import { AI_STRATEGIST_MODELS } from './model-catalog';
import type {
  AiStrategistAlsoConsider,
  AiStrategistBrief,
  AiStrategistBriefInput,
  AiStrategistModelEntry,
  AiStrategistModelId,
  AiStrategistPromptStructureId,
  AiStrategistRecommendation,
  AiStrategistRecommendations,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from './types';

type FocusArea = 'product' | 'cinematic' | 'social' | 'character' | 'brand' | 'general';
type NormalizedBrief = Required<Pick<AiStrategistBrief, 'workflow'>> &
  Omit<AiStrategistBrief, 'workflow'> & { goal: string };
type ScoredModel = {
  index: number;
  model: AiStrategistModelEntry;
  score: number;
  matchedSignals: readonly string[];
};

const tierOrder: readonly AiStrategistTierPosition[] = ['best', 'medium', 'value'];
const PERSON_REFERENCE_WARNING =
  'Person/character reference images need a compatible image-to-video model. Kling or LTX are safer choices for uploaded person/character preservation; Seedance/Sora should be avoided unless the image was generated in a compatible workflow first. Happy Horse remains limited for real-person image-to-video preservation.';
const PRODUCT_DETAIL_WARNING =
  'Exact labels, logos, legal copy, packaging details, and tiny text may drift and should be checked after generation or added as overlays.';
const draftTestingTerms = ['cheap', 'draft', 'storyboard', 'quick test', 'low cost', 'rough concept'];
const playfulEffectTerms = ['transformation', 'effect', 'before-and-after', 'experimental', 'stylized'];
const strongSoraFitTerms = ['sora', 'surreal', 'conceptual', 'impossible', 'dream', 'dreamlike', 'narrative continuity', 'worldbuilding', 'imaginative story'];
const kling4kEscalationTerms = [
  '4k',
  'ultra-high detail',
  'ultra high detail',
  'final commercial delivery',
  'final delivery',
  'large-screen',
  'large screen',
  'maximum detail',
  'premium export quality',
  'premium export',
];
const strictProductDetailTerms = [
  'exact packaging',
  'exact label',
  'label placement',
  'sku accuracy',
  'legal copy',
  'fine text',
  'tiny text',
  'small text',
  'logo position',
  'logo fidelity',
  'strict packaging',
  'precise packaging',
];
const socialFirstProductTerms = [
  'social-first',
  'social first',
  'social ad',
  'tiktok',
  'reels',
  'dynamic product motion',
  'dynamic motion',
  'cost-efficient iteration',
  'fast iteration',
];
const lipSyncTerms = [
  'lip sync',
  'lip-sync',
  'lipsync',
  'talking avatar',
  'talking head',
  'spokesperson',
  'speaking',
  'spoken line',
  'dialogue',
  'synchronized speech',
  'synced speech',
];
const noSpeechTerms = ['no dialogue', 'without dialogue', 'silent', 'no speech', 'without speech', 'no voiceover', 'no voice over'];
const veoLiteBudgetTerms = [
  'veo lite',
  'veo 3.1 lite',
  'veo-style',
  'veo style',
  'budget veo',
  'lower-cost veo',
  'low-cost veo',
];

const costScore: Record<AiStrategistModelEntry['relativeCostLevel'], number> = {
  low: 5,
  medium: 4,
  high: 2,
  premium: 1,
};

const speedScore: Record<AiStrategistModelEntry['relativeSpeedLevel'], number> = {
  slow: 1,
  medium: 3,
  fast: 4,
  'very-fast': 5,
};

const qualityScore: Record<AiStrategistModelEntry['qualityLevel'], number> = {
  draft: 2,
  standard: 3,
  high: 4,
  premium: 5,
};

export function recommendModelsForBrief(briefInput: AiStrategistBriefInput): AiStrategistRecommendations {
  const brief = normalizeBrief(briefInput);
  const scoredModels = AI_STRATEGIST_MODELS.map((model, index) => ({
    index,
    model,
    score: scoreModelForBrief(model, brief),
    matchedSignals: buildMatchedSignals(model, brief),
  }));
  const selectedIds = new Set<AiStrategistModelId>();
  const warning = buildWarning(brief);
  const upgradeNote = buildUpgradeNote(brief);
  const recommendations = {} as Record<AiStrategistTierPosition, AiStrategistRecommendation>;

  for (const tier of tierOrder) {
    const winner = selectWinnerForTier(tier, scoredModels, brief, selectedIds);

    selectedIds.add(winner.model.id);
    recommendations[tier] = {
      model: winner.model,
      reason: buildReason(winner.model, brief, tier),
      matchedSignals: winner.matchedSignals,
      ...(warning ? { warning } : {}),
      ...(tier === 'best' && upgradeNote ? { upgradeNote } : {}),
    };
  }

  const alsoConsider = buildAlsoConsider(scoredModels, brief, selectedIds);

  return {
    best: recommendations.best,
    medium: recommendations.medium,
    value: recommendations.value,
    ...(alsoConsider.length > 0 ? { alsoConsider } : {}),
  };
}

export function scoreModelForBrief(model: AiStrategistModelEntry, briefInput: AiStrategistBriefInput): number {
  const brief = normalizeBrief(briefInput);
  const focus = detectFocusArea(brief);
  const draftTesting = isDraftTestingBrief(brief);
  const playfulEffect = isPlayfulEffectBrief(brief);
  const personReferenceI2V = isPersonReferenceImageToVideoBrief(brief);
  const compatibleGeneratedPerson = isCompatibleGeneratedPersonWorkflow(brief);
  const lipSyncBrief = isLipSyncBrief(brief);
  const veoLiteBudgetBrief = isVeoLiteBudgetBrief(brief);
  let score = model.supportedWorkflows.includes(brief.workflow) ? 14 : -18;

  if (focus === 'product') {
    score += model.productDetailScore * 9 + model.socialAdScore * 2 + qualityScore[model.qualityLevel] * 2;
    if (isKling4kEscalationBrief(brief)) {
      if (model.id === 'kling-3-4k') score += 14;
      if (model.id === 'kling-3-pro') score += 8;
    } else {
      if (model.id === 'kling-3-4k') score -= 8;
      if (model.id === 'kling-3-pro') score += 14;
    }
    if (model.id === 'kling-3-standard') score += 7;
    if (isSocialFirstProductMotionBrief(brief) && !isStrictProductPreservationBrief(brief)) {
      if (model.id === 'seedance-2-0') score += 40;
      if (model.id === 'seedance-2-0-fast') score += 36;
      if (model.id === 'veo-3-1-lite') score += 16;
    }
    if (isStrictProductPreservationBrief(brief)) {
      if (model.id === 'kling-3-standard') score += 8;
      if (model.id === 'seedance-2-0') score += 3;
      if (model.id === 'seedance-2-0-fast') score -= 4;
    }
    if (model.id === 'sora') score -= 4;
    if (model.id === 'happy-horse-1-0' && lipSyncBrief) score += 4;
  } else if (focus === 'cinematic') {
    score += model.realismScore * 8 + model.motionScore * 5 + qualityScore[model.qualityLevel] * 3;
    if (model.id === 'veo-3-1') score += 9;
    if (model.id === 'sora') score += isSoraPreferredBrief(brief) ? 9 : -24;
    if (model.id === 'veo-3-1-fast') score += 4;
    if (model.id === 'veo-3-1-lite') score += veoLiteBudgetBrief || brief.budgetPriority === 'value' ? 18 : 5;
    if (model.id === 'happy-horse-1-0' && lipSyncBrief) score += 4;
  } else if (focus === 'social') {
    score += model.socialAdScore * 8 + model.motionScore * 3 + speedScore[model.relativeSpeedLevel] * 3;
    if (model.id.startsWith('kling-3')) score += 4;
    if (model.id === 'seedance-2-0-fast' || model.id === 'ltx-2-3') score += 4;
    if (model.id === 'veo-3-1-lite') score += veoLiteBudgetBrief || brief.budgetPriority === 'value' ? 16 : 4;
    if (model.id === 'happy-horse-1-0' && lipSyncBrief) score += 6;
    if (model.id === 'sora') score -= 34;
  } else if (focus === 'character') {
    score += model.motionScore * 7 + model.realismScore * 5 + qualityScore[model.qualityLevel] * 2;
    if (model.id === 'veo-3-1') score += 5;
    if (model.id === 'sora') score += isSoraPreferredBrief(brief) ? 5 : -18;
    if (model.id === 'seedance-2-0') score += 4;
    if (model.id === 'happy-horse-1-0' && lipSyncBrief) score += 6;
    if (model.id === 'veo-3-1-lite' && (brief.budgetPriority === 'value' || veoLiteBudgetBrief)) score += 12;
  } else if (focus === 'brand') {
    score += model.productDetailScore * 6 + qualityScore[model.qualityLevel] * 5 + model.socialAdScore * 2;
    if (model.id === 'kling-3-4k' || model.id === 'kling-3-pro') score += 6;
  } else {
    score += model.realismScore * 3 + model.motionScore * 3 + model.socialAdScore * 2;
  }

  if (model.id === 'sora' && !isSoraPreferredBrief(brief)) {
    score -= 18;
  }

  if (draftTesting) {
    if (model.id === 'ltx-2-3') score += 28;
    if (model.id === 'seedance-2-0-fast') score += 26;
    if (model.id === 'veo-3-1-lite') score += 24;
    if (model.id === 'seedance-2-0') score += 18;
    if (model.qualityLevel === 'premium') score -= 38;
  }

  if (lipSyncBrief) {
    if (model.id === 'happy-horse-1-0') score += 8;
    if (model.id === 'seedance-2-0') score += 16;
    if (model.id === 'seedance-2-0-fast') score += 8;
    if (model.id === 'kling-3-pro' || model.id === 'kling-3-standard') score += 13;
    if (model.id === 'ltx-2-3') score += 12;
    if (model.id === 'veo-3-1' || model.id === 'veo-3-1-fast') score += 14;
    if (model.id === 'veo-3-1-lite') score += 8;
  }

  if (veoLiteBudgetBrief && model.id === 'veo-3-1-lite') {
    score += 34;
  }

  if (playfulEffect) {
    if (model.id === 'pika') score += 32;
    if (model.id === 'hailuo') score += 12;
    if (model.id === 'seedance-2-0-fast') score += 8;
  }

  if ((model.id === 'pika' || model.id === 'hailuo') && !playfulEffect && !draftTesting) {
    score -= 24;
  }

  if ((model.id === 'pika' || model.id === 'hailuo') && isSeriousCommercialBrief(brief)) {
    score -= 36;
  }

  if (personReferenceI2V) {
    if (!compatibleGeneratedPerson && (model.id === 'seedance-2-0' || model.id === 'seedance-2-0-fast' || model.id === 'sora')) {
      score -= 1000;
    }
    if (model.id.startsWith('kling-3') || model.id === 'ltx-2-3') score += 30;
    if (model.id === 'happy-horse-1-0') score += lipSyncBrief && !isUploadedRealPersonReferenceImageToVideoBrief(brief) ? 6 : -18;
    if (model.id === 'veo-3-1' || model.id === 'veo-3-1-fast') score -= 10;
  } else if (compatibleGeneratedPerson) {
    if (model.id === 'seedance-2-0') score += 16;
    if (model.id === 'seedance-2-0-fast') score += 10;
  }

  if (brief.budgetPriority === 'value') {
    score += costScore[model.relativeCostLevel] * 6;
  } else if (brief.budgetPriority === 'balanced') {
    score += model.relativeCostLevel === 'medium' || model.relativeCostLevel === 'high' ? 5 : 2;
  } else if (brief.budgetPriority === 'quality') {
    score += qualityScore[model.qualityLevel] * 6;
  }

  if (brief.speedPriority === 'high') {
    score += speedScore[model.relativeSpeedLevel] * 5;
  } else if (brief.speedPriority === 'medium') {
    score += speedScore[model.relativeSpeedLevel] * 2;
  }

  if (brief.qualityPriority === 'maximum') {
    score += qualityScore[model.qualityLevel] * 7;
  } else if (brief.qualityPriority === 'balanced') {
    score += qualityScore[model.qualityLevel] * 3;
  } else if (brief.qualityPriority === 'draft') {
    score += speedScore[model.relativeSpeedLevel] * 4 + costScore[model.relativeCostLevel] * 3;
  }

  score += matchedTraitCount(model, brief) * 4;

  return score;
}

function selectWinnerForTier(
  tier: AiStrategistTierPosition,
  scoredModels: readonly ScoredModel[],
  brief: NormalizedBrief,
  selectedIds: Set<AiStrategistModelId>
): ScoredModel {
  const preferredCandidates = getPreferredCandidatesForTier(tier, scoredModels, brief);
  const tierCandidates = scoredModels.filter((entry) => entry.model.tierPosition === tier);
  const baseCandidates = preferredCandidates.length > 0 ? preferredCandidates : tierCandidates;
  const workflowCandidates = baseCandidates.filter((entry) => entry.model.supportedWorkflows.includes(brief.workflow));
  const eligibleCandidates = (workflowCandidates.length > 0 ? workflowCandidates : baseCandidates).filter((entry) =>
    isModelAllowedForBrief(entry.model, brief)
  );
  const withoutDuplicates = eligibleCandidates.filter((entry) => !selectedIds.has(entry.model.id));
  const candidates = withoutDuplicates.length > 0 ? withoutDuplicates : eligibleCandidates;
  const winner = [...candidates].sort((a, b) => b.score - a.score || a.index - b.index)[0];

  if (!winner) {
    throw new Error(`No AI Strategist models available for ${tier}`);
  }

  return winner;
}

function getPreferredCandidatesForTier(
  tier: AiStrategistTierPosition,
  scoredModels: readonly ScoredModel[],
  brief: NormalizedBrief
): readonly ScoredModel[] {
  const focus = detectFocusArea(brief);

  if (isDraftTestingBrief(brief)) {
    return candidatesByIds(scoredModels, {
      best: ['seedance-2-0-fast'],
      medium: ['veo-3-1-lite', 'seedance-2-0'],
      value: ['ltx-2-3', 'veo-3-1-lite'],
    }[tier]);
  }

  if (isPersonReferenceImageToVideoBrief(brief)) {
    if (isCompatibleGeneratedPersonWorkflow(brief)) {
      return candidatesByIds(scoredModels, {
        best: ['kling-3-pro', 'seedance-2-0', 'kling-3-standard', 'ltx-2-3', 'veo-3-1-fast', 'happy-horse-1-0'],
        medium: ['seedance-2-0'],
        value: ['ltx-2-3', 'veo-3-1-lite', 'seedance-2-0-fast', 'kling-3-standard', 'hailuo'],
      }[tier]);
    }

    return candidatesByIds(scoredModels, {
      best: ['kling-3-pro', 'kling-3-standard', 'ltx-2-3', 'veo-3-1-fast'],
      medium: ['kling-3-standard', 'ltx-2-3', 'kling-3-pro', 'veo-3-1-fast', 'happy-horse-1-0'],
      value: ['ltx-2-3', 'veo-3-1-lite', 'kling-3-standard', 'hailuo', 'pika'],
    }[tier]);
  }

  if (isLipSyncBrief(brief)) {
    const bestIds: readonly AiStrategistModelId[] =
      focus === 'cinematic'
        ? ['veo-3-1', 'seedance-2-0', 'kling-3-pro', 'ltx-2-3']
        : ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'ltx-2-3'];

    return candidatesByIds(scoredModels, {
      best: bestIds,
      medium: ['kling-3-pro', 'veo-3-1-fast', 'seedance-2-0'],
      value: ['veo-3-1-lite', 'ltx-2-3', 'kling-3-standard', 'seedance-2-0-fast'],
    }[tier]);
  }

  if (isVeoLiteBudgetBrief(brief)) {
    return candidatesByIds(scoredModels, {
      best: ['veo-3-1-fast', 'seedance-2-0', 'kling-3-pro'],
      medium: ['seedance-2-0', 'veo-3-1-fast'],
      value: ['veo-3-1-lite'],
    }[tier]);
  }

  if (focus === 'social' && (brief.speedPriority === 'high' || brief.budgetPriority === 'value')) {
    return candidatesByIds(scoredModels, {
      best: ['seedance-2-0'],
      medium: ['kling-3-pro'],
      value: isPlayfulEffectBrief(brief) ? ['pika'] : ['seedance-2-0-fast'],
    }[tier]);
  }

  if (focus === 'product') {
    if (isKling4kEscalationBrief(brief)) {
      return candidatesByIds(scoredModels, {
        best: ['kling-3-4k'],
        medium: ['kling-3-pro'],
        value: ['kling-3-standard', 'seedance-2-0', 'veo-3-1-lite'],
      }[tier]);
    }

    if (isStrictProductPreservationBrief(brief)) {
      return candidatesByIds(scoredModels, {
        best: ['kling-3-pro'],
        medium: ['kling-3-standard'],
        value: ['seedance-2-0', 'seedance-2-0-fast', 'kling-3-standard', 'veo-3-1-lite'],
      }[tier]);
    }

    if (isSocialFirstProductMotionBrief(brief)) {
      return candidatesByIds(scoredModels, {
        best: ['kling-3-pro'],
        medium: ['seedance-2-0', 'kling-3-standard'],
        value: ['seedance-2-0-fast', 'seedance-2-0', 'veo-3-1-lite', 'kling-3-standard'],
      }[tier]);
    }

    return candidatesByIds(scoredModels, {
      best: ['kling-3-pro'],
      medium: ['kling-3-standard', 'veo-3-1-fast', 'seedance-2-0'],
      value: ['kling-3-standard', 'seedance-2-0', 'seedance-2-0-fast', 'veo-3-1-lite'],
    }[tier]);
  }

  if (tier !== 'value') return [];

  if (focus === 'product') {
    return candidatesByIds(scoredModels, ['kling-3-standard', 'seedance-2-0', 'seedance-2-0-fast', 'veo-3-1-lite', 'ltx-2-3']);
  }

  if (focus === 'social' && isPlayfulEffectBrief(brief)) {
    return candidatesByIds(scoredModels, ['pika']);
  }

  if (focus === 'social') {
    return candidatesByIds(scoredModels, ['seedance-2-0-fast', 'veo-3-1-lite']);
  }

  if (focus === 'cinematic') {
    return candidatesByIds(scoredModels, ['veo-3-1-lite', 'ltx-2-3', 'seedance-2-0-fast', 'kling-3-standard', 'hailuo']);
  }

  if (focus === 'character') {
    return candidatesByIds(scoredModels, ['veo-3-1-lite', 'ltx-2-3', 'seedance-2-0-fast', 'kling-3-standard', 'pika']);
  }

  return [];
}

function candidatesByIds(scoredModels: readonly ScoredModel[], ids: readonly AiStrategistModelId[]): readonly ScoredModel[] {
  return ids
    .map((id) => scoredModels.find((entry) => entry.model.id === id))
    .filter((entry): entry is ScoredModel => Boolean(entry));
}

function normalizeBrief(briefInput: AiStrategistBriefInput): NormalizedBrief {
  if (typeof briefInput === 'string') {
    return {
      goal: briefInput,
      workflow: inferWorkflow(briefInput),
      promptStructure: inferPromptStructure(briefInput),
      budgetPriority: 'balanced',
      speedPriority: 'medium',
      qualityPriority: 'balanced',
      requiredTraits: [],
      sourceImageKind: 'generic',
      sourceImageGeneratedInWorkflow: false,
    };
  }

  const goal = briefInput.goal ?? '';
  return {
    ...briefInput,
    goal,
    workflow: briefInput.workflow ?? inferWorkflow(goal),
    promptStructure: briefInput.promptStructure ?? inferPromptStructure(goal),
    budgetPriority: briefInput.budgetPriority ?? 'balanced',
    speedPriority: briefInput.speedPriority ?? 'medium',
    qualityPriority: briefInput.qualityPriority ?? 'balanced',
    requiredTraits: briefInput.requiredTraits ?? [],
    sourceImageKind: briefInput.sourceImageKind ?? 'generic',
    sourceImageGeneratedInWorkflow: briefInput.sourceImageGeneratedInWorkflow ?? false,
  };
}

function inferWorkflow(goal: string): AiStrategistWorkflowId {
  const normalized = goal.toLowerCase();
  if (normalized.includes('source video') || normalized.includes('video-to-video') || normalized.includes('restyle')) {
    return 'video-to-video';
  }
  if (normalized.includes('reference image') || normalized.includes('reference-to-video') || normalized.includes('r2v') || normalized.includes('image-to-video')) {
    return 'image-to-video';
  }
  if (normalized.includes('product') || normalized.includes('packshot') || normalized.includes('brand asset')) {
    return 'text-to-image-then-image-to-video';
  }
  return 'text-to-video';
}

function inferPromptStructure(goal: string): AiStrategistPromptStructureId {
  const normalized = goal.toLowerCase();
  if (containsAny(normalized, ['product', 'ecommerce', 'packshot', 'packaging'])) return 'product-ad';
  if (containsAny(normalized, ['brand', 'logo', 'launch asset', 'hero asset'])) return 'brand-asset';
  if (containsAny(normalized, ['tiktok', 'reels', 'social', 'ugc', 'ad variant'])) return 'social-ad';
  if (containsAny(normalized, ['character', 'person', 'founder', 'avatar', 'emotion'])) return 'character-scene';
  return 'cinematic-scene';
}

function detectFocusArea(brief: AiStrategistBrief & { goal: string }): FocusArea {
  if (brief.promptStructure === 'product-ad') return 'product';
  if (brief.promptStructure === 'brand-asset') return 'brand';
  if (brief.promptStructure === 'social-ad') return 'social';
  if (brief.promptStructure === 'character-scene') return 'character';
  if (brief.promptStructure === 'cinematic-scene') return 'cinematic';

  const normalized = brief.goal.toLowerCase();
  if (containsAny(normalized, ['product', 'ecommerce', 'packshot', 'packaging'])) return 'product';
  if (containsAny(normalized, ['brand', 'logo'])) return 'brand';
  if (containsAny(normalized, ['social', 'tiktok', 'reels', 'ad'])) return 'social';
  if (containsAny(normalized, ['character', 'person', 'avatar'])) return 'character';
  if (containsAny(normalized, ['cinematic', 'realistic', 'film'])) return 'cinematic';
  return 'general';
}

function matchedTraitCount(model: AiStrategistModelEntry, brief: AiStrategistBrief & { goal: string }): number {
  const searchable = [
    model.promptStyle,
    ...model.bestFor,
    ...model.strengths,
    ...model.recommendedUseCases,
  ]
    .join(' ')
    .toLowerCase();

  return brief.requiredTraits?.filter((trait) => searchable.includes(trait.toLowerCase())).length ?? 0;
}

function buildMatchedSignals(
  model: AiStrategistModelEntry,
  brief: AiStrategistBrief & { goal: string; workflow: AiStrategistWorkflowId }
): readonly string[] {
  const focus = detectFocusArea(brief);
  const signals = [focus, brief.workflow];

  if (model.supportedWorkflows.includes(brief.workflow)) signals.push('workflow-supported');
  if (isDraftTestingBrief(brief)) signals.push('draft-testing');
  if (isPlayfulEffectBrief(brief)) signals.push('playful-effect');
  if (isLipSyncBrief(brief)) signals.push('lip-sync');
  if (isVeoLiteBudgetBrief(brief)) signals.push('veo-lite-budget');
  if (isPersonReferenceImageToVideoBrief(brief)) signals.push('person-reference-i2v');
  if (isCompatibleGeneratedPersonWorkflow(brief)) signals.push('generated-person-compatible');
  if (brief.qualityPriority === 'maximum' && model.qualityLevel === 'premium') signals.push('premium-quality');
  if (brief.speedPriority === 'high' && speedScore[model.relativeSpeedLevel] >= 4) signals.push('fast-iteration');
  if (brief.budgetPriority === 'value' && costScore[model.relativeCostLevel] >= 4) signals.push('cost-efficient');

  return signals;
}

function buildReason(
  model: AiStrategistModelEntry,
  brief: AiStrategistBrief & { goal: string },
  recommendationTier: AiStrategistTierPosition
): string {
  const focus = detectFocusArea(brief);
  const tier = recommendationTier;

  if (isDraftTestingBrief(brief)) {
    return `${model.label} is the ${tier} recommendation for fast, low-cost testing before premium rendering.`;
  }

  if (isPersonReferenceImageToVideoBrief(brief)) {
    if (model.id === 'happy-horse-1-0') {
      return `${model.label} is a strong candidate for compatible audio/lip-sync/spokesperson workflows, but review real-person image-to-video preservation carefully.`;
    }
    return `${model.label} is the ${tier} recommendation for safer person-reference image-to-video compatibility.`;
  }

  if (model.id === 'happy-horse-1-0') {
    return `${model.label} is a strong candidate for compatible audio/lip-sync/spokesperson workflows when the workflow matches its strengths.`;
  }

  if (model.id === 'veo-3-1-lite') {
    return `${model.label} is the ${tier} route for lower-cost Veo-family realistic drafts with native audio.`;
  }

  if (focus === 'product') {
    if (model.id === 'kling-3-pro') {
      return `${model.label} is the ${tier} default for premium product realism, controlled motion, and strong commercial quality without jumping to 4K.`;
    }
    if (model.id === 'kling-3-4k') {
      return `${model.label} is the ${tier} escalation when the brief asks for native 4K, maximum product detail, or premium export quality.`;
    }
    if (model.id === 'kling-3-standard') {
      return `${model.label} is the ${tier} tradeoff when product preservation and realistic motion still matter at lower cost.`;
    }
    if (model.id === 'seedance-2-0') {
      if (isStrictProductPreservationBrief(brief)) {
        return `${model.label} is the ${tier} fallback for cost-efficient product/object motion when exact label/text fidelity is less critical and details will be reviewed.`;
      }
      return `${model.label} is the ${tier} route for social-first product ads, dynamic motion, and vertical content when exact label/text fidelity is less critical.`;
    }
    if (model.id === 'seedance-2-0-fast') {
      return `${model.label} is the ${tier} route for quick low-cost testing and fast vertical ad iteration.`;
    }
    return `${model.label} is the ${tier} recommendation for product detail, controlled motion, and ad-ready composition.`;
  }

  if (focus === 'cinematic') {
    return `${model.label} is the ${tier} recommendation for realism, natural motion, and a coherent cinematic scene.`;
  }

  if (focus === 'social') {
    return `${model.label} is the ${tier} recommendation for short-form pacing, motion clarity, and efficient variant testing.`;
  }

  if (focus === 'character') {
    return `${model.label} is the ${tier} recommendation for character motion, identity anchors, and performance readability.`;
  }

  if (focus === 'brand') {
    return `${model.label} is the ${tier} recommendation for polished brand composition, controlled motion, and final-frame utility.`;
  }

  return `${model.label} is the ${tier} recommendation because its strengths match the workflow, quality target, and iteration needs.`;
}

function buildAlsoConsider(
  scoredModels: readonly ScoredModel[],
  brief: NormalizedBrief,
  selectedIds: ReadonlySet<AiStrategistModelId>
): readonly AiStrategistAlsoConsider[] {
  if (selectedIds.has('happy-horse-1-0') || !shouldAlsoConsiderHappyHorse(brief)) {
    return [];
  }

  const happyHorse = scoredModels.find((entry) => entry.model.id === 'happy-horse-1-0');
  if (!happyHorse || !happyHorse.model.supportedWorkflows.includes(brief.workflow)) {
    return [];
  }

  return [
    {
      model: happyHorse.model,
      reason: buildHappyHorseAlsoConsiderReason(brief),
      matchedSignals: [...new Set([...happyHorse.matchedSignals, 'specialized-audio-lip-sync'])],
    },
  ];
}

function shouldAlsoConsiderHappyHorse(brief: NormalizedBrief): boolean {
  if (!isLipSyncBrief(brief)) return false;
  if (isVoiceoverOnlyProductBrief(brief)) return false;

  return (
    isPersonReferenceImageToVideoBrief(brief) ||
    brief.workflow === 'video-to-video' ||
    isDraftTestingBrief(brief) ||
    hasVisibleSpeakingPerformanceSignal(brief)
  );
}

function buildHappyHorseAlsoConsiderReason(brief: NormalizedBrief): string {
  if (isPersonReferenceImageToVideoBrief(brief)) {
    return 'Happy Horse 1.0 if lip-sync/audio performance is more important than strict visual preservation.';
  }

  if (isDraftTestingBrief(brief)) {
    return 'Happy Horse 1.0 for testing dedicated lip-sync/spokesperson workflows.';
  }

  return 'Happy Horse 1.0 for compatible audio/lip-sync/spokesperson workflows.';
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function isModelAllowedForBrief(model: AiStrategistModelEntry, brief: NormalizedBrief): boolean {
  if (model.id === 'veo-3-1-lite' && brief.workflow === 'video-to-video' && !isVeoLiteExtendBrief(brief)) {
    return false;
  }

  if (
    isPersonReferenceImageToVideoBrief(brief) &&
    !isCompatibleGeneratedPersonWorkflow(brief) &&
    (model.id === 'seedance-2-0' || model.id === 'seedance-2-0-fast' || model.id === 'sora')
  ) {
    return false;
  }

  return true;
}

function isDraftTestingBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  return containsAny(text, draftTestingTerms) || (text.includes('iteration') && containsAny(text, ['rough', 'test', 'draft', 'low-cost', 'low cost']));
}

function isPlayfulEffectBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  return containsAny(briefText(brief), playfulEffectTerms);
}

function isLipSyncBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  if (isVoiceoverOnlyProductBrief(brief)) return false;
  if (containsAny(text, noSpeechTerms)) return false;
  if (
    containsAny(text, [
      'lip sync',
      'lip-sync',
      'lipsync',
      'talking avatar',
      'talking head',
      'spokesperson',
      'speaking',
      'spoken line',
      'synchronized speech',
      'synced speech',
    ])
  ) {
    return true;
  }
  return containsAny(text, lipSyncTerms);
}

function isVeoLiteBudgetBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  return containsAny(text, veoLiteBudgetTerms) || (text.includes('veo') && containsAny(text, ['budget', 'value', 'lower-cost', 'low-cost', 'cheap']));
}

function isVeoLiteExtendBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  return brief.workflow === 'video-to-video' && containsAny(briefText(brief), ['extend', 'extension', 'continue', 'continuation']);
}

function isVoiceoverOnlyProductBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  return detectFocusArea(brief) === 'product' && containsAny(text, ['voiceover', 'voice over']) && !hasVisibleSpeakingPerformanceSignal(brief);
}

function hasVisibleSpeakingPerformanceSignal(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  if (
    containsAny(text, [
      'no visible talking person',
      'no visible person',
      'no visible speaker',
      'voiceover only',
      'voice over only',
      'off-camera voiceover',
      'off camera voiceover',
    ])
  ) {
    return false;
  }

  return containsAny(text, [
    'talking avatar',
    'talking head',
    'spokesperson',
    'speaking person',
    'talking person',
    'human actor',
    'actor',
    'founder',
    'on-camera',
    'on camera',
    'face to camera',
    'dialogue',
    'spoken line',
    'lip-sync',
    'lip sync',
    'lipsync',
    'synchronized speech',
    'synced speech',
    'audio-first human performance',
  ]);
}

function isSeriousCommercialBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  return containsAny(briefText(brief), ['premium', 'commercial', 'luxury', '4k', 'high-detail', 'hero', 'ecommerce']);
}

function isSoraPreferredBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  if (text.includes('sora')) return true;
  if (detectFocusArea(brief) !== 'cinematic' && detectFocusArea(brief) !== 'character') return false;
  if (isDraftTestingBrief(brief) || isPlayfulEffectBrief(brief) || text.includes('generic fantasy')) return false;
  return containsAny(text, strongSoraFitTerms);
}

function isPersonReferenceImageToVideoBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  if (brief.workflow !== 'image-to-video') return false;
  if (personSourceImageKinds.has(brief.sourceImageKind ?? 'generic')) {
    return true;
  }

  return containsAny(briefText(brief), ['real person photo', 'uploaded human image', 'uploaded person', 'person image', 'face', 'spokesperson', 'avatar', 'character reference', 'preserve identity', 'preserve face']);
}

function isUploadedRealPersonReferenceImageToVideoBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  if (brief.workflow !== 'image-to-video') return false;
  if (brief.sourceImageKind === 'uploaded-person') return true;
  return containsAny(briefText(brief), ['real person photo', 'uploaded human image', 'uploaded person', 'person image', 'human image']);
}

function isCompatibleGeneratedPersonWorkflow(brief: AiStrategistBrief & { goal: string }): boolean {
  if (brief.sourceImageGeneratedInWorkflow) return true;
  if (brief.sourceImageKind === 'generated-person' || brief.sourceImageKind === 'generated-character') return true;
  return containsAny(briefText(brief), ['generated first with seedream', 'generated first with text-to-image', 'seedream text-to-image']);
}

function buildWarning(brief: NormalizedBrief): string | undefined {
  const warnings: string[] = [];
  if (isPersonReferenceImageToVideoBrief(brief)) {
    warnings.push(PERSON_REFERENCE_WARNING);
  }

  if (hasProductDetailWarningRisk(brief)) {
    warnings.push(PRODUCT_DETAIL_WARNING);
  }

  return warnings.length > 0 ? warnings.join(' ') : undefined;
}

function buildUpgradeNote(brief: NormalizedBrief): string | undefined {
  if (detectFocusArea(brief) === 'product' && !isKling4kEscalationBrief(brief)) {
    return 'Use Kling 3 4K if final 4K product detail is required.';
  }

  return undefined;
}

function briefText(brief: AiStrategistBrief & { goal: string }): string {
  return [brief.goal, ...(brief.requiredTraits ?? [])].join(' ').toLowerCase();
}

function isKling4kEscalationBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  return containsAny(briefText(brief), kling4kEscalationTerms);
}

function isStrictProductPreservationBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  return detectFocusArea(brief) === 'product' && containsAny(text, strictProductDetailTerms) && !isExactFidelityRelaxed(text);
}

function isSocialFirstProductMotionBrief(brief: AiStrategistBrief & { goal: string }): boolean {
  return detectFocusArea(brief) === 'product' && containsAny(briefText(brief), socialFirstProductTerms);
}

function hasProductDetailWarningRisk(brief: AiStrategistBrief & { goal: string }): boolean {
  const text = briefText(brief);
  return (
    detectFocusArea(brief) === 'product' &&
    containsAny(text, [...strictProductDetailTerms, 'label', 'labels', 'logo', 'logos', 'packaging', 'legal', 'perfume', 'skincare', 'jewelry'])
  );
}

function isExactFidelityRelaxed(text: string): boolean {
  return containsAny(text, ['less important', 'not important', 'not the main requirement', 'not required', 'less critical']);
}

const personSourceImageKinds = new Set(['uploaded-person', 'uploaded-character', 'generated-person', 'generated-character']);
