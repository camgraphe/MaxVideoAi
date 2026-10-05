import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {AUDIO_LANGUAGE_VALUES, AUDIO_MOOD_VALUES,AUDIO_PACK_VALUES} from '@/lib/audio-generation';
import {CANONICAL_VIDEO_GENERATION_MODES} from '@/server/agent-api/generation-types';
import {conversationAspectRatioSchema,conversationSelectionFields,conversationSelectionProperties} from './conversation-creation-contract';
import {STUDIO_CONVERSATION_MAX_REFERENCES,conversationPreparationReplyProperty,conversationCreationPromptProperty} from './conversation-creation-contract';

const reply = z.string().min(1).max(2400);
export const conversationMediaReferenceSchema=z.object({ref:toolAssetRefSchema,role:z.enum(['reference','source','first_frame','last_frame','mask']),slot:z.number().int().min(0).max(49).nullable().optional()}).strict();
const audioReferences=z.array(z.object({role:z.enum(['source_video','voice_sample']),asset:toolAssetRefSchema}).strict()).max(2).nullable().optional();
export const studioVideoActionSchema = z.object({
  action: z.literal('video.prepare'), reply, prompt: z.string().min(1).max(12000),
  aspectRatio: conversationAspectRatioSchema, source: toolAssetRefSchema.nullable(),
  ...conversationSelectionFields, mode: z.enum(CANONICAL_VIDEO_GENERATION_MODES).nullable().optional(),
  references: z.array(conversationMediaReferenceSchema).max(STUDIO_CONVERSATION_MAX_REFERENCES).nullable().optional(),
}).strict();
export const studioVoiceActionSchema = z.object({
  action: z.literal('voice.prepare'), reply, script: z.string().trim().min(1).max(5000), language: z.enum(AUDIO_LANGUAGE_VALUES),
  ...conversationSelectionFields,references:audioReferences,
}).strict();
export const studioMusicActionSchema = z.object({
  action: z.literal('music.prepare'), reply, prompt: z.string().trim().min(1).max(2500), mood: z.enum(AUDIO_MOOD_VALUES),
  ...conversationSelectionFields,references:audioReferences,
}).strict();
export const studioAudioActionSchema=z.object({action:z.literal('audio.prepare'),reply,prompt:z.string().max(12000),mode:z.enum(AUDIO_PACK_VALUES),...conversationSelectionFields,references:audioReferences}).strict();
export const studioMediaIntentSchema = z.discriminatedUnion('action', [studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema,studioAudioActionSchema]);
export type StudioMediaIntent = z.infer<typeof studioMediaIntentSchema>;

export function conversationMediaRefProperties(jobOutputs=true,kinds:readonly string[]=['image','video','audio']) {return {anyOf:kinds.flatMap(kind=>[
  {type:'object',additionalProperties:false,required:['type','assetId','kind'],properties:{type:{type:'string',enum:['asset']},assetId:{type:'string'},kind:{type:'string',enum:[kind]}}},
  ...(jobOutputs?[{type:'object',additionalProperties:false,required:['type','jobId','outputId','kind'],properties:{type:{type:'string',enum:['job-output']},jobId:{type:'string'},outputId:{type:'string'},kind:{type:'string',enum:[kind]}}}]:[]),
])};}
export function conversationMediaReferencesProperties(jobOutputs=true){return {type:['array','null'],maxItems:STUDIO_CONVERSATION_MAX_REFERENCES,items:{type:'object',additionalProperties:false,required:['ref','role','slot'],properties:{ref:conversationMediaRefProperties(jobOutputs),role:{type:'string',enum:['reference','source','first_frame','last_frame','mask']},slot:{type:['integer','null'],minimum:0,maximum:49,description:'Use an ordered zero-based slot only when model_details permits ordered source/reference media; otherwise null.'}}}};}
const source={anyOf:[...conversationMediaRefProperties().anyOf,{type:'null'}]};
const audioReferenceProperties={type:['array','null'],maxItems:2,items:{type:'object',additionalProperties:false,required:['role','asset'],properties:{role:{type:'string',enum:['source_video','voice_sample']},asset:conversationMediaRefProperties(true,['video','audio'])}}};
export const STUDIO_MEDIA_DIRECTOR_TOOLS = [
  {action: 'media.read', name: 'media_read', description: 'Read ready outputs generated in this project and their exact owned identities. No generation or charge.', properties: {}},
  {action: 'video.prepare', name: 'video_prepare', description: 'Prepare one exact video quote using an executable model, mode, settings and typed owned references from model_details. Supports creation, first/last frames, references, clip editing, extension, audio-to-video, retake and reframing when the selected model exposes that mode. Use durationSec, never duration; source-derived duration and temporal ranges must match measured media facts. Select exact attached assets or ready project outputs from media_read; never supply URLs. References guide generation, not timeline placement. Source is a single-input shortcut (image first frame, video/audio source); keep it null with explicit references. Success ends this turn, awaiting client confirmation.', properties: {reply: conversationPreparationReplyProperty, prompt: conversationCreationPromptProperty, aspectRatio: {type: 'string'}, source, ...conversationSelectionProperties, mode: {type: ['string','null'],enum: [...CANONICAL_VIDEO_GENERATION_MODES,null]}, references: conversationMediaReferencesProperties()}},
  {action: 'voice.prepare', name: 'voice_prepare', description: 'Write narration and choose an available voice variant and supported settings from model_details. Duration follows the script. A supported voice_sample reference selects an exact owned attached sample or ready project output. Preserve the requested speaker only with a supported sample variant. Success ends this turn with a quote requiring explicit client confirmation.', properties: {reply: conversationPreparationReplyProperty, script: {type: 'string',description: 'Preserve the requested narration verbatim, including accents and punctuation, unless the client asks for a rewrite.'}, language: {type: 'string', enum: [...AUDIO_LANGUAGE_VALUES]}, ...conversationSelectionProperties,references:audioReferenceProperties}},
  {action: 'music.prepare', name: 'music_prepare', description: 'Write music direction and choose available duration and settings from model_details. Select source_video only when supported by this pack; it is measured video context, not continuation of an audio recording. Success ends this turn with an exact quote requiring explicit client confirmation.', properties: {reply: conversationPreparationReplyProperty, prompt: {type: 'string'}, mood: {type: 'string', enum: [...AUDIO_MOOD_VALUES]}, ...conversationSelectionProperties,references:audioReferenceProperties}},
  {action:'audio.prepare',name:'audio_prepare',description:'Prepare one exact Audio quote for an available pack: music, narration, sound effects, song, ambience, cinematic sound design or cinematic narration. Inspect model_details and audioWorkflow for exact settings and required, optional or unsupported source_video and voice_sample roles. Cinematic packs require source_video; they add sound to an existing clip while preserving its picture. For a new video from an image or prompt, use video_prepare with supported generated audio. References must be currently attached owned media or ready project outputs; no URLs. Keep narration/lyrics exact in settings. Success ends this turn awaiting explicit client confirmation.',properties:{reply:conversationPreparationReplyProperty,prompt:{type:'string'},mode:{type:'string',enum:[...AUDIO_PACK_VALUES]},...conversationSelectionProperties,references:audioReferenceProperties}},
] as const;
