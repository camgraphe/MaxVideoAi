import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const createTopupLinkInputSchema = z.object({ quoteId: z.string().uuidv4() }).strict();

export function registerCreateTopupLinkTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.createTopupLink) {
    throw new Error('create_topup_link service is required when its gate is enabled.');
  }
  server.registerTool(
    'create_topup_link',
    {
      title: 'Create a MaxVideoAI top-up handoff',
      description:
        'Creates a short-lived MaxVideoAI web handoff when the prepared quote needs more credits. MaxVideoAI collects payment on its website; this tool does not take payment. It invalidates the old short-lived quote, so after funding call get_account_status and then a fresh prepare_generation for an exact quote.',
      inputSchema: createTopupLinkInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => runAgentTool(() => services.createTopupLink!(input, principal)),
  );
}
