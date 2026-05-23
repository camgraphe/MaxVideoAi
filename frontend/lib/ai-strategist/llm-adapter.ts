import { createSign } from 'node:crypto';

import type { AiStrategistBriefNormalizationInput, AiStrategistNormalizedBrief } from './brief-normalization';
import { normalizeStrategistBrief } from './brief-normalization';
import {
  buildBriefRefinementLLMRequest,
  buildPromptWriterLLMRequest,
  type AiStrategistLLMRequest,
  type AiStrategistLLMValidationIssue,
  type AiStrategistLLMValidationResult,
  validateBriefRefinementLLMOutput,
  validatePromptWriterLLMOutput,
} from './llm-contracts';
import {
  buildModelSpecificPrompt,
  type AiStrategistPromptGenerationContext,
} from './prompt-structures';
import type {
  AiStrategistPromptStructureId,
  AiStrategistSourceImageKind,
  AiStrategistWorkflowId,
} from './types';

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

type AiStrategistLLMEnv = {
  AI_STRATEGIST_LLM_PROVIDER?: string;
  AI_STRATEGIST_LLM_MODEL?: string;
  GOOGLE_VERTEX_PROJECT_ID?: string;
  GOOGLE_VERTEX_LOCATION?: string;
  GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_VERTEX_API_BASE_URL?: string;
};

export type AiStrategistLLMConfig = {
  provider: 'google-vertex-gemini';
  model: string;
  projectId: string;
  location: string;
  serviceAccountJson: string;
  apiBaseUrl: string;
};

export type AiStrategistLLMCompletionParams = {
  request: AiStrategistLLMRequest<Record<string, unknown>>;
  config: AiStrategistLLMConfig;
  signal?: AbortSignal;
};

export type AiStrategistLLMCompletionClient = (params: AiStrategistLLMCompletionParams) => Promise<unknown>;

export type AiStrategistLLMRunOptions = {
  env?: AiStrategistLLMEnv;
  completionClient?: AiStrategistLLMCompletionClient;
  signal?: AbortSignal;
  disableLLM?: boolean;
  disableReason?: string;
};

export type AiStrategistBriefRefinementLLMResult = {
  usedLLM: boolean;
  source: 'llm' | 'deterministic_fallback';
  fallbackReason?: string;
  provider?: string;
  model?: string;
  output: AiStrategistNormalizedBrief;
  request: ReturnType<typeof buildBriefRefinementLLMRequest>;
  validation: AiStrategistLLMValidationResult;
  rawOutput?: unknown;
  error?: string;
};

export type AiStrategistPromptWriterOutput = {
  assistantMessage: string;
  finalPrompt: string;
  negativePrompt: string;
  settings: string[];
  warnings: string[];
  uiActions: {
    type:
      | 'SET_MODEL'
      | 'SET_WORKFLOW'
      | 'SET_PROMPT'
      | 'SET_NEGATIVE_PROMPT'
      | 'SET_ASPECT_RATIO'
      | 'SET_DURATION'
      | 'SET_RESOLUTION';
    value: string;
  }[];
};

export type AiStrategistPromptWriterLLMResult = {
  usedLLM: boolean;
  source: 'llm' | 'deterministic_fallback';
  fallbackReason?: string;
  provider?: string;
  model?: string;
  output: AiStrategistPromptWriterOutput;
  request: ReturnType<typeof buildPromptWriterLLMRequest>;
  validation: AiStrategistLLMValidationResult;
  validationBeforeSanitizer: AiStrategistLLMValidationResult;
  validationAfterSanitizer: AiStrategistLLMValidationResult;
  sanitizerChangedOutput: boolean;
  rawOutput?: unknown;
  error?: string;
};

let cachedGoogleToken: { accessToken: string; expiresAtMs: number } | null = null;

const productObjectTerms = [
  'product',
  'perfume',
  'perfume bottle',
  'bottle',
  'sneaker',
  'sneakers',
  'shoe',
  'shoes',
  'jewelry',
  'jewellery',
  'skincare',
  'packaging',
  'package',
  'watch',
  'car',
  'glass',
  'label',
  'logo',
] as const;

const premiumProductRefinementTerms = [
  'premium',
  'product',
  'commercial',
  'cinematic',
  'luxury',
  'hero',
  'glass',
  'reflection',
  'reflections',
] as const;

const explicitTextToVideoTerms = [
  'pure text-to-video',
  'text-to-video only',
  'only text-to-video',
  'keep it text-to-video',
  'keep it pure text-to-video',
  'no starting image',
  'without starting image',
  'without image generation',
] as const;

export async function runBriefRefinementLLM(
  input: AiStrategistBriefNormalizationInput,
  options: AiStrategistLLMRunOptions = {}
): Promise<AiStrategistBriefRefinementLLMResult> {
  const request = buildBriefRefinementLLMRequest(input);
  const fallbackOutput = normalizeStrategistBrief(input);
  if (options.disableLLM) {
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: options.disableReason ?? 'llm_disabled',
      output: fallbackOutput,
      request,
      validation: okValidation(),
    };
  }

  const configResult = resolveLocalLLMConfig(options.env);
  if (!configResult.ok) {
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: configResult.reason,
      output: fallbackOutput,
      request,
      validation: okValidation(),
    };
  }

  try {
    const rawOutput = await runCompletion({ request, config: configResult.config, options });
    const validation = validateBriefRefinementLLMOutput(rawOutput);
    const output = isNormalizedBrief(rawOutput) ? rawOutput : null;
    const finalValidation = output ? validation : withIssue(validation, errorIssue('invalid_normalized_brief_shape', 'LLM output does not match the normalized brief shape.'));

    if (!output || !finalValidation.ok) {
      return {
        usedLLM: false,
        source: 'deterministic_fallback',
        fallbackReason: 'validation_failed',
        provider: configResult.config.provider,
        model: configResult.config.model,
        output: fallbackOutput,
        request,
        validation: finalValidation,
        rawOutput,
      };
    }

    const mergedOutput = applyBriefHardContextOverrides(output, input);

    return {
      usedLLM: true,
      source: 'llm',
      provider: configResult.config.provider,
      model: configResult.config.model,
      output: mergedOutput,
      request,
      validation: finalValidation,
      rawOutput,
    };
  } catch (error) {
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: classifyAdapterError(error),
      provider: configResult.config.provider,
      model: configResult.config.model,
      output: fallbackOutput,
      request,
      validation: withIssue(okValidation(), errorIssue('llm_adapter_error', errorMessage(error))),
      error: errorMessage(error),
    };
  }
}

export async function runPromptWriterLLM(
  context: AiStrategistPromptGenerationContext,
  options: AiStrategistLLMRunOptions = {}
): Promise<AiStrategistPromptWriterLLMResult> {
  const request = buildPromptWriterLLMRequest(context);
  const rawFallbackOutput = buildPromptWriterFallback(context);
  const fallbackOutput = normalizePromptWriterOutput(rawFallbackOutput, context);
  const fallbackSanitizerChangedOutput = promptWriterOutputChanged(rawFallbackOutput, fallbackOutput);
  if (options.disableLLM) {
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: options.disableReason ?? 'llm_disabled',
      output: fallbackOutput,
      request,
      validation: okValidation(),
      validationBeforeSanitizer: okValidation(),
      validationAfterSanitizer: okValidation(),
      sanitizerChangedOutput: fallbackSanitizerChangedOutput,
    };
  }

  const configResult = resolveLocalLLMConfig(options.env);
  if (!configResult.ok) {
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: configResult.reason,
      output: fallbackOutput,
      request,
      validation: okValidation(),
      validationBeforeSanitizer: okValidation(),
      validationAfterSanitizer: okValidation(),
      sanitizerChangedOutput: fallbackSanitizerChangedOutput,
    };
  }

  try {
    const rawOutput = await runCompletion({ request, config: configResult.config, options });
    const validationBeforeSanitizer = validatePromptWriterLLMOutput(rawOutput, context);
    const output = isPromptWriterOutput(rawOutput) ? normalizePromptWriterOutput(rawOutput, context) : null;
    const validationAfterSanitizer = output ? validatePromptWriterLLMOutput(output, context) : validationBeforeSanitizer;
    const finalValidation = output ? validationAfterSanitizer : withIssue(validationBeforeSanitizer, errorIssue('invalid_prompt_writer_shape', 'LLM output does not match the prompt writer shape.'));
    const sanitizerChangedOutput = output && isPromptWriterOutput(rawOutput) ? promptWriterOutputChanged(rawOutput, output) : false;
    const hasBlockingValidationError = validationBeforeSanitizer.issues.some((issue) => issue.severity === 'error') || finalValidation.issues.some((issue) => issue.severity === 'error');

    if (!output || hasBlockingValidationError) {
      return {
        usedLLM: false,
        source: 'deterministic_fallback',
        fallbackReason: 'validation_failed',
        provider: configResult.config.provider,
        model: configResult.config.model,
        output: fallbackOutput,
        request,
        validation: finalValidation,
        validationBeforeSanitizer,
        validationAfterSanitizer: finalValidation,
        sanitizerChangedOutput: sanitizerChangedOutput || fallbackSanitizerChangedOutput,
        rawOutput,
      };
    }

    return {
      usedLLM: true,
      source: 'llm',
      provider: configResult.config.provider,
      model: configResult.config.model,
      output,
      request,
      validation: finalValidation,
      validationBeforeSanitizer,
      validationAfterSanitizer,
      sanitizerChangedOutput,
      rawOutput,
    };
  } catch (error) {
    const validation = withIssue(okValidation(), errorIssue('llm_adapter_error', errorMessage(error)));
    return {
      usedLLM: false,
      source: 'deterministic_fallback',
      fallbackReason: classifyAdapterError(error),
      provider: configResult.config.provider,
      model: configResult.config.model,
      output: fallbackOutput,
      request,
      validation,
      validationBeforeSanitizer: validation,
      validationAfterSanitizer: validation,
      sanitizerChangedOutput: fallbackSanitizerChangedOutput,
      error: errorMessage(error),
    };
  }
}

async function runCompletion(params: {
  request: AiStrategistLLMRequest<Record<string, unknown>>;
  config: AiStrategistLLMConfig;
  options: AiStrategistLLMRunOptions;
}): Promise<unknown> {
  if (params.options.completionClient) {
    return params.options.completionClient({
      request: params.request,
      config: params.config,
      signal: params.options.signal,
    });
  }

  return callGoogleVertexGemini(params.config, params.request, params.options.signal);
}

function resolveLocalLLMConfig(envInput?: AiStrategistLLMEnv):
  | { ok: true; config: AiStrategistLLMConfig }
  | { ok: false; reason: string } {
  const env = envInput ?? process.env;
  const provider = cleanEnv(env.AI_STRATEGIST_LLM_PROVIDER);
  const model = cleanEnv(env.AI_STRATEGIST_LLM_MODEL);
  const projectId = cleanEnv(env.GOOGLE_VERTEX_PROJECT_ID);
  const location = cleanEnv(env.GOOGLE_VERTEX_LOCATION);
  const serviceAccountJson = cleanEnv(env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON);

  if (!provider && !model && !projectId && !location && !serviceAccountJson) {
    return { ok: false, reason: 'missing_local_llm_config' };
  }
  if (provider !== 'google-vertex-gemini') {
    return { ok: false, reason: provider ? 'unsupported_local_llm_provider' : 'missing_local_llm_config' };
  }
  if (!model || !projectId || !location || !serviceAccountJson) {
    return { ok: false, reason: 'missing_local_llm_config' };
  }

  return {
    ok: true,
    config: {
      provider: 'google-vertex-gemini',
      model,
      projectId,
      location,
      serviceAccountJson,
      apiBaseUrl: cleanEnv(env.GOOGLE_VERTEX_API_BASE_URL) || defaultGoogleVertexApiBaseUrl(location),
    },
  };
}

async function callGoogleVertexGemini(
  config: AiStrategistLLMConfig,
  request: AiStrategistLLMRequest<Record<string, unknown>>,
  signal?: AbortSignal
): Promise<unknown> {
  const serviceAccount = parseServiceAccount(config.serviceAccountJson);
  const token = await getGoogleAccessToken(serviceAccount);
  const response = await fetch(buildGeminiGenerateContentUrl(config), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildGeminiRequestBody(request)),
    signal,
  });
  const raw = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`Vertex Gemini request failed with status ${response.status}: ${JSON.stringify(raw)}`);
  }
  return parseGeminiJsonResponse(raw);
}

function buildGeminiGenerateContentUrl(config: AiStrategistLLMConfig): string {
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  return `${base}/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(
    config.location
  )}/publishers/google/models/${encodeURIComponent(config.model)}:generateContent`;
}

function buildGeminiRequestBody(request: AiStrategistLLMRequest<Record<string, unknown>>): Record<string, unknown> {
  return {
    systemInstruction: {
      parts: [{ text: request.systemInstructions }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              developerPayload: request.developerPayload,
              userPayload: request.userPayload,
              expectedJsonSchema: request.expectedJsonSchema,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
  };
}

function parseGeminiJsonResponse(raw: unknown): unknown {
  const text = extractGeminiText(raw);
  if (!text) {
    throw new Error('Vertex Gemini response did not include text output.');
  }
  return parseJsonText(text);
}

function extractGeminiText(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const candidates = raw.candidates;
  if (!Array.isArray(candidates)) return null;
  const first = candidates[0];
  if (!isRecord(first) || !isRecord(first.content)) return null;
  const parts = first.content.parts;
  if (!Array.isArray(parts)) return null;
  return parts
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim() || null;
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error('Vertex Gemini output was not valid JSON.');
    return JSON.parse(match[1].trim()) as unknown;
  }
}

function parseServiceAccount(raw: string): GoogleServiceAccount {
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('missing client_email or private_key');
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
      token_uri: parsed.token_uri,
      project_id: parsed.project_id,
    };
  } catch (error) {
    throw new Error(`GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is invalid: ${errorMessage(error)}`);
  }
}

function buildJwt(serviceAccount: GoogleServiceAccount): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  return `${signingInput}.${base64Url(signature)}`;
}

async function getGoogleAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  if (cachedGoogleToken && cachedGoogleToken.expiresAtMs - Date.now() > 60_000) {
    return cachedGoogleToken.accessToken;
  }

  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(serviceAccount),
    }),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(`Google OAuth token request failed with status ${response.status}: ${JSON.stringify(json)}`);
  }
  const accessToken = typeof json?.access_token === 'string' ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new Error('Google OAuth response did not include an access token.');
  }
  cachedGoogleToken = { accessToken, expiresAtMs: Date.now() + expiresIn * 1000 };
  return accessToken;
}

function buildPromptWriterFallback(context: AiStrategistPromptGenerationContext): AiStrategistPromptWriterOutput {
  const draft = buildModelSpecificPrompt({
    modelId: context.selectedModel.id,
    promptStructureId: context.promptStructure.id as AiStrategistPromptStructureId,
    brief: context.userBrief,
    workflow: context.selectedWorkflow,
    selectedTier: context.selectedTier,
    sourceImageKind: inferSourceImageKind(context),
  });
  const warnings = uniqueStrings([draft.warning, ...context.warnings.all].filter((value): value is string => Boolean(value)));
  return {
    assistantMessage: `Great, the prompt is ready for ${context.selectedModel.label}. Next, use the prompt below with the negative prompt, settings, and warnings; you can copy it or adjust the brief. No generation runs and no credits are spent here.`,
    finalPrompt: draft.finalPrompt,
    negativePrompt: draft.negativePrompt,
    settings: [...draft.recommendedSettings],
    warnings,
    uiActions: buildFallbackUiActions({
      modelId: context.selectedModel.id,
      workflow: context.selectedWorkflow,
      finalPrompt: draft.finalPrompt,
      negativePrompt: draft.negativePrompt,
      settings: draft.recommendedSettings,
    }),
  };
}

function buildFallbackUiActions(input: {
  modelId: string;
  workflow: AiStrategistWorkflowId;
  finalPrompt: string;
  negativePrompt: string;
  settings: readonly string[];
}): AiStrategistPromptWriterOutput['uiActions'] {
  const actions: AiStrategistPromptWriterOutput['uiActions'] = [
    { type: 'SET_MODEL', value: input.modelId },
    { type: 'SET_WORKFLOW', value: input.workflow },
    { type: 'SET_PROMPT', value: input.finalPrompt },
    { type: 'SET_NEGATIVE_PROMPT', value: input.negativePrompt },
  ];
  const aspectRatio = input.settings.find((setting) => /\b\d+:\d+\b/.test(setting));
  const duration = input.settings.find((setting) => /\b\d+(?:-\d+)?\s*(?:seconds|second|s)\b/i.test(setting));
  const resolution = input.settings.find((setting) => /\b(?:native\s+)?(?:4K|1080p|720p)\b/i.test(setting));
  if (aspectRatio) actions.push({ type: 'SET_ASPECT_RATIO', value: aspectRatio });
  if (duration) actions.push({ type: 'SET_DURATION', value: duration });
  if (resolution) actions.push({ type: 'SET_RESOLUTION', value: resolution });
  return actions;
}

function isNormalizedBrief(value: unknown): value is AiStrategistNormalizedBrief {
  if (!isRecord(value)) return false;
  return (
    typeof value.rawUserMessage === 'string' &&
    typeof value.normalizedBrief === 'string' &&
    typeof value.intent === 'string' &&
    typeof value.hasProduct === 'boolean' &&
    typeof value.hasPerson === 'boolean' &&
    typeof value.hasCharacter === 'boolean' &&
    typeof value.hasUploadedReference === 'boolean' &&
    typeof value.hasVisibleSpeaker === 'boolean' &&
    typeof value.hasVoiceover === 'boolean' &&
    typeof value.hasDialogue === 'boolean' &&
    typeof value.hasLipSyncIntent === 'boolean' &&
    typeof value.hasLogoOrTextRisk === 'boolean' &&
    typeof value.qualityIntent === 'string' &&
    typeof value.platformHint === 'string' &&
    Array.isArray(value.styleHints) &&
    Array.isArray(value.constraints) &&
    typeof value.confidence === 'number'
  );
}

function isPromptWriterOutput(value: unknown): value is AiStrategistPromptWriterOutput {
  if (!isRecord(value)) return false;
  return (
    typeof value.assistantMessage === 'string' &&
    typeof value.finalPrompt === 'string' &&
    typeof value.negativePrompt === 'string' &&
    Array.isArray(value.settings) &&
    value.settings.every((setting) => typeof setting === 'string') &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string') &&
    Array.isArray(value.uiActions) &&
    value.uiActions.every((action) => isRecord(action) && typeof action.type === 'string' && typeof action.value === 'string')
  );
}

function normalizePromptWriterOutput(
  output: AiStrategistPromptWriterOutput,
  context: AiStrategistPromptGenerationContext
): AiStrategistPromptWriterOutput {
  const finalPrompt = sanitizePromptWriterText(output.finalPrompt, context);
  const negativePrompt = sanitizeProtectedStyleReferences(output.negativePrompt);
  return {
    assistantMessage: sanitizeProtectedStyleReferences(output.assistantMessage),
    finalPrompt,
    negativePrompt,
    settings: uniqueStrings(output.settings.map(sanitizeProtectedStyleReferences)),
    warnings: uniqueStrings(output.warnings.map(sanitizeProtectedStyleReferences)),
    uiActions: output.uiActions.map((action) => {
      if (action.type === 'SET_PROMPT') return { ...action, value: finalPrompt };
      if (action.type === 'SET_NEGATIVE_PROMPT') return { ...action, value: negativePrompt };
      return { ...action, value: sanitizeProtectedStyleReferences(action.value) };
    }),
  };
}

function promptWriterOutputChanged(rawOutput: AiStrategistPromptWriterOutput, output: AiStrategistPromptWriterOutput): boolean {
  return (
    rawOutput.finalPrompt !== output.finalPrompt ||
    rawOutput.negativePrompt !== output.negativePrompt ||
    JSON.stringify(rawOutput.settings) !== JSON.stringify(output.settings) ||
    JSON.stringify(rawOutput.warnings) !== JSON.stringify(output.warnings) ||
    JSON.stringify(rawOutput.uiActions) !== JSON.stringify(output.uiActions)
  );
}

function sanitizePromptWriterText(text: string, context: AiStrategistPromptGenerationContext): string {
  let next = text;
  if (!hasCustomerProvidedSpokenLine(context)) {
    next = sanitizeInventedSpokenLines(next);
  }
  next = sanitizeOverStrongPromptWording(next);
  next = sanitizeProtectedStyleReferences(next);
  if (!context.uploadedAsset?.hasText && !context.uploadedAsset?.hasLogo && context.promptStructure.id === 'product-ad') {
    next = sanitizeGeneratedLabelTypography(next);
  }
  return next;
}

function sanitizeProtectedStyleReferences(text: string): string {
  return text
    .replace(/\bStreet Fighter\s+style\s+fight\b/gi, 'arcade fighting / stylized combat scene')
    .replace(/\bStreet Fighter\s+(?:style|aesthetic|inspiration)\b/gi, 'arcade fighting / stylized combat inspiration')
    .replace(/\binspired by\s+Street Fighter\b/gi, 'inspired by arcade fighting games and stylized combat')
    .replace(/\bStreet Fighter\b/gi, 'arcade fighting / stylized combat')
    .replace(/\bMortal Kombat\b/gi, 'dark arcade fighting game inspiration')
    .replace(/\bGrand Theft Auto\b|\bGTA\b/gi, 'open-world urban crime-drama inspiration')
    .replace(/\bFortnite\b/gi, 'colorful stylized battle-game inspiration')
    .replace(/\bMinecraft\b/gi, 'blocky voxel-world inspiration')
    .replace(/\bPok[eé]mon\b/gi, 'creature-collector adventure inspiration')
    .replace(/\bMarvel\b/gi, 'superhero comic-book inspiration')
    .replace(/\bDisney\b/gi, 'family-friendly animated film inspiration')
    .replace(/\bStar Wars\b/gi, 'space-opera sci-fi inspiration');
}

function sanitizeInventedSpokenLines(text: string): string {
  return text
    .replace(
      /(\b(?:voiceover|dialogue|spoken line|narrat(?:ing|ion|e)?|saying|says)\b[^\n.]{0,160}:\s*)['"“][^'"”]+['"”]/gi,
      '$1[customer-provided line]'
    )
    .replace(
      /(\b(?:voiceover|dialogue|spoken line)\b[^\n.]{0,120}\b(?:narrating|saying|says)\s*)['"“][^'"”]+['"”]/gi,
      '$1[customer-provided line]'
    );
}

function sanitizeOverStrongPromptWording(text: string): string {
  return text
    .replace(/\bMaintain(?: the)? exact facial structure\b/gi, 'Preserve facial structure as much as possible')
    .replace(/\b(?:the\s+)?(?:person|subject)'s exact facial structure\b/gi, "the person's facial structure as much as possible")
    .replace(/\bmaintain(?: the)? exact facial identity\b/gi, 'Preserve facial identity as much as possible')
    .replace(/\bEnsure no identity drift or wardrobe changes occur\b/gi, 'Reduce identity drift and wardrobe changes')
    .replace(/\bEnsure no identity drift or warping occurs\b/gi, 'Reduce identity drift and warping')
    .replace(/\bEnsure no identity drift(?: occurs)?\b/gi, 'Reduce identity drift')
    .replace(/\bmatch mouth movements precisely\b/gi, 'sync mouth movement as closely as possible using a compatible lip-sync workflow')
    .replace(/\bmust precisely match\b/gi, 'should sync as closely as possible with')
    .replace(/\bprecisely match\b/gi, 'sync as closely as possible with')
    .replace(/\bperfect lip-sync\b/gi, 'simple and readable lip-sync')
    .replace(/\bexact lip-sync\b/gi, 'simple and readable lip-sync')
    .replace(/\brealistic lip-sync\b/gi, 'simple, readable lip-sync')
    .replace(/\brealistic lip-syncing\b/gi, 'simple, readable lip-syncing')
    .replace(/\blip-sync accuracy\b/gi, 'lip-sync readability')
    .replace(/\bexactly synchronized\b/gi, 'closely synchronized')
    .replace(/\bThe lip-sync should be [^.\n]*\bmatching the provided (audio|dialogue)\b/gi, 'Keep lip-sync simple and readable, following the provided $1 as closely as possible')
    .replace(/\bLip-sync enabled to match the provided dialogue\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with the provided dialogue and keep lip-sync simple and readable')
    .replace(/\bLip-sync enabled for the provided audio track\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with the provided audio track and keep lip-sync simple and readable')
    .replace(/\bLip-syncing enabled for the provided audio track\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with the provided audio track and keep lip-sync simple and readable')
    .replace(/\bLip-sync enabled;?\s*the subject should speak the provided content with natural cadence and mouth movement\.?/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with the provided content and keep lip-sync simple and readable.')
    .replace(/\b(?:the\s+(?:character|person)'s\s+|their\s+)?mouth movements should match the provided (audio track|audio|dialogue)\b/gi, 'sync mouth movement as closely as possible with the provided $1 and keep lip-sync simple and readable')
    .replace(/\blip-sync(?:ing)?\s+to\s+match\s+the\s+provided\s+(audio|dialogue)\b/gi, 'simple, readable lip-syncing that follows the provided $1 as closely as possible')
    .replace(/\bLip-sync\s+to\s+the\s+provided\s+(audio|dialogue)\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with the provided $1 and keep lip-sync simple and readable')
    .replace(/\blip-sync enabled to match\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with')
    .replace(/\blip-sync enabled for\b/gi, 'Use a compatible lip-sync workflow; sync mouth movement as closely as possible with')
    .replace(/\blip-sync enabled\b/gi, 'Use a compatible lip-sync workflow')
    .replace(/\blip-syncing enabled\b/gi, 'Use a compatible lip-sync workflow')
    .replace(/\bperfectly centered\b/gi, 'cleanly centered')
    .replace(/\bperfectly\b/gi, 'cleanly')
    .replace(/\bprecisely\b/gi, 'as closely as possible');
}

function sanitizeGeneratedLabelTypography(text: string): string {
  return text
    .replace(
      /\b(?:elegant|minimalist|premium|branded)?\s*label\s+with\s+[^,\n.;]*(?:typography|text|lettering)\b/gi,
      'clean label area, no readable text required; add final typography as an overlay if needed'
    )
    .replace(/\blabel readability\b/gi, 'clean label area')
    .replace(/\breadable labels?\s+area\b/gi, 'clean label area')
    .replace(/\blegible labels?\s+area\b/gi, 'clean label area')
    .replace(/\b(?:elegant|minimalist|premium|branded)\s+label\b/gi, 'clean label area, no readable text required; add final typography as an overlay if needed')
    .replace(/\breadable labels?\b/gi, 'clean label area')
    .replace(/\blegible labels?\b/gi, 'clean label area')
    .replace(/\breadable typography\b/gi, 'final typography overlay')
    .replace(/\bclean label area\s+area\b/gi, 'clean label area');
}

function hasCustomerProvidedSpokenLine(context: AiStrategistPromptGenerationContext): boolean {
  const sourceText = [context.userBrief, context.currentPrompt].filter(Boolean).join('\n');
  return /['"“][^'"”]{3,}['"”]/.test(sourceText) || /\b(?:voiceover|dialogue|spoken line|says?|narration)\s*:\s*\S+/i.test(sourceText);
}

function applyBriefHardContextOverrides(
  output: AiStrategistNormalizedBrief,
  input: AiStrategistBriefNormalizationInput
): AiStrategistNormalizedBrief {
  const uploadedAsset = input.uploadedAsset;
  const next: AiStrategistNormalizedBrief = {
    ...output,
    ...(input.selectedWorkflow ? { workflowHint: input.selectedWorkflow } : {}),
  };

  if (uploadedAsset?.isReferenceImage === true) {
    next.hasUploadedReference = true;
  }
  if (uploadedAsset?.hasPerson === true) {
    next.hasPerson = true;
  }
  if (uploadedAsset?.hasProduct === true) {
    next.hasProduct = true;
  }
  if (uploadedAsset?.hasLogo === true || uploadedAsset?.hasText === true) {
    next.hasLogoOrTextRisk = true;
  }

  if (uploadedAsset?.hasPerson === true && uploadedAsset.isReferenceImage === true) {
    next.intent = 'person_reference_i2v';
    next.hasPerson = true;
    next.hasUploadedReference = true;
    next.workflowHint = input.selectedWorkflow ?? 'image-to-video';
    return next;
  }

  if (uploadedAsset?.hasProduct === true && uploadedAsset.isReferenceImage === true) {
    next.intent = 'product_reference_i2v';
    next.hasProduct = true;
    next.hasUploadedReference = true;
    next.workflowHint = input.selectedWorkflow ?? 'image-to-video';
    return next;
  }

  if (shouldPreferProductImprovementStartingImage(input, next)) {
    next.workflowHint = 'text-to-image-then-image-to-video';
  }

  if (shouldPreferCommercialObjectStartingImage(input, next)) {
    next.workflowHint = 'text-to-image-then-image-to-video';
  }

  return next;
}

function shouldPreferCommercialObjectStartingImage(
  input: AiStrategistBriefNormalizationInput,
  output: AiStrategistNormalizedBrief
): boolean {
  if (input.selectedWorkflow || input.uploadedAsset?.isReferenceImage) return false;
  if (output.intent !== 'product_ad' && output.intent !== 'product_reference_i2v') return false;
  if (output.intent === 'social_ad' || output.intent === 'draft_storyboard') return false;

  const text = [input.rawUserMessage, input.currentPrompt, output.normalizedBrief, ...output.styleHints]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (containsAny(text, explicitTextToVideoTerms)) return false;
  if (containsAny(text, ['tiktok', 'reels', 'social-first', 'social first', 'quick test', 'draft', 'storyboard'])) return false;
  if (!containsAny(text, productObjectTerms) && !output.hasProduct) return false;
  return containsAny(text, [
    'premium',
    'luxury',
    'hero',
    'packshot',
    'black marble',
    'marble',
    'reflections',
    'reflection',
    'controlled',
    'silhouette',
    'glass',
    'perfume',
    'bottle',
    'jewelry',
    'watch',
    'skincare',
    'packaging',
  ]);
}

function shouldPreferProductImprovementStartingImage(
  input: AiStrategistBriefNormalizationInput,
  output: AiStrategistNormalizedBrief
): boolean {
  if (input.selectedWorkflow || input.uploadedAsset?.isReferenceImage) return false;
  if (input.mode !== 'improve_prompt' || !input.currentPrompt) return false;

  const text = [input.rawUserMessage, input.currentPrompt, output.normalizedBrief, ...output.styleHints]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (containsAny(text, explicitTextToVideoTerms)) return false;
  if (!containsAny(text, productObjectTerms) && !output.hasProduct) return false;
  if (!containsAny(text, premiumProductRefinementTerms) && output.qualityIntent !== 'premium') return false;
  if (output.intent === 'social_ad' || output.intent === 'draft_storyboard') return false;

  return true;
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function inferSourceImageKind(context: AiStrategistPromptGenerationContext): AiStrategistSourceImageKind {
  if (context.uploadedAsset?.hasPerson) return 'uploaded-person';
  if (context.uploadedAsset?.hasProduct) return 'product';
  return 'generic';
}

function classifyAdapterError(error: unknown): string {
  const message = errorMessage(error);
  if (/GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is invalid/i.test(message)) return 'invalid_local_llm_config';
  if (/token request failed|OAuth|unauthorized|permission/i.test(message)) return 'vertex_auth_error';
  if (/valid JSON|not include text|response/i.test(message)) return 'vertex_invalid_response';
  return 'vertex_error';
}

function defaultGoogleVertexApiBaseUrl(location: string): string {
  return location === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`;
}

function cleanEnv(value: string | undefined): string {
  return (value ?? '').trim();
}

function okValidation(): AiStrategistLLMValidationResult {
  return {
    ok: true,
    issues: [],
    dedupedWarnings: [],
  };
}

function withIssue(
  validation: AiStrategistLLMValidationResult,
  issue: AiStrategistLLMValidationIssue
): AiStrategistLLMValidationResult {
  return {
    ok: false,
    issues: [...validation.issues, issue],
    dedupedWarnings: validation.dedupedWarnings,
  };
}

function errorIssue(code: string, message: string): AiStrategistLLMValidationIssue {
  return { code, message, severity: 'error' };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
