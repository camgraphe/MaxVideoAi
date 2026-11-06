import { z } from 'zod';
import { RECAST_FRAMINGS, RECAST_RESOLUTIONS } from '@/lib/character-studio-recast-format';
import { mediaExcerptDuration } from '@/lib/media-excerpt-timing';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { conversationPreparationReplyProperty } from './conversation-creation-contract';
import { conversationMediaRefProperties } from './conversation-media-contract';

const id = z.string().regex(/^[1-9]\d{0,17}$/);
const name = z.string().trim().min(1).max(80);
const range = z.object({startSec:z.number().finite().nonnegative(),endSec:z.number().finite().positive()})
  .strict().refine(value => value.endSec > value.startSec && mediaExcerptDuration(value) <= 15);
const image = toolAssetRefSchema.refine(ref => ref.kind === 'image');
const track = (kind: 'video' | 'audio') => z.object({ref:toolAssetRefSchema.refine(ref => ref.kind === kind),range}).strict();
export const studioCharacterListSchema = z.object({
  action:z.literal('character.list'),name:name.nullable().optional(),cursor:id.nullable().optional(),
}).strict();
export const studioCharacterGetSchema = z.object({
  action:z.literal('character.get'),characterId:id,lookName:name.nullable().optional(),lookCursor:id.nullable().optional(),
}).strict();
export const studioCharacterSelectionSchema = z.object({
  characterId:id,lookId:id.nullable().optional(),
}).strict();
export const studioRecastActionSchema = z.object({
  action:z.literal('recast.prepare'),
  reply:z.string().min(1).max(2400),
  portrait:z.union([studioCharacterSelectionSchema,image]),
  product:image.nullable().optional(),
  video:track('video').nullable().optional(),
  audio:track('audio').nullable().optional(),
  direction:z.string().trim().max(2000),
  dialogue:z.string().trim().max(500),
  seconds:z.number().int().min(2).max(30),
  resolution:z.enum(RECAST_RESOLUTIONS),
  aspectRatio:z.enum(RECAST_FRAMINGS),
}).strict();

export type StudioRecastIntent = z.infer<typeof studioRecastActionSchema>;
export function validateStudioRecast(value: StudioRecastIntent, context: z.RefinementCtx) {
  if (!value.direction && !value.dialogue && !value.video && !value.audio)
    context.addIssue({code:'custom',message:'Add direction, dialogue, video or audio.'});
  if (value.video && value.seconds + mediaExcerptDuration(value.video.range) > 30)
    context.addIssue({code:'custom',message:'Selected video passage and output must total at most 30 seconds.'});
}
export type StudioCharacterList = {characters:{id:string;name:string;lookCount:number}[];nextCursor:string|null};
export type StudioCharacterDetails = {id:string;name:string;looks:{id:string;name:string}[];nextLookCursor:string|null};

const idProperty = {type:'string',pattern:'^[1-9][0-9]{0,17}$'};
const optionalId = {anyOf:[idProperty,{type:'null'}]};
const optionalName = {type:['string','null'],minLength:1,maxLength:80};
const trackProperty = (kind:'audio'|'video') => ({anyOf:[
  {type:'object',additionalProperties:false,required:['ref','range'],properties:{
    ref:conversationMediaRefProperties(true,[kind]),
    range:{type:'object',additionalProperties:false,required:['startSec','endSec'],properties:{
      startSec:{type:'number',minimum:0},endSec:{type:'number',minimum:0},
    }},
  }},{type:'null'},
]});
const imageRefs = conversationMediaRefProperties(true,['image']).anyOf;

export const STUDIO_CHARACTER_DIRECTOR_TOOLS = [
  {action:'character.list',name:'character_list',description:'Find saved Character Studio identities by exact name, case-insensitively. Use null name to browse, null cursor for the first page. Duplicate names have distinct IDs. No generation or wallet charge.',properties:{name:optionalName,cursor:optionalId}},
  {action:'character.get',name:'character_get',description:'Read one saved character by exact ID and find a saved look by exact name, case-insensitively. Use null lookName to browse and null lookCursor for the first page. Ask which look if multiple match. No generation or wallet charge.',properties:{characterId:idProperty,lookName:optionalName,lookCursor:optionalId}},
  {action:'recast.prepare',name:'recast_prepare',description:'Prepare one exact Character Studio Recast quote. Use an exact saved character and look ID, an attached portrait or a ready project image. Select each optional video and audio range independently, preserving the requested source times. Each passage is up to 15 seconds and video passage plus output is up to 30 seconds. Product, video and audio must be attached or ready project outputs. Preserve exact dialogue and direction, output duration, resolution and framing. Null for omitted sources; never use a URL. Success ends this turn for client confirmation.',properties:{
    reply:conversationPreparationReplyProperty,
    portrait:{anyOf:[
      {type:'object',additionalProperties:false,required:['characterId','lookId'],properties:{characterId:idProperty,lookId:optionalId}},
      ...imageRefs,
    ]},
    product:{anyOf:[...imageRefs,{type:'null'}]},video:trackProperty('video'),audio:trackProperty('audio'),
    direction:{type:'string',maxLength:2000},dialogue:{type:'string',maxLength:500},
    seconds:{type:'integer',minimum:2,maximum:30},
    resolution:{type:'string',enum:RECAST_RESOLUTIONS},aspectRatio:{type:'string',enum:RECAST_FRAMINGS},
  }},
] as const;
