import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

const inputSchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  surface: z.enum(['video', 'image']).optional(),
  status: z.enum(['accepted', 'running', 'completed', 'failed']).optional(),
}).strict();

export function registerListRecentGenerationsTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.listRecentGenerations) {
    throw new Error('list_recent_generations service is required when its gate is enabled.');
  }
  server.registerTool(
    'list_recent_generations',
    {
      title: 'List recent MaxVideoAI generations',
      description:
        'Use this to recover a bounded page of the connected user’s recent image or video generations and safe public result links.',
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      () => services.listRecentGenerations!(input, principal),
      (page) => page.items.flatMap(buildGenerationResourceLinks),
    ),
  );
}
