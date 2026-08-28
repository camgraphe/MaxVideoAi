import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { MAX_REFERENCE_FILES_PER_IMPORT } from '@/server/agent-api/reference-file-import';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const hostReferenceFileSchema = z.object({
  download_url: z.string().url().max(4_096),
  file_id: z.string().min(1).max(512),
  mime_type: z.string().min(1).max(255).optional(),
  file_name: z.string().min(1).max(255).optional(),
}).strict();

export const importReferenceFilesInputSchema = z.object({
  files: z.array(hostReferenceFileSchema).min(1).max(MAX_REFERENCE_FILES_PER_IMPORT),
}).strict();

export function registerImportReferenceFilesTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.importReferenceFiles) {
    throw new Error('import_reference_files service is required when reference uploads are enabled.');
  }
  server.registerTool(
    'import_reference_files',
    {
      title: 'Import private reference files',
      description:
        'Import one or more user-authorized image, video, or audio files from temporary host file handles into the connected private MaxVideoAI library. Use this when the host provides attachments or authorized generation results as file handles. Returns reusable asset IDs in input order. Do not use this with invented URLs, existing library assets, local filesystem paths, generation, or spending.',
      inputSchema: importReferenceFilesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: {
        'openai/fileParams': ['files'],
        'openai/toolInvocation/invoking': 'Importing private references…',
        'openai/toolInvocation/invoked': 'Private references ready',
      },
    },
    async (input) => runAgentTool(() => services.importReferenceFiles!(input, principal)),
  );
}
