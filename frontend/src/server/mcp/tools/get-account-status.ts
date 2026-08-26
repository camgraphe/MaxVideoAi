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
        'Use this to check the connected MaxVideoAI account, current credit balance, trial state, spending limits, and safe account destinations. It never reveals payment details or changes the wallet.',
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
