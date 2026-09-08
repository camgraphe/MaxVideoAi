import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createStudioMontageInputSchema } from '@/lib/studio/montage-contract';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const createStudioMontageToolInputSchema = createStudioMontageInputSchema;

export function registerCreateStudioMontageTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.createStudioMontage) {
    throw new Error('create_studio_montage service is required when its gate is enabled.');
  }
  server.registerTool(
    'create_studio_montage',
    {
      title: 'Create an editable Studio montage',
      description:
        'Create one persisted editable Studio project from 2–12 caller-ordered owned ready videos with frame-aligned trims. Reuse the exact idempotencyKey only for an exact retry of the same request.',
      inputSchema: createStudioMontageToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.createStudioMontage!(input, principal)),
  );
}
