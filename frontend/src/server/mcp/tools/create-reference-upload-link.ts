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
      description: [
        'Use this when the host cannot expose a file handle and the user needs a private image, video or audio reference.',
        'It creates a short-lived handoff for the requested media kind.',
        'A compatible UI host can show the in-chat multi-file importer; the exact returned browser destination is the manual fallback.',
        'For local files in Codex or Claude Code, create one link per file and use the packaged local helper.',
        'The helper reads local bytes: never send a raw local path to the MCP server, publish a public URL, or depend on Computer Use.',
        'After the importer or helper returns asset IDs, use them directly without relisting.',
        'After a browser upload is saved to the same connected MaxVideoAI library, call list_media by media kind.',
        'A handoff is not proof of upload completion.',
        'If the handoff fails, is denied or unavailable, explain the blocker and ask to authorize or retry it; do not invent a replacement URL.',
        'This does not start generation or modify an existing asset.',
      ].join(' '),
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
