import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const settingValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const referenceRole = z.enum(['source', 'reference', 'first_frame', 'last_frame']);
const reference = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset'), assetId: z.string(), role: referenceRole }).strict(),
  z.object({ kind: z.literal('https'), url: z.string(), role: referenceRole }).strict(),
]);

export function registerPrepareGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.prepareGeneration) {
    throw new Error('prepare_generation service is required when its gate is enabled.');
  }
  server.registerTool(
    'prepare_generation',
    {
      title: 'Prepare a MaxVideoAI generation',
      description:
        'Use this when the user has selected an image or video model and needs an exact short-lived quote. It validates and saves the quote, but it does not spend or generate. Do not use it as confirmation.',
      inputSchema: {
        schemaVersion: z.literal(1).optional(),
        surface: z.enum(['video', 'image']),
        engineId: z.string(),
        mode: z.enum(['t2v', 'i2v', 'ref2v', 't2i', 'i2i']),
        prompt: z.string(),
        settings: z.record(z.string(), settingValue).optional(),
        references: z.array(reference).optional(),
        outputCount: z.literal(1).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareGeneration!(input, principal)),
  );
}
