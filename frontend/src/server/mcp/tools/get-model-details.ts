import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const getModelDetailsInputSchema = z.object({
  id: z.string().trim().min(1).max(128).describe(
    'Exact public MaxVideoAI model ID returned by list_models or recommend_models.',
  ),
}).strict();

export function registerGetModelDetailsTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  server.registerTool(
    'get_model_details',
    {
      title: 'Get MaxVideoAI model details',
      description:
        'Use this when the user needs exact current capabilities, constraints, evidence, or links for one known public MaxVideoAI model. Do not use it for pricing, generation, hidden models, or provider guarantees.',
      inputSchema: getModelDetailsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ id }) => runAgentTool(() => services.getModelDetails(id, principal)),
  );
}
