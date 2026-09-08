import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_LANGUAGE_VALUES,
  AUDIO_LYRIA3_BPM_VALUES,
  AUDIO_LYRIA3_MODEL_VALUES,
  AUDIO_LYRICS_MAX_LENGTH,
  AUDIO_MINIMAX_VOICE_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_PACK_VALUES,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES,
  AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_SEED_AUDIO_VOICE_VALUES,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_GENDER_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
} from '@/lib/audio-generation';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const audioGenerationSettingsSchema = z.object({
  script: optionalText(AUDIO_SCRIPT_MAX_LENGTH),
  lyrics: optionalText(AUDIO_LYRICS_MAX_LENGTH),
  mood: z.enum(AUDIO_MOOD_VALUES).optional(),
  intensity: z.enum(AUDIO_INTENSITY_VALUES).optional(),
  durationSec: z.number().int().positive().optional(),
  musicModel: z.enum(AUDIO_LYRIA3_MODEL_VALUES).optional(),
  musicBpm: z.number().refine((value) => (AUDIO_LYRIA3_BPM_VALUES as readonly number[]).includes(value)).optional(),
  musicEnabled: z.boolean().optional(),
  exportAudioFile: z.boolean().optional(),
  voiceModel: z.enum(['seed', 'minimax']).optional(),
  minimaxVoiceId: z.enum(AUDIO_MINIMAX_VOICE_VALUES).optional(),
  voiceGender: z.enum(AUDIO_VOICE_GENDER_VALUES).optional(),
  voiceProfile: z.enum(AUDIO_VOICE_PROFILE_VALUES).optional(),
  voiceDelivery: z.enum(AUDIO_VOICE_DELIVERY_VALUES).optional(),
  language: z.enum(AUDIO_LANGUAGE_VALUES).optional(),
  seedAudioVoice: z.enum(AUDIO_SEED_AUDIO_VOICE_VALUES).optional(),
  seedAudioOutputFormat: z.enum(AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES).optional(),
  seedAudioSampleRate: z.number().refine((value) => (AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES as readonly number[]).includes(value)).optional(),
  seedAudioSpeed: z.number().finite().optional(),
  seedAudioVolume: z.number().finite().optional(),
  seedAudioPitch: z.number().finite().optional(),
  locale: z.string().trim().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u).optional(),
}).strict();
const toolAssetRefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('asset'),
    assetId: z.string().trim().min(1).max(256),
    kind: z.enum(['image', 'video', 'audio']),
  }).strict(),
  z.object({
    type: z.literal('job-output'),
    jobId: z.string().trim().min(1).max(256),
    outputId: z.string().trim().min(1).max(256),
    kind: z.enum(['image', 'video', 'audio']),
  }).strict(),
]);

export const prepareAudioGenerationInputSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  surface: z.literal('audio'),
  engineId: z.string().trim().min(1).max(128),
  mode: z.enum(AUDIO_PACK_VALUES),
  prompt: z.string().trim().max(AUDIO_PROMPT_MAX_LENGTH),
  settings: audioGenerationSettingsSchema.optional(),
  references: z.array(z.object({
    role: z.enum(['source_video', 'voice_sample']),
    asset: toolAssetRefSchema,
  }).strict()).max(2).optional(),
  outputCount: z.literal(1).optional(),
}).strict();

export function registerPrepareAudioGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.prepareAudioGeneration) {
    throw new Error('prepare_audio_generation service is required when Audio publication is enabled.');
  }
  server.registerTool(
    'prepare_audio_generation',
    {
      title: 'Prepare a MaxVideoAI Audio generation',
      description:
        'Validates one exact Audio request and saves a short-lived quote with exact cents, currency, expiry, wallet balance, and confirmation requirement. It does not debit the wallet or contact a provider.',
      inputSchema: prepareAudioGenerationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(() => services.prepareAudioGeneration!(input, principal)),
  );
}
