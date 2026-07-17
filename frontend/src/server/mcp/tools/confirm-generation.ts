import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export function registerConfirmGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.confirmGeneration) {
    throw new Error('confirm_generation service is required when its gate is enabled.');
  }
  server.registerTool(
    'confirm_generation',
    {
      title: 'Confirm a MaxVideoAI generation',
      description:
        'Confirms one exact prepared quote using the funding locked into the quote and contacts an external generation provider. Wallet quotes may spend wallet funds; an included trial does not. Repeating the same confirmation safely returns the same generation job.',
      inputSchema: {
        quoteId: z.string().uuid(),
        confirmed: z.literal(true),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => runAgentTool(() => services.confirmGeneration!(input, principal)),
  );
}
