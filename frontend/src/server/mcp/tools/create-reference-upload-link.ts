import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const createReferenceUploadLinkInputSchema = z.object({
  kind: z.enum(['image', 'video', 'audio']),
}).strict();

export function registerCreateReferenceUploadLinkTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.createReferenceUploadLink) {
    throw new Error('create_reference_upload_link service is required when its gate is enabled.');
  }
  server.registerTool(
    'create_reference_upload_link',
    {
      title: 'Upload private reference media',
      description:
        'Use this when the user needs to add one private reference by requested media kind: image, video, or audio. It creates a short-lived browser handoff. Do not use it as proof that the file was uploaded, to start generation, or to modify an existing asset.',
      inputSchema: createReferenceUploadLinkInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => runAgentTool(() => services.createReferenceUploadLink!(input, principal)),
  );
}
