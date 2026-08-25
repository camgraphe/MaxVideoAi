import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const settingValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const referenceRole = z.enum(['source', 'reference', 'first_frame', 'last_frame']);
const referenceMediaKind = z.enum(['image', 'video', 'audio']);
const reference = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset'), assetId: z.string(), role: referenceRole }).strict(),
  z.object({
    kind: z.literal('https'),
    url: z.string(),
    role: referenceRole,
    mediaKind: referenceMediaKind,
  }).strict(),
]);
export const prepareGenerationInputSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  surface: z.enum(['video', 'image']),
  engineId: z.string(),
  mode: z.enum(CANONICAL_GENERATION_MODES),
  prompt: z.string(),
  settings: z.record(z.string(), settingValue).optional(),
  references: z.array(reference).optional(),
  outputCount: z.literal(1).optional(),
}).strict();

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
        'Use this when the user has selected an image model or a supported video workflow (t2v, i2v, ref2v, v2v, or extend) and needs validation plus an exact short-lived quote. It saves the quote but does not spend or generate. Do not use it as confirmation or skip the selected mode’s live model details.',
      inputSchema: prepareGenerationInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareGeneration!(input, principal)),
  );
}
