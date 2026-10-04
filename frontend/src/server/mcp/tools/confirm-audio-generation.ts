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
      description: [
        'Use only after explicit user approval of the exact fresh quote returned by prepare_audio_generation.',
        'Display the exact price and wait for approval first; ambiguous assent is not confirmation.',
        'Consumes one quote, may debit wallet funds, and contacts external Audio providers.',
        'One approval authorizes one paid attempt, consumed whether accepted, failed or refunded.',
        'A refund does not restore authorization.',
        'Duplicate delivery of the identical confirmed quote returns its durable job; never automatically retry an Audio provider failure.',
        'Every replacement needs a fresh quote and new explicit approval.',
        'Recover through get_generation_status or list_recent_generations with surface audio, then present completed original Audio with present_generation.',
      ].join(' '),
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
