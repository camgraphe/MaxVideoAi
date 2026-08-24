import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const inputSchema = z.object({
  id: z.string().trim().min(1).max(128).optional(),
  surface: z.enum(['video', 'image']).optional(),
  mode: z.enum(['t2v', 'i2v', 'ref2v', 't2i', 'i2i']).optional(),
  aspectRatio: z.string().trim().min(1).max(32).optional(),
  resolution: z.string().trim().min(1).max(32).optional(),
  maxDurationSec: z.number().positive().max(300).optional(),
  audio: z.boolean().optional(),
  referenceImages: z.boolean().optional(),
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
  ]).optional().describe('Optional creative goal used only with reviewed MaxVideoAI model guidance.'),
  priorities: z.array(z.enum([
    'speed',
    'highest_resolution',
    'native_audio',
    'reference_control',
    'longer_clips',
    'lower_cost',
  ])).max(6).optional().describe('Ordered user-stated factual priorities, most important first. highest_resolution applies only when delivery resolution matters and is not a proxy for overall creative quality. Use lower_cost to request a project budget, not a price guess.'),
  preferredModelIds: z.array(z.string().trim().min(1).max(128)).max(10).optional()
    .describe('Up to ten public model IDs the user would like considered when compatible.'),
  excludedModelIds: z.array(z.string().trim().min(1).max(128)).max(10).optional()
    .describe('Up to ten public model IDs to leave out of the recommendations.'),
  budgetCeilingCents: z.number().int().positive().max(10_000_000).optional()
    .describe('Optional project budget ceiling in cents; use calculate_project_budget for current comparable totals.'),
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
        'Use this when the user is undecided, asks for advice, or wants up to three public models matched to a creative goal and factual capabilities. Ask only about missing goals, preferences, or budget; use calculate_project_budget for current costs. Do not use it when the user already chose a compatible model and only wants validation, pricing, or execution. Do not use it as an exact quote, a generation command, or a claim that a provider will accept a job.',
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.recommendModels(input, principal))
  );
}
