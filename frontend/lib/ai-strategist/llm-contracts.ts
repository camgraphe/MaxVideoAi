import type {
  AiStrategistAspectRatioHint,
  AiStrategistBriefNormalizationInput,
  AiStrategistNormalizedIntent,
  AiStrategistPlatformHint,
  AiStrategistQualityIntent,
} from './brief-normalization';
import type { AiStrategistPromptGenerationContext } from './prompt-structures';
import type { StrategistKnowledgeToolResult } from './knowledge/types';
import type { AiStrategistModelId, AiStrategistWorkflowId } from './types';

type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'boolean';

export type AiStrategistJsonSchema = {
  type: JsonSchemaType;
  description?: string;
  properties?: Record<string, AiStrategistJsonSchema>;
  required?: string[];
  enum?: readonly string[];
  items?: AiStrategistJsonSchema;
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
};

export type AiStrategistLLMRequest<TPayload extends Record<string, unknown>> = {
  kind: 'brief_refinement' | 'prompt_writer' | 'knowledge_synthesis';
  systemInstructions: string;
  developerPayload: Record<string, unknown>;
  userPayload: TPayload;
  expectedJsonSchema: AiStrategistJsonSchema;
};

export type AiStrategistLLMValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning';
};

export type AiStrategistLLMValidationResult = {
  ok: boolean;
  issues: readonly AiStrategistLLMValidationIssue[];
  dedupedWarnings: readonly string[];
};

type BriefRefinementUserPayload = {
  rawUserMessage: string;
  mode?: AiStrategistBriefNormalizationInput['mode'];
  pageContext?: unknown;
  currentPrompt?: string;
  uploadedAsset?: AiStrategistBriefNormalizationInput['uploadedAsset'];
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  conversationContext?: AiStrategistBriefNormalizationInput['conversationContext'];
  hardContext: {
    selectedModelWins: boolean;
    selectedWorkflowWins: boolean;
    uploadedAssetMetadataWins: boolean;
    noAutoGeneration: true;
    noCreditSpend: true;
  };
};

type PromptWriterUserPayload = {
  promptGenerationContext: AiStrategistPromptGenerationContext;
};

type KnowledgeSynthesisUserPayload = {
  toolResults: StrategistKnowledgeToolResult[];
  conversationContext?: Record<string, unknown>;
  allowedSourceLabels: string[];
  lowConfidence: boolean;
  hardRules: {
    noAutoGeneration: true;
    noCreditSpend: true;
    noPublishing: true;
    previewOnly: true;
  };
};

const normalizedIntentValues: readonly AiStrategistNormalizedIntent[] = [
  'product_ad',
  'social_ad',
  'cinematic_scene',
  'talking_avatar',
  'spokesperson',
  'character_animation',
  'product_reference_i2v',
  'person_reference_i2v',
  'video_to_video',
  'draft_storyboard',
  'product_help',
  'prompt_improvement',
  'unknown',
];

const workflowValues: readonly AiStrategistWorkflowId[] = [
  'text-to-video',
  'image-to-video',
  'text-to-image-then-image-to-video',
  'video-to-video',
];

const aspectRatioValues: readonly AiStrategistAspectRatioHint[] = ['9:16', '16:9', '1:1', '4:3', '3:4'];
const qualityIntentValues: readonly AiStrategistQualityIntent[] = ['premium', 'balanced', 'value', 'draft'];
const platformHintValues: readonly AiStrategistPlatformHint[] = ['tiktok', 'instagram', 'youtube', 'website', 'ad', 'unknown'];
const uiActionValues = [
  'SET_MODEL',
  'SET_WORKFLOW',
  'SET_PROMPT',
  'SET_NEGATIVE_PROMPT',
  'SET_ASPECT_RATIO',
  'SET_DURATION',
  'SET_RESOLUTION',
] as const;

const briefRefinementSystemInstructions = [
  'You are the MaxVideoAI brief refinement LLM. Convert messy user input into one structured normalized video brief for deterministic routing.',
  'Hard app context wins over inferred text: selected model, selected workflow, and uploaded asset metadata must be preserved.',
  'Voiceover means off-camera narration unless the user explicitly asks for a visible speaker, talking avatar, spokesperson, person saying a line, or lip-sync.',
  'Product/object references are different from person/character references; do not apply person-reference restrictions to product photos.',
  'If mode is improve_prompt, preserve the improvement context; currentPrompt is the source concept and the user message is the improvement instruction.',
  'For premium product prompt improvements with a concrete product/object and no uploaded reference, prefer text-to-image-then-image-to-video unless the user explicitly asked for pure text-to-video.',
  'Use compact conversationContext when present to interpret short follow-ups against the previous strategist state.',
  'If the user says ok seedance, use Kling, je prends Veo, Best, Medium, or Value after recommendations, treat it as selecting that model/tier for the previous brief, not as a new creative brief.',
  'Ask one short clarification question only if the request is too ambiguous to route.',
  'Do not choose the final model here.',
  'Do not write the final video prompt here.',
  'Do not call generation, spend credits, publish, or claim a render has started.',
].join('\n');

const promptWriterSystemInstructions = [
  'You are the final MaxVideoAI prompt writer LLM. Write the final prompt from the provided deterministic promptGenerationContext only.',
  'Follow the selected model, selected workflow, model-page prompt structure, workflow prompt structure, settings guidance, warnings, and MaxVideoAI rules.',
  'Do not switch model unless the user explicitly asked to switch.',
  'Do not mention Midjourney, DALL-E, Runway, or external tools by default.',
  'Do not invent voiceover or dialogue lines as if the customer provided them. Use [customer-provided line] unless the context includes exact speech.',
  'Avoid over-strong precision wording such as perfectly, precisely, perfect lip-sync, exact lip-sync, exactly synchronized, or ensure no identity drift.',
  'For product labels without a provided label/text asset, use a clean label area and say final typography should be added as an overlay if needed.',
  'Use promptGenerationContext.durationGuidance as a required timing constraint in the final prompt, settings, and SET_DURATION uiAction.',
  'Use duration to shape shot count, motion beats, voiceover/dialogue pacing, lip-sync readability, SFX timing, and final hold.',
  'Do not auto-run generation.',
  'Do not spend credits.',
  'Do not publish anything.',
  'Do not claim 8K, 12K, or any unsupported resolution. Use 1080p unless the settings guidance explicitly supports 4K; native 4K is only for Kling 3 4K.',
  'For text-to-video, output the text-to-video fields required by the context.',
  'For image-to-video, output the reference/preserve/motion/camera/atmosphere/end-frame/audio structure.',
  'For text-to-image-then-image-to-video, output both Starting image prompt and Video animation prompt blocks.',
  'Return JSON only and keep uiActions in { type, value } shape.',
].join('\n');

const knowledgeSynthesisSystemInstructions = [
  'You are the MaxVideoAI knowledge synthesis LLM. Rephrase or combine deterministic knowledge tool results without inventing facts.',
  'Use only facts, URLs, prices, settings, warnings, and limitations present in toolResults.',
  'Cite or mention only source labels available in allowedSourceLabels.',
  'Do not claim unavailable routes, settings, prices, discounts, free generation, unlimited generation, or unsupported resolution.',
  'Keep answers short and helpful.',
  'If any source confidence is below 0.65, say what is missing or ask one short clarification instead of guessing.',
  'Do not run generation, spend credits, publish anything, or imply that a render has started.',
  'Return JSON only and keep uiActions in { type, value } shape.',
].join('\n');

export function buildBriefRefinementLLMRequest(
  input: AiStrategistBriefNormalizationInput
): AiStrategistLLMRequest<BriefRefinementUserPayload> {
  return {
    kind: 'brief_refinement',
    systemInstructions: briefRefinementSystemInstructions,
    developerPayload: {
      task: 'Normalize the raw MaxVideoAI user request into the brief contract used by the deterministic router.',
      pipelinePosition: 'raw user message -> brief refinement LLM -> normalized brief -> deterministic router',
      rules: [
        'Return JSON only.',
        'Preserve raw user meaning without adding a model recommendation.',
        'Set clarificationQuestion only when confidence is low and the request cannot be routed safely.',
        'Keep clarificationQuestion to one short question.',
        'Treat uploadedAsset fields as hard facts.',
        'Use conversationContext as advisor memory only; do not expose raw debug state in normalizedBrief.',
        'For short model/tier follow-ups, preserve or enrich the previous brief and do not interpret model names as style words.',
      ],
    },
    userPayload: {
      rawUserMessage: textOrEmpty(input.rawUserMessage),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.pageContext !== undefined ? { pageContext: toJsonSafe(input.pageContext) } : {}),
      ...(input.currentPrompt ? { currentPrompt: input.currentPrompt } : {}),
      ...(input.uploadedAsset ? { uploadedAsset: input.uploadedAsset } : {}),
      ...(input.selectedModel ? { selectedModel: input.selectedModel } : {}),
      ...(input.selectedWorkflow ? { selectedWorkflow: input.selectedWorkflow } : {}),
      ...(input.conversationContext ? { conversationContext: toJsonSafe(input.conversationContext) as BriefRefinementUserPayload['conversationContext'] } : {}),
      hardContext: {
        selectedModelWins: Boolean(input.selectedModel),
        selectedWorkflowWins: Boolean(input.selectedWorkflow),
        uploadedAssetMetadataWins: Boolean(input.uploadedAsset),
        noAutoGeneration: true,
        noCreditSpend: true,
      },
    },
    expectedJsonSchema: buildNormalizedBriefJsonSchema(),
  };
}

export function buildPromptWriterLLMRequest(
  promptGenerationContext: AiStrategistPromptGenerationContext
): AiStrategistLLMRequest<PromptWriterUserPayload> {
  return {
    kind: 'prompt_writer',
    systemInstructions: promptWriterSystemInstructions,
    developerPayload: {
      task: 'Write the final MaxVideoAI prompt using the deterministic routing and promptGenerationContext.',
      pipelinePosition: 'deterministic router -> promptGenerationContext -> prompt writer LLM -> validation/uiActions',
      rules: [
        'Return JSON only.',
        'Use the selected MaxVideoAI model and workflow.',
        'Use the model-page prompt structure and workflow output blocks supplied in the context.',
        'Preserve warnings and add only relevant extra warnings.',
        'Keep uiActions as objects with type and value.',
      ],
    },
    userPayload: {
      promptGenerationContext,
    },
    expectedJsonSchema: buildPromptWriterJsonSchema(),
  };
}

export function buildKnowledgeSynthesisLLMRequest(
  toolResults: readonly StrategistKnowledgeToolResult[],
  conversationContext: Record<string, unknown> = {}
): AiStrategistLLMRequest<KnowledgeSynthesisUserPayload> {
  const safeToolResults = toJsonSafe(toolResults) as StrategistKnowledgeToolResult[];
  const allowedSourceLabels = uniqueStrings(
    toolResults.flatMap((result) => result.sources.map((source) => source.label))
  );

  return {
    kind: 'knowledge_synthesis',
    systemInstructions: knowledgeSynthesisSystemInstructions,
    developerPayload: {
      task: 'Synthesize deterministic MaxVideoAI knowledge tool results into a concise advisor answer.',
      pipelinePosition: 'knowledge tool router -> deterministic source-backed tool results -> optional cheap LLM synthesis -> validation',
      rules: [
        'Return JSON only.',
        'Use only toolResults as factual context.',
        'Preserve tool warnings and limitations when relevant.',
        'Do not add claims that are not supported by toolResults.',
        'Do not call generation, spend credits, publish, or apply UI actions.',
      ],
    },
    userPayload: {
      toolResults: safeToolResults,
      conversationContext: toJsonSafe(conversationContext) as Record<string, unknown>,
      allowedSourceLabels,
      lowConfidence: toolResults.some((result) => result.confidence < 0.65),
      hardRules: {
        noAutoGeneration: true,
        noCreditSpend: true,
        noPublishing: true,
        previewOnly: true,
      },
    },
    expectedJsonSchema: buildKnowledgeSynthesisJsonSchema(),
  };
}

export function validatePromptWriterLLMOutput(
  output: unknown,
  context?: AiStrategistPromptGenerationContext
): AiStrategistLLMValidationResult {
  const issues: AiStrategistLLMValidationIssue[] = [];
  const outputRecord = isRecord(output) ? output : {};
  const outputText = collectText(outputRecord);
  const finalPrompt = typeof outputRecord.finalPrompt === 'string' ? outputRecord.finalPrompt : '';
  const assistantMessage = typeof outputRecord.assistantMessage === 'string' ? outputRecord.assistantMessage : '';
  const settings = Array.isArray(outputRecord.settings)
    ? outputRecord.settings.filter((setting): setting is string => typeof setting === 'string')
    : [];
  const warnings = Array.isArray(outputRecord.warnings)
    ? outputRecord.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];
  const dedupedWarnings = uniqueStrings(warnings);

  if (!isRecord(output)) {
    issues.push(errorIssue('invalid_output_shape', 'Prompt writer output must be a JSON object.'));
  }

  validateUiActions(outputRecord.uiActions, issues);
  validateExternalToolReferences(outputText, context, issues);
  validateOverpromisingLanguage(outputText, issues);
  validateInventedSpokenLines(finalPrompt, context, issues);
  validateOverStrongPromptWording(finalPrompt, issues);
  validateGeneratedReadableLabelTypography(finalPrompt, context, issues);
  validateUnsupportedResolutionClaims([assistantMessage, finalPrompt, ...settings].join('\n'), context, issues);
  validateDurationInheritance(finalPrompt, settings, context, issues);
  validateWorkflowPromptStructure(finalPrompt, context, issues);

  if (warnings.length !== dedupedWarnings.length) {
    issues.push(warningIssue('duplicate_warning', 'Warnings should be deduped before returning to the UI.'));
  }

  return {
    ok: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues,
    dedupedWarnings,
  };
}

export function validateBriefRefinementLLMOutput(output: unknown): AiStrategistLLMValidationResult {
  const issues: AiStrategistLLMValidationIssue[] = [];
  const outputRecord = isRecord(output) ? output : {};

  if (!isRecord(output)) {
    issues.push(errorIssue('invalid_output_shape', 'Brief refinement output must be a JSON object.'));
  }

  for (const key of ['selectedModel', 'model', 'recommendations'] as const) {
    if (Object.hasOwn(outputRecord, key)) {
      issues.push(errorIssue('brief_refinement_selected_model', 'Brief refinement must not choose or recommend a final model.'));
      break;
    }
  }

  for (const key of ['finalPrompt', 'prompt', 'negativePrompt'] as const) {
    if (Object.hasOwn(outputRecord, key)) {
      issues.push(errorIssue('brief_refinement_final_prompt', 'Brief refinement must not write the final video prompt.'));
      break;
    }
  }

  if (typeof outputRecord.clarificationQuestion === 'string') {
    const question = outputRecord.clarificationQuestion.trim();
    if (question.length > 90 || question.split('?').filter(Boolean).length > 1) {
      issues.push(warningIssue('clarification_too_long', 'Clarification should be one short question.'));
    }
  }

  return {
    ok: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues,
    dedupedWarnings: [],
  };
}

export function validateKnowledgeSynthesisOutput(
  output: unknown,
  context: { toolResults: readonly StrategistKnowledgeToolResult[] }
): AiStrategistLLMValidationResult {
  const issues: AiStrategistLLMValidationIssue[] = [];
  const outputRecord = isRecord(output) ? output : {};
  const outputText = collectText(outputRecord);
  const warnings = Array.isArray(outputRecord.warnings)
    ? outputRecord.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];
  const dedupedWarnings = uniqueStrings(warnings);

  if (!isRecord(output)) {
    issues.push(errorIssue('invalid_output_shape', 'Knowledge synthesis output must be a JSON object.'));
  }

  validateUiActions(outputRecord.uiActions, issues);
  validateKnowledgeUnsupportedClaims(outputText, context.toolResults, issues);
  validateKnowledgeSourceLabels(outputRecord, context.toolResults, issues);

  if (warnings.length !== dedupedWarnings.length) {
    issues.push(warningIssue('duplicate_warning', 'Warnings should be deduped before returning to the UI.'));
  }

  return {
    ok: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues,
    dedupedWarnings,
  };
}

function buildNormalizedBriefJsonSchema(): AiStrategistJsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'rawUserMessage',
      'normalizedBrief',
      'intent',
      'hasProduct',
      'hasPerson',
      'hasCharacter',
      'hasUploadedReference',
      'hasVisibleSpeaker',
      'hasVoiceover',
      'hasDialogue',
      'hasLipSyncIntent',
      'hasLogoOrTextRisk',
      'qualityIntent',
      'platformHint',
      'styleHints',
      'constraints',
      'confidence',
    ],
    properties: {
      rawUserMessage: stringSchema('Original user text for debugging and traceability.'),
      normalizedBrief: stringSchema('Cleaned structured brief, not a final generation prompt.'),
      intent: enumSchema(normalizedIntentValues),
      workflowHint: enumSchema(workflowValues),
      hasProduct: booleanSchema(),
      hasPerson: booleanSchema(),
      hasCharacter: booleanSchema(),
      hasUploadedReference: booleanSchema(),
      hasVisibleSpeaker: booleanSchema(),
      hasVoiceover: booleanSchema(),
      hasDialogue: booleanSchema(),
      hasLipSyncIntent: booleanSchema(),
      hasLogoOrTextRisk: booleanSchema(),
      aspectRatioHint: enumSchema(aspectRatioValues),
      qualityIntent: enumSchema(qualityIntentValues),
      platformHint: enumSchema(platformHintValues),
      styleHints: stringArraySchema(),
      constraints: stringArraySchema(),
      clarificationQuestion: stringSchema('One short follow-up question when confidence is too low.'),
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
      },
    },
  };
}

function buildPromptWriterJsonSchema(): AiStrategistJsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['assistantMessage', 'finalPrompt', 'negativePrompt', 'settings', 'warnings', 'uiActions'],
    properties: {
      assistantMessage: stringSchema('Short UI-facing explanation of what was prepared.'),
      finalPrompt: stringSchema('Final MaxVideoAI prompt following the selected model and workflow structure.'),
      negativePrompt: stringSchema('Negative prompt aligned with model and prompt-structure guidance.'),
      settings: stringArraySchema(),
      warnings: stringArraySchema(),
      uiActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'value'],
          properties: {
            type: enumSchema(uiActionValues),
            value: stringSchema('Value to set in the UI.'),
          },
        },
      },
    },
  };
}

function buildKnowledgeSynthesisJsonSchema(): AiStrategistJsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['assistantMessage', 'warnings', 'uiActions'],
    properties: {
      assistantMessage: stringSchema('Short UI-facing answer grounded only in the provided knowledge tool results.'),
      warnings: stringArraySchema(),
      sourceLabels: stringArraySchema(),
      uiActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'value'],
          properties: {
            type: enumSchema(uiActionValues),
            value: stringSchema('Value to preview in the UI.'),
          },
        },
      },
    },
  };
}

function validateKnowledgeUnsupportedClaims(
  outputText: string,
  toolResults: readonly StrategistKnowledgeToolResult[],
  issues: AiStrategistLLMValidationIssue[]
): void {
  const toolText = toolResults.map((result) => result.answer).join('\n');
  const unsupportedPatterns = [
    /\bfree\b/i,
    /\bunlimited\b/i,
    /\b(?:ultra[-\s]?(?:high)?[-\s]*)?(?:[5-9]|[1-9]\d+)\s*k\b/i,
    /\bguaranteed\b/i,
  ];

  if (unsupportedPatterns.some((pattern) => pattern.test(outputText) && !pattern.test(toolText))) {
    issues.push(errorIssue('unsupported_knowledge_claim', 'Knowledge synthesis output contains an unsupported factual claim.'));
  }

  if (/\b(run|start|launch)\s+(?:the\s+)?generation\b/i.test(outputText)) {
    issues.push(errorIssue('unsafe_generation_claim', 'Knowledge synthesis must not imply it can run generation or spend credits.'));
  }
}

function validateKnowledgeSourceLabels(
  outputRecord: Record<string, unknown>,
  toolResults: readonly StrategistKnowledgeToolResult[],
  issues: AiStrategistLLMValidationIssue[]
): void {
  const allowedLabels = new Set(toolResults.flatMap((result) => result.sources.map((source) => source.label)));
  const explicitLabels = Array.isArray(outputRecord.sourceLabels)
    ? outputRecord.sourceLabels.filter((label): label is string => typeof label === 'string')
    : [];
  const inlineLabels = collectInlineSourceLabels(typeof outputRecord.assistantMessage === 'string' ? outputRecord.assistantMessage : '');

  for (const label of [...explicitLabels, ...inlineLabels]) {
    if (!allowedLabels.has(label.trim())) {
      issues.push(errorIssue('unknown_source_label', 'Knowledge synthesis cited a source label that was not provided by toolResults.'));
      return;
    }
  }
}

function collectInlineSourceLabels(text: string): string[] {
  const labels: string[] = [];
  for (const match of text.matchAll(/\bSource:\s*([^\n.]+)/gi)) {
    if (match[1]) labels.push(match[1].trim());
  }
  return labels;
}

function validateUiActions(value: unknown, issues: AiStrategistLLMValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(errorIssue('invalid_ui_actions_type', 'uiActions must be an array.'));
    return;
  }

  for (const action of value) {
    if (typeof action === 'string') {
      issues.push(errorIssue('bare_ui_action_string', 'uiActions must use { type, value }, not bare strings.'));
      continue;
    }

    if (!isRecord(action) || typeof action.type !== 'string' || typeof action.value !== 'string') {
      issues.push(errorIssue('invalid_ui_action_shape', 'Every uiAction must include string type and value fields.'));
    }
  }
}

function validateExternalToolReferences(
  outputText: string,
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  if (/\b(Midjourney|DALL-?E|Runway)\b/i.test(outputText)) {
    issues.push(errorIssue('external_tool_reference', 'Prompt writer output should not mention external tools by default.'));
  }

  if (/\bPika Labs\b/i.test(outputText) && context?.selectedModel.id !== 'pika') {
    issues.push(errorIssue('external_tool_reference', 'Pika Labs should not be mentioned outside the selected Pika model context.'));
  }
}

function validateOverpromisingLanguage(outputText: string, issues: AiStrategistLLMValidationIssue[]): void {
  if (/\b(flawless|perfect|guaranteed|always)\b/i.test(outputText)) {
    issues.push(warningIssue('overpromising_language', 'Avoid overpromising terms such as flawless, perfect, guaranteed, or always.'));
  }
}

function validateInventedSpokenLines(
  finalPrompt: string,
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  if (!finalPrompt || hasCustomerProvidedSpokenLine(context)) return;

  if (hasQuotedSpeechCue(finalPrompt)) {
    issues.push(warningIssue('invented_spoken_line', 'Do not invent voiceover or dialogue lines as if they were customer-provided.'));
  }
}

function validateOverStrongPromptWording(finalPrompt: string, issues: AiStrategistLLMValidationIssue[]): void {
  if (
    /\b(perfectly|precisely)\b/i.test(finalPrompt) ||
    /\b(?:perfect|exact)\s+lip-sync\b/i.test(finalPrompt) ||
    /\brealistic\s+lip-sync(?:ing)?\b/i.test(finalPrompt) ||
    /\blip-sync\s+accuracy\b/i.test(finalPrompt) ||
    /\bexactly\s+synchronized\b/i.test(finalPrompt) ||
    /\bexact\s+facial\s+(?:identity|structure)\b/i.test(finalPrompt) ||
    /\bensure\s+no\s+identity\s+drift\b/i.test(finalPrompt) ||
    /\blip-sync\s+should\s+be\s+[^.\n]*\bmatching\s+the\s+provided\s+(?:audio|dialogue)\b/i.test(finalPrompt) ||
    /\bmouth\s+movements\s+should\s+match\s+the\s+provided\s+(?:audio track|audio|dialogue)\b/i.test(finalPrompt) ||
    /\blip-sync(?:ing)?\s+(?:to\s+match|to)\s+the\s+provided\s+(?:audio|dialogue)\b/i.test(finalPrompt) ||
    /\blip-sync(?:ing)?\s+enabled\b/i.test(finalPrompt)
  ) {
    issues.push(warningIssue('over_strong_prompt_wording', 'Use careful wording for precision, lip-sync, centering, and identity preservation.'));
  }
}

function validateGeneratedReadableLabelTypography(
  finalPrompt: string,
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  if (!finalPrompt || context?.uploadedAsset?.hasText || context?.uploadedAsset?.hasLogo) return;
  if (context?.promptStructure.id !== 'product-ad') return;

  if (/\blabel\s+with\s+[^,\n.;]*(?:typography|text|lettering)\b/i.test(finalPrompt) || /\b(?:label readability|readable label|legible label|readable typography)\b/i.test(finalPrompt)) {
    issues.push(warningIssue('generated_label_typography', 'Do not ask the model to generate readable label typography when no label/text asset was provided.'));
  }
}

function validateUnsupportedResolutionClaims(
  outputText: string,
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  const highResolutionMatches = outputText.matchAll(/\b(?:ultra[-\s]?(?:high)?[-\s]*)?([5-9]|[1-9]\d+)\s*k\b/gi);
  for (const match of highResolutionMatches) {
    const resolutionK = Number.parseInt(match[1], 10);
    if (resolutionK > 4) {
      issues.push(errorIssue('unsupported_resolution_claim', 'Prompt writer output must not claim unsupported 8K, 12K, or higher resolution.'));
      return;
    }
  }

  if (!/\b4\s*k\b/i.test(outputText)) return;

  const modelId = context?.selectedModel.id;
  if (/\bnative\s+4\s*k\b/i.test(outputText) && modelId !== 'kling-3-4k') {
    issues.push(errorIssue('unsupported_resolution_claim', 'Native 4K wording is only allowed for Kling 3 4K.'));
    return;
  }

  if (!modelId || !supports4KClaim(modelId)) {
    issues.push(errorIssue('unsupported_resolution_claim', '4K wording is only allowed when the selected model/settings guidance supports 4K.'));
  }
}

function supports4KClaim(modelId: AiStrategistModelId): boolean {
  return modelId === 'kling-3-4k' || modelId === 'veo-3-1' || modelId === 'veo-3-1-fast';
}

function validateDurationInheritance(
  finalPrompt: string,
  settings: readonly string[],
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  if (!context?.durationGuidance) return;
  const duration = context.durationGuidance;
  const durationPattern = new RegExp(`\\b${duration.seconds}\\s*(?:seconds?|secs?|sec|s)\\b|\\b${duration.seconds}-second\\b`, 'i');
  if (!durationPattern.test(finalPrompt)) {
    issues.push(errorIssue('missing_duration_in_prompt', 'Final prompt must include the strategist-selected duration.'));
  }
  if (!durationPattern.test(settings.join('\n'))) {
    issues.push(errorIssue('missing_duration_in_settings', 'Settings must include the strategist-selected duration.'));
  }
}

function hasCustomerProvidedSpokenLine(context: AiStrategistPromptGenerationContext | undefined): boolean {
  if (!context) return false;
  const sourceText = [context.userBrief, context.currentPrompt].filter(Boolean).join('\n');
  return /['"“][^'"”]{3,}['"”]/.test(sourceText) || /\b(?:voiceover|dialogue|spoken line|says?|narration)\s*:\s*\S+/i.test(sourceText);
}

function hasQuotedSpeechCue(finalPrompt: string): boolean {
  return (
    /\b(?:voiceover|dialogue|spoken line|narrat(?:ing|ion|e)?|saying|says)\b[^\n.]{0,160}:\s*['"“][^'"”]+['"”]/i.test(finalPrompt) ||
    /\b(?:voiceover|dialogue|spoken line)\b[^\n.]{0,120}\b(?:narrating|saying|says)\s*['"“][^'"”]+['"”]/i.test(finalPrompt)
  );
}

function validateWorkflowPromptStructure(
  finalPrompt: string,
  context: AiStrategistPromptGenerationContext | undefined,
  issues: AiStrategistLLMValidationIssue[]
): void {
  if (!context || !finalPrompt) return;

  const requiredFields = requiredPromptFieldsForWorkflow(context.selectedWorkflow);
  const hasRequiredFields = requiredFields.every((field) => new RegExp(`^${escapeRegExp(field)}:`, 'mi').test(finalPrompt));
  const hasStartingImageBlocks = /^Starting image prompt:/im.test(finalPrompt) && /^Video animation prompt:/im.test(finalPrompt);

  if (context.selectedWorkflow === 'text-to-image-then-image-to-video') {
    if (!hasStartingImageBlocks) {
      issues.push(errorIssue('workflow_prompt_structure_mismatch', 'Text-to-image then image-to-video requires both starting image and video animation prompt blocks.'));
    }
    return;
  }

  if (context.selectedWorkflow !== 'text-to-image-then-image-to-video' && hasStartingImageBlocks) {
    issues.push(errorIssue('workflow_prompt_structure_mismatch', 'Prompt blocks do not match the selected workflow.'));
    return;
  }

  if (!hasRequiredFields) {
    issues.push(errorIssue('workflow_prompt_structure_mismatch', 'Prompt is missing required fields for the selected workflow.'));
  }
}

function requiredPromptFieldsForWorkflow(workflow: AiStrategistWorkflowId): readonly string[] {
  if (workflow === 'text-to-video') return ['Subject', 'Duration', 'Action', 'Camera', 'Style'];
  if (workflow === 'image-to-video') return ['Reference', 'Preserve', 'Duration', 'Motion', 'Camera', 'Atmosphere', 'End frame'];
  if (workflow === 'video-to-video') return ['Source clip', 'Preserve', 'Duration', 'Edit direction', 'Camera/motion'];
  return [];
}

function collectText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join('\n');
  if (isRecord(value)) return Object.values(value).map(collectText).join('\n');
  return '';
}

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringSchema(description?: string): AiStrategistJsonSchema {
  return {
    type: 'string',
    ...(description ? { description } : {}),
  };
}

function booleanSchema(): AiStrategistJsonSchema {
  return { type: 'boolean' };
}

function enumSchema(values: readonly string[]): AiStrategistJsonSchema {
  return {
    type: 'string',
    enum: values,
  };
}

function stringArraySchema(): AiStrategistJsonSchema {
  return {
    type: 'array',
    items: { type: 'string' },
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorIssue(code: string, message: string): AiStrategistLLMValidationIssue {
  return { code, message, severity: 'error' };
}

function warningIssue(code: string, message: string): AiStrategistLLMValidationIssue {
  return { code, message, severity: 'warning' };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
