import {z} from 'zod';
import {z as schema4} from 'zod/v4';
import {characterBuilderAuthoringInput} from '@/lib/character-builder-authoring';

/** Derive native strict properties from the same canonical Builder schema as MCP. */
type JsonSchema={type?:string;properties?:Record<string,JsonSchema>;required?:string[];items?:JsonSchema;anyOf?:JsonSchema[];[key:string]:unknown};
const original=schema4.toJSONSchema(characterBuilderAuthoringInput) as JsonSchema;
function nativeSchema(value:JsonSchema):JsonSchema {
  const result={...value};delete result.$schema;
  if(value.properties){
    result.properties=Object.fromEntries(Object.entries(value.properties).map(([key,child])=>{
      const schema=nativeSchema(child);
      return [key,value.required?.includes(key)?schema:{anyOf:[schema,{type:'null'}]}];
    }));
    result.required=Object.keys(value.properties);result.additionalProperties=false;
  }
  if(value.items)result.items=nativeSchema(value.items);
  if(value.anyOf)result.anyOf=value.anyOf.map(nativeSchema);
  return result;
}
function omittedNulls(value:unknown,schema:JsonSchema):unknown {
  if(Array.isArray(value))return value.map(item=>omittedNulls(item,schema.items??{}));
  if(value&&typeof value==='object'&&schema.properties)return Object.fromEntries(Object.entries(value).flatMap(([key,item])=>
    item===null&&!schema.required?.includes(key)?[]:[[key,omittedNulls(item,schema.properties?.[key]??{})]]));
  return value;
}
export function parseStudioCharacterRecipe(value:unknown){return characterBuilderAuthoringInput.parse(omittedNulls(value,original));}
export const studioCharacterBuilderActionSchema=z.object({action:z.literal('character.prepare'),reply:z.string().min(1).max(2400),recipe:z.record(z.unknown())}).strict();
export type StudioCharacterBuilderIntent=z.infer<typeof studioCharacterBuilderActionSchema>;
export function validateStudioCharacterBuilder(value:StudioCharacterBuilderIntent,context:z.RefinementCtx){
  try{parseStudioCharacterRecipe(value.recipe);}catch{context.addIssue({code:'custom',message:'Choose canonical Character Builder traits and owned image references.'});}
}
export const STUDIO_CHARACTER_AUTHORING_DIRECTOR_TOOLS=[{action:'character.prepare',name:'character_prepare',
  description:'Author one reusable Character Studio identity or a look of a saved character, using the canonical Builder recipe. Use custom descriptions for details outside preset choices. References are exact attached owned image asset IDs; never use URLs or generic image_prepare as a substitute for a saveable Builder recipe. A saved characterId preserves its identity while styling/scene can change. Find exact IDs with character_list/get. Null recipe fields use Builder defaults. Prepare only on request; success presents the exact recipe and quote and ends this turn. The client alone approves one paid attempt in the quote card; no confirmation function is available.',
  properties:{reply:{type:'string',minLength:1,maxLength:2400},recipe:nativeSchema(original)},
}] as const;

export const studioCharacterSaveActionSchema=z.object({action:z.literal('character.save'),quoteId:z.string().uuid(),name:z.string().trim().min(1).max(80)}).strict();
export const studioCharacterSelectActionSchema=z.object({action:z.literal('character.select'),characterId:z.string().regex(/^[1-9]\d{0,17}$/),lookId:z.string().regex(/^[1-9]\d{0,17}$/).nullable().optional()}).strict();
export type StudioCharacterSaveResult={kind:'character'|'look';characterId:string;name:string;lookId:string|null;lookName:string|null};
export type StudioCharacterSelectResult={characterId:string;lookId:string|null;name:string;lookName:string|null;assetId:string;kind:'image';jobId:string};
export const STUDIO_CHARACTER_LIBRARY_DIRECTOR_TOOLS=[
  {action:'character.save',name:'character_save',description:'Save a completed Character Builder result only when the client asks to save/name it. Use its exact quoteId from this project and the requested name. The server resolves the owned original and real Builder recipe; a generic image is never saveable as a Builder result. The recipe decides new identity versus a look of its original parent; name labels that identity or look. Saving is idempotent and does not generate or charge. Announce a saved character/look only after a successful result.',properties:{quoteId:{type:'string',format:'uuid'},name:{type:'string',minLength:1,maxLength:80}}},
  {action:'character.select',name:'character_select',description:'Select an exact saved Character Studio identity or look chosen by the client. Resolve names with character_list/get first; preserve characterId and exact lookId, or null for the base identity. Returns its owned original asset ID for a Character Builder reference in this project. Recast accepts these saved IDs directly. Generic image/video creation still requires attaching the saved item in the library or selecting a ready project output. No generation or charge.',properties:{characterId:{type:'string',pattern:'^[1-9][0-9]{0,17}$'},lookId:{type:['string','null'],pattern:'^[1-9][0-9]{0,17}$'}}},
] as const;
