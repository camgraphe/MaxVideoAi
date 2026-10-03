import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import type {InputTokenCountParams} from 'openai/resources/responses/input-tokens';

/** Preserve the complete token-bearing payload; response-only arguments are not count-endpoint parameters. */
export function studioTokenCountInput(params:ResponseCreateParamsNonStreaming):InputTokenCountParams {
  return {
    model: params.model, input: params.input, instructions: params.instructions,
    conversation: params.conversation, previous_response_id: params.previous_response_id,
    tools: params.tools, tool_choice: params.tool_choice, parallel_tool_calls: params.parallel_tool_calls,
    reasoning: params.reasoning, text: params.text, truncation: params.truncation ?? undefined,
  };
}
