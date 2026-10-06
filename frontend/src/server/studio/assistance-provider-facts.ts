import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';
export const STUDIO_PROVIDER_RATE_VERSION = 'openai-standard-global-2026-10-03';
// Factual USD nanounits/token; verified official model pages 2026-10-03. No retail margin here.
const rates = {
  'gpt-6.1-sol': {input: 2000,read: 100,write: 2500,output: 10000},
  'gpt-6-luna': {input: 100,read: 10,write: 125,output: 500},
};
const record = (v: unknown): v is Record<string,unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export function readStudioUsage(usage: unknown, model: unknown, serviceTier: unknown) {
  if (!(model === 'gpt-6.1-sol' || model === 'gpt-6-luna') || !(serviceTier === 'default' || serviceTier === 'standard') || !record(usage)) return null;
  const input = usage.input_tokens, output = usage.output_tokens, detail = usage.input_tokens_details;
  if (!count(input) || input > 272000 || !count(output) || !record(detail) || !count(detail.cached_tokens) || detail.cached_tokens > input) return null;
  const cached = detail.cached_tokens;
  const writes = Object.hasOwn(detail,'cache_write_tokens') ? detail.cache_write_tokens : null;
  if (writes !== null && (!count(writes) || writes + cached > input)) return null;
  const reasoning = record(usage.output_tokens_details) && Object.hasOwn(usage.output_tokens_details,'reasoning_tokens') ? usage.output_tokens_details.reasoning_tokens : null;
  if (reasoning !== null && (!count(reasoning) || reasoning > output)) return null;
  const rate = rates[model];
  const common = cached * rate.read + output * rate.output;
  const noncached = input - cached;
  const providerMinNanoUsd = common + (writes === null ? noncached * rate.input : (noncached - writes) * rate.input + writes * rate.write);
  const providerMaxNanoUsd = writes === null ? common + noncached * rate.write : providerMinNanoUsd;
  return {inputTokens: input,cachedTokens: cached,cacheWriteTokens: writes as number|null,outputTokens: output,reasoningTokens: reasoning as number|null,
    providerMinNanoUsd,providerMaxNanoUsd,tariffBasisNanoUsd: common + noncached * rate.write};
}
export function studioProviderReservation(model: StudioAssistantModel, inputTokens: number, outputTokens: number,approvedOutputBound=2200) {
  if (!count(inputTokens) || inputTokens > 272000 || !count(outputTokens) || !count(approvedOutputBound)||approvedOutputBound>6000||outputTokens>approvedOutputBound) throw new Error('Invalid Studio token bounds');
  return inputTokens * rates[model].write + outputTokens * rates[model].output;
}
