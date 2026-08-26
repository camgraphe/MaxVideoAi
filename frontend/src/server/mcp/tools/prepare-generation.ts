import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

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
const canonicalSettingsSchema = z.object({
  durationSec: z.number().int().min(1).max(86_400).optional().describe(
    'For video modes, use the exact key settings.durationSec for the requested duration in seconds; never send settings.duration.',
  ),
  resolution: z.string().trim().min(1).max(64).optional().describe(
    'Use one resolution supported by the selected mode from get_model_details.',
  ),
  aspectRatio: z.string().trim().min(1).max(64).optional().describe(
    'If the selected mode aspectRatios list is non-empty, use one supported value. If it is empty, omit this field.',
  ),
  fps: z.number().int().min(1).max(240).optional(),
  audio: z.boolean().optional().describe(
    'Send only when the selected mode reports audio as optional; omit when always_generated or unavailable.',
  ),
  loop: z.boolean().optional(),
  cameraFixed: z.boolean().optional(),
  cfgScale: z.number().optional(),
  negativePrompt: z.string().max(4_096).optional(),
  numFrames: z.number().int().min(1).optional(),
  safetyChecker: z.boolean().optional(),
  seed: z.number().int().optional(),
  shotType: z.string().trim().min(1).max(64).optional(),
  enableWebSearch: z.boolean().optional(),
  limitGenerations: z.boolean().optional(),
  outputFormat: z.string().trim().min(1).max(64).optional(),
  quality: z.string().trim().min(1).max(64).optional(),
  style: z.string().trim().min(1).max(64).optional(),
  thinkingLevel: z.string().trim().min(1).max(64).optional(),
  watermark: z.boolean().optional(),
}).strict().describe(
  'Canonical MaxVideoAI settings only. Read the selected mode from get_model_details and include only compatible fields.',
);
export const prepareGenerationInputSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  surface: z.enum(['video', 'image']),
  engineId: z.string(),
  mode: z.enum(CANONICAL_GENERATION_MODES),
  prompt: z.string(),
  settings: canonicalSettingsSchema.optional(),
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
        'Use this when the user has selected an image model or a supported video workflow (t2v, i2v, ref2v, fl2v, v2v, r2v, or extend) and needs validation plus an exact short-lived quote. For video duration, send settings.durationSec in seconds, never settings.duration. It saves the quote but does not spend or generate. Do not use it as confirmation or skip the selected mode’s live model details.',
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
