import { buildModelSpecificPrompt } from '../frontend/lib/ai-strategist/prompt-structures.ts';
import type {
  AiStrategistModelId,
  AiStrategistPromptStructureId,
  AiStrategistSourceImageKind,
  AiStrategistWorkflowId,
} from '../frontend/lib/ai-strategist/types.ts';

type PromptScenario = {
  id: number;
  label: string;
  modelId: AiStrategistModelId;
  workflow: AiStrategistWorkflowId;
  promptStructureId: AiStrategistPromptStructureId;
  brief: string;
  sourceImageKind?: AiStrategistSourceImageKind;
};

const scenarios: readonly PromptScenario[] = [
  {
    id: 1,
    label: 'Luxury perfume ad',
    modelId: 'kling-3-4k',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Luxury perfume ad on black marble in 9:16, glossy glass reflections, premium studio light, slow product reveal.',
  },
  {
    id: 2,
    label: 'Fast TikTok sneakers ad',
    modelId: 'seedance-2-0-fast',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Fast TikTok sneaker ad, vertical hook, quick product reveal, creator-style pacing, energetic but readable motion.',
  },
  {
    id: 3,
    label: 'Cheap storyboard draft',
    modelId: 'ltx-2-3',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Cheap storyboard draft for an ad concept with three simple timing beats before a premium render.',
  },
  {
    id: 4,
    label: 'Product photo to video',
    modelId: 'kling-3-pro',
    workflow: 'image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Use the product photo to create a smooth tabletop commercial move while preserving packaging, shape, color and label placement.',
  },
  {
    id: 5,
    label: 'Character/person reference image-to-video',
    modelId: 'kling-3-standard',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate an uploaded character reference image with stable face identity, calm spokesperson pose and subtle hand movement.',
    sourceImageKind: 'uploaded-character',
  },
  {
    id: 6,
    label: 'Social transformation effect',
    modelId: 'pika',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Playful before-and-after transformation effect for a vertical social post with one clean visual change.',
  },
  {
    id: 7,
    label: 'Talking avatar with native audio',
    modelId: 'happy-horse-1-0',
    workflow: 'text-to-video',
    promptStructureId: 'character-scene',
    brief: 'Talking avatar spokesperson clip in 9:16 with one short spoken line, native audio, lip-sync, clean studio light and subtle hand gesture.',
  },
  {
    id: 8,
    label: 'Budget realistic Veo draft',
    modelId: 'veo-3-1-lite',
    workflow: 'text-to-video',
    promptStructureId: 'cinematic-scene',
    brief: 'Budget realistic 9:16 creator-style product demo with native audio ambience, one simple camera move and lower-cost Veo iteration.',
  },
];

function main() {
  console.log('AI Strategist Prompt Generation Evaluation');
  console.log('Live LLM/RAG connected: no');
  console.log('');

  for (const scenario of scenarios) {
    const result = buildModelSpecificPrompt(scenario);
    console.log(`${scenario.id}. ${scenario.label}`);
    console.log(`Selected model: ${result.selectedModel.label}`);
    console.log(`Workflow: ${result.workflow}`);
    console.log(
      `Model-page prompt structure: ${result.modelPagePromptStructure.title} (${result.modelPagePromptStructure.sourcePath} ${result.modelPagePromptStructure.sourceKey})`
    );
    console.log(`Short reason: ${result.reason}`);
    console.log('Final MaxVideoAI prompt:');
    console.log(result.finalPrompt);
    console.log(`Negative prompt: ${result.negativePrompt}`);
    console.log(`Recommended settings: ${result.recommendedSettings.join('; ')}`);
    console.log(`Warning: ${result.warning ?? 'None'}`);
    console.log('');
  }
}

main();
