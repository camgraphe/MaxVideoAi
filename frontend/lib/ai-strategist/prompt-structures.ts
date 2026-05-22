import { getAiStrategistModel } from './model-catalog';
import { getAiStrategistWorkflowRule } from './workflow-rules';
import type {
  AiStrategistModelId,
  AiStrategistPromptStructure,
  AiStrategistPromptStructureId,
  AiStrategistSourceImageKind,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from './types';

export const AI_STRATEGIST_PROMPT_STRUCTURES: readonly AiStrategistPromptStructure[] = [
  {
    id: 'product-ad',
    label: 'Product ad',
    goal: 'Create a commercial video that keeps the product readable while adding premium motion and conversion intent.',
    bestFor: ['Ecommerce ads', 'launch videos', 'packshots', 'paid social product creative'],
    requiredInputs: ['product', 'target buyer', 'surface or environment', 'main benefit', 'output format'],
    sections: [
      { label: 'Hero product', instruction: 'Name the product, material, color, scale, and what must stay readable.' },
      { label: 'Commercial setup', instruction: 'Describe surface, props, background, light, and brand mood.' },
      { label: 'Motion', instruction: 'Specify one camera move and one product movement or reveal.' },
      { label: 'End frame', instruction: 'Define the final composition and call-to-action-safe space.' },
    ],
    modelAdaptationHints: [
      'Use Kling 3 4K for premium detail and packaging hierarchy.',
      'Use Kling 3 Pro or Standard for social-ready product variants.',
      'Use Seedance, Veo Lite or LTX when motion timing and budget matter more than product detail.',
    ],
    negativePromptChecklist: ['warped product shape', 'unreadable labels', 'extra logos', 'cluttered background'],
  },
  {
    id: 'cinematic-scene',
    label: 'Cinematic scene',
    goal: 'Create a realistic scene with coherent subject action, lighting, camera behavior, and emotional tone.',
    bestFor: ['Brand films', 'story scenes', 'realistic environments', 'human emotion'],
    requiredInputs: ['subject', 'action', 'location', 'mood', 'camera behavior'],
    sections: [
      { label: 'Scene premise', instruction: 'State who or what is in the scene and what is happening.' },
      { label: 'Camera and light', instruction: 'Describe camera movement, lens feel, light source, and time of day.' },
      { label: 'Motion beat', instruction: 'Define the visible action progression in one concise sequence.' },
      { label: 'Realism guardrails', instruction: 'Name what should remain natural, grounded, and physically plausible.' },
    ],
    modelAdaptationHints: [
      'Use Veo 3.1 for premium realism and human-scene credibility.',
      'Use Sora for imaginative narrative scenes with strong continuity.',
      'Use Seedance 2.0, Happy Horse or Veo 3.1 Lite when motion, audio, or practical campaign speed matter.',
    ],
    negativePromptChecklist: ['uncanny faces', 'unmotivated camera moves', 'physics errors', 'style conflicts'],
  },
  {
    id: 'social-ad',
    label: 'Social ad',
    goal: 'Create a short-form ad that communicates a hook quickly and works in a feed.',
    bestFor: ['TikTok-style cuts', 'Reels ads', 'UGC-inspired creative', 'variant testing'],
    requiredInputs: ['platform or aspect ratio', 'hook', 'subject', 'offer or message', 'visual payoff'],
    sections: [
      { label: 'Hook', instruction: 'Open with the visual moment that stops scrolling.' },
      { label: 'Format', instruction: 'State vertical, square, or landscape framing and the intended pacing.' },
      { label: 'Visual payoff', instruction: 'Describe the transformation, reveal, or benefit shot.' },
      { label: 'Loop or ending', instruction: 'Define whether the final frame loops, lands a CTA, or resolves the story.' },
    ],
    modelAdaptationHints: [
      'Use Kling 3 Standard for value social ads with good product readability.',
      'Use Seedance 2.0 Fast, Veo 3.1 Lite or LTX 2.3 for rapid A/B motion testing.',
      'Use Veo 3.1 Fast when the social ad still needs realistic cinematic polish.',
    ],
    negativePromptChecklist: ['slow opening', 'confusing hook', 'crowded frame', 'tiny unreadable text'],
  },
  {
    id: 'character-scene',
    label: 'Character scene',
    goal: 'Create a character-led video with stable identity, clear performance, and believable movement.',
    bestFor: ['Founder videos', 'avatar scenes', 'story moments', 'creator-style scenes'],
    requiredInputs: ['character identity', 'wardrobe', 'action', 'environment', 'emotion'],
    sections: [
      { label: 'Character identity', instruction: 'Define age range, wardrobe, silhouette, and continuity anchors.' },
      { label: 'Performance', instruction: 'Describe expression, body language, and action beats.' },
      { label: 'Environment', instruction: 'State the location and objects that support the action.' },
      { label: 'Camera treatment', instruction: 'Use one camera move that helps the performance stay readable.' },
    ],
    modelAdaptationHints: [
      'Use Veo 3.1 for realistic human emotion and natural motion.',
      'Consider Happy Horse 1.0 as a strong candidate for compatible audio/lip-sync/spokesperson workflows, without making it the automatic Best pick.',
      'Use Sora for character scenes with stronger story arcs.',
      'Use Seedance 2.0 for practical motion-heavy character concepts.',
    ],
    negativePromptChecklist: ['identity drift', 'extra limbs', 'uncanny face', 'wardrobe changes'],
  },
  {
    id: 'brand-asset',
    label: 'Brand asset',
    goal: 'Create a polished brand-safe visual asset with controlled composition, color, and final-frame utility.',
    bestFor: ['Launch assets', 'hero visuals', 'brand loops', 'campaign key visuals'],
    requiredInputs: ['brand mood', 'colors', 'asset type', 'must-keep elements', 'final use'],
    sections: [
      { label: 'Brand system', instruction: 'Name color palette, visual tone, and any must-preserve elements.' },
      { label: 'Composition', instruction: 'Describe layout, safe space, focal point, and background simplicity.' },
      { label: 'Motion language', instruction: 'Specify subtle motion, reveal, or loop behavior.' },
      { label: 'Delivery intent', instruction: 'State where the asset will appear and how the ending should be framed.' },
    ],
    modelAdaptationHints: [
      'Use Kling 3 4K for premium brand/product loops with fine detail.',
      'Use Kling 3 Pro for campaign-ready social brand assets.',
      'Use Veo or Sora when the brand asset is more cinematic than product-specific.',
    ],
    negativePromptChecklist: ['off-brand colors', 'extra logos', 'messy composition', 'illegible text'],
  },
];

export function getAiStrategistPromptStructure(id: AiStrategistPromptStructureId): AiStrategistPromptStructure {
  const structure = AI_STRATEGIST_PROMPT_STRUCTURES.find((entry) => entry.id === id);
  if (!structure) {
    throw new Error(`Unknown AI Strategist prompt structure: ${id}`);
  }
  return structure;
}

export type AiStrategistModelPagePromptStructure = {
  id: 'quick' | 'structured' | 'pro' | 'storyboard';
  label: string;
  title: string;
  sourcePath: string;
  sourceKey: string;
};

export type AiStrategistModelSpecificPrompt = {
  selectedModel: ReturnType<typeof getAiStrategistModel>;
  selectedTier: AiStrategistTierPosition;
  workflow: AiStrategistWorkflowId;
  promptStructure: AiStrategistPromptStructure;
  modelPagePromptStructure: AiStrategistModelPagePromptStructure;
  reason: string;
  finalPrompt: string;
  negativePrompt: string;
  recommendedSettings: readonly string[];
  warning?: string;
};

export type AiStrategistPromptContextUploadedAsset = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

export type AiStrategistWorkflowPromptBlock = {
  label: string;
  fields: readonly {
    label: string;
    instruction: string;
  }[];
};

export type AiStrategistWorkflowPromptStructure = {
  id: AiStrategistWorkflowId;
  label: string;
  description: string;
  blocks: readonly AiStrategistWorkflowPromptBlock[];
  rules: readonly string[];
};

export type AiStrategistPromptGenerationContext = {
  userBrief: string;
  currentPrompt?: string;
  selectedModel: ReturnType<typeof getAiStrategistModel>;
  selectedWorkflow: AiStrategistWorkflowId;
  selectedTier?: AiStrategistTierPosition;
  promptStructure: AiStrategistPromptStructure;
  modelPagePromptStructure: AiStrategistModelPagePromptStructure;
  workflowPromptStructure: AiStrategistWorkflowPromptStructure;
  uploadedAsset?: AiStrategistPromptContextUploadedAsset;
  warnings: {
    product: readonly string[];
    person: readonly string[];
    reference: readonly string[];
    all: readonly string[];
  };
  negativePromptGuidance: {
    model: readonly string[];
    promptStructure: readonly string[];
    compiled: string;
  };
  settingsGuidance: readonly string[];
  maxVideoAiRules: readonly string[];
  outputFormatExamples: readonly string[];
};

const PRODUCT_DETAIL_WARNING =
  'Exact text, logos, legal copy, badges, plates, labels, packaging details, and tiny text may drift. Add critical details as overlays or check them after generation.';
const PERSON_REFERENCE_WARNING =
  'Person/character reference images need a compatible image-to-video model. Kling or LTX are safer choices for uploaded person/character preservation; Seedance/Sora should be avoided unless the image was generated in a compatible workflow first. Happy Horse remains limited for real-person image-to-video preservation.';
const SOCIAL_PRODUCT_AUDIO_LINE = 'Energetic whoosh SFX on the reveal, light sneaker impact sound, upbeat social ad rhythm, no dialogue.';
const PRODUCT_VOICEOVER_AUDIO_LINE =
  'Off-camera voiceover narration over the product video, energetic whoosh SFX on the reveal, light product impact cue, no visible talking person.';
const LIP_SYNC_AUDIO_LINE =
  'Use a compatible lip-sync/audio workflow, natural voice delivery, no background music overpowering the speech; keep the line short for more reliable lip-sync.';
const PRODUCT_DETAIL_TERMS = [
  'label',
  'labels',
  'packaging',
  'package',
  'logo',
  'logos',
  'legal copy',
  'perfume',
  'perfume bottle',
  'sneaker',
  'sneakers',
  'car',
  'cars',
  'badge',
  'badges',
  'plate',
  'plates',
  'license plate',
  'tiny text',
  'small text',
] as const;

export function buildModelSpecificPrompt(input: {
  modelId: AiStrategistModelId;
  promptStructureId: AiStrategistPromptStructureId;
  brief: string;
  workflow: AiStrategistWorkflowId;
  selectedTier?: AiStrategistTierPosition;
  sourceImageKind?: AiStrategistSourceImageKind;
}): AiStrategistModelSpecificPrompt {
  const model = getAiStrategistModel(input.modelId);
  const structure = getAiStrategistPromptStructure(input.promptStructureId);
  const selectedTier = input.selectedTier ?? model.tierPosition;
  const modelPagePromptStructure = selectModelPagePromptStructure(input);
  const finalPrompt = buildFinalPrompt({
    brief: input.brief,
    modelId: input.modelId,
    promptStructureId: input.promptStructureId,
    workflow: input.workflow,
    sourceImageKind: input.sourceImageKind,
  });
  const negativePrompt = buildNegativePrompt(input.promptStructureId, input.modelId, input.sourceImageKind);
  const warning = buildPromptWarning(input.brief, input.workflow, input.sourceImageKind);

  return {
    selectedModel: model,
    selectedTier,
    workflow: input.workflow,
    promptStructure: structure,
    modelPagePromptStructure,
    reason: buildPromptReason(modelPagePromptStructure, input.workflow, input.promptStructureId, input.modelId),
    finalPrompt,
    negativePrompt,
    recommendedSettings: buildRecommendedSettings(input.modelId, input.workflow, input.promptStructureId, input.brief),
    ...(warning ? { warning } : {}),
  };
}

export function buildPromptGenerationContext(input: {
  modelId: AiStrategistModelId;
  promptStructureId: AiStrategistPromptStructureId;
  brief: string;
  workflow: AiStrategistWorkflowId;
  selectedTier?: AiStrategistTierPosition;
  sourceImageKind?: AiStrategistSourceImageKind;
  currentPrompt?: string;
  uploadedAsset?: AiStrategistPromptContextUploadedAsset;
}): AiStrategistPromptGenerationContext {
  const model = getAiStrategistModel(input.modelId);
  const promptStructure = getAiStrategistPromptStructure(input.promptStructureId);
  const modelPagePromptStructure = selectModelPagePromptStructure(input);
  const workflowPromptStructure = buildWorkflowPromptStructure(input.workflow);
  const warnings = buildContextWarnings(input);
  const negativePromptGuidance = {
    model: model.negativePromptGuidance,
    promptStructure: promptStructure.negativePromptChecklist,
    compiled: buildNegativePrompt(input.promptStructureId, input.modelId, input.sourceImageKind),
  };

  return {
    userBrief: input.brief,
    ...(input.currentPrompt ? { currentPrompt: input.currentPrompt } : {}),
    selectedModel: model,
    selectedWorkflow: input.workflow,
    ...(input.selectedTier ? { selectedTier: input.selectedTier } : {}),
    promptStructure,
    modelPagePromptStructure,
    workflowPromptStructure,
    ...(input.uploadedAsset ? { uploadedAsset: input.uploadedAsset } : {}),
    warnings,
    negativePromptGuidance,
    settingsGuidance: buildRecommendedSettings(input.modelId, input.workflow, input.promptStructureId, input.brief),
    maxVideoAiRules: buildMaxVideoAiRules(input, warnings),
    outputFormatExamples: buildOutputFormatExamples(input.workflow),
  };
}

const MODEL_PAGE_PROMPT_STRUCTURES: Record<string, Record<AiStrategistModelPagePromptStructure['id'], AiStrategistModelPagePromptStructure>> = {
  'kling-3-4k': {
    quick: modelPageStructure('quick', 'Final master', 'Final 4K delivery prompt', 'content/models/en/kling-3-4k.json'),
    structured: modelPageStructure('structured', 'Reference', 'Image-to-video master prompt', 'content/models/en/kling-3-4k.json'),
    pro: modelPageStructure('pro', 'Audio', 'Audio decision prompt', 'content/models/en/kling-3-4k.json'),
    storyboard: modelPageStructure('storyboard', 'Cost control', '4K escalation checklist', 'content/models/en/kling-3-4k.json'),
  },
  'kling-3-pro': {
    quick: modelPageStructure('quick', 'Single shot', 'Single-shot prompt', 'content/models/en/kling-3-pro.json'),
    structured: modelPageStructure('structured', 'Multi-shot', 'Multi-shot prompt', 'content/models/en/kling-3-pro.json'),
    pro: modelPageStructure('pro', 'Elements + Audio', 'Elements / voices prompt', 'content/models/en/kling-3-pro.json'),
    storyboard: modelPageStructure('storyboard', 'Shot list', 'Shot-list prompt', 'content/models/en/kling-3-pro.json'),
  },
  'kling-3-standard': {
    quick: modelPageStructure('quick', 'Quick', 'Quick prompt (fast iteration)', 'content/models/en/kling-3-standard.json'),
    structured: modelPageStructure('structured', 'Structured', 'Structured prompt (best for reliable results)', 'content/models/en/kling-3-standard.json'),
    pro: modelPageStructure('pro', 'Pro', 'Pro prompt (ultra-specific film crew brief)', 'content/models/en/kling-3-standard.json'),
    storyboard: modelPageStructure('storyboard', 'Storyboard', 'Storyboard prompt (multi-shot / shot list)', 'content/models/en/kling-3-standard.json'),
  },
  'seedance-2-0-fast': {
    quick: modelPageStructure('quick', 'Text', 'Text-to-video test prompt', 'content/models/en/seedance-2-0-fast.json'),
    structured: modelPageStructure('structured', 'Start/End', 'Image-to-video transition test', 'content/models/en/seedance-2-0-fast.json'),
    pro: modelPageStructure('pro', 'References', 'Reference continuity test', 'content/models/en/seedance-2-0-fast.json'),
    storyboard: modelPageStructure('storyboard', 'Compare', 'Comparison / handoff prompt', 'content/models/en/seedance-2-0-fast.json'),
  },
  'seedance-2-0': {
    quick: modelPageStructure('quick', 'Text', 'Text-to-video prompt', 'content/models/en/seedance-2-0.json'),
    structured: modelPageStructure('structured', 'Start/End', 'Image-to-video with optional end frame', 'content/models/en/seedance-2-0.json'),
    pro: modelPageStructure('pro', 'References', 'Reference-to-video prompt', 'content/models/en/seedance-2-0.json'),
    storyboard: modelPageStructure('storyboard', 'Timeline', 'Timeline / multi-shot prompt', 'content/models/en/seedance-2-0.json'),
  },
  'veo-3-1': {
    quick: modelPageStructure('quick', 'Text', 'Text-to-video prompt', 'content/models/en/veo-3-1.json'),
    structured: modelPageStructure('structured', 'Refs', 'Reference prompt', 'content/models/en/veo-3-1.json'),
    pro: modelPageStructure('pro', 'First/Last', 'First/last frame prompt', 'content/models/en/veo-3-1.json'),
    storyboard: modelPageStructure('storyboard', 'Extend', 'Extend prompt', 'content/models/en/veo-3-1.json'),
  },
  'veo-3-1-fast': {
    quick: modelPageStructure('quick', 'Quick', 'Quick prompt (fast iteration)', 'content/models/en/veo-3-1-fast.json'),
    structured: modelPageStructure('structured', 'Structured', 'Structured prompt (reliable draft)', 'content/models/en/veo-3-1-fast.json'),
    pro: modelPageStructure('pro', 'Reference-to-video', 'Reference-to-video prompt (1-4 stills)', 'content/models/en/veo-3-1-fast.json'),
    storyboard: modelPageStructure('storyboard', 'First/Last', 'First/last frame prompt', 'content/models/en/veo-3-1-fast.json'),
  },
  'veo-3-1-lite': {
    quick: modelPageStructure('quick', 'Quick', 'Quick prompt (fast iteration)', 'content/models/en/veo-3-1-lite.json'),
    structured: modelPageStructure('structured', 'Structured', 'Structured prompt (reliable draft)', 'content/models/en/veo-3-1-lite.json'),
    pro: modelPageStructure('pro', 'First/Last', 'First/last frame prompt', 'content/models/en/veo-3-1-lite.json'),
    storyboard: modelPageStructure('storyboard', 'Extend', 'Extend prompt', 'content/models/en/veo-3-1-lite.json'),
  },
  'happy-horse-1-0': {
    quick: modelPageStructure('quick', 'Native audio', 'Native audio launch clip prompt', 'content/models/en/happy-horse-1-0.json', 'promptStructure.quote'),
    structured: modelPageStructure('structured', 'Image flow', 'Image-to-video native-audio prompt', 'content/models/en/happy-horse-1-0.json', 'promptStructure.steps'),
    pro: modelPageStructure('pro', 'References', 'R2V reference and lip-sync prompt', 'content/models/en/happy-horse-1-0.json', 'prompts'),
    storyboard: modelPageStructure('storyboard', 'Video edit', 'Video edit prompt', 'content/models/en/happy-horse-1-0.json', 'prompts'),
  },
  'ltx-2-3': {
    quick: modelPageStructure('quick', 'Quick', 'Quick prompt (fastest draft)', 'content/models/en/ltx-2-3-fast.json'),
    structured: modelPageStructure('structured', 'Structured', 'Structured prompt (repeatable)', 'content/models/en/ltx-2-3-fast.json'),
    pro: modelPageStructure('pro', 'Image flow', 'Image-to-Video prompt', 'content/models/en/ltx-2-3-fast.json'),
    storyboard: modelPageStructure('storyboard', 'Storyboard', 'Storyboard prompt (generate-only sequence)', 'content/models/en/ltx-2-3-fast.json'),
  },
  pika: {
    quick: modelPageStructure('quick', 'Quick', 'Quick prompt (fast iteration)', 'content/models/en/pika-text-to-video.json'),
    structured: modelPageStructure('structured', 'Structured', 'Structured prompt (best for reliable results)', 'content/models/en/pika-text-to-video.json'),
    pro: modelPageStructure('pro', 'Pro', 'Pro prompt (ultra-specific studio brief)', 'content/models/en/pika-text-to-video.json'),
    storyboard: modelPageStructure('structured', 'Structured', 'Structured prompt (best for reliable results)', 'content/models/en/pika-text-to-video.json'),
  },
};

function modelPageStructure(
  id: AiStrategistModelPagePromptStructure['id'],
  label: string,
  title: string,
  sourcePath: string,
  sourceKey = `custom.promptingTabs.${id}`
): AiStrategistModelPagePromptStructure {
  return {
    id,
    label,
    title,
    sourcePath,
    sourceKey,
  };
}

function selectModelPagePromptStructure(input: {
  modelId: AiStrategistModelId;
  promptStructureId: AiStrategistPromptStructureId;
  workflow: AiStrategistWorkflowId;
  sourceImageKind?: AiStrategistSourceImageKind;
}): AiStrategistModelPagePromptStructure {
  const modelStructures = MODEL_PAGE_PROMPT_STRUCTURES[input.modelId] ?? MODEL_PAGE_PROMPT_STRUCTURES['kling-3-standard'];
  if (input.modelId === 'kling-3-4k') {
    return input.workflow === 'image-to-video' || input.workflow === 'text-to-image-then-image-to-video'
      ? modelStructures.structured
      : modelStructures.quick;
  }
  if (input.modelId === 'kling-3-pro') return input.workflow === 'image-to-video' ? modelStructures.quick : modelStructures.structured;
  if (input.modelId === 'kling-3-standard') return input.promptStructureId === 'character-scene' ? modelStructures.structured : modelStructures.quick;
  if (input.modelId === 'seedance-2-0-fast') return input.workflow === 'text-to-video' ? modelStructures.quick : modelStructures.structured;
  if (input.modelId === 'seedance-2-0') {
    if (input.workflow === 'text-to-video') return modelStructures.quick;
    if (input.workflow === 'video-to-video') return modelStructures.storyboard;
    if (input.workflow === 'image-to-video') return modelStructures.structured;
    return modelStructures.structured;
  }
  if (input.modelId === 'veo-3-1' || input.modelId === 'veo-3-1-fast' || input.modelId === 'veo-3-1-lite') {
    if (input.workflow === 'video-to-video') return modelStructures.storyboard;
    if (input.workflow === 'image-to-video') return modelStructures.structured;
    if (input.workflow === 'text-to-image-then-image-to-video') return modelStructures.pro;
    return input.modelId === 'veo-3-1' ? modelStructures.quick : modelStructures.structured;
  }
  if (input.modelId === 'happy-horse-1-0') {
    if (input.workflow === 'video-to-video') return modelStructures.storyboard;
    if (input.workflow === 'image-to-video') return input.sourceImageKind ? modelStructures.pro : modelStructures.structured;
    return modelStructures.quick;
  }
  if (input.modelId === 'ltx-2-3') return input.workflow === 'image-to-video' ? modelStructures.pro : modelStructures.storyboard;
  if (input.modelId === 'pika') return modelStructures.structured;
  return modelStructures.quick;
}

function buildWorkflowPromptStructure(workflow: AiStrategistWorkflowId): AiStrategistWorkflowPromptStructure {
  const workflowRule = getAiStrategistWorkflowRule(workflow);
  const sharedRules = [
    'Write the final prompt as directly usable MaxVideoAI text.',
    'Keep the structure explicit and field-by-field.',
    'Use audio only when it supports the selected workflow, brief, or approval pass.',
  ];

  if (workflow === 'image-to-video') {
    return {
      id: workflow,
      label: workflowRule.label,
      description: workflowRule.description,
      blocks: [
        {
          label: 'Image-to-video prompt',
          fields: [
            { label: 'Reference', instruction: 'Name the MaxVideoAI reference image role and what it anchors.' },
            { label: 'Preserve', instruction: 'List identity, product, text/logo areas, palette, materials, and composition that must stay stable.' },
            { label: 'Motion', instruction: 'Describe one controlled subject/product/action movement.' },
            { label: 'Camera', instruction: 'Specify shot size, framing, aspect ratio, angle, and one camera move.' },
            { label: 'Atmosphere', instruction: 'Define lighting, environment, palette, and mood.' },
            { label: 'End frame', instruction: 'Define the final stable pose, product angle, or composition.' },
            { label: 'Audio', instruction: 'Add ambience, SFX, voiceover, or short lip-sync guidance only when useful.' },
          ],
        },
      ],
      rules: [
        ...sharedRules,
        'Reference preservation must be separated from motion instructions.',
        'For uploaded people or character references, protect identity and use compatible image-to-video guidance.',
      ],
    };
  }

  if (workflow === 'text-to-image-then-image-to-video') {
    return {
      id: workflow,
      label: workflowRule.label,
      description: workflowRule.description,
      blocks: [
        {
          label: 'Starting image prompt',
          fields: [
            { label: 'Product/subject', instruction: 'Describe the still image subject, material, color, scale, and required readability.' },
            { label: 'Composition', instruction: 'Define framing, surface, background, safe space, and approval-ready layout.' },
            { label: 'Lighting', instruction: 'Describe light direction, highlights, reflections, and palette.' },
            { label: 'Preserve for video', instruction: 'List what the animation must keep from the generated starting image.' },
          ],
        },
        {
          label: 'Video animation prompt',
          fields: [
            { label: 'Reference', instruction: 'State that the MaxVideoAI starting image is the product/scene anchor.' },
            { label: 'Preserve', instruction: 'Protect product shape, identity, material finish, logos/text areas, and final composition.' },
            { label: 'Motion', instruction: 'Describe one controlled animation beat.' },
            { label: 'Camera', instruction: 'Specify framing, aspect ratio, angle, and one camera move.' },
            { label: 'Atmosphere', instruction: 'Carry over lighting, palette, texture, and mood from the starting image.' },
            { label: 'End frame', instruction: 'Define the final hero frame, hold, loop, or CTA-safe composition.' },
            { label: 'Audio', instruction: 'Add ambience/SFX/voiceover guidance when useful; keep approval passes silent if needed.' },
          ],
        },
      ],
      rules: [
        ...sharedRules,
        'Do not collapse the starting image and video animation instructions into one block.',
        'Say “create the starting image with MaxVideoAI image generation” when a starting image is required.',
      ],
    };
  }

  if (workflow === 'video-to-video') {
    return {
      id: workflow,
      label: workflowRule.label,
      description: workflowRule.description,
      blocks: [
        {
          label: 'Video-to-video prompt',
          fields: [
            { label: 'Source clip', instruction: 'Describe the uploaded/source video role as the timing and motion base.' },
            { label: 'Preserve', instruction: 'List subject identity, usable timing, motion, framing, and audio intent to keep.' },
            { label: 'Edit direction', instruction: 'Describe the restyle, refinement, extension, or transformation goal.' },
            { label: 'Camera/motion', instruction: 'Explain what can move or change without fighting the source clip.' },
            { label: 'Audio handling', instruction: 'State whether source audio should be kept, regenerated, or guided with new audio cues.' },
            { label: 'End frame', instruction: 'Define the final pose, product beat, or story beat.' },
          ],
        },
      ],
      rules: [
        ...sharedRules,
        'Separate preserved source-video facts from requested style or story changes.',
        'Do not ask for changes that conflict with the source timing or source identity.',
      ],
    };
  }

  return {
    id: workflow,
    label: workflowRule.label,
    description: workflowRule.description,
    blocks: [
      {
        label: 'Text-to-video prompt',
        fields: [
          { label: 'Subject', instruction: 'Describe who or what appears with 2-3 defining traits.' },
          { label: 'Action', instruction: 'Describe one visible action or one timed beat.' },
          { label: 'Camera', instruction: 'Specify shot size, aspect ratio, angle, one move, and optional transition.' },
          { label: 'Style', instruction: 'Define lighting, palette, texture, lens feel, and realism/stylization level.' },
          { label: 'Audio', instruction: 'Add ambience, SFX, voiceover, dialogue, or “off” guidance based on the brief and model.' },
        ],
      },
    ],
    rules: sharedRules,
  };
}

function buildContextWarnings(input: {
  brief: string;
  workflow: AiStrategistWorkflowId;
  sourceImageKind?: AiStrategistSourceImageKind;
  uploadedAsset?: AiStrategistPromptContextUploadedAsset;
}): AiStrategistPromptGenerationContext['warnings'] {
  const text = input.brief.toLowerCase();
  const product: string[] = [];
  const person: string[] = [];
  const reference: string[] = [];

  if (hasProductDetailRisk(text) || input.uploadedAsset?.hasLogo || input.uploadedAsset?.hasText) {
    product.push(PRODUCT_DETAIL_WARNING);
  }

  if (
    input.workflow === 'image-to-video' &&
    (isPersonSource(input.sourceImageKind) ||
      input.uploadedAsset?.hasPerson ||
      ['person', 'face', 'spokesperson', 'avatar', 'character reference'].some((term) => text.includes(term)))
  ) {
    person.push(PERSON_REFERENCE_WARNING);
  }

  if (input.workflow === 'image-to-video' || input.uploadedAsset?.isReferenceImage) {
    reference.push('Reference assets should anchor identity, product shape, composition, and timing, while motion stays simple and controlled.');
  }

  return {
    product,
    person,
    reference,
    all: uniqueContextStrings([...product, ...person, ...reference]),
  };
}

function buildMaxVideoAiRules(
  input: {
    brief: string;
    workflow: AiStrategistWorkflowId;
    sourceImageKind?: AiStrategistSourceImageKind;
    uploadedAsset?: AiStrategistPromptContextUploadedAsset;
  },
  warnings: AiStrategistPromptGenerationContext['warnings']
): readonly string[] {
  const rules = [
    'Do not mention Midjourney, DALL-E, Runway, or external tools by default.',
    'Use the selected MaxVideoAI model, selected workflow, settings guidance, and compatibility warnings as constraints.',
    'Do not auto-run generation, spend credits, or imply the video has already been generated.',
    'Return polished prompt text that is directly usable in MaxVideoAI.',
    'Avoid overpromising words like flawless, perfect, guaranteed, or always.',
    'Voiceover means off-camera narration unless the brief explicitly asks for a visible talking person, spokesperson, avatar, or lip-sync.',
  ];

  if (input.workflow === 'text-to-image-then-image-to-video') {
    rules.push('Create the starting image with MaxVideoAI image generation before animating it with the selected video model.');
  }
  if (input.workflow === 'image-to-video' || input.uploadedAsset?.isReferenceImage) {
    rules.push('Use a reference image in MaxVideoAI as the preservation anchor.');
  }
  if (warnings.product.length > 0) {
    rules.push(PRODUCT_DETAIL_WARNING);
  }
  if (warnings.person.length > 0) {
    rules.push(PERSON_REFERENCE_WARNING);
  }

  return uniqueContextStrings(rules);
}

function buildOutputFormatExamples(workflow: AiStrategistWorkflowId): readonly string[] {
  if (workflow === 'image-to-video') {
    return [
      'Reference:\n[Use the MaxVideoAI reference image as the anchor]\n\nPreserve:\n[Identity/product/material/composition details]\n\nMotion:\n[One controlled movement]\n\nCamera:\n[Shot size + angle + one move]\n\nAtmosphere:\n[Lighting + palette + environment]\n\nEnd frame:\n[Stable final pose/product angle]\n\nAudio:\n[Ambience/SFX/voiceover/lip-sync guidance or off]',
    ];
  }

  if (workflow === 'text-to-image-then-image-to-video') {
    return [
      'Starting image prompt:\nProduct/subject: [Still image subject and defining details]\nComposition: [Framing, surface, background, safe space]\nLighting: [Light direction, reflections, palette]\nPreserve for video: [Details the animation must keep]\n\nVideo animation prompt:\nReference: [Use the MaxVideoAI starting image as the anchor]\nPreserve: [Product/identity/material/composition details]\nMotion: [One controlled animation beat]\nCamera: [Aspect ratio + angle + one move]\nAtmosphere: [Carry over lighting, palette, texture]\nEnd frame: [Final hero frame or loop point]\nAudio: [Ambience/SFX/voiceover guidance or off]',
    ];
  }

  if (workflow === 'video-to-video') {
    return [
      'Source clip:\n[Uploaded/source video role]\n\nPreserve:\n[Identity, timing, motion, framing, audio intent]\n\nEdit direction:\n[Restyle/refine/extend goal]\n\nCamera/motion:\n[What can change safely]\n\nAudio handling:\n[Keep, regenerate, or guide audio]\n\nEnd frame:\n[Final pose/product/story beat]',
    ];
  }

  return [
    'Subject:\n[Who/what appears + 2-3 defining traits]\n\nAction:\n[One visible action or timed beat]\n\nCamera:\n[Shot size + aspect ratio + angle + one move]\n\nStyle:\n[Lighting + palette + texture / lens feel]\n\nAudio:\n[Ambience + SFX + optional voiceover/dialogue, or off]',
  ];
}

function buildFinalPrompt(input: {
  brief: string;
  modelId: AiStrategistModelId;
  promptStructureId: AiStrategistPromptStructureId;
  workflow: AiStrategistWorkflowId;
  sourceImageKind?: AiStrategistSourceImageKind;
}): string {
  if (input.modelId === 'kling-3-4k') return buildKling4kPrompt(input);
  if (input.modelId === 'kling-3-pro') return buildKlingProPrompt(input);
  if (input.modelId === 'kling-3-standard') return buildKlingStandardPrompt(input);
  if (input.modelId === 'seedance-2-0') return buildSeedancePrompt(input);
  if (input.modelId === 'seedance-2-0-fast') return buildSeedanceFastPrompt(input);
  if (input.modelId === 'veo-3-1' || input.modelId === 'veo-3-1-fast' || input.modelId === 'veo-3-1-lite') return buildVeoPrompt(input);
  if (input.modelId === 'happy-horse-1-0') return buildHappyHorsePrompt(input);
  if (input.modelId === 'ltx-2-3') return buildLtxPrompt(input);
  if (input.modelId === 'pika') return buildPikaPrompt(input);
  return input.brief;
}

function buildKling4kPrompt(input: { brief: string; workflow: AiStrategistWorkflowId }): string {
  if (input.workflow === 'text-to-image-then-image-to-video') {
    const product = buildKling4kProductSubject(input.brief);
    const prompt = [
      'Starting image prompt:',
      `Campaign brief: ${input.brief}`,
      `Product: ${product.subject}.`,
      `Composition: ${product.composition}`,
      'Lighting: premium studio key light, controlled rim highlights, clean reflections and deep background separation.',
      `Materials: ${product.materials}`,
      `Preserve for video: ${product.preserve}`,
      '',
      'Video animation prompt:',
      'Source image role: product geometry and approved final framing.',
      `Keep: ${product.preserve}`,
      `Animate: ${product.motion}`,
      'Camera: locked 9:16 macro product framing, small controlled push-in, no sudden orbit.',
      'End frame: centered product, readable product shape, clean negative space for editorial finishing.',
      'Delivery: native 4K, 6-10 seconds.',
      'Audio: subtle studio ambience, soft product reveal SFX, no dialogue.',
      productOverlayInstruction(input.brief),
    ];
    return compactLines(prompt).join('\n');
  }

  return [
    'Shot goal:',
    `Final native 4K delivery for: ${input.brief}`,
    '',
    'Subject:',
    'One approved product or scene with no extra hero subjects.',
    '',
    'Action:',
    'One clean readable motion beat that preserves the approved composition.',
    '',
    'Camera:',
    'Locked framing with one controlled camera move.',
    '',
    'Style:',
    'Approved lighting, palette and lens feel from the campaign direction.',
    '',
    'Delivery:',
    'Native 4K, short-form duration.',
    '',
    'Audio:',
    'Subtle ambience and one clean SFX cue if sound helps the review; no dialogue unless the brief asks for it.',
  ].join('\n');
}

function buildKling4kProductSubject(brief: string): {
  subject: string;
  composition: string;
  materials: string;
  preserve: string;
  motion: string;
} {
  const text = brief.toLowerCase();
  if (text.includes('perfume')) {
    return {
      subject: 'transparent glass perfume bottle with metallic cap, premium label placement and clean luxury silhouette',
      composition: 'perfume bottle centered on polished black marble, 9:16 vertical campaign framing, clean negative space for finishing.',
      materials: 'transparent glass, metallic cap, polished black marble surface and controlled glossy highlights.',
      preserve: 'bottle silhouette, cap shape, glass color, label placement, black marble surface and centered hero composition.',
      motion: 'one slow premium push-in with subtle reflection movement across the glass and marble.',
    };
  }
  if (text.includes('watch')) {
    return {
      subject: 'premium watch with polished metal edge, readable face and controlled reflection surfaces',
      composition: 'watch centered on a marble plinth, campaign product framing, clean negative space for finishing.',
      materials: 'polished metal, glass face, refined strap texture, marble plinth and controlled studio highlights.',
      preserve: 'watch shape, face position, strap form, metal finish, marble plinth and centered hero composition.',
      motion: 'one slow premium push-in with subtle highlight movement across the watch face and metal edge.',
    };
  }
  return {
    subject: cleanProductSubject(brief),
    composition: 'hero product centered in campaign framing with clean negative space for finishing.',
    materials: 'product materials, approved colors, reflective surfaces and controlled studio highlights.',
    preserve: 'product silhouette, material finish, color, label placement and centered hero composition.',
    motion: 'one slow premium push-in with subtle product-safe reflection movement.',
  };
}

function buildKlingProPrompt(input: { brief: string; workflow: AiStrategistWorkflowId }): string {
  if (input.workflow === 'text-to-image-then-image-to-video') {
    const product = cleanProductSubject(input.brief) || 'hero product';
    const prompt = [
      'Starting image prompt:',
      `Product: ${product}.`,
      'Composition: premium product hero frame, clean surface, controlled reflections, clear product silhouette and room for final overlays.',
      'Lighting: polished commercial studio light with soft highlights and realistic material detail.',
      'Preserve for video: product shape, material finish, color, packaging proportions, label placement and logo position.',
      '',
      'Video animation prompt:',
      'Source image role: approved product composition and material reference.',
      'Motion: one controlled product reveal with stable geometry and readable silhouette.',
      'Camera: smooth commercial push-in, no sudden orbit, no distracting secondary props.',
      'Atmosphere: premium ad polish, realistic reflections, quiet brand-safe mood.',
      'End frame: stable product hero frame with clean negative space for overlays.',
      'Audio: subtle ambience and soft product reveal SFX unless the approval pass should stay silent.',
      productOverlayInstruction(input.brief),
    ];
    return compactLines(prompt).join('\n');
  }

  if (input.workflow === 'image-to-video') {
    const prompt = [
      'Reference:',
      'Use the product photo in MaxVideoAI as the source frame and hero product reference.',
      '',
      'Preserve:',
      'Packaging shape, product silhouette, color, material finish, label placement and tabletop composition.',
      '',
      'Motion:',
      `One visible commercial motion beat from the reference image: ${input.brief}`,
      '',
      'Camera:',
      'Smooth tabletop push-in with controlled reflections and stable product geometry.',
      '',
      'Atmosphere:',
      'Premium studio light, clean background, realistic material detail and quiet product-focused mood.',
      '',
      'End frame:',
      'Settle on the same product angle with clean space for overlays and approval review.',
      '',
      'Audio:',
      'Off for the first approval pass unless subtle ambience or product reveal SFX are needed.',
      '',
      'Constraints:',
      'No new text, no logo changes, no subtitles or burned-in overlays.',
      productOverlayInstruction(input.brief),
    ];
    return compactLines(prompt).join('\n');
  }

  if (isSpeakingBrief(input.brief)) {
    return [
      'Scene anchors:',
      `${input.brief}`,
      '',
      'Multi-shot plan (3-10s total):',
      'Shot 1 (0-3s): medium shot establishes the speaker and clean environment.',
      'Shot 2 (3-7s): speaker delivers one short line with restrained natural gesture.',
      'Shot 3 (7-10s): settle on a calm final expression and stable composition.',
      '',
      'Dialogue:',
      'Use one short customer-provided line.',
      '',
      'Audio:',
      LIP_SYNC_AUDIO_LINE,
      '',
      'Constraints:',
      'No subtitles or burned-in overlays. Keep the line short for more reliable lip-sync.',
    ].join('\n');
  }

  return [
    'Scene anchors:',
    `${input.brief}`,
    '',
    'Multi-shot plan (3-10s total):',
    'Shot 1 (0-3s): establish the product or subject with one clean camera move.',
    'Shot 2 (3-7s): reveal the main benefit or motion beat.',
    'Shot 3 (7-10s): settle on the final composition.',
    '',
    'Elements (optional):',
    '@Element1 = hero subject or product if a reference is supplied.',
    '',
    'Audio (optional):',
    'Minimal ambience plus one subtle SFX cue if sound helps review.',
    '',
    'Constraints:',
    'No readable text, no logo changes, no subtitles or burned-in overlays.',
  ].join('\n');
}

function buildKlingStandardPrompt(input: {
  brief: string;
  promptStructureId: AiStrategistPromptStructureId;
  sourceImageKind?: AiStrategistSourceImageKind;
}): string {
  if (input.promptStructureId === 'character-scene' || isPersonSource(input.sourceImageKind)) {
    return [
      'Reference:',
      'Use a reference image in MaxVideoAI as @Element1 for the uploaded character/person.',
      '',
      'Preserve:',
      'Face shape, hairstyle, wardrobe, body proportions, pose language and calm spokesperson identity.',
      '',
      'Motion:',
      `Subtle face-safe performance for this brief: ${input.brief}`,
      '',
      'Camera:',
      'Locked medium shot with a gentle push-in; keep @Element1 readable and centered.',
      '',
      'Atmosphere:',
      'Clean studio or simple real-world background, soft natural light, quiet review-friendly mood.',
      '',
      'End frame:',
      'Return to a stable final pose with identity, wardrobe and face shape preserved.',
      '',
      ...(isSpeakingBrief(input.brief)
        ? [
            'Spoken line:',
            'Use one short customer-provided line for the spokesperson.',
            '',
            'Audio:',
            LIP_SYNC_AUDIO_LINE,
          ]
        : [
            'Audio:',
            'Off for the first compatibility review unless ambience or SFX are needed.',
          ]),
      '',
      'Constraints:',
      'No extra people, no face warping, no readable text, no subtitles or burned-in overlays.',
    ].join('\n');
  }

  if (isSpeakingBrief(input.brief)) {
    return [
      'Subject:',
      `${input.brief}`,
      '',
      'Action:',
      'One short spoken delivery with restrained natural gesture.',
      '',
      'Camera:',
      'Locked medium shot with one gentle camera move.',
      '',
      'Style:',
      'Clean lighting and readable facial performance.',
      '',
      'Spoken line:',
      'Use one short customer-provided line.',
      '',
      'Audio:',
      LIP_SYNC_AUDIO_LINE,
      '',
      'Negative:',
      'No text, no logos, no subtitles or burned-in overlays.',
    ].join('\n');
  }

  return [
    'Subject:',
    `${input.brief}`,
    '',
    'Action:',
    'One visible action in a simple setting.',
    '',
    'Camera:',
    'Locked framing with one camera move.',
    '',
    'Style:',
    'Clean lighting and readable composition.',
    '',
    'Audio:',
    'Subtle ambience or one SFX cue if sound helps the review; no dialogue unless the brief asks for it.',
    '',
    'Negative:',
    'No text, no logos, no subtitles or burned-in overlays.',
  ].join('\n');
}

function buildSeedancePrompt(input: { brief: string; workflow: AiStrategistWorkflowId }): string {
  if (input.workflow === 'image-to-video') {
    const prompt = [
      'Reference:',
      'Use a reference image in MaxVideoAI as the fixed first frame and visual anchor.',
      '',
      'Preserve:',
      'Keep the reference subject shape, product silhouette, palette, wardrobe or material finish stable across the clip.',
      '',
      'Motion:',
      `One readable movement based on this brief: ${input.brief}`,
      '',
      'Camera:',
      'One move only: smooth push-in or short handheld transition.',
      '',
      'Atmosphere:',
      'Keep palette, wardrobe, background and pace consistent across the clip.',
      '',
      'End frame:',
      'Land on the same product or subject composition with a cleaner final hero angle.',
      '',
      ...(isSpeakingBrief(input.brief)
        ? [
            'Audio:',
            `Use one short customer-provided spoken line. ${LIP_SYNC_AUDIO_LINE}`,
          ]
        : [
            'Audio:',
            isVoiceoverBrief(input.brief)
              ? PRODUCT_VOICEOVER_AUDIO_LINE
              : 'Light ambience and one subtle SFX cue if sound helps the concept.',
          ]),
      '',
      'Rule:',
      'Use the end frame to control the landing frame, not to restart the scene.',
    ];
    return prompt.join('\n');
  }

  if (input.workflow === 'text-to-image-then-image-to-video') {
    const prompt = [
      'Starting image prompt:',
      `Hero product: ${cleanProductSubject(input.brief) || input.brief}.`,
      'Composition: vertical social product frame, crisp silhouette, clean surface, strong first-frame hook and room for overlays.',
      'Lighting: bright creator-style studio light, clean product texture, readable shape and controlled highlights.',
      'Preserve for video: sneaker shape, color blocking, material texture, sole profile and final hero angle.',
      productOverlayInstruction(input.brief),
      '',
      'Video animation prompt:',
      'Reference: use the MaxVideoAI starting image as the fixed product and composition anchor.',
      'Preserve: sneaker silhouette, material finish, color blocking, logo area and approved product angle.',
      `Motion: one fast product reveal based on this brief: ${input.brief}`,
      'Camera: 9:16 low-front product framing, fast push-in with a short whip transition into the final hero angle.',
      'Atmosphere: bright studio-meets-creator lighting, saturated but clean palette, crisp texture, light handheld lens feel.',
      'End frame: clean sneaker hero hold with readable shape and space for CTA or text overlay.',
      `Audio: ${isVoiceoverBrief(input.brief) ? PRODUCT_VOICEOVER_AUDIO_LINE : 'Short room-tone ambience, one sneaker slide SFX, one soft impact cue at the final hero angle.'}`,
    ];
    return compactLines(prompt).join('\n');
  }

  if (isSpeakingBrief(input.brief)) {
    return [
      'Subject:',
      `${input.brief}`,
      '',
      'Action:',
      'One short spoken beat with natural face movement and restrained gesture.',
      '',
      'Camera:',
      'Medium close-up, steady eye-level framing, one gentle push-in.',
      '',
      'Style:',
      'Natural studio light, clean background, readable expression, realistic creator-style texture.',
      '',
      'Spoken line:',
      'Use one short customer-provided line.',
      '',
      'Audio:',
      LIP_SYNC_AUDIO_LINE,
      '',
      'Rule:',
      'Keep the line short and avoid background music overpowering the speech.',
    ].join('\n');
  }

  return [
    'Subject:',
    'Hero sneakers in a vertical social ad, crisp silhouette, clean product shape, creator-style energy.',
    '',
    'Action:',
    `One fast product reveal based on this brief: ${input.brief}`,
    '',
    'Camera:',
    '9:16 medium product shot from a low front angle, fast push-in with a short whip transition into the final hero angle.',
    '',
    'Style:',
    'Bright studio-meets-creator lighting, saturated but clean palette, crisp texture, light handheld lens feel.',
    '',
    'Audio:',
    isVoiceoverBrief(input.brief)
      ? PRODUCT_VOICEOVER_AUDIO_LINE
      : 'Short room-tone ambience, one sneaker slide SFX, one soft impact cue at the final hero angle.',
  ].join('\n');
}

function buildSeedanceFastPrompt(input: { brief: string }): string {
  return [
    'Subject:',
    'Sneakers as the hero product in a vertical social ad.',
    '',
    'Action:',
    'One quick reveal: the shoe slides into frame, catches light, then lands on a clean final hero angle.',
    '',
    'Camera:',
    'Fast 9:16 handheld-style push with a small whip into the final product angle.',
    '',
    'Style:',
    'Bright creator-style lighting, crisp product silhouette, energetic but readable motion.',
    '',
    'Goal:',
    `Test timing, framing and motion for this brief: ${input.brief}`,
    '',
    'Audio:',
    isVoiceoverBrief(input.brief) ? PRODUCT_VOICEOVER_AUDIO_LINE : SOCIAL_PRODUCT_AUDIO_LINE,
    '',
    'Rule:',
    'Change one variable per run; do not combine multiple creative decisions in the same Fast pass.',
  ].join('\n');
}

function buildVeoPrompt(input: {
  brief: string;
  modelId: AiStrategistModelId;
  workflow: AiStrategistWorkflowId;
  sourceImageKind?: AiStrategistSourceImageKind;
}): string {
  const isLite = input.modelId === 'veo-3-1-lite';
  const isFast = input.modelId === 'veo-3-1-fast';
  const aspectRatio = extractRequestedAspectRatio(input.brief) ?? (input.brief.toLowerCase().includes('vertical') ? '9:16' : '16:9');
  const resolution = isLite ? '720p or 1080p' : input.brief.toLowerCase().includes('4k') ? '4K when selected' : '1080p, or 4K when the shot needs it';
  const soundLine = isSpeakingBrief(input.brief)
    ? 'One short spoken line with native audio; use a compatible lip-sync/audio workflow and keep speech calm for more reliable lip-sync.'
    : isVoiceoverBrief(input.brief)
      ? 'Off-camera voiceover narration over the scene with concise ambience and one supporting SFX cue; no visible talking person.'
    : 'Native audio with concise ambience and one SFX cue if sound helps the review; no dialogue unless the brief asks for it.';

  if (input.workflow === 'image-to-video') {
    return [
      'Prompt intent:',
      `Animate the supplied MaxVideoAI reference still for this brief: ${input.brief}`,
      '',
      'Reference stills:',
      'Use the start image for subject, product, wardrobe, setting and palette.',
      '',
      'What stays fixed:',
      isPersonSource(input.sourceImageKind)
        ? 'Face identity, wardrobe, pose language, lighting direction and background simplicity.'
        : 'Product or subject shape, material finish, palette, background layout and approved composition.',
      '',
      'What can change:',
      'One visible action, one natural camera move, subtle lighting or atmosphere movement.',
      '',
      'Camera:',
      `${aspectRatio} framing, steady cinematic push-in or gentle handheld drift, 4-8 seconds.`,
      '',
      'Sound:',
      soundLine,
      '',
      'Rule:',
      'Use the reference to lock identity and style, then let the prompt steer motion and camera.',
    ].join('\n');
  }

  if (input.workflow === 'text-to-image-then-image-to-video') {
    return [
      'Starting image prompt:',
      `Create the starting image with MaxVideoAI image generation for: ${input.brief}`,
      'Keep the subject centered, readable, and simple enough for video animation.',
      productOverlayInstruction(input.brief),
      '',
      'Video animation prompt:',
      'First frame:',
      'Use the approved generated starting image as the opening frame.',
      '',
      'Last frame:',
      'Land on the same subject with a cleaner hero composition and stable lighting.',
      '',
      'Transition logic:',
      'One natural camera move and one physical subject motion between the two compositions.',
      '',
      'Continuity anchors:',
      'Subject identity, material finish, palette, lighting direction and background simplicity.',
      '',
      'Sound:',
      soundLine,
      '',
      'Settings:',
      `${aspectRatio}, ${resolution}, 4-8 seconds${isFast ? ', Fast route for iteration' : ''}${isLite ? ', Lite route for budget preview' : ''}.`,
    ]
      .filter((line): line is string => typeof line === 'string')
      .join('\n');
  }

  return [
    'Subject + action + context:',
    `${input.brief}`,
    '',
    'Camera:',
    `${aspectRatio} shot, one clear move, natural camera behavior, 4-8 seconds.`,
    '',
    'Look:',
    isLite
      ? 'Clean realistic Veo-family draft look, readable subject, simple lighting, budget preview finish.'
      : 'Cinematic realistic lighting, grounded palette, natural texture and polished short-form finish.',
    '',
    'Sound:',
    soundLine,
    '',
    'Format:',
    `${resolution}; ${isLite ? 'do not request 4K on Lite' : 'use 4K only when selected in MaxVideoAI'}.`,
    '',
    'Constraint style:',
    'Say what should be visible and stable; keep the scene to one coherent action.',
  ].join('\n');
}

function buildHappyHorsePrompt(input: {
  brief: string;
  workflow: AiStrategistWorkflowId;
  sourceImageKind?: AiStrategistSourceImageKind;
}): string {
  const aspectRatio = extractRequestedAspectRatio(input.brief) ?? (input.workflow === 'image-to-video' ? 'source image aspect ratio' : '9:16 or 16:9');
  const spokenBlock = isSpeakingBrief(input.brief)
    ? [
        'Spoken line:',
        'Use one short customer-provided line.',
        '',
        'Audio:',
        'Use native synchronized audio with a compatible lip-sync workflow; keep the line short, natural, and not overpowered by music.',
      ]
    : isVoiceoverBrief(input.brief)
      ? [
          'Audio:',
          'Native synchronized audio with off-camera voiceover narration and 1-2 restrained SFX cues; no visible talking person.',
        ]
    : [
        'Audio:',
        'Native synchronized audio with simple ambience and 1-2 SFX cues; no dialogue unless the brief asks for it.',
      ];

  if (input.workflow === 'video-to-video') {
    return [
      'Source clip:',
      'Use the uploaded source video in MaxVideoAI as the timing and motion base.',
      '',
      'Edit direction:',
      `${input.brief}`,
      '',
      'Preserve:',
      'Core subject identity, source pacing, usable gestures, aspect ratio and approved audio intent.',
      '',
      'Reference images:',
      'Optional @Image1-@Image5 can define look, wardrobe, product or setting if supplied.',
      '',
      'Audio handling:',
      'Use auto for native regenerated audio, or origin when the source audio must stay attached.',
      '',
      'End frame:',
      'Settle on a clean final pose or product/scene beat that matches the edit direction.',
    ].join('\n');
  }

  if (input.workflow === 'image-to-video') {
    return [
      'Reference:',
      'Use the MaxVideoAI reference image as the first frame and primary identity/style anchor.',
      '',
      'Preserve:',
      isPersonSource(input.sourceImageKind)
        ? 'Face identity, hairstyle, wardrobe, body proportions, character look and clean spokesperson framing.'
        : 'Subject shape, materials, palette, composition and approved start-frame layout.',
      '',
      'Motion:',
      `One controlled motion beat for this brief: ${input.brief}`,
      '',
      'Camera:',
      `${aspectRatio}, gentle push-in or stable handheld move, 3-15 seconds.`,
      '',
      ...spokenBlock,
      '',
      'End frame:',
      'Return to a stable final pose with identity, style and timing preserved.',
    ].join('\n');
  }

  return [
    'Subject:',
    `${input.brief}`,
    '',
    'Action:',
    isSpeakingBrief(input.brief)
      ? 'One calm on-camera delivery beat with restrained gesture and readable mouth movement.'
      : 'One visible action or reveal that matches the native-audio cue.',
    '',
    'Camera:',
    `${aspectRatio}, medium shot or clean product/social framing, one subtle move, 3-15 seconds.`,
    '',
    ...spokenBlock,
    '',
    'Workflow references:',
    'Use text-to-video for a fresh shot; switch to image/reference/video edit in MaxVideoAI if a source asset should control identity or timing.',
    '',
    'Rule:',
    'Keep dialogue short and keep each reference or source clip focused on one job.',
  ].join('\n');
}

function buildLtxPrompt(input: { brief: string; workflow: AiStrategistWorkflowId; sourceImageKind?: AiStrategistSourceImageKind }): string {
  if (input.workflow === 'image-to-video') {
    return [
      'Start frame:',
      'Use a reference image in MaxVideoAI with the character/person already composed clearly.',
      '',
      'Motion:',
      `Subtle face-safe movement based on this brief: ${input.brief}`,
      '',
      'Camera:',
      'Locked medium shot with a gentle push-in.',
      '',
      'Resolve:',
      'Return to a stable final pose with identity and wardrobe preserved.',
      '',
      ...(isSpeakingBrief(input.brief)
        ? [
            'Spoken line:',
            'Use one short customer-provided line for the spokesperson.',
            '',
            'Audio:',
            LIP_SYNC_AUDIO_LINE,
          ]
        : [
            'Audio:',
            'Subtle ambience plus one motion cue if sound helps the review.',
          ]),
    ].join('\n');
  }

  return [
    'Shot 1:',
    'Establish the ad concept with one clear product or scene setup.',
    '',
    'Shot 2:',
    `Show the core action or benefit as a rough storyboard beat: ${input.brief}`,
    '',
    'Shot 3:',
    'Resolve on a simple final frame that can be upgraded later.',
    '',
    'Look:',
    'Fast draft, readable composition, minimal styling, clear timing over polish.',
    '',
    'Audio:',
    'Simple ambience plus one timing cue; keep dialogue short if lip-sync is needed.',
  ].join('\n');
}

function buildPikaPrompt(input: { brief: string }): string {
  return [
    'Start state:',
    'One product or object is clearly visible in a simple vertical social frame before the change.',
    '',
    'Transformation:',
    `One playful before-and-after visual change based on this brief: ${input.brief}`,
    '',
    'End state:',
    'The transformed object lands in a clean after state with a crisp silhouette and readable shape.',
    '',
    'Camera:',
    'Locked 9:16 shot with a small push-in during the transformation.',
    '',
    'Style:',
    'Playful stylized motion, bold color pop, clean background and light texture.',
    '',
    'Loop/ending:',
    'End on a clean hold that can loop back to the start state or cut to a social CTA.',
    '',
    'Negative:',
    'No text, logos, extra characters, extra limbs, heavy blur or messy artifacts.',
  ].join('\n');
}

function buildNegativePrompt(
  promptStructureId: AiStrategistPromptStructureId,
  modelId: AiStrategistModelId,
  sourceImageKind?: AiStrategistSourceImageKind
): string {
  const structure = getAiStrategistPromptStructure(promptStructureId);
  const base = new Set(['no unreadable text', 'no unwanted logos', 'no subtitles or overlays', ...structure.negativePromptChecklist]);
  if (modelId.startsWith('kling-3')) base.add('no product shape drift');
  if (modelId.startsWith('veo-3-1')) base.add('no long monologues');
  if (modelId === 'happy-horse-1-0') base.add('no long monologues');
  if (modelId === 'pika') base.add('no extra limbs');
  if (isPersonSource(sourceImageKind)) {
    base.add('no face warping');
    base.add('no identity drift');
    base.add('no extra people');
  }
  return Array.from(base).join(', ');
}

function buildRecommendedSettings(
  modelId: AiStrategistModelId,
  workflow: AiStrategistWorkflowId,
  promptStructureId: AiStrategistPromptStructureId,
  brief: string
): readonly string[] {
  const aspectRatio = extractRequestedAspectRatio(brief) ?? (brief.toLowerCase().includes('vertical') ? '9:16' : undefined);
  if (modelId === 'kling-3-4k') {
    return [
      aspectRatio ?? '9:16 for vertical ads or 16:9 for campaign masters',
      'native 4K',
      '6-10 seconds',
      'audio ambience/SFX on when useful, off for silent approvals',
      'use one approved starting image',
    ];
  }
  if (modelId === 'kling-3-pro') {
    return [
      aspectRatio ?? '16:9 or 9:16 based on placement',
      '1080p',
      '5-10 seconds for approval passes',
      workflow === 'image-to-video' ? 'use one product reference image' : '2-3 shots maximum',
      isSpeakingBrief(brief) ? 'use compatible audio/lip-sync workflow' : 'audio ambience/SFX on when useful',
    ];
  }
  if (modelId === 'kling-3-standard') {
    return [
      '1080p',
      '8-10 seconds',
      'use @Element1 for the person or product reference',
      isSpeakingBrief(brief) ? 'use compatible audio/lip-sync workflow' : 'audio ambience/SFX on when useful',
    ];
  }
  if (modelId === 'veo-3-1') {
    return [
      aspectRatio ?? '16:9 or 9:16 based on placement',
      brief.toLowerCase().includes('4k') ? '4K available in MaxVideoAI' : '1080p, with 4K available when selected',
      '4-8 seconds',
      isSpeakingBrief(brief) ? 'native audio with compatible lip-sync workflow' : 'native audio ambience/SFX on when useful',
    ];
  }
  if (modelId === 'veo-3-1-fast') {
    return [
      aspectRatio ?? '16:9 or 9:16 based on placement',
      brief.toLowerCase().includes('4k') ? '4K available in MaxVideoAI' : '720p/1080p, with 4K available when selected',
      '4-8 seconds',
      isSpeakingBrief(brief) ? 'native audio with compatible lip-sync workflow' : 'native audio ambience/SFX on when useful',
      'Fast route for lower-cost Veo iteration',
    ];
  }
  if (modelId === 'veo-3-1-lite') {
    return [
      aspectRatio ?? '16:9 or 9:16 based on placement',
      '720p/1080p',
      '4-8 seconds',
      isSpeakingBrief(brief) ? 'native audio with compatible lip-sync workflow' : 'native audio ambience/SFX on when useful',
      'Lite budget route for value testing',
    ];
  }
  if (modelId === 'happy-horse-1-0') {
    return [
      aspectRatio ?? (workflow === 'image-to-video' ? 'source image aspect ratio' : '16:9 or 9:16 based on placement'),
      '720p/1080p',
      '3-15 seconds',
      isSpeakingBrief(brief) ? 'native synchronized audio/lip-sync workflow' : 'native synchronized audio with ambience/SFX',
      workflow === 'video-to-video' ? 'auto or origin audio handling' : 'use R2V/V2V when references or source clips matter',
    ];
  }
  if (modelId === 'seedance-2-0-fast') return [aspectRatio ?? '9:16', '720p preview', '5-8 seconds', 'one variable per run', 'audio/SFX on for social ad timing tests'];
  if (modelId === 'seedance-2-0') {
    return [
      aspectRatio ?? '16:9 or 9:16 based on placement',
      '1080p',
      '5-8 seconds',
      isSpeakingBrief(brief)
        ? 'native audio with compatible lip-sync workflow'
        : isVoiceoverBrief(brief)
          ? 'native audio with off-camera voiceover/SFX guidance'
          : 'native audio ambience/SFX on when useful',
    ];
  }
  if (modelId === 'ltx-2-3') return [promptStructureId === 'social-ad' ? '9:16 draft' : '16:9 draft', '1080p', 'about 10 seconds', isSpeakingBrief(brief) ? 'use compatible audio/lip-sync workflow' : 'native audio cue when useful'];
  if (modelId === 'pika') return [aspectRatio ? `${aspectRatio} social loop` : '9:16 social loop', '5-10 seconds', '720p or 1080p depending on budget', 'keep the transformation simple'];
  return ['short-form duration', 'one subject', 'one camera move'];
}

function buildPromptReason(
  modelPagePromptStructure: AiStrategistModelPagePromptStructure,
  workflow: AiStrategistWorkflowId,
  promptStructureId: AiStrategistPromptStructureId,
  modelId: AiStrategistModelId
): string {
  if (workflow === 'text-to-image-then-image-to-video') {
    return `Uses the ${modelPagePromptStructure.title} from the model page because the shot needs an approved MaxVideoAI starting image before video motion.`;
  }
  if (workflow === 'image-to-video') {
    return `Uses the ${modelPagePromptStructure.title} from the model page because the source image controls identity, product shape or composition.`;
  }
  if (modelId === 'seedance-2-0-fast') return 'Uses the model-page Text-to-video test prompt because this is a fast timing and framing run.';
  if (modelId === 'ltx-2-3') return 'Uses the model-page Storyboard prompt because this is a rough draft with simple timing beats.';
  if (promptStructureId === 'social-ad') return `Uses the ${modelPagePromptStructure.title} from the model page for a short social prompt with one action and one camera move.`;
  return `Uses the ${modelPagePromptStructure.title} from the model page to keep the prompt aligned with MaxVideoAI guidance.`;
}

function buildPromptWarning(
  brief: string,
  workflow: AiStrategistWorkflowId,
  sourceImageKind?: AiStrategistSourceImageKind
): string | undefined {
  const text = brief.toLowerCase();
  const warnings: string[] = [];
  if (hasProductDetailRisk(text)) {
    warnings.push(PRODUCT_DETAIL_WARNING);
  }
  if (
    workflow === 'image-to-video' &&
    (isPersonSource(sourceImageKind) || ['person', 'face', 'spokesperson', 'avatar', 'character reference'].some((term) => text.includes(term)))
  ) {
    warnings.push(PERSON_REFERENCE_WARNING);
  }
  return warnings.length > 0 ? warnings.join(' ') : undefined;
}

function productOverlayInstruction(brief: string): string | undefined {
  if (!hasProductDetailRisk(brief.toLowerCase())) return undefined;
  return 'Overlay/check note: Add critical label, logo, legal copy, badge, plate or tiny-text details as overlays, or review them after generation before delivery.';
}

function hasProductDetailRisk(text: string): boolean {
  return PRODUCT_DETAIL_TERMS.some((term) => text.includes(term));
}

function extractRequestedAspectRatio(brief: string): string | undefined {
  const match = brief.match(/\b(?:9:16|16:9|1:1|4:5|3:4|4:3|21:9)\b/);
  return match?.[0];
}

function cleanProductSubject(brief: string): string {
  return brief
    .replace(/\b(?:ad|advert|advertisement|commercial|video)\b/gi, '')
    .replace(/\b(?:in|on)\s+\d+:\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:\s]+$/g, '')
    .trim();
}

function compactLines(lines: ReadonlyArray<string | undefined>): string[] {
  return lines.filter((line): line is string => typeof line === 'string');
}

function uniqueContextStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function isPersonSource(sourceImageKind?: AiStrategistSourceImageKind): boolean {
  return sourceImageKind === 'uploaded-person' || sourceImageKind === 'uploaded-character' || sourceImageKind === 'generated-person' || sourceImageKind === 'generated-character';
}

function isSpeakingBrief(brief: string): boolean {
  const text = brief.toLowerCase();
  return [
    'dialogue',
    'spoken line',
    'speaking',
    'speak',
    'spokesperson',
    'talking avatar',
    'avatar',
    'character speaking',
    'lip sync',
    'lip-sync',
    'lipsync',
    'voice delivery',
    'short line',
  ].some((term) => text.includes(term));
}

function isVoiceoverBrief(brief: string): boolean {
  const text = brief.toLowerCase();
  return ['voiceover', 'voice over', 'off-camera narration', 'off camera narration', 'narration'].some((term) =>
    text.includes(term)
  );
}
