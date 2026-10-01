import { randomUUID } from "node:crypto";
import type { ImageDraft } from "../../frontend/src/lib/studio/image-conversation-contract";
import type { ImageDirector, ImageDirectorTelemetry } from "../../frontend/src/server/studio/image-conversation-director";
import type { ResolvedReference } from "../../frontend/src/server/agent-api/reference-types";
import type { EnglishScenario } from "../../tests/fixtures/studio-image-english-scenarios";
import { estimateSolCost, type SolCostEstimate } from "./studio-sol-cost";

export type EnglishResult = {
  id: string;
  message: string;
  expectedRatio: EnglishScenario["expectedRatio"];
  historySource: "fixture" | "actual_previous_replies";
  historyTurnsSent: number;
  reference: boolean;
  draft: ImageDraft | null;
  actionPassed: boolean;
  telemetry: ImageDirectorTelemetry | null;
  cost: SolCostEstimate | null;
  errorCode: string | null;
};

/** Calls only the director. No generation service, quote, wallet, or provider. */
export async function evaluateEnglishScenarios(options: {
  scenarios: EnglishScenario[];
  createDirector: (onResponse: (event: ImageDirectorTelemetry) => void) => ImageDirector;
  reference: ResolvedReference;
  consecutive?: boolean;
  onResult?: (result: EnglishResult) => void | Promise<void>;
  shouldStop?: () => boolean;
}): Promise<EnglishResult[]> {
  const history: EnglishScenario["history"] = [];
  const results: EnglishResult[] = [];
  for (const scenario of options.scenarios) {
    if (options.shouldStop?.()) break;
    let telemetry: ImageDirectorTelemetry | null = null;
    const director = options.createDirector((event) => { telemetry = event; });
    const prior = options.consecutive ? [...history] : scenario.history;
    const result: EnglishResult = {
      id: scenario.id, message: scenario.message, expectedRatio: scenario.expectedRatio,
      historySource: options.consecutive ? "actual_previous_replies" : "fixture",
      historyTurnsSent: Math.min(8, prior.length), reference: scenario.reference,
      draft: null, actionPassed: false, telemetry: null, cost: null, errorCode: null,
    };
    try {
      result.draft = await director({
        requestId: randomUUID(), message: scenario.message,
        references: scenario.reference ? [options.reference.assetId] : [],
      }, prior, scenario.reference ? [options.reference] : []);
      result.actionPassed = (result.draft.image?.aspectRatio ?? null) === scenario.expectedRatio;
      if (options.consecutive) history.push({ message: scenario.message, reply: result.draft.reply });
    } catch (error) {
      // Avoid serializing raw provider errors, request bodies, or credentials.
      result.errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code : "DIRECTOR_ERROR";
    }
    result.telemetry = telemetry;
    if (result.telemetry) result.cost = estimateSolCost(result.telemetry.usage, result.telemetry.serviceTier, result.telemetry.model);
    results.push(result);
    await options.onResult?.(result);
    // A broken chain must not silently pretend later replies have full history.
    if (options.consecutive && result.errorCode) break;
  }
  return results;
}

export function summarizeEnglishResults(results: EnglishResult[]) {
  let input = 0, output = 0, cached = 0, reasoning = 0, minUsd = 0, maxUsd = 0;
  let missingUsage = 0, missingCost = 0, cacheWrites = 0, missingCacheWrites = 0;
  for (const result of results) {
    const usage = result.telemetry?.usage;
    if (usage) {
      input += usage.input_tokens;
      output += usage.output_tokens;
      cached += usage.input_tokens_details.cached_tokens;
      const details = usage.input_tokens_details as { cached_tokens: number; cache_write_tokens?: number };
      if (Number.isSafeInteger(details.cache_write_tokens) && details.cache_write_tokens! >= 0) {
        cacheWrites += details.cache_write_tokens!;
      } else missingCacheWrites++;
      reasoning += usage.output_tokens_details.reasoning_tokens;
    } else missingUsage++;
    if (result.cost) {
      minUsd += result.cost.minUsd;
      maxUsd += result.cost.maxUsd;
    } else missingCost++;
  }
  return {
    calls: results.length, passedActionChecks: results.filter((result) => result.actionPassed).length,
    errors: results.filter((result) => result.errorCode).map((result) => result.id),
    inputTokens: input, outputTokens: output, totalTokens: input + output,
    cachedTokens: cached, reasoningTokensIncludedInOutput: reasoning,
    cacheWriteTokens: cacheWrites, responsesMissingCacheWriteTokens: missingCacheWrites,
    missingUsage, missingCost,
    estimatedUsd: missingCost ? null : { min: minUsd, max: maxUsd },
  };
}
