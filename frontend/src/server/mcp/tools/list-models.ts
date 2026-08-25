import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const generationMode = z.enum(CANONICAL_GENERATION_MODES);
export const listModelsInputSchema = z.object({
  id: z.string().trim().min(1).optional().describe('Optional exact public MaxVideoAI model ID.'),
  surface: z.enum(['video', 'image']).optional(),
  mode: generationMode.optional(),
  aspectRatio: z.string().trim().min(1).optional(),
  resolution: z.string().trim().min(1).optional(),
  maxDurationSec: z.number().positive().max(300).optional(),
  audio: z.boolean().optional(),
  referenceImages: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional().describe(
    'Maximum number of matching models to return after all capability filters are applied.',
  ),
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
        'Use this when the user needs current public MaxVideoAI image or video model capabilities, including audio and reference-image support. Do not use it for generation, exact pricing, private models, or provider guarantees.',
      inputSchema: listModelsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (filter) => runAgentTool(async () => ({ models: await services.listModels(filter, principal) }))
  );
}
