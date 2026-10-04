import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import type { AgentPrincipal } from '@/server/agent-api/principal';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { omitNullishToolInput } from '@/server/mcp/optional-tool-input';
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
  }).strict()).min(1).max(6).nullable().default(null).describe(
    'Kling multi-shot scenes. Use only when get_model_details reports the multiPrompt setting; otherwise send null or omit it. Omit the top-level prompt text content for this form.',
  ),
  durationSec: z.number().int().min(1).max(86_400).nullable().default(null).describe(
    'For video modes, use the exact key settings.durationSec for the requested duration in seconds; never send settings.duration. Send null when not applicable.',
  ),
  documentUrl: z.string().url().max(4_096).nullable().default(null).describe(
    'Public HTTPS document reference; use only when reported by get_model_details. Mutually exclusive with webpageUrl and requires prompt expansion.',
  ),
  webpageUrl: z.string().url().max(4_096).nullable().default(null).describe(
    'Public HTTPS webpage reference without login; use only when reported by get_model_details. Mutually exclusive with documentUrl and requires prompt expansion.',
  ),
  enablePromptExpansion: z.boolean().nullable().default(null),
  resolution: z.string().trim().min(1).max(64).nullable().default(null).describe(
    'Use one resolution supported by the selected mode from get_model_details, or null when not applicable.',
  ),
  aspectRatio: z.string().trim().min(1).max(64).nullable().default(null).describe(
    'If the selected mode aspectRatios list is non-empty, use one supported value. If it is empty, send null or omit this field.',
  ),
  fps: z.number().int().min(1).max(240).nullable().default(null),
  audio: z.boolean().nullable().default(null).describe(
    'Send only when the selected mode reports audio as optional; send null or omit when always_generated or unavailable.',
  ),
  loop: z.boolean().nullable().default(null),
  cameraFixed: z.boolean().nullable().default(null),
  cfgScale: z.number().nullable().default(null),
  contextSec: z.number().min(0).nullable().default(null),
  cropEndX: z.number().nullable().default(null),
  cropEndY: z.number().nullable().default(null),
  cropStartX: z.number().nullable().default(null),
  cropStartY: z.number().nullable().default(null),
  editDepthBlur: z.number().nullable().default(null),
  editFace: z.boolean().nullable().default(null),
  editKeyframeIndexes: z.string().max(4_096).nullable().default(null),
  editNormalsAugmentation: z.number().nullable().default(null),
  editPoseStrength: z.string().trim().min(1).max(64).nullable().default(null),
  editStrength: z.string().trim().min(1).max(64).nullable().default(null),
  editTrajectorySparsity: z.number().nullable().default(null),
  exrExport: z.boolean().nullable().default(null),
  extendPosition: z.enum(['start', 'end']).nullable().default(null),
  guidanceScale: z.number().nullable().default(null),
  hdr: z.boolean().nullable().default(null),
  modifyStrength: z.string().trim().min(1).max(64).nullable().default(null),
  negativePrompt: z.string().max(4_096).nullable().default(null),
  numFrames: z.number().int().min(1).nullable().default(null),
  safetyChecker: z.boolean().nullable().default(null),
  seed: z.number().int().nullable().default(null),
  shotType: z.string().trim().min(1).max(64).nullable().default(null),
  enableWebSearch: z.boolean().nullable().default(null),
  limitGenerations: z.boolean().nullable().default(null),
  imageHeight: z.number().int().positive().nullable().default(null).describe(
    'GPT Image family only: custom output height in pixels when resolution is custom.',
  ),
  imageWidth: z.number().int().positive().nullable().default(null).describe(
    'GPT Image family only: custom output width in pixels when resolution is custom.',
  ),
  background: z.enum(['auto', 'transparent', 'opaque']).nullable().default(null).describe(
    'Use only when get_model_details reports a background setting for the selected image model.',
  ),
  outputFormat: z.string().trim().min(1).max(64).nullable().default(null),
  promptExpansionMode: z.enum(['disabled', 'balanced', 'quality']).nullable().default(null).describe(
    'Use only when get_model_details reports the promptExpansionMode setting for the selected mode.',
  ),
  quality: z.string().trim().min(1).max(64).nullable().default(null),
  reframeGridPositionX: z.number().nullable().default(null),
  reframeGridPositionY: z.number().nullable().default(null),
  retakeMode: z.enum(['replace_audio', 'replace_video', 'replace_audio_and_video']).nullable().default(null),
  sourcePositionHeight: z.number().nullable().default(null),
  sourcePositionWidth: z.number().nullable().default(null),
  sourcePositionX: z.number().nullable().default(null),
  sourcePositionY: z.number().nullable().default(null),
  startTimeSec: z.number().min(0).nullable().default(null),
  style: z.string().trim().min(1).max(64).nullable().default(null),
  thinkingLevel: z.string().trim().min(1).max(64).nullable().default(null),
  watermark: z.boolean().nullable().default(null),
}).strict().describe(
  'Canonical MaxVideoAI settings only. Read the selected mode from get_model_details and include only compatible fields.',
);
export const prepareGenerationInputSchema = z.object({
  schemaVersion: z.literal(1).nullable().default(null),
  surface: z.enum(['video', 'image']),
  engineId: z.string(),
  mode: z.enum(CANONICAL_GENERATION_MODES),
  prompt: z.string(),
  settings: canonicalSettingsSchema.nullable().default(null),
  references: z.array(reference).nullable().default(null),
  outputCount: z.number().int().min(1).max(15).nullable().default(null).describe(
    'Number of outputs. Video must use 1. Image limits are model-specific; read outputCount from get_model_details.',
  ),
}).strict();

function normalizePrepareGenerationInput(
  input: z.output<typeof prepareGenerationInputSchema>,
) {
  return omitNullishToolInput({
    ...input,
    settings: input.settings === null ? null : omitNullishToolInput(input.settings),
  });
}

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
      description: [
        'Use this to validate a complete selected AI video or image request and save an exact short-lived quote.',
        'Read get_model_details for the selected mode first, including t2v, i2v, i2v_standard, ref2v, fl2v, v2v, r2v, extend, a2v, retake and reframe.',
        'It saves the quote but does not spend or generate.',
        'Display the exact price, currency and validated request, then stop and wait for explicit user approval before confirm_generation.',
        'Required private references must be present; if missing, no exact quote can be created.',
        'A project budget is only an estimate.',
        'For nullable inputs, omit or send null when not explicitly required by the selected mode’s live details or the user.',
        'For video duration use settings.durationSec, never settings.duration.',
        'Use only supported settings and ordered reference roles; never infer constraints from a sibling mode.',
        'Treat expiresAt as UTC; declare definitive expiry only on QUOTE_EXPIRED, not a local-date comparison.',
        'If credits are insufficient, use create_topup_link for this quote.',
        'Funding, discussion and ambiguous assent do not approve generation.',
        'Never substitute a named model or use a quote as a generation result.',
      ].join(' '),
      inputSchema: prepareGenerationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareGeneration!(
      normalizePrepareGenerationInput(input),
      principal,
    )),
  );
}
