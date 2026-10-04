import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

export const getGenerationStatusInputSchema = z.object({
  jobId: z.string().trim().min(1).max(256),
}).strict();

export function registerGetGenerationStatusTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.getGenerationStatus) {
    throw new Error('get_generation_status service is required when its gate is enabled.');
  }
  server.registerTool(
    'get_generation_status',
    {
      title: 'Get a MaxVideoAI generation status',
      description: [
        'Use this to follow or recover one known owned generation, including after interruption or an ambiguous submission response.',
        'It returns safe current status, failure/refund state and MaxVideoAI library/workspace destinations without exposing prompts, provider details or private media.',
        'An accepted or running job is not completed: do not claim completion until terminal success.',
        'When retry is returned, wait at least retry.afterSeconds before calling retry.tool with retry.arguments; do not repeatedly check sooner. When retry is null, stop automatic polling.',
        'For a technical failure inspect the refund state; do not resubmit automatically.',
        'Every replacement is a new paid attempt requiring a fresh quote and approval.',
        'For a completed job use present_generation once to deliver the saved result.',
        'For Audio, preserve the original output and use the same recovery flow.',
      ].join(' '),
      inputSchema: getGenerationStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      () => services.getGenerationStatus!(input, principal),
      buildGenerationResourceLinks,
    ),
  );
}
