import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const generationMode = z.enum(['t2v', 'i2v', 'ref2v', 't2i', 'i2i']);

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
      inputSchema: {
        id: z.string().trim().min(1).optional().describe('Optional exact public MaxVideoAI model ID.'),
        surface: z.enum(['video', 'image']).optional(),
        mode: generationMode.optional(),
        aspectRatio: z.string().trim().min(1).optional(),
        resolution: z.string().trim().min(1).optional(),
        maxDurationSec: z.number().positive().max(300).optional(),
        audio: z.boolean().optional(),
        referenceImages: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (filter) => runAgentTool(async () => ({ models: await services.listModels(filter, principal) }))
  );
}
