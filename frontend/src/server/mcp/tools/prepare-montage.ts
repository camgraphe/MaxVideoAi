import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import {
  MONTAGE_ASPECT_RATIOS,
  MONTAGE_AUDIO_MODES,
  MONTAGE_FPS,
  MONTAGE_MAX_CLIPS,
  MONTAGE_MIN_CLIPS,
  MONTAGE_RESOLUTIONS,
} from '@/server/agent-api/montage-plan';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const canonicalAssetId = z.string().regex(/^ma_[a-f0-9]{32}$/u);

export const prepareMontageInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  settings: z.object({
    fps: z.union(MONTAGE_FPS.map((fps) => z.literal(fps)) as [z.ZodLiteral<24>, z.ZodLiteral<25>, z.ZodLiteral<30>, z.ZodLiteral<60>]),
    aspectRatio: z.enum(MONTAGE_ASPECT_RATIOS),
    resolution: z.enum(MONTAGE_RESOLUTIONS),
    audioMode: z.enum(MONTAGE_AUDIO_MODES),
  }).strict(),
  clips: z.array(z.object({
    assetId: canonicalAssetId,
    sourceInFrame: z.number().int().nonnegative(),
    durationFrames: z.number().int().positive(),
  }).strict()).min(MONTAGE_MIN_CLIPS).max(MONTAGE_MAX_CLIPS),
}).strict();

export function registerPrepareMontageTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.prepareMontage) {
    throw new Error('prepare_montage service is required when its gate is enabled.');
  }
  server.registerTool(
    'prepare_montage',
    {
      title: 'Prepare a montage edit plan',
      description:
        'Validate 2–12 ordered owned video clips and return a contiguous frame-aligned edit plan. Ordering is supplied by the caller, not visual analysis. This does not render media, modify assets, or save an editable Studio project.',
      inputSchema: prepareMontageInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareMontage!(input, principal)),
  );
}
