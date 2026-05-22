import type { AiStrategistWorkflowId, AiStrategistWorkflowRule } from './types';

export const AI_STRATEGIST_WORKFLOWS: readonly AiStrategistWorkflowRule[] = [
  {
    id: 'text-to-video',
    label: 'Text to video',
    description: 'The user starts from a written brief and needs the strategist to choose a video model directly.',
    bestFor: ['Cinematic scenes', 'character action', 'social concepts', 'rapid creative exploration'],
    avoidFor: ['Exact product packshots without a reference image', 'brand assets that require strict logo reproduction'],
    recommendedPromptStructures: ['cinematic-scene', 'social-ad', 'character-scene'],
    planningSteps: [
      'Identify the use case and output format.',
      'Choose the tier by quality, cost, and speed pressure.',
      'Convert the brief into a single coherent scene prompt.',
    ],
    tierGuidance: {
      best: 'Use premium models when realism, human emotion, or brand-film quality matters more than cost.',
      medium: 'Use balanced models when the user needs strong output with practical iteration speed.',
      value: 'Use value models for exploration, social variants, and early motion tests.',
    },
  },
  {
    id: 'image-to-video',
    label: 'Image to video',
    description: 'The user has a source image or reference asset and wants controlled motion around that asset.',
    bestFor: ['Product references', 'character references', 'brand visuals', 'controlled commercial motion'],
    avoidFor: ['No-reference requests that depend entirely on generated visual identity'],
    recommendedPromptStructures: ['product-ad', 'brand-asset', 'character-scene', 'social-ad'],
    planningSteps: [
      'Extract what must remain stable from the image.',
      'Choose a model with the right detail and motion tradeoff.',
      'Prompt the camera move and protected visual details separately.',
      'For real person or character reference images, prefer Kling or LTX; avoid Seedance and Sora unless the image was generated in a compatible workflow first.',
    ],
    tierGuidance: {
      best: 'Use best-tier models when the reference is a final brand or product asset.',
      medium: 'Use medium-tier models for campaign drafts where reference fidelity matters but iteration is still active.',
      value: 'Use value-tier models when testing movement, framing, or social variants from a reference.',
    },
  },
  {
    id: 'text-to-image-then-image-to-video',
    label: 'Text to image, then image to video',
    description:
      'The strategist should first plan a still image asset, then animate that approved image with a video model.',
    bestFor: ['Product ads', 'brand assets', 'packshot control', 'campaign key visuals'],
    avoidFor: ['Loose cinematic ideas where a still-image approval loop would slow down exploration'],
    recommendedPromptStructures: ['product-ad', 'brand-asset', 'social-ad'],
    planningSteps: [
      'Generate or select the still image direction first.',
      'Protect product, material, and brand details in the animation prompt.',
      'Choose the video tier based on product detail and campaign importance.',
    ],
    tierGuidance: {
      best: 'Use best-tier models for premium product detail and polished brand assets.',
      medium: 'Use medium-tier models for product campaigns that need quality without full premium cost.',
      value: 'Use value-tier models for motion tests after the still image direction is approved.',
    },
  },
  {
    id: 'video-to-video',
    label: 'Video to video',
    description: 'The user has a video source and wants restyling, refinement, extension, or guided transformation.',
    bestFor: ['Restyled clips', 'motion-preserving experiments', 'reference-led edits', 'animatic refinement'],
    avoidFor: ['Precise legal text changes', 'large story changes that conflict with the input video'],
    recommendedPromptStructures: ['cinematic-scene', 'character-scene', 'social-ad'],
    planningSteps: [
      'Identify what must remain from the source video.',
      'Separate preservation instructions from style or scene changes.',
      'Choose a model that supports reference-led continuity.',
    ],
    tierGuidance: {
      best: 'Use best-tier models when continuity and final polish are both important.',
      medium: 'Use medium-tier models for practical reference-led refinement and campaign options.',
      value: 'Use value-tier models for low-cost restyle tests and animatic iteration.',
    },
  },
];

export function getAiStrategistWorkflowRule(id: AiStrategistWorkflowId): AiStrategistWorkflowRule {
  const workflow = AI_STRATEGIST_WORKFLOWS.find((entry) => entry.id === id);
  if (!workflow) {
    throw new Error(`Unknown AI Strategist workflow: ${id}`);
  }
  return workflow;
}
