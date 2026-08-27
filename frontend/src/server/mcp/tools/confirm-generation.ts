import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

export const confirmGenerationInputSchema = z.object({
  quoteId: z.string().uuid(),
  confirmed: z.literal(true),
}).strict();

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
        'Confirms one exact prepared quote using the funding locked into the quote and contacts an external generation provider. Wallet quotes may spend wallet funds; an included trial does not. A confirmation authorizes exactly one paid attempt. Duplicate delivery of the identical confirmed request returns the existing job; never use this to retry a failed generation. A new paid attempt requires a fresh exact quote and new explicit user approval.',
      inputSchema: confirmGenerationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      () => services.confirmGeneration!(input, principal),
      buildGenerationResourceLinks,
    ),
  );
}
