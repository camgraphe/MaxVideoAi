import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';
import { getGenerationStatusInputSchema } from '@/server/mcp/tools/get-generation-status';
import { resolveGenerationDownload } from '@/server/mcp/tools/present-generation';

const generationDownloadOutputSchema = z.object({
  jobId: z.string(),
  download: z.object({
    url: z.url(),
    filename: z.string(),
    expiresAt: z.iso.datetime(),
  }).nullable(),
}).strict();

export function registerGetGenerationDownloadTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.getGenerationStatus) {
    throw new Error('get_generation_status service is required when generation downloads are enabled.');
  }
  server.registerTool(
    'get_generation_download',
    {
      title: 'Refresh a MaxVideoAI generation download',
      description:
        'Use this from the MaxVideoAI result app to create a fresh short-lived attachment URL for one completed owned generation.',
      inputSchema: getGenerationStatusInputSchema,
      outputSchema: generationDownloadOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { visibility: ['app'] },
        'openai/visibility': 'private',
      },
    },
    async (input) => runAgentTool(async () => {
      const recovery = await services.getGenerationStatus!(input, principal);
      return {
        jobId: recovery.jobId,
        download: await resolveGenerationDownload(recovery, principal, services),
      };
    }),
  );
}
