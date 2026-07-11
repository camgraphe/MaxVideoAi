import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

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
        'Use this when the user wants up to three public models matched to image/video, prompt mode, format, duration, audio, references, speed, budget, or quality needs. Do not use it as an exact quote, a generation command, or a claim that a provider will accept a job.',
      inputSchema: {
        id: z.string().trim().min(1).optional(),
        surface: z.enum(['video', 'image']).optional(),
        mode: z.enum(['t2v', 'i2v', 'ref2v', 't2i', 'i2i']).optional(),
        aspectRatio: z.string().trim().min(1).optional(),
        resolution: z.string().trim().min(1).optional(),
        maxDurationSec: z.number().positive().max(300).optional(),
        audio: z.boolean().optional(),
        referenceImages: z.boolean().optional(),
        budgetPreference: z.enum(['lowest', 'balanced', 'flexible']).optional(),
        speedPreference: z.enum(['fastest', 'balanced', 'quality']).optional(),
        qualityPreference: z.enum(['draft', 'balanced', 'highest']).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.recommendModels(input, principal))
  );
}
