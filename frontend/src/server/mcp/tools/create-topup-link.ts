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
      description: [
        'Use this when an exact prepared quote needs more credits.',
        'It creates a short-lived MaxVideoAI web handoff and invalidates the old short-lived quote.',
        'This tool does not take payment.',
        'Payment happens only on the MaxVideoAI website at the exact returned destination; never collect payment data or claim the browser step completed.',
        'After the user reports funding, call get_account_status, then a fresh prepare_generation (prepare_audio_generation for Audio).',
        'Display the fresh exact quote and wait for new explicit approval before confirmation.',
        'Funding is not generation approval; never automatically retry or generate.',
      ].join(' '),
      inputSchema: createTopupLinkInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.createTopupLink!(input, principal)),
  );
}
