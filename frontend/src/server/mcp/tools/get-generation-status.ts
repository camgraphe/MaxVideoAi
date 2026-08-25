import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

export const getGenerationStatusInputSchema = z.object({
  jobId: z.string().trim().min(1).max(256),
}).strict();

export function registerGetGenerationStatusTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.getGenerationStatus) {
    throw new Error('get_generation_status service is required when its gate is enabled.');
  }
  server.registerTool(
    'get_generation_status',
    {
      title: 'Get a MaxVideoAI generation status',
      description:
        'Use this to recover the safe current state and public result links for one owned generation. It never returns prompts, provider details, or private media.',
      inputSchema: getGenerationStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      () => services.getGenerationStatus!(input, principal),
      buildGenerationResourceLinks,
    ),
  );
}
