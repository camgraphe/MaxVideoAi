import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  AUDIO_MINIMAX_VOICE_VALUES, AUDIO_PACK_VALUES, AUDIO_PROMPT_MAX_LENGTH, AUDIO_SCRIPT_MAX_LENGTH, AUDIO_LYRICS_MAX_LENGTH,
  AUDIO_MOOD_VALUES, AUDIO_INTENSITY_VALUES, AUDIO_LANGUAGE_VALUES, AUDIO_VOICE_GENDER_VALUES,
  AUDIO_VOICE_PROFILE_VALUES, AUDIO_VOICE_DELIVERY_VALUES, AUDIO_LYRIA3_MODEL_VALUES,
  AUDIO_SEED_AUDIO_VOICE_VALUES, AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES, AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_LYRIA3_BPM_VALUES, getAudioPackConfig, type AudioGenerateRequestBody,
} from '@/lib/audio-generation';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { validateAudioGenerateRequest } from '@/server/audio/audio-generate-validation';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalNumber = z.number().finite().optional();
export const audioGenerationSettingsSchema = z.object({
  script: optionalText(AUDIO_SCRIPT_MAX_LENGTH), lyrics: optionalText(AUDIO_LYRICS_MAX_LENGTH),
  mood: z.enum(AUDIO_MOOD_VALUES).optional(), intensity: z.enum(AUDIO_INTENSITY_VALUES).optional(),
  durationSec: z.number().int().positive().optional(),
  musicModel: z.enum(AUDIO_LYRIA3_MODEL_VALUES).optional(),
  musicBpm: z.number().refine(value => (AUDIO_LYRIA3_BPM_VALUES as readonly number[]).includes(value)).optional(),
  musicEnabled: z.boolean().optional(), exportAudioFile: z.boolean().optional(),
  voiceModel: z.enum(['seed', 'minimax']).optional(), minimaxVoiceId: z.enum(AUDIO_MINIMAX_VOICE_VALUES).optional(),
  voiceGender: z.enum(AUDIO_VOICE_GENDER_VALUES).optional(), voiceProfile: z.enum(AUDIO_VOICE_PROFILE_VALUES).optional(),
  voiceDelivery: z.enum(AUDIO_VOICE_DELIVERY_VALUES).optional(), language: z.enum(AUDIO_LANGUAGE_VALUES).optional(),
  seedAudioVoice: z.enum(AUDIO_SEED_AUDIO_VOICE_VALUES).optional(),
  seedAudioOutputFormat: z.enum(AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES).optional(),
  seedAudioSampleRate: z.number().refine(value => (AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES as readonly number[]).includes(value)).optional(),
  seedAudioSpeed: optionalNumber, seedAudioVolume: optionalNumber, seedAudioPitch: optionalNumber,
  locale: z.string().trim().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
}).strict();

export const canonicalAudioRequestSchema = z.object({
  schemaVersion: z.literal(1), surface: z.literal('audio'), engineId: z.string().trim().min(1).max(128),
  mode: z.enum(AUDIO_PACK_VALUES), prompt: z.string().trim().max(AUDIO_PROMPT_MAX_LENGTH),
  settings: audioGenerationSettingsSchema,
  references: z.array(z.object({ role: z.enum(['source_video', 'voice_sample']), asset: toolAssetRefSchema }).strict()).max(2),
  outputCount: z.literal(1),
}).strict();
export type CanonicalAudioRequest = z.infer<typeof canonicalAudioRequestSchema>;

/** Identity only: the prepare/confirm services must resolve these owned references themselves. */
export function normalizeAudioGenerationRequest(value: unknown): CanonicalAudioRequest {
  const parsed = canonicalAudioRequestSchema.parse(value);
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > 24_576) throw new Error('Audio request is too large.');
  const config = getAudioPackConfig(parsed.mode);
  if (parsed.engineId !== config.engineId) throw new Error('Audio engine does not match the selected mode.');
  if (new Set(parsed.references.map(reference => reference.role)).size !== parsed.references.length) throw new Error('Duplicate audio reference role.');
  for (const reference of parsed.references) {
    if (reference.asset.kind !== (reference.role === 'source_video' ? 'video' : 'audio')) throw new Error('Audio reference kind does not match its role.');
    if (reference.role === 'source_video' && !config.requiresVideo && parsed.mode !== 'music_only') throw new Error('This audio mode does not use a source video.');
  }
  if (!config.includesVoice && parsed.settings.script !== undefined) throw new Error('Narration requires a voice mode.');
  if (parsed.mode === 'voice_only' && parsed.settings.durationSec !== undefined) throw new Error('Voice duration is determined by the narration.');
  // Placeholders are confined to synchronous semantic validation. They are never
  // stored in the request, fetched or forwarded to the provider execution owner.
  const normalized = validateAudioGenerateRequest({
    pack: parsed.mode, prompt: parsed.prompt, ...parsed.settings,
    ...(parsed.references.some(reference => reference.role === 'source_video') ? { sourceVideoUrl: 'owned-source-video' } : {}),
    ...(parsed.references.some(reference => reference.role === 'voice_sample') ? { voiceSampleUrl: 'owned-voice-sample' } : {}),
  });
  const settings = Object.fromEntries(Object.keys(parsed.settings).sort().flatMap(key => {
    const value = normalized[key as keyof typeof normalized];
    return value === null || value === undefined ? [] : [[key, value]];
  })) as CanonicalAudioRequest['settings'];
  return { schemaVersion: 1, surface: 'audio', engineId: config.engineId, mode: parsed.mode,
    prompt: normalized.prompt ?? '', settings,
    references: parsed.references.sort((left, right) => left.role.localeCompare(right.role, 'en')), outputCount: 1 };
}

export function hashCanonicalAudioRequest(value: CanonicalAudioRequest): string {
  return createHash('sha256').update(JSON.stringify(normalizeAudioGenerationRequest(value))).digest('hex');
}

/** URL arguments are resolved server evidence, never fields of the MCP request. */
export function audioRequestToGenerationBody(request: CanonicalAudioRequest, resolved: { sourceVideoUrl?: string; voiceSampleUrl?: string } = {}): AudioGenerateRequestBody {
  const normalized = normalizeAudioGenerationRequest(request);
  for (const reference of normalized.references) {
    if (!resolved[reference.role === 'source_video' ? 'sourceVideoUrl' : 'voiceSampleUrl']) throw new Error('Audio reference must be resolved before preparation.');
  }
  if (resolved.sourceVideoUrl && !normalized.references.some(reference => reference.role === 'source_video')) throw new Error('Unexpected resolved source video.');
  if (resolved.voiceSampleUrl && !normalized.references.some(reference => reference.role === 'voice_sample')) throw new Error('Unexpected resolved voice sample.');
  return { pack: normalized.mode, prompt: normalized.prompt, ...normalized.settings, ...resolved };
}
