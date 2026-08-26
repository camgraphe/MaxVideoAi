import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { GENERATION_RESULT_APP_URI } from '@/server/mcp/generation-result-app';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';
import { getGenerationStatusInputSchema } from '@/server/mcp/tools/get-generation-status';

export function registerPresentGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.getGenerationStatus) {
    throw new Error('get_generation_status service is required when present_generation is enabled.');
  }
  server.registerTool(
    'present_generation',
    {
      title: 'Present a MaxVideoAI generation',
      description:
        'Use this when a completed owned MaxVideoAI generation should be shown inline as a playable video or image result. Call get_generation_status or list_recent_generations first; do not use this to poll, generate, retry, or charge credits.',
      inputSchema: getGenerationStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: GENERATION_RESULT_APP_URI },
        'ui/resourceUri': GENERATION_RESULT_APP_URI,
        'openai/outputTemplate': GENERATION_RESULT_APP_URI,
        'openai/toolInvocation/invoking': 'Loading generation…',
        'openai/toolInvocation/invoked': 'Generation ready',
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      () => services.getGenerationStatus!(input, principal),
      buildGenerationResourceLinks,
    ),
  );
}
