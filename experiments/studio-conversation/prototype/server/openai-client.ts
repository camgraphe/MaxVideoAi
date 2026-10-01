import OpenAI from "openai";
import type { FunctionTool } from "openai/resources/responses/responses";
import type { ModelClient, ModelRequest, ModelReply } from "./ai-director";
import { actionTools } from "./studio-actions";
import { StudioError } from "../shared/timeline";

export class OpenAIResponses implements ModelClient {
  private client: OpenAI;
  constructor(
    private key?: string,
    fetcher?: typeof fetch,
  ) {
    this.client = new OpenAI({
      apiKey: key || "unconfigured",
      timeout: 60000,
      maxRetries: 0,
      ...(fetcher ? { fetch: fetcher } : {}),
    });
  }
  async create(request: ModelRequest): Promise<ModelReply> {
    if (!this.key)
      throw new StudioError(
        "La clé OpenAI doit être configurée côté serveur pour connecter Studio.",
        503,
      );
    try {
      const reply = await this.client.responses.create({
        model: "gpt-6.1-sol",
        store: false,
        stream: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 6000,
        parallel_tool_calls: false,
        tools: actionTools.map(({ name, description, parameters }) => ({
          type: "function",
          name,
          description,
          parameters,
          strict: true,
        })) as FunctionTool[],
        ...request,
      });
      return {
        id: reply.id,
        status: reply.status ?? "failed",
        output: reply.output,
        ...(reply.usage
          ? {
              usage: {
                inputTokens: reply.usage.input_tokens,
                cachedInputTokens:
                  reply.usage.input_tokens_details?.cached_tokens ?? 0,
                outputTokens: reply.usage.output_tokens,
                reasoningTokens:
                  reply.usage.output_tokens_details?.reasoning_tokens ?? 0,
                totalTokens: reply.usage.total_tokens,
              },
            }
          : {}),
      };
    } catch (e) {
      // Never return provider messages: an authentication error may quote its key.
      if (e instanceof OpenAI.APIError) {
        if (e.status === 401)
          throw new StudioError(
            "La clé OpenAI configurée côté serveur est refusée.",
            503,
          );
        if (e.status === 403 || e.status === 404)
          throw new StudioError(
            "GPT‑6.1 Sol n’est pas accessible à ce compte API.",
            503,
          );
        if (e.status === 429)
          throw new StudioError(
            "La limite OpenAI est atteinte. Reprenez cet échange plus tard.",
            503,
          );
      }
      throw new StudioError(
        "L’API OpenAI n’a pas terminé cet échange. Vous pouvez le reprendre sans répéter les actions enregistrées.",
        502,
      );
    }
  }
}
