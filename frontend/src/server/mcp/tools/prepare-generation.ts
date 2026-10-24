import {MAX_GENERATION_REFERENCES} from '@/lib/generation-reference-limits';
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
  z.object({ kind: z.literal('asset'), assetId: z.string(), role: referenceRole, slot: z.number().int().min(0).max(MAX_GENERATION_REFERENCES-1).optional() }).strict(),
  z.object({
    kind: z.literal('https'),
    url: z.string(),
    role: referenceRole,
    mediaKind: referenceMediaKind,
    slot: z.number().int().min(0).max(MAX_GENERATION_REFERENCES-1).optional(),
  }).strict(),
]);
export const canonicalSettingsSchema = z.object({
  keepAudio: z.boolean().nullable().default(null),
  safetyTolerance: z.number().int().min(0).max(4).nullable().default(null),
  audioSetting: z.string().trim().min(1).max(128).nullable().default(null),
  personGeneration: z.string().trim().min(1).max(128).nullable().default(null),
  compressionQuality: z.string().trim().min(1).max(128).nullable().default(null),
  promptAudioDirection: z.string().trim().min(1).max(4096).nullable().default(null),
  promptCameraDirection: z.string().trim().min(1).max(4096).nullable().default(null),
  promptEditInstruction: z.string().trim().min(1).max(4096).nullable().default(null),

  multiPrompt: z.array(z.object({
    prompt: z.string().trim().min(1).max(512),
    durationSec: z.number().int().min(1).max(15),
  }).strict()).min(1).max(6).nullable().default(null).describe(
    'Kling multi-shot scenes. Use only when get_model_details reports the multiPrompt setting; otherwise send null or omit it. Omit the top-level prompt text content for this form.',
  ),
  durationSec: z.number().int().min(1).max(86_400).nullable().default(null).describe(
    'Use settings.durationSec for requested output seconds. When get_model_details reports source_video duration, omit it or send null; the owned source supplies timing. Never use settings.duration.',
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
  extendDirection: z.enum(['forward', 'backward']).nullable().default(null),
  editControlMode: z.enum(['automatic', 'manual']).nullable().default(null),
  editPoseMode: z.enum(['default', 'on', 'off']).nullable().default(null),
  editDepthMode: z.enum(['default', 'on', 'off']).nullable().default(null),
  editNormalsMode: z.enum(['default', 'on', 'off']).nullable().default(null),
  editTrajectoryMode: z.enum(['default', 'on', 'off']).nullable().default(null),
  editFaceMode: z.enum(['default', 'on', 'off']).nullable().default(null),
  editFace: z.boolean().nullable().default(null),
  editKeyframeIndexes: z.string().max(4_096).nullable().default(null),
  reasoningLevel: z.enum(['low', 'high']).nullable().default(null),
  keyframeIndexes: z.string().max(4096).nullable().default(null).describe(
    'Use only when model details report keyframeIndexes. Unique integer frame positions, comma-separated in the same order as image references; FLUX 3 Max uses 24 fps and accepts 0 through durationSec × 24 inclusive.',
  ),
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
export const seedanceWorkflowSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('draft') }).strict(),
  z.object({ step: z.literal('final'), draftJobId: z.string().min(1).max(255).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u) }).strict(),
]);

const elementSlot = z.number().int().min(0).max(65);
const klingOwnedElementsSchema = z.array(z.discriminatedUnion('kind', [
  z.object({kind:z.literal('images'),frontalSlot:elementSlot,referenceSlots:z.array(elementSlot).min(1).max(3)}).strict(),
  z.object({kind:z.literal('video'),videoSlot:elementSlot}).strict(),
])).min(1).max(3).describe('Kling Modify only. Compose owned role=reference slots into subjects. Element slots must be assets; no URLs/provider IDs. Elements plus remaining guidance images: at most four.');

export const prepareGenerationInputSchema = z.object({
  schemaVersion: z.literal(1).nullable().default(null),
  surface: z.enum(['video', 'image']),
  engineId: z.string(),
  elements: klingOwnedElementsSchema.nullable().optional(),
  sourceJobId: z.string().min(1).max(255).nullable().default(null),
  sourceOutputId: z.string().min(1).max(255).nullable().default(null),
  operation: z.enum(['kling-reference', 'kling-edit', 'luma-extend']).nullable().default(null),
  mode: z.enum(CANONICAL_GENERATION_MODES).nullable().default(null),
  prompt: z.string().nullable().default(null),
  seedanceWorkflow: seedanceWorkflowSchema.nullable().default(null).describe(
    'Seedance 2.5 native Draft only: draft selects finalizable 480p; final uses an owned ready draftJobId and inherits creative facts. Omit for ordinary generation. For final, omit mode, prompt, settings and references.',
  ),
  settings: canonicalSettingsSchema.nullable().default(null),
  references: z.array(reference).max(MAX_GENERATION_REFERENCES).nullable().default(null),
  outputCount: z.number().int().min(1).max(15).nullable().default(null).describe(
    'Number of outputs. Video must use 1. Image limits are model-specific; read outputCount from get_model_details.',
  ),
}).strict();

function normalizePrepareGenerationInput(
  input: z.output<typeof prepareGenerationInputSchema>,
) {
  const { elements, ...rest } = input;
  return { ...omitNullishToolInput({
    ...rest,
    settings: input.settings === null ? null : omitNullishToolInput(input.settings),
  }), ...(elements ? {elements} : {}) };
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
        'For a finalizable Seedance 2.5 Draft use seedanceWorkflow.step=draft, never resolution alone. Finalization uses step=final with the owned ready draftJobId and inherited creative facts. Each step needs its own quote and approval; show returned workflow prices, with a future final price labeled as an estimate.',
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
        'After the quote, briefly invite another model, resolution, duration or budget for a new quote and price comparison; use compare_generation_prices for actual savings, never guess.',
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
