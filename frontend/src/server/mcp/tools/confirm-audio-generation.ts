import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const confirmAudioGenerationInputSchema = z.object({
  quoteId: z.string().uuid(),
  confirmed: z.literal(true),
}).strict();

export function registerConfirmAudioGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.confirmAudioGeneration) {
    throw new Error('confirm_audio_generation service is required when Audio publication is enabled.');
  }
  server.registerTool(
    'confirm_audio_generation',
    {
      title: 'Confirm a MaxVideoAI Audio generation',
      description:
        'Consumes one exact prepared Audio quote, may debit wallet funds, and contacts external Audio providers. Duplicate delivery of the same confirmed quote returns its durable job. Never retry a failed or refunded attempt without a fresh quote and new explicit approval.',
      inputSchema: confirmAudioGenerationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => runAgentTool(() => services.confirmAudioGeneration!(input, principal)),
  );
}
