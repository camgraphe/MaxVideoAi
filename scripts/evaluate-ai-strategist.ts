import { recommendModelsForBrief } from '../frontend/lib/ai-strategist/recommendation-rules.ts';
import type {
  AiStrategistBrief,
  AiStrategistPromptStructureId,
  AiStrategistRecommendation,
  AiStrategistWorkflowId,
} from '../frontend/lib/ai-strategist/types.ts';

interface EvaluationScenario {
  id: number;
  label: string;
  brief: AiStrategistBrief;
  warning: string;
}

const scenarios: readonly EvaluationScenario[] = [
  {
    id: 1,
    label: 'Luxury perfume ad on black marble, 9:16',
    brief: {
      goal: 'Luxury perfume ad on black marble in 9:16, glossy reflections, premium lighting, slow push-in, elegant brand mood.',
      workflow: 'text-to-image-then-image-to-video',
      promptStructure: 'product-ad',
      qualityPriority: 'maximum',
      budgetPriority: 'quality',
      speedPriority: 'low',
      requiredTraits: ['product', 'premium', 'reflections'],
    },
    warning: 'Perfume labels and legal copy should be handled as final design overlays if exact text is required.',
  },
  {
    id: 2,
    label: 'Talking avatar / spokesperson style video',
    brief: {
      goal: 'Talking avatar spokesperson style video for a SaaS landing page, native audio, lip-sync, one short spoken line, realistic person, stable identity, clear expression, subtle hand gestures.',
      workflow: 'text-to-video',
      promptStructure: 'character-scene',
      qualityPriority: 'maximum',
      budgetPriority: 'balanced',
      speedPriority: 'medium',
      requiredTraits: ['character', 'realism', 'identity', 'native audio', 'lip-sync'],
    },
    warning: 'Keep the spoken line short and use a compatible audio/lip-sync workflow; exact script delivery should be reviewed after generation.',
  },
  {
    id: 3,
    label: 'Fast TikTok product ad for sneakers',
    brief: {
      goal: 'Fast TikTok product ad for new sneakers, vertical 9:16, energetic hook, quick shoe reveal, creator-style pacing.',
      workflow: 'text-to-video',
      promptStructure: 'social-ad',
      qualityPriority: 'draft',
      budgetPriority: 'value',
      speedPriority: 'high',
      requiredTraits: ['social', 'fast', 'product'],
    },
    warning: 'Use a product reference image if the sneaker design must match a specific SKU.',
  },
  {
    id: 4,
    label: 'Cinematic car commercial at night',
    brief: {
      goal: 'Cinematic car commercial at night on wet city streets, realistic reflections, smooth tracking camera, premium automotive mood.',
      workflow: 'text-to-video',
      promptStructure: 'cinematic-scene',
      qualityPriority: 'maximum',
      budgetPriority: 'quality',
      speedPriority: 'low',
      requiredTraits: ['cinematic', 'realism', 'motion'],
    },
    warning: 'Specific car badges, license plates, and exact model details should be avoided or composited separately.',
  },
  {
    id: 5,
    label: 'Image-to-video from a product photo',
    brief: {
      goal: 'Image-to-video from a product photo: keep packaging, shape, color, and label placement stable while adding a smooth tabletop camera move.',
      workflow: 'image-to-video',
      promptStructure: 'product-ad',
      qualityPriority: 'maximum',
      budgetPriority: 'balanced',
      speedPriority: 'medium',
      requiredTraits: ['product', 'reference', 'detail'],
    },
    warning: 'Even image-to-video may drift on tiny label text; protect typography in prompt and review closely.',
  },
  {
    id: 6,
    label: 'Fantasy creature animation',
    brief: {
      goal: 'Fantasy creature animation in an enchanted forest, expressive creature movement, magical atmosphere, cinematic camera drift.',
      workflow: 'text-to-video',
      promptStructure: 'cinematic-scene',
      qualityPriority: 'maximum',
      budgetPriority: 'balanced',
      speedPriority: 'medium',
      requiredTraits: ['cinematic', 'story', 'motion'],
    },
    warning: 'Creature anatomy and continuity should be constrained in the final prompt to avoid inconsistent limbs or silhouette drift.',
  },
  {
    id: 7,
    label: 'Cheap draft / storyboard for an ad concept',
    brief: {
      goal: 'Cheap draft storyboard for an ad concept, quick animatic, explore timing and visual direction before paying for premium renders.',
      workflow: 'text-to-video',
      promptStructure: 'social-ad',
      qualityPriority: 'draft',
      budgetPriority: 'value',
      speedPriority: 'high',
      requiredTraits: ['cheap', 'draft', 'storyboard'],
    },
    warning: 'Draft picks are for timing and direction; do not judge final realism or product fidelity from this pass.',
  },
  {
    id: 8,
    label: 'Premium 4K product shot with glass and reflections',
    brief: {
      goal: 'Premium 4K product shot with glass, reflections, transparent material, controlled highlights, luxury ecommerce hero video.',
      workflow: 'text-to-image-then-image-to-video',
      promptStructure: 'product-ad',
      qualityPriority: 'maximum',
      budgetPriority: 'quality',
      speedPriority: 'low',
      requiredTraits: ['4K', 'product', 'reflections', 'premium'],
    },
    warning: 'Transparent glass and reflections need simple scene geometry; cluttered setups can reduce product readability.',
  },
  {
    id: 9,
    label: 'Social media transformation effect',
    brief: {
      goal: 'Social media transformation effect, before-and-after visual change, vertical feed video, fast hook, playful motion.',
      workflow: 'text-to-video',
      promptStructure: 'social-ad',
      qualityPriority: 'balanced',
      budgetPriority: 'value',
      speedPriority: 'high',
      requiredTraits: ['social', 'fast', 'transformation'],
    },
    warning: 'Transformation effects should be kept visually simple so the before and after states remain understandable.',
  },
  {
    id: 10,
    label: 'Realistic human scene with subtle camera movement',
    brief: {
      goal: 'Realistic human scene with subtle camera movement, natural light, quiet emotion, believable body language, premium film look.',
      workflow: 'text-to-video',
      promptStructure: 'character-scene',
      qualityPriority: 'maximum',
      budgetPriority: 'quality',
      speedPriority: 'low',
      requiredTraits: ['human', 'realism', 'subtle camera'],
    },
    warning: 'Subtle emotion depends heavily on prompt specificity; avoid asking for too many emotional beats at once.',
  },
];

function main() {
  console.log('AI Strategist Recommendation Evaluation');
  console.log('Production behavior changed: recommendation rules updated locally; no live LLM/RAG connected');
  console.log('');

  for (const scenario of scenarios) {
    const recommendations = recommendModelsForBrief(scenario.brief);
    const detectedIntent = getDetectedIntent(recommendations.best, scenario.brief.promptStructure);
    const workflow = getRecommendedWorkflow(recommendations.best, scenario.brief.workflow);

    console.log(`${scenario.id}. ${scenario.label}`);
    console.log(`Detected intent: ${detectedIntent}`);
    console.log(`Recommended workflow: ${workflow}`);
    printRecommendation('Best', recommendations.best);
    if (recommendations.best.upgradeNote) {
      console.log(`Upgrade note: ${recommendations.best.upgradeNote}`);
    }
    printRecommendation('Medium', recommendations.medium);
    printRecommendation('Value', recommendations.value);
    console.log(`Warning or limitation: ${formatWarning(scenario.warning, recommendations)}`);
    console.log('');
  }
}

function printRecommendation(label: string, recommendation: AiStrategistRecommendation) {
  console.log(`${label}: ${recommendation.model.label} - ${recommendation.reason}`);
}

function getDetectedIntent(
  recommendation: AiStrategistRecommendation,
  fallback?: AiStrategistPromptStructureId
): string {
  return recommendation.matchedSignals[0] ?? fallback ?? 'general';
}

function getRecommendedWorkflow(
  recommendation: AiStrategistRecommendation,
  fallback?: AiStrategistWorkflowId
): string {
  return recommendation.matchedSignals[1] ?? fallback ?? 'text-to-video';
}

function formatWarning(scenarioWarning: string, recommendations: ReturnType<typeof recommendModelsForBrief>): string {
  const strategistWarning = recommendations.best.warning;
  if (!strategistWarning) return scenarioWarning;
  return `${strategistWarning} ${scenarioWarning}`;
}

main();
