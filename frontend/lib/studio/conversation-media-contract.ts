import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {AUDIO_LANGUAGE_VALUES, AUDIO_MOOD_VALUES} from '@/lib/audio-generation';
import {conversationAspectRatioSchema,conversationSelectionFields,conversationSelectionProperties,conversationReferenceSchema,conversationReferencesProperties,conversationImageRefProperties,conversationJobImageRefProperties} from './conversation-creation-contract';
import {STUDIO_CONVERSATION_MAX_REFERENCES} from './conversation-creation-contract';

const reply = z.string().min(1).max(2400);
export const studioVideoActionSchema = z.object({
  action: z.literal('video.prepare'), reply, prompt: z.string().min(1).max(12000),
  aspectRatio: conversationAspectRatioSchema, source: toolAssetRefSchema.refine(ref => ref.kind === 'image').nullable(),
  ...conversationSelectionFields, mode: z.enum(['t2v','i2v','ref2v','fl2v']).nullable().optional(),
  references: z.array(conversationReferenceSchema).max(STUDIO_CONVERSATION_MAX_REFERENCES).nullable().optional(),
}).strict();
export const studioVoiceActionSchema = z.object({
  action: z.literal('voice.prepare'), reply, script: z.string().trim().min(1).max(5000), language: z.enum(AUDIO_LANGUAGE_VALUES),
  ...conversationSelectionFields,
}).strict();
export const studioMusicActionSchema = z.object({
  action: z.literal('music.prepare'), reply, prompt: z.string().trim().min(1).max(2500), mood: z.enum(AUDIO_MOOD_VALUES),
  ...conversationSelectionFields,
}).strict();
export const studioMediaIntentSchema = z.discriminatedUnion('action', [studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema]);
export type StudioMediaIntent = z.infer<typeof studioMediaIntentSchema>;

const source = {anyOf: [
  conversationImageRefProperties, conversationJobImageRefProperties,
  {type: 'null'},
]};
export const STUDIO_MEDIA_DIRECTOR_TOOLS = [
  {action: 'media.read', name: 'media_read', description: 'Read ready outputs generated in this project and their exact owned identities. No generation or charge.', properties: {}},
  {action: 'video.prepare', name: 'video_prepare', description: 'Write the video prompt and select a model, mode, settings and image reference roles from model_details. For the requested duration in seconds, use a settings entry named durationSec, never duration. References guide generation; they are not timeline clips. Source is the legacy first-frame shortcut; keep it null when selecting references. Null selection fields use defaults. Ends this turn with one exact quote, awaiting client confirmation.', properties: {reply: {type: 'string'}, prompt: {type: 'string'}, aspectRatio: {type: 'string'}, source, ...conversationSelectionProperties, mode: {type: ['string','null'],enum: ['t2v','i2v','ref2v','fl2v',null]}, references: conversationReferencesProperties(true)}},
  {action: 'voice.prepare', name: 'voice_prepare', description: 'Write the narration and choose an available voice variant and supported settings from model_details. Duration follows the script. Null selection fields use defaults. Ends this turn; requires explicit client confirmation.', properties: {reply: {type: 'string'}, script: {type: 'string'}, language: {type: 'string', enum: [...AUDIO_LANGUAGE_VALUES]}, ...conversationSelectionProperties}},
  {action: 'music.prepare', name: 'music_prepare', description: 'Write music direction and select an available variant, duration and supported settings from model_details. Null selection fields use defaults. Ends this turn with an exact quote; requires explicit client confirmation.', properties: {reply: {type: 'string'}, prompt: {type: 'string'}, mood: {type: 'string', enum: [...AUDIO_MOOD_VALUES]}, ...conversationSelectionProperties}},
] as const;
