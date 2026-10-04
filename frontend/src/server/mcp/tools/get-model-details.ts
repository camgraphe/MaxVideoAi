import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

export const getModelDetailsInputSchema = z.object({
  id: z.string().trim().min(1).max(128).describe(
    'Exact public MaxVideoAI model ID returned by list_models or recommend_models.',
  ),
}).strict();

export function registerGetModelDetailsTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  server.registerTool(
    'get_model_details',
    {
      title: 'Get MaxVideoAI model details',
      description: [
        'Use this when the user needs exact current capabilities, limits, evidence and reviewed official promptingSources for one known public MaxVideoAI model.',
        'Read the selected mode before budgeting or quoting: required fields, settings, reference roles/counts/kinds, per-file and combined durations, audio policy and limits.',
        't2v creates video from text; i2v and i2v_standard animate a first/source image and may accept a last frame; ref2v uses image/video/audio references; fl2v requires first_frame and last_frame images; v2v edits source video; r2v uses ordered reference videos; extend uses ordered clips; a2v follows owned audio; retake replaces part of an owned clip; reframe changes its canvas.',
        'i2v_standard is the published Standard route; check live prices before calling it cheaper.',
        'Only live generation-enabled modes are executable.',
        'Honor assetRequired and conditional assetRequiredWhen: required references must be private MaxVideoAI assets, never arbitrary public HTTPS URLs.',
        'If aspectRatios is empty, omit aspectRatio; if non-empty, include a supported aspectRatio.',
        'When audio is always_generated or unavailable, omit settings.audio; only send it when optional.',
        'For GPT Image edits use source/reference images and an optional mask image with the mask role; custom resolution needs imageWidth and imageHeight from live constraints.',
        'For prompt help, use relevant reviewed official provider promptingSources and share the returned URL when useful; if empty, say no reviewed official source was returned; do not invent a guide or substitute web search.',
        'Provider guides inform prompt craft, not MaxVideoAI availability or pricing; live details also govern settings and execution.',
        'Do not use this for exact pricing, generation, hidden models, or provider guarantees.',
      ].join(' '),
      inputSchema: getModelDetailsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ id }) => runAgentTool(() => services.getModelDetails(id, principal)),
  );
}
