import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {AUDIO_LANGUAGE_VALUES, AUDIO_MOOD_VALUES} from '@/lib/audio-generation';

const reply = z.string().min(1).max(2400);
export const studioVideoActionSchema = z.object({
  action: z.literal('video.prepare'), reply, prompt: z.string().min(1).max(12000),
  aspectRatio: z.enum(['16:9', '9:16']), source: toolAssetRefSchema.refine(ref => ref.kind === 'image').nullable(),
}).strict();
export const studioVoiceActionSchema = z.object({
  action: z.literal('voice.prepare'), reply, script: z.string().trim().min(1).max(5000), language: z.enum(AUDIO_LANGUAGE_VALUES),
}).strict();
export const studioMusicActionSchema = z.object({
  action: z.literal('music.prepare'), reply, prompt: z.string().trim().min(1).max(2500), mood: z.enum(AUDIO_MOOD_VALUES),
}).strict();
export const studioMediaIntentSchema = z.discriminatedUnion('action', [studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema]);
export type StudioMediaIntent = z.infer<typeof studioMediaIntentSchema>;

const source = {anyOf: [
  {type: 'object', additionalProperties: false, required: ['type','assetId','kind'], properties: {type: {type: 'string', enum: ['asset']}, assetId: {type: 'string'}, kind: {type: 'string', enum: ['image']}}},
  {type: 'object', additionalProperties: false, required: ['type','jobId','outputId','kind'], properties: {type: {type: 'string', enum: ['job-output']}, jobId: {type: 'string'}, outputId: {type: 'string'}, kind: {type: 'string', enum: ['image']}}},
  {type: 'null'},
]};
export const STUDIO_MEDIA_DIRECTOR_TOOLS = [
  {action: 'media.read', name: 'media_read', description: 'Read ready outputs generated in this project and their exact owned identities. No generation or charge.', properties: {}},
  {action: 'video.prepare', name: 'video_prepare', description: 'Write a motion prompt yourself and prepare one economic 5-second, 480p, silent video quote. Source is an attached image asset or an exact ready project image from media_read; null creates without a reference. Ends this turn, awaiting client confirmation.', properties: {reply: {type: 'string'}, prompt: {type: 'string'}, aspectRatio: {type: 'string', enum: ['16:9','9:16']}, source}},
  {action: 'voice.prepare', name: 'voice_prepare', description: 'Write the narration yourself and prepare one voice-only quote. Duration follows the script. Ends this turn; requires explicit client confirmation.', properties: {reply: {type: 'string'}, script: {type: 'string'}, language: {type: 'string', enum: [...AUDIO_LANGUAGE_VALUES]}}},
  {action: 'music.prepare', name: 'music_prepare', description: 'Write an instrumental music direction and prepare one 30-second clip quote. Ends this turn; requires explicit client confirmation.', properties: {reply: {type: 'string'}, prompt: {type: 'string'}, mood: {type: 'string', enum: [...AUDIO_MOOD_VALUES]}}},
] as const;
