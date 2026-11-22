import type OpenAI from 'openai';
import {addOutputText} from 'openai/lib/ResponsesParser';
import type {Response, ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';

/** Consume the supplier stream on the server. Only its terminal snapshot can reach a checkpoint. */
export async function receiveStudioResponse(
  client: OpenAI, params: ResponseCreateParamsNonStreaming, stream: boolean, timeout: number,
): Promise<Response> {
  if (!stream) return client.responses.create(params);
  const events = await client.responses.create({...params, stream:true}, {signal:AbortSignal.timeout(timeout)});
  for await (const event of events) {
    if (event.type === 'response.completed' || event.type === 'response.incomplete' || event.type === 'response.failed') {
      addOutputText(event.response);
      return event.response;
    }
  }
  throw new Error('Studio lost the model stream before its final usage and response were available.');
}
