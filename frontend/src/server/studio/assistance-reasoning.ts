import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';

/** The pinned SDK predates xhigh; the Responses API supports this exact wire value.
 * https://developers.openai.com/api/docs/models/gpt-6.1-sol (verified 2026-10-29).
 * Keep the compatibility cast at this transport boundary; never silently lower effort.
 */
export function studioReasoning(effort:'low'|'medium'|'high'|'xhigh'):NonNullable<ResponseCreateParamsNonStreaming['reasoning']> {
  return {effort} as NonNullable<ResponseCreateParamsNonStreaming['reasoning']>;
}
