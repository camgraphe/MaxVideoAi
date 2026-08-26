import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const getAccountStatusInputSchema = z.object({}).strict();

export function registerGetAccountStatusTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices
): void {
  server.registerTool(
    'get_account_status',
    {
      title: 'Get MaxVideoAI account status',
      description:
        'Use this when the user asks which MaxVideoAI account is connected, its current credit balance, trial state, spending limits, or safe account destinations. Do not use it to reveal a private email, collect payment details, charge credits, change the wallet, or generate media.',
      inputSchema: getAccountStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runAgentTool(() => services.getAccountStatus(principal))
  );
}
