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
  ])).max(6).nullable().default(null).describe('Ordered user-stated factual priorities, most important first, or null when none of these values matches. For beautiful cinematography, expressive acting or smooth camera movement without an explicit listed priority, use null. highest_resolution requires a delivery-resolution preference such as 4K; it is not a proxy for overall creative quality. lower_cost requests a budget comparison when cheaper options are explicitly wanted. Asking what a project costs does not mean prefer the cheapest: keep priorities null and use calculate_project_budget for the estimate.'),
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
      description: [
        'Use this when the user is undecided or asks for advice on which AI video/image model fits a creative goal.',
        'Present the best-fit available executable model first, then strong alternatives from distinct model families when useful.',
        'Validate the selected mode with get_model_details.',
        'Nullable constraints must be null or omitted when unstated, never placeholders.',
        'Ask only for missing choices that change the result or budget.',
        'Clarify whether quality means story coherence, multi-shot continuity, reference/character fidelity, motion, audio or delivery resolution; never rank creative quality by resolution alone.',
        'Use calculate_project_budget on comparable proposals before calling an option cheaper or lower-cost.',
        'Mix models only when each shot has a factual rationale; do not force diversity or dilute a quality-first plan.',
        'Do not use when the user already chose a compatible model for validation, pricing or execution.',
        'Never substitute a named model without user approval.',
        'Recommendations are capability matches. Do not use them as an exact quote, generation command, or guarantee that a provider will accept a request.',
      ].join(' '),
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
