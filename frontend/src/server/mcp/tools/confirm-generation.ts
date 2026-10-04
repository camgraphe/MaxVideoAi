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
      description: [
        'Use only after explicit user approval of the exact fresh quote returned by prepare_generation.',
        'Display its exact price and wait for that approval first; ambiguous assent is not confirmation.',
        'This consumes the funding locked into the quote: wallet quotes may spend credits; an included trial does not. It contacts an external generation provider.',
        'A confirmation authorizes exactly one paid attempt and is consumed whether accepted, failed or refunded.',
        'A refund does not restore authorization.',
        'Every replacement is a new paid attempt requiring a fresh exact quote and new explicit user approval.',
        'Duplicate delivery of the identical confirmed request returns the existing job; never use this to retry a failed generation.',
        'After an ambiguous response, recover through get_generation_status or list_recent_generations rather than submitting a second paid attempt.',
        'An accepted job is not a completed result.',
      ].join(' '),
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
