import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { AgentApiError } from '@/server/agent-api/errors';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_VIDEO_GENERATION_MODES } from '@/server/agent-api/generation-types';
import { MAX_CANONICAL_REFERENCES } from '@/server/agent-api/generation-normalization';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const referenceRole = z.enum(['source', 'first_frame', 'last_frame', 'reference']).describe(
  'How this declared reference will be used for the video line.',
);

const settingsSchema = z.object({
  durationSec: z.number().int().min(1).max(86_400).describe(
    'Requested duration of each output clip in seconds.',
  ),
  resolution: z.string().trim().min(1).max(64).describe(
    'Requested output resolution supported by the selected model and mode.',
  ),
  aspectRatio: z.string().trim().min(1).max(64).optional().describe(
    'Read the selected mode from get_model_details. If mode.aspectRatios is non-empty, include one supported aspectRatio, including for i2v; if it is empty, omit aspectRatio. Never infer this from the mode name or another mode.',
  ),
  fps: z.number().int().min(1).max(240).optional().describe(
    'Optional requested frames per second when the selected model supports it.',
  ),
  audio: z.boolean().optional().describe(
    'Set only when get_model_details reports audio as optional. Omit this field when audio is always_generated or unavailable.',
  ),
  loop: z.boolean().optional().describe(
    'Optional intent to create a looping clip when the selected model and mode support it.',
  ),
}).strict().describe('Only the concrete video settings that affect capability validation and current pricing.');

const lineSchema = z.object({
  purpose: z.string().trim().min(1).max(240).describe(
    'Short human-readable purpose of this line, such as opening hero shot or product cutaways.',
  ),
  engineId: z.string().trim().min(1).max(128).describe(
    'Exact public MaxVideoAI video model ID returned by list_models or get_model_details.',
  ),
  mode: z.enum(CANONICAL_VIDEO_GENERATION_MODES).describe(
    'Video creation mode: text, image, multimodal reference, first/last frame, source-video edit, ordered reference videos, or clip extension.',
  ),
  settings: settingsSchema,
  referenceRoles: z.array(referenceRole).max(MAX_CANONICAL_REFERENCES).optional().describe(
    'Optional declared roles for the reference inputs needed by this model and mode; no media is uploaded or generated.',
  ),
  clipCount: z.number().int().min(1).max(100).describe(
    'Number of intended output clips for this production line.',
  ),
  attemptsPerClip: z.number().int().min(1).max(10).describe(
    'Explicit creative attempts per clip. One is the base production pass; additional attempts are a user-chosen creative iteration allowance.',
  ),
}).strict().describe('One concrete video production line to validate and price.');

export const calculateProjectBudgetInputSchema = z.object({
  proposals: z.array(z.object({
    name: z.string().trim().min(1).max(160).describe(
      'Your name for this concrete production proposal; names and order are preserved exactly.',
    ),
    lines: z.array(lineSchema).min(1).max(12).describe(
      'Concrete video production lines in the order they should be discussed.',
    ),
  }).strict()).min(1).max(4).describe(
    'One to four user-named video production proposals, including single-model or mixed-model approaches.',
  ),
}).strict();

export function registerCalculateProjectBudgetTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  const calculateProjectBudget = services.calculateProjectBudget;
  server.registerTool(
    'calculate_project_budget',
    {
      title: 'Calculate a MaxVideoAI project budget',
      description:
        'Use this when the user wants current pricing for one or more concrete video production proposals, including mixed models, clip counts, and explicit creative attempts. Do not use it to invent the creative plan, reserve a price, create a generation quote, inspect the wallet, or spend funds.',
      inputSchema: calculateProjectBudgetInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => runAgentTool(() => {
      if (!calculateProjectBudget) {
        throw new AgentApiError('INTERNAL_ERROR', 'Current project pricing is unavailable.');
      }
      return calculateProjectBudget(input, principal);
    }),
  );
}
