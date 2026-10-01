/**
 * Pure QA-only cost estimate for Responses API usage from gpt-6.1-sol.
 * Public rates verified 2026-10-01: https://developers.openai.com/api/docs/pricing
 * This does not read billing state and must never be used to charge an account.
 */
export type SolCostEstimate = Readonly<{
  minUsd: number;
  maxUsd: number;
  assumptions: readonly string[];
}>;

type TokenRates = Readonly<{
  ordinaryInput: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
}>;

const MILLION = 1_000_000;
const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;
const MISSING_CACHE_WRITE_ASSUMPTION =
  "cache_write_tokens absent: min assumes zero cache writes; max assumes all non-cached input tokens were cache writes.";

const SERVICE_TIER_MULTIPLIERS: Readonly<Record<string, number>> = {
  default: 1,
  standard: 1,
  fast: 2,
  priority: 2,
  flex: 0.5,
  batch: 0.5,
};

const STANDARD_RATES: TokenRates = {
  ordinaryInput: 2,
  cachedInput: 0.1,
  cacheWriteInput: 2.5,
  output: 10,
};

const LONG_CONTEXT_RATES: TokenRates = {
  ordinaryInput: 4,
  cachedInput: 0.2,
  cacheWriteInput: 5,
  output: 15,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTokenCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/** Estimates API cost for QA reporting only. Returns null when usage is unusable. */
export function estimateSolCost(
  usage: unknown,
  serviceTier: unknown,
  model: unknown,
): SolCostEstimate | null {
  if (model !== "gpt-6.1-sol" || typeof serviceTier !== "string") return null;
  if (!Object.hasOwn(SERVICE_TIER_MULTIPLIERS, serviceTier)) return null;
  const tierMultiplier = SERVICE_TIER_MULTIPLIERS[serviceTier];
  if (!isRecord(usage)) return null;

  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const inputDetails = usage.input_tokens_details;
  if (
    !isTokenCount(inputTokens) ||
    !isTokenCount(outputTokens) ||
    !isRecord(inputDetails) ||
    !isTokenCount(inputDetails.cached_tokens)
  ) {
    return null;
  }

  const cachedTokens = inputDetails.cached_tokens;
  if (cachedTokens > inputTokens) return null;

  if (
    isRecord(usage.output_tokens_details) &&
    usage.output_tokens_details.reasoning_tokens !== undefined &&
    (!isTokenCount(usage.output_tokens_details.reasoning_tokens) ||
      usage.output_tokens_details.reasoning_tokens > outputTokens)
  ) {
    return null;
  }

  const hasCacheWriteTokens = Object.hasOwn(inputDetails, "cache_write_tokens");
  const cacheWriteTokens = inputDetails.cache_write_tokens;
  if (hasCacheWriteTokens && !isTokenCount(cacheWriteTokens)) return null;

  const unclassifiedInputTokens = inputTokens - cachedTokens;
  if (
    hasCacheWriteTokens &&
    (cacheWriteTokens as number) > unclassifiedInputTokens
  ) {
    return null;
  }

  const rates =
    inputTokens > LONG_CONTEXT_INPUT_THRESHOLD
      ? LONG_CONTEXT_RATES
      : STANDARD_RATES;
  const sharedCost =
    (cachedTokens * rates.cachedInput + outputTokens * rates.output) /
    MILLION;

  if (hasCacheWriteTokens) {
    const writes = cacheWriteTokens as number;
    const ordinary = unclassifiedInputTokens - writes;
    const inputCost =
      (ordinary * rates.ordinaryInput + writes * rates.cacheWriteInput) /
      MILLION;
    const total = (sharedCost + inputCost) * tierMultiplier;
    return { minUsd: total, maxUsd: total, assumptions: [] };
  }

  const minimum =
    (sharedCost +
      (unclassifiedInputTokens * rates.ordinaryInput) / MILLION) *
    tierMultiplier;
  const maximum =
    (sharedCost +
      (unclassifiedInputTokens * rates.cacheWriteInput) / MILLION) *
    tierMultiplier;
  return {
    minUsd: minimum,
    maxUsd: maximum,
    assumptions: [MISSING_CACHE_WRITE_ASSUMPTION],
  };
}
