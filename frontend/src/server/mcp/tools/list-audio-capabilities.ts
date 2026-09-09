import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const listAudioCapabilitiesInputSchema = z.object({}).strict();

export function registerListAudioCapabilitiesTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.listAudioCapabilities) {
    throw new Error('list_audio_capabilities service is required when Audio publication is enabled.');
  }
  server.registerTool(
    'list_audio_capabilities',
    {
      title: 'List MaxVideoAI Audio capabilities',
      description:
        'Lists the current public Audio modes, exact settings, owned reference roles, provider availability, pricing policy revision, and confirmation contract. It does not quote, spend, or generate.',
      inputSchema: listAudioCapabilitiesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runAgentTool(async () => services.listAudioCapabilities!(principal)),
  );
}
