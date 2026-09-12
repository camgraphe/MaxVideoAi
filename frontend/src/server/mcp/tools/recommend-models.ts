import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { omitNullishToolInput } from '@/server/mcp/optional-tool-input';
import { runAgentTool } from '@/server/mcp/tool-result';

export const recommendModelsInputSchema = z.object({
  id: z.string().trim().min(1).max(128).nullable().default(null)
    .describe('Exact public model ID to consider, or null unless the user named one.'),
  surface: z.enum(['video', 'image']).nullable().default(null)
    .describe('Requested media surface, or null unless the user constrained it.'),
  mode: z.enum(CANONICAL_GENERATION_MODES).nullable().default(null)
    .describe('Requested generation mode, or null unless the user constrained it.'),
  aspectRatio: z.string().trim().min(1).max(32).nullable().default(null)
    .describe('Requested aspect ratio, or null unless the user constrained it.'),
  resolution: z.string().trim().min(1).max(32).nullable().default(null)
    .describe('Requested resolution, or null unless the user constrained it.'),
  maxDurationSec: z.number().positive().max(300).nullable().default(null)
    .describe('Maximum duration requested by the user, or null. Never use 300 as a placeholder.'),
  audio: z.boolean().nullable().default(null)
    .describe('Whether the user explicitly requires or excludes audio, or null when unstated.'),
  referenceImages: z.boolean().nullable().default(null)
    .describe('Whether the user explicitly requires or excludes reference images, or null when unstated.'),
  useCase: z.enum([
    'cinematic_story',
    'multi_shot',
    'product_video',
    'character_scene',
    'reference_guided',
    'source_edit',
    'conversational_refine',
    'social_video',
    'native_audio',
    'high_resolution',
  ]).nullable().default(null).describe(
    'Creative goal used only with reviewed MaxVideoAI model guidance, or null when unstated.',
  ),
  priorities: z.array(z.enum([
    'speed',
    'highest_resolution',
    'native_audio',
    'reference_control',
    'longer_clips',
    'lower_cost',
  ])).max(6).nullable().default(null).describe('Ordered user-stated factual priorities, most important first, or null when unstated. highest_resolution applies only when delivery resolution matters and is not a proxy for overall creative quality. Use lower_cost to request a project budget, not a price guess.'),
  preferredModelIds: z.array(z.string().trim().min(1).max(128)).max(10).nullable().default(null)
    .describe('Up to ten public model IDs the user would like considered when compatible, or null.'),
  excludedModelIds: z.array(z.string().trim().min(1).max(128)).max(10).nullable().default(null)
    .describe('Up to ten public model IDs to leave out of the recommendations, or null.'),
  budgetCeilingCents: z.number().int().positive().max(10_000_000).nullable().default(null)
    .describe('Project budget ceiling in cents, or null when unstated; use calculate_project_budget for current comparable totals.'),
}).strict();

export function registerRecommendModelsTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices
): void {
  server.registerTool(
    'recommend_models',
    {
      title: 'Recommend MaxVideoAI models',
      description:
        'Use this when the user is undecided, asks for advice, or wants a best-fit generation-enabled model plus strong alternatives from distinct model families, matched to a creative goal and factual capabilities. Every optional constraint is represented by a nullable field: send null when the user did not state it, never a placeholder. Ask only about missing goals, preferences, or budget; use calculate_project_budget before calling an alternative cheaper or lower-cost. Do not use it when the user already chose a compatible model and only wants validation, pricing, or execution. Do not use it as an exact quote, a generation command, or a claim that a provider will accept a job.',
      inputSchema: recommendModelsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.recommendModels(
      omitNullishToolInput(input),
      principal,
    ))
  );
}
