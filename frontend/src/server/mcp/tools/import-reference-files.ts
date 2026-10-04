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
      description: [
        'Use this to import up to eight user-authorized image, video or audio files from temporary host file handles, including attachments or authorized generation results, into the connected private MaxVideoAI library.',
        'MaxVideoAI manages these references; the host owns creating or selecting reference media.',
        'Use returned asset IDs directly and preserve input order; do not call list_media after a successful direct import.',
        'On partial failure, keep successful IDs and retry only failed files.',
        'Do not invent or substitute download URLs, send local filesystem paths, re-import existing library assets, generate, or spend.',
        'When the host cannot expose a file handle, use create_reference_upload_link instead.',
      ].join(' '),
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
