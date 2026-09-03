import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const referenceRole = z.enum(['source', 'reference', 'first_frame', 'last_frame', 'mask']);
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
  multiPrompt: z.array(z.object({
    prompt: z.string().trim().min(1).max(512),
    durationSec: z.number().int().min(1).max(15),
  }).strict()).min(1).max(6).optional().describe(
    'Kling multi-shot scenes. Use only when get_model_details reports the multiPrompt setting; omit the top-level prompt text content for this form.',
  ),
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
  contextSec: z.number().min(0).optional(),
  cropEndX: z.number().optional(),
  cropEndY: z.number().optional(),
  cropStartX: z.number().optional(),
  cropStartY: z.number().optional(),
  editDepthBlur: z.number().optional(),
  editFace: z.boolean().optional(),
  editKeyframeIndexes: z.string().max(4_096).optional(),
  editNormalsAugmentation: z.number().optional(),
  editPoseStrength: z.string().trim().min(1).max(64).optional(),
  editStrength: z.string().trim().min(1).max(64).optional(),
  editTrajectorySparsity: z.number().optional(),
  exrExport: z.boolean().optional(),
  extendPosition: z.enum(['start', 'end']).optional(),
  guidanceScale: z.number().optional(),
  hdr: z.boolean().optional(),
  modifyStrength: z.string().trim().min(1).max(64).optional(),
  negativePrompt: z.string().max(4_096).optional(),
  numFrames: z.number().int().min(1).optional(),
  safetyChecker: z.boolean().optional(),
  seed: z.number().int().optional(),
  shotType: z.string().trim().min(1).max(64).optional(),
  enableWebSearch: z.boolean().optional(),
  limitGenerations: z.boolean().optional(),
  imageHeight: z.number().int().positive().optional().describe(
    'GPT Image 2 only: custom output height in pixels when resolution is custom.',
  ),
  imageWidth: z.number().int().positive().optional().describe(
    'GPT Image 2 only: custom output width in pixels when resolution is custom.',
  ),
  outputFormat: z.string().trim().min(1).max(64).optional(),
  promptExpansionMode: z.enum(['balanced', 'quality']).optional().describe(
    'Use only when get_model_details reports the promptExpansionMode setting for the selected mode.',
  ),
  quality: z.string().trim().min(1).max(64).optional(),
  reframeGridPositionX: z.number().optional(),
  reframeGridPositionY: z.number().optional(),
  retakeMode: z.enum(['replace_audio', 'replace_video', 'replace_audio_and_video']).optional(),
  sourcePositionHeight: z.number().optional(),
  sourcePositionWidth: z.number().optional(),
  sourcePositionX: z.number().optional(),
  sourcePositionY: z.number().optional(),
  startTimeSec: z.number().min(0).optional(),
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
  outputCount: z.number().int().min(1).max(15).optional().describe(
    'Number of outputs. Video must use 1. Image limits are model-specific; read outputCount from get_model_details.',
  ),
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
        'Use this when the user has selected an image model or a supported video workflow (t2v, i2v, i2v_standard, ref2v, fl2v, v2v, r2v, extend, a2v, retake, or reframe) and needs validation plus an exact short-lived quote. For video duration, send settings.durationSec in seconds, never settings.duration. It saves the quote but does not spend or generate. Do not use it as confirmation or skip the selected mode’s live model details.',
      inputSchema: prepareGenerationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareGeneration!(input, principal)),
  );
}
