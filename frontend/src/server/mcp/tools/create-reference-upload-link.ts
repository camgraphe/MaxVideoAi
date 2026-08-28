import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { REFERENCE_UPLOAD_APP_URI } from '@/server/mcp/reference-upload-app';
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
        'Use this when the user needs to add one private reference by requested media kind: image, video, or audio. It creates a short-lived browser handoff; after upload the file is saved to the connected MaxVideoAI library and list_media can select it. Do not use the handoff alone as proof that upload completed, to start generation, or to modify an existing asset.',
      inputSchema: createReferenceUploadLinkInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: REFERENCE_UPLOAD_APP_URI },
        'ui/resourceUri': REFERENCE_UPLOAD_APP_URI,
        'openai/outputTemplate': REFERENCE_UPLOAD_APP_URI,
        'openai/toolInvocation/invoking': 'Preparing private upload…',
        'openai/toolInvocation/invoked': 'Private upload ready',
      },
    },
    async (input) => runAgentTool(() => services.createReferenceUploadLink!(input, principal)),
  );
}
