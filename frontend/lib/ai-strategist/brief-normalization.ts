import type {
  AiStrategistModelId,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from './types';

// Contract for the future brief-refinement LLM step.
// The deterministic implementation below is a fallback/test-mode parser that
// returns the same JSON-safe shape the LLM should eventually produce.
export type AiStrategistNormalizedIntent =
  | 'product_ad'
  | 'social_ad'
  | 'cinematic_scene'
  | 'talking_avatar'
  | 'spokesperson'
  | 'character_animation'
  | 'product_reference_i2v'
  | 'person_reference_i2v'
  | 'video_to_video'
  | 'draft_storyboard'
  | 'product_help'
  | 'prompt_improvement'
  | 'unknown';

export type AiStrategistAspectRatioHint = '9:16' | '16:9' | '1:1' | '4:3' | '3:4';
export type AiStrategistQualityIntent = 'premium' | 'balanced' | 'value' | 'draft';
export type AiStrategistPlatformHint = 'tiktok' | 'instagram' | 'youtube' | 'website' | 'ad' | 'unknown';
export type AiStrategistBriefMode = 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';

export type AiStrategistBriefUploadedAsset = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

export type AiStrategistBriefRefinementTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiStrategistBriefRefinementRecommendationSummary = {
  modelId: AiStrategistModelId;
  label?: string;
  reason?: string;
  warning?: string;
};

export type AiStrategistBriefRefinementConversationContext = {
  currentChatStage?: string;
  currentUserMessage?: string;
  lastUserBrief?: string;
  enrichedBrief?: string;
  lastRecommendations?: {
    best?: AiStrategistBriefRefinementRecommendationSummary;
    medium?: AiStrategistBriefRefinementRecommendationSummary;
    value?: AiStrategistBriefRefinementRecommendationSummary;
    alsoConsider?: AiStrategistBriefRefinementRecommendationSummary[];
  };
  lastSelectedModel?: AiStrategistModelId;
  lastSelectedTier?: AiStrategistTierPosition;
  lastSelectedWorkflow?: AiStrategistWorkflowId;
  recentTurns?: readonly AiStrategistBriefRefinementTurn[];
};

export type AiStrategistBriefNormalizationInput = {
  rawUserMessage?: string;
  mode?: AiStrategistBriefMode;
  pageContext?: unknown;
  currentPrompt?: string;
  uploadedAsset?: AiStrategistBriefUploadedAsset;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  conversationContext?: AiStrategistBriefRefinementConversationContext;
};

export type AiStrategistNormalizedBrief = {
  rawUserMessage: string;
  normalizedBrief: string;
  intent: AiStrategistNormalizedIntent;
  workflowHint?: AiStrategistWorkflowId;
  hasProduct: boolean;
  hasPerson: boolean;
  hasCharacter: boolean;
  hasUploadedReference: boolean;
  hasVisibleSpeaker: boolean;
  hasVoiceover: boolean;
  hasDialogue: boolean;
  hasLipSyncIntent: boolean;
  hasLogoOrTextRisk: boolean;
  aspectRatioHint?: AiStrategistAspectRatioHint;
  qualityIntent: AiStrategistQualityIntent;
  platformHint: AiStrategistPlatformHint;
  styleHints: string[];
  constraints: string[];
  clarificationQuestion?: string;
  confidence: number;
};

const productTerms = [
  'product',
  'perfume',
  'bottle',
  'skincare',
  'jewelry',
  'jewellery',
  'sneaker',
  'sneakers',
  'shoe',
  'shoes',
  'packaging',
  'package',
  'packshot',
  'car',
  'voiture',
  'auto',
  'watch',
  'cream',
  'serum',
  'logo',
  'label',
] as const;

const textRiskTerms = [
  'label',
  'labels',
  'logo',
  'logos',
  'text',
  'tiny text',
  'small text',
  'legal copy',
  'packaging',
  'package',
  'perfume',
  'bottle',
  'sneaker',
  'sneakers',
  'car',
  'voiture',
  'badge',
  'plate',
] as const;

const productHelpTerms = [
  'where do i generate',
  'how do i generate',
  'how to generate',
  'how do i choose a model',
  'how to choose a model',
  'how the site works',
  'where do i upload',
  'where to upload',
  'pricing',
  'credits',
  'price',
  'cost',
] as const;

const visibleSpeakerTerms = [
  'talking avatar',
  'spokesperson',
  'speak to camera',
  'speaks to camera',
  'speaking to camera',
  'talking head',
  'person says',
  'person speaking',
  'says to camera',
  'on-camera',
  'on camera',
  'lip-sync',
  'lip sync',
  'lipsync',
] as const;

const dialogueTerms = ['dialogue', 'spoken line', 'short spoken line', 'person says', 'says', 'speaking', 'speak'] as const;

export function normalizeStrategistBrief(input: AiStrategistBriefNormalizationInput): AiStrategistNormalizedBrief {
  const rawUserMessage = cleanText(input.rawUserMessage);
  const currentPrompt = cleanText(input.currentPrompt);
  const pageContext = summarizePageContext(input.pageContext);
  const combinedText = [rawUserMessage, currentPrompt, pageContext].filter(Boolean).join(' ');
  const text = combinedText.toLowerCase();

  const hasUploadedReference = input.uploadedAsset?.isReferenceImage === true;
  const hasPerson = input.uploadedAsset?.hasPerson === true || containsAny(text, ['person', 'human', 'face', 'founder', 'actor', 'fighter']);
  const hasCharacter = containsAny(text, ['character', 'avatar', 'creature', 'mascot', 'fighter', 'street fighter', 'combat']);
  const hasProduct = input.uploadedAsset?.hasProduct === true || containsAny(text, productTerms);
  const hasVoiceover = containsAny(text, ['voiceover', 'voice over', 'off-camera narration', 'off camera narration', 'narration']);
  const explicitVisibleSpeaker = containsAny(text, visibleSpeakerTerms);
  const hasVisibleSpeaker = explicitVisibleSpeaker || (hasPerson && containsAny(text, ['speaking to camera', 'talking to camera']));
  const hasDialogue = containsAny(text, dialogueTerms);
  const hasLipSyncIntent = containsAny(text, ['lip-sync', 'lip sync', 'lipsync']) || (hasVisibleSpeaker && hasDialogue);
  const hasLogoOrTextRisk =
    input.uploadedAsset?.hasLogo === true ||
    input.uploadedAsset?.hasText === true ||
    (hasProduct && containsAny(text, textRiskTerms));
  const aspectRatioHint = inferAspectRatio(text);
  const qualityIntent = inferQualityIntent(text);
  const platformHint = inferPlatform(text);
  const intent = inferIntent({
    text,
    currentPrompt,
    hasUploadedReference,
    hasPerson,
    hasCharacter,
    hasProduct,
    hasVisibleSpeaker,
    hasDialogue,
    input,
  });
  const workflowHint = input.selectedWorkflow ?? inferWorkflowHint({
    text,
    intent,
    hasUploadedReference,
    hasProduct,
    hasVisibleSpeaker,
    input,
  });
  const constraints = buildConstraints({
    input,
    hasUploadedReference,
    hasPerson,
    hasVoiceover,
    hasVisibleSpeaker,
    hasLogoOrTextRisk,
    workflowHint,
  });
  const clarificationQuestion = buildClarificationQuestion({
    rawUserMessage,
    currentPrompt,
    intent,
    hasUploadedReference,
    selectedModel: input.selectedModel,
    selectedWorkflow: input.selectedWorkflow,
  });

  return {
    rawUserMessage,
    normalizedBrief: buildNormalizedBrief({ rawUserMessage, currentPrompt, intent, qualityIntent, styleHints: inferStyleHints(text) }),
    intent,
    ...(workflowHint ? { workflowHint } : {}),
    hasProduct,
    hasPerson,
    hasCharacter,
    hasUploadedReference,
    hasVisibleSpeaker,
    hasVoiceover,
    hasDialogue,
    hasLipSyncIntent,
    hasLogoOrTextRisk,
    ...(aspectRatioHint ? { aspectRatioHint } : {}),
    qualityIntent,
    platformHint,
    styleHints: inferStyleHints(text),
    constraints,
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
    confidence: inferConfidence({ intent, workflowHint, aspectRatioHint, hasUploadedReference, hasProduct, hasPerson, hasVoiceover, hasVisibleSpeaker }),
  };
}

function inferIntent(input: {
  text: string;
  currentPrompt: string;
  hasUploadedReference: boolean;
  hasPerson: boolean;
  hasCharacter: boolean;
  hasProduct: boolean;
  hasVisibleSpeaker: boolean;
  hasDialogue: boolean;
  input: AiStrategistBriefNormalizationInput;
}): AiStrategistNormalizedIntent {
  if (containsAny(input.text, productHelpTerms)) return 'product_help';
  if (input.currentPrompt && containsAny(input.text, ['improve', 'make this better', 'refine', 'rewrite', 'upgrade'])) {
    return 'prompt_improvement';
  }
  if (input.input.selectedWorkflow === 'video-to-video' || containsAny(input.text, ['source video', 'video-to-video', 'restyle', 're-style'])) {
    return 'video_to_video';
  }
  if (input.hasUploadedReference && input.hasPerson) return 'person_reference_i2v';
  if (input.hasUploadedReference && input.hasProduct) return 'product_reference_i2v';
  if (containsAny(input.text, ['draft', 'storyboard', 'rough concept', 'quick test', 'cheap', 'low cost', 'low-cost'])) {
    return 'draft_storyboard';
  }
  if (containsAny(input.text, ['talking avatar', 'talking head'])) return 'talking_avatar';
  if (containsAny(input.text, ['spokesperson', 'speaking to camera', 'person says']) || (input.hasVisibleSpeaker && input.hasDialogue)) {
    return 'spokesperson';
  }
  if (input.hasCharacter) return 'character_animation';
  if (containsAny(input.text, ['social-first', 'social first', 'tiktok', 'reels', 'ugc', 'short-form', 'vertical']) && input.hasProduct) {
    return 'social_ad';
  }
  if (input.hasProduct) return 'product_ad';
  if (containsAny(input.text, ['cinematic', 'film', 'scene', 'realistic human', 'camera movement', 'pub', 'fight', 'street fighter', 'combat', 'battle'])) return 'cinematic_scene';
  return 'unknown';
}

function inferWorkflowHint(input: {
  text: string;
  intent: AiStrategistNormalizedIntent;
  hasUploadedReference: boolean;
  hasProduct: boolean;
  hasVisibleSpeaker: boolean;
  input: AiStrategistBriefNormalizationInput;
}): AiStrategistWorkflowId | undefined {
  if (input.hasUploadedReference || input.intent === 'person_reference_i2v' || input.intent === 'product_reference_i2v') return 'image-to-video';
  if (input.intent === 'video_to_video') return 'video-to-video';
  if (input.intent === 'unknown') return undefined;
  if (input.intent === 'product_help') return undefined;
  if (input.intent === 'draft_storyboard' || input.intent === 'talking_avatar' || input.intent === 'spokesperson') return 'text-to-video';
  if (input.intent === 'social_ad' && containsAny(input.text, ['social-first', 'social first', 'tiktok', 'reels', 'vertical', 'quick'])) {
    return 'text-to-video';
  }
  if (input.hasProduct && !input.hasVisibleSpeaker) return 'text-to-image-then-image-to-video';
  return 'text-to-video';
}

function buildNormalizedBrief(input: {
  rawUserMessage: string;
  currentPrompt: string;
  intent: AiStrategistNormalizedIntent;
  qualityIntent: AiStrategistQualityIntent;
  styleHints: readonly string[];
}): string {
  if (input.currentPrompt) {
    const request = input.rawUserMessage.toLowerCase();
    const refinements: string[] = [];
    if (containsAny(request, ['premium', 'luxury'])) refinements.push('premium product ad');
    if (containsAny(request, ['product'])) refinements.push('product-focused composition');
    if (containsAny(request, ['cinematic'])) refinements.push('cinematic camera and lighting');
    if (refinements.length === 0) refinements.push('clearer subject, action, camera, style, and final frame');
    return `${input.currentPrompt}. Refine as ${Array.from(new Set(refinements)).join(', ')}.`;
  }

  if (!input.rawUserMessage) return input.intent === 'unknown' ? 'Unspecified video brief.' : `Video brief for ${input.intent}.`;
  const raw = input.rawUserMessage.toLowerCase();
  if (containsAny(raw, ['voiture', 'pub de voiture'])) {
    return 'A high-energy cinematic car commercial emphasizing speed, dynamic motion, and polished automotive camera work.';
  }
  return input.rawUserMessage;
}

function inferAspectRatio(text: string): AiStrategistAspectRatioHint | undefined {
  const match = text.match(/\b(9:16|16:9|1:1|4:3|3:4)\b/);
  if (match) return match[1] as AiStrategistAspectRatioHint;
  if (containsAny(text, ['vertical', 'tiktok', 'reels', 'short-form'])) return '9:16';
  if (containsAny(text, ['landscape', 'youtube', 'website hero'])) return '16:9';
  return undefined;
}

function inferQualityIntent(text: string): AiStrategistQualityIntent {
  if (containsAny(text, ['draft', 'storyboard', 'rough concept', 'quick test'])) return 'draft';
  if (containsAny(text, ['cheap', 'low cost', 'low-cost', 'budget', 'value'])) return 'value';
  if (containsAny(text, ['premium', 'luxury', '4k', 'final commercial', 'maximum detail'])) return 'premium';
  return 'balanced';
}

function inferPlatform(text: string): AiStrategistPlatformHint {
  if (text.includes('tiktok')) return 'tiktok';
  if (containsAny(text, ['instagram', 'reels'])) return 'instagram';
  if (text.includes('youtube')) return 'youtube';
  if (text.includes('website')) return 'website';
  if (containsAny(text, ['ad', 'advert', 'commercial', 'saas', 'pub', 'publicite', 'publicité'])) return 'ad';
  return 'unknown';
}

function inferStyleHints(text: string): string[] {
  const hints: string[] = [];
  for (const hint of ['cinematic', 'luxury', 'premium', 'social-first', 'black marble', 'vertical', 'creator-style', 'fast', 'realistic', 'dynamic', 'dynamique', 'street fighter', 'arcade', 'combat', 'stylized']) {
    if (text.includes(hint)) hints.push(hint);
  }
  return hints;
}

function buildConstraints(input: {
  input: AiStrategistBriefNormalizationInput;
  hasUploadedReference: boolean;
  hasPerson: boolean;
  hasVoiceover: boolean;
  hasVisibleSpeaker: boolean;
  hasLogoOrTextRisk: boolean;
  workflowHint?: AiStrategistWorkflowId;
}): string[] {
  const constraints: string[] = [];
  if (input.input.selectedModel) constraints.push(`Selected model is fixed: ${input.input.selectedModel}`);
  if (input.input.selectedWorkflow) constraints.push(`Selected workflow is fixed: ${input.input.selectedWorkflow}`);
  if (input.hasUploadedReference) constraints.push('Uploaded reference asset must stay part of routing context.');
  if (input.hasPerson && input.hasUploadedReference) constraints.push('Uploaded person reference requires person-compatible image-to-video handling.');
  if (input.hasVoiceover && !input.hasVisibleSpeaker) constraints.push('Voiceover is off-camera narration, not a visible speaking person.');
  if (input.hasLogoOrTextRisk) constraints.push('Exact labels, logos, legal copy, packaging details, and tiny text may drift.');
  if (input.workflowHint) constraints.push(`Workflow hint: ${input.workflowHint}`);
  return constraints;
}

function buildClarificationQuestion(input: {
  rawUserMessage: string;
  currentPrompt: string;
  intent: AiStrategistNormalizedIntent;
  hasUploadedReference: boolean;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
}): string | undefined {
  if (input.currentPrompt || input.hasUploadedReference || input.selectedModel || input.selectedWorkflow) return undefined;
  if (input.intent !== 'unknown') return undefined;
  if (!input.rawUserMessage || containsAny(input.rawUserMessage.toLowerCase(), ['make it better', 'improve it', 'fix it', 'better'])) {
    return 'What video are you trying to improve, and should the result be a product ad, social ad, cinematic scene, or speaking character?';
  }
  return 'What kind of video do you want to create: product ad, social ad, cinematic scene, or speaking character?';
}

function inferConfidence(input: {
  intent: AiStrategistNormalizedIntent;
  workflowHint?: AiStrategistWorkflowId;
  aspectRatioHint?: AiStrategistAspectRatioHint;
  hasUploadedReference: boolean;
  hasProduct: boolean;
  hasPerson: boolean;
  hasVoiceover: boolean;
  hasVisibleSpeaker: boolean;
}): number {
  if (input.intent === 'product_help') return 0.82;
  let score = input.intent === 'unknown' ? 0.35 : 0.58;
  if (input.workflowHint) score += 0.1;
  if (input.aspectRatioHint) score += 0.06;
  if (input.hasUploadedReference) score += 0.08;
  if (input.hasProduct || input.hasPerson) score += 0.07;
  if (input.hasVoiceover || input.hasVisibleSpeaker) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
}

function summarizePageContext(pageContext: unknown): string {
  if (!pageContext) return '';
  if (typeof pageContext === 'string') return pageContext;
  try {
    return JSON.stringify(pageContext).slice(0, 500);
  } catch {
    return '';
  }
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
