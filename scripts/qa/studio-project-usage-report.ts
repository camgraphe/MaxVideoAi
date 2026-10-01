import { estimateSolCost } from "./studio-sol-cost";

type Attempt = { response: { responseId: string; model: string; serviceTier: unknown; usage: unknown } | null };
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** QA evidence only. Unknown attempts prevent an estimated project total. */
export function summarizeProjectUsage(attempts: Attempt[]) {
  const seen = new Set<string>();
  let uniqueResponses = 0, duplicateResponses = 0, unknownAttempts = 0, unpricedResponses = 0;
  let knownTokens = 0, reasoningTokensIncludedInOutput = 0, minimum = 0, maximum = 0, priced = 0;
  for (const attempt of attempts) {
    const response = attempt.response;
    if (!response?.responseId) { unknownAttempts++; continue; }
    if (seen.has(response.responseId)) { duplicateResponses++; continue; }
    seen.add(response.responseId);
    uniqueResponses++;
    const usage = response.usage as { input_tokens?: unknown; output_tokens?: unknown; output_tokens_details?: { reasoning_tokens?: unknown } } | null;
    if (count(usage?.input_tokens) && count(usage?.output_tokens)) knownTokens += usage.input_tokens + usage.output_tokens;
    const reasoning = usage?.output_tokens_details?.reasoning_tokens;
    if (count(reasoning)) reasoningTokensIncludedInOutput += reasoning;
    const cost = estimateSolCost(response.usage, response.serviceTier, response.model);
    if (!cost) { unpricedResponses++; continue; }
    minimum += cost.minUsd; maximum += cost.maxUsd; priced++;
  }
  const estimatedKnownUsd = priced ? { min: minimum, max: maximum } : null;
  return { attempts: attempts.length, uniqueResponses, duplicateResponses, unknownAttempts, unpricedResponses,
    knownTokens, reasoningTokensIncludedInOutput, estimatedKnownUsd,
    estimatedTotalUsd: unknownAttempts || unpricedResponses ? null : estimatedKnownUsd };
}
