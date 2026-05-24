import type { AiStrategistLLMRequest } from './llm-contracts';

export type AiStrategistLlmCostStage = 'brief_refinement' | 'prompt_writer' | 'advisor_quality_judge';

export type AiStrategistLlmProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  thoughtsTokens?: number;
};

export type AiStrategistLlmUsageEstimate = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  thoughtsTokens?: number;
  source: 'provider' | 'estimated' | 'none';
};

export type AiStrategistLlmPricingEstimate = {
  currency: 'USD';
  inputUsdPerMillionTokens: number | null;
  outputUsdPerMillionTokens: number | null;
  source: 'env' | 'default_table' | 'not_configured';
  sourceLabel: string;
};

export type AiStrategistLlmCallCostEstimate = {
  stage: AiStrategistLlmCostStage;
  liveCall: boolean;
  acceptedOutput: boolean;
  provider?: string;
  model?: string;
  fallbackReason?: string;
  usage: AiStrategistLlmUsageEstimate;
  pricing: AiStrategistLlmPricingEstimate;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  estimatedCostUsd: number | null;
  formattedCost: string;
  warnings: string[];
};

export type AiStrategistConversationCostEstimate = {
  calls: AiStrategistLlmCallCostEstimate[];
  liveCallCount: number;
  acceptedCallCount: number;
  fallbackCallCount: number;
  totalEstimatedCostUsd: number | null;
  formattedTotal: string;
  hasProviderUsage: boolean;
  hasUnpricedUsage: boolean;
  warnings: string[];
};

export type AiStrategistLlmCostEnv = {
  AI_STRATEGIST_LLM_INPUT_USD_PER_1M?: string;
  AI_STRATEGIST_LLM_OUTPUT_USD_PER_1M?: string;
};

type BuildLlmCallCostEstimateInput = {
  stage: AiStrategistLlmCostStage;
  request?: AiStrategistLLMRequest<Record<string, unknown>>;
  output?: unknown;
  providerUsage?: AiStrategistLlmProviderUsage | null;
  provider?: string;
  model?: string;
  liveCall: boolean;
  acceptedOutput: boolean;
  fallbackReason?: string;
  env?: AiStrategistLlmCostEnv;
};

// Defaults only cover strategist-local Gemini text models. Override with env vars
// when provider pricing changes or when testing a different model.
const DEFAULT_MODEL_PRICES: readonly {
  pattern: RegExp;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  sourceLabel: string;
}[] = [
  {
    pattern: /^gemini-3\.1-flash-lite(?:-|$)/i,
    inputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.5,
    sourceLabel: 'default Gemini 3.1 Flash-Lite public price',
  },
  {
    pattern: /^gemini-3-flash(?:-|$)/i,
    inputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 3,
    sourceLabel: 'default Gemini 3 Flash public price',
  },
];

export function buildLlmCallCostEstimate(input: BuildLlmCallCostEstimateInput): AiStrategistLlmCallCostEstimate {
  const usage = input.liveCall
    ? buildUsageEstimate(input.request, input.output, input.providerUsage)
    : { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: 'none' as const };
  const pricing = resolveLlmPricing(input.model, input.env);
  const inputCostUsd = usage.source !== 'none' && pricing.inputUsdPerMillionTokens !== null
    ? (usage.inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens
    : null;
  const outputCostUsd = usage.source !== 'none' && pricing.outputUsdPerMillionTokens !== null
    ? (usage.outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens
    : null;
  const estimatedCostUsd = inputCostUsd !== null && outputCostUsd !== null ? inputCostUsd + outputCostUsd : null;
  const warnings = buildCostWarnings({ usage, pricing, liveCall: input.liveCall, model: input.model });

  return {
    stage: input.stage,
    liveCall: input.liveCall,
    acceptedOutput: input.acceptedOutput,
    provider: input.provider,
    model: input.model,
    fallbackReason: input.fallbackReason,
    usage,
    pricing,
    inputCostUsd,
    outputCostUsd,
    estimatedCostUsd,
    formattedCost: formatUsdEstimate(estimatedCostUsd),
    warnings,
  };
}

export function buildSkippedLlmCallCostEstimate(
  stage: AiStrategistLlmCostStage,
  fallbackReason: string
): AiStrategistLlmCallCostEstimate {
  return buildLlmCallCostEstimate({
    stage,
    liveCall: false,
    acceptedOutput: false,
    fallbackReason,
  });
}

export function buildConversationCostEstimate(
  calls: readonly AiStrategistLlmCallCostEstimate[]
): AiStrategistConversationCostEstimate {
  const liveCalls = calls.filter((call) => call.liveCall);
  const pricedCalls = liveCalls.filter((call) => call.estimatedCostUsd !== null);
  const allLiveCallsPriced = liveCalls.length === pricedCalls.length;
  const totalEstimatedCostUsd = allLiveCallsPriced
    ? pricedCalls.reduce((total, call) => total + (call.estimatedCostUsd ?? 0), 0)
    : null;
  const warnings = uniqueStrings(calls.flatMap((call) => call.warnings));

  return {
    calls: [...calls],
    liveCallCount: liveCalls.length,
    acceptedCallCount: calls.filter((call) => call.acceptedOutput).length,
    fallbackCallCount: calls.filter((call) => call.fallbackReason).length,
    totalEstimatedCostUsd,
    formattedTotal: formatUsdEstimate(totalEstimatedCostUsd),
    hasProviderUsage: calls.some((call) => call.usage.source === 'provider'),
    hasUnpricedUsage: liveCalls.some((call) => call.estimatedCostUsd === null),
    warnings,
  };
}

export function extractGeminiUsageMetadata(raw: unknown): AiStrategistLlmProviderUsage | null {
  if (!isRecord(raw) || !isRecord(raw.usageMetadata)) return null;
  const usage = raw.usageMetadata;
  const inputTokens = numberOrUndefined(usage.promptTokenCount ?? usage.inputTokenCount);
  const outputTokens = numberOrUndefined(usage.candidatesTokenCount ?? usage.outputTokenCount);
  const thoughtsTokens = numberOrUndefined(usage.thoughtsTokenCount);
  const totalTokens = numberOrUndefined(usage.totalTokenCount) ?? sumKnown(inputTokens, outputTokens, thoughtsTokens);
  const cachedInputTokens = numberOrUndefined(usage.cachedContentTokenCount);

  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return {
    inputTokens,
    outputTokens: outputTokens !== undefined ? outputTokens + (thoughtsTokens ?? 0) : thoughtsTokens,
    totalTokens,
    cachedInputTokens,
    thoughtsTokens,
  };
}

function buildUsageEstimate(
  request: AiStrategistLLMRequest<Record<string, unknown>> | undefined,
  output: unknown,
  providerUsage: AiStrategistLlmProviderUsage | null | undefined
): AiStrategistLlmUsageEstimate {
  if (providerUsage) {
    const inputTokens = Math.max(0, Math.round(providerUsage.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.round(providerUsage.outputTokens ?? 0));
    return {
      inputTokens,
      outputTokens,
      totalTokens: Math.max(0, Math.round(providerUsage.totalTokens ?? inputTokens + outputTokens)),
      cachedInputTokens: providerUsage.cachedInputTokens,
      thoughtsTokens: providerUsage.thoughtsTokens,
      source: 'provider',
    };
  }

  return {
    inputTokens: estimateTokens(request),
    outputTokens: estimateTokens(output),
    totalTokens: estimateTokens(request) + estimateTokens(output),
    source: 'estimated',
  };
}

function resolveLlmPricing(model: string | undefined, envInput?: AiStrategistLlmCostEnv): AiStrategistLlmPricingEstimate {
  const env = envInput ?? process.env;
  const envInputRate = numberFromEnv(env.AI_STRATEGIST_LLM_INPUT_USD_PER_1M);
  const envOutputRate = numberFromEnv(env.AI_STRATEGIST_LLM_OUTPUT_USD_PER_1M);
  if (envInputRate !== null && envOutputRate !== null) {
    return {
      currency: 'USD',
      inputUsdPerMillionTokens: envInputRate,
      outputUsdPerMillionTokens: envOutputRate,
      source: 'env',
      sourceLabel: 'AI_STRATEGIST_LLM_*_USD_PER_1M',
    };
  }

  const defaultPrice = model ? DEFAULT_MODEL_PRICES.find((entry) => entry.pattern.test(model)) : undefined;
  if (defaultPrice) {
    return {
      currency: 'USD',
      inputUsdPerMillionTokens: defaultPrice.inputUsdPerMillionTokens,
      outputUsdPerMillionTokens: defaultPrice.outputUsdPerMillionTokens,
      source: 'default_table',
      sourceLabel: defaultPrice.sourceLabel,
    };
  }

  return {
    currency: 'USD',
    inputUsdPerMillionTokens: null,
    outputUsdPerMillionTokens: null,
    source: 'not_configured',
    sourceLabel: 'No LLM price configured for this model.',
  };
}

function buildCostWarnings(input: {
  usage: AiStrategistLlmUsageEstimate;
  pricing: AiStrategistLlmPricingEstimate;
  liveCall: boolean;
  model?: string;
}): string[] {
  const warnings: string[] = [];
  if (!input.liveCall) return warnings;
  if (input.usage.source === 'estimated') {
    warnings.push('Token usage is estimated locally because provider usage metadata was not available.');
  }
  if (input.pricing.source === 'not_configured') {
    warnings.push(`No LLM price is configured for ${input.model ?? 'this model'}; token usage is tracked but cost is not estimated.`);
  }
  return warnings;
}

function estimateTokens(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

export function formatUsdEstimate(value: number | null): string {
  if (value === null) return 'not estimated';
  if (value === 0) return '$0.00';
  if (value < 0.0001) return '<$0.0001';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function numberFromEnv(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sumKnown(...values: Array<number | undefined>): number | undefined {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length ? known.reduce((total, value) => total + value, 0) : undefined;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
