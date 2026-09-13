import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { omitNullishToolInput } from '@/server/mcp/optional-tool-input';
import { runAgentTool } from '@/server/mcp/tool-result';

const generationMode = z.enum(CANONICAL_GENERATION_MODES);
export const listModelsInputSchema = z.object({
  id: z.string().trim().min(1).nullable().default(null)
    .describe('Exact public MaxVideoAI model ID, or null unless the user named one.'),
  surface: z.enum(['video', 'image']).nullable().default(null)
    .describe('Requested media surface, or null unless the user constrained it.'),
  mode: generationMode.nullable().default(null)
    .describe('Requested generation mode, or null unless the user constrained it.'),
  aspectRatio: z.string().trim().min(1).nullable().default(null)
    .describe('Requested aspect ratio, or null unless the user constrained it.'),
  resolution: z.string().trim().min(1).nullable().default(null)
    .describe('Requested resolution, or null unless the user constrained it.'),
  maxDurationSec: z.number().positive().max(300).nullable().default(null)
    .describe('Maximum duration requested by the user, or null. Never use 300 as a placeholder.'),
  audio: z.boolean().nullable().default(null)
    .describe('Whether the user explicitly requires or excludes audio, or null when unstated.'),
  referenceImages: z.boolean().nullable().default(null)
    .describe('Whether the user explicitly requires or excludes reference images, or null when unstated.'),
  limit: z.number().int().min(1).max(50).nullable().default(null)
    .describe('Maximum number of matching models requested by the user, or null for the service default.'),
}).strict();

export function registerListModelsTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices
): void {
  server.registerTool(
    'list_models',
    {
      title: 'List MaxVideoAI models',
      description:
        'Use this when the user needs current public MaxVideoAI image or video model capabilities, including audio and reference-image support. Every filtering field is nullable: send null when the user did not state that constraint, never a placeholder. Do not use it for generation, exact pricing, private models, or provider guarantees.',
      inputSchema: listModelsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (filter) => runAgentTool(async () => ({
      models: await services.listModels(omitNullishToolInput(filter), principal),
    }))
  );
}
