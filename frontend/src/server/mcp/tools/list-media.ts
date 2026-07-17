import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const inputSchema = z.object({
  cursor: z.string().min(1).max(1_024).optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

export function registerListMediaTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.listMedia) {
    throw new Error('list_media service is required when its gate is enabled.');
  }
  server.registerTool(
    'list_media',
    {
      title: 'List private MaxVideoAI images',
      description:
        'Use this when the user needs their reusable private MaxVideoAI image asset IDs and controlled previews. Do not use it to upload files, list audio or video, expose source URLs, or start generation.',
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.listMedia!(input, principal)),
  );
}
