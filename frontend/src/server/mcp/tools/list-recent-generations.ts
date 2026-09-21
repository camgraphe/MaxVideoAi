import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

export const listRecentGenerationsInputSchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  surface: z.enum(['video', 'image', 'audio']).optional(),
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
      description: [
        'Use this when a job identifier or submission response was lost, or the user returns to recent work.',
        'Recover a bounded page from the same connected user\'s MaxVideoAI library before considering any second paid submission.',
        'Filter by surface video, image or audio when known, preserve the existing job IDs and use get_generation_status for follow-up.',
        'Do not claim completion for accepted/running jobs or use this to generate, retry, or charge.',
        'Completed results can be delivered through present_generation.',
      ].join(' '),
      inputSchema: listRecentGenerationsInputSchema,
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
