import { z } from 'zod/v4';
import { CHARACTER_TRAIT_OPTION_MAP, ACCESSORY_OPTIONS, DISTINCTIVE_FEATURE_OPTIONS } from '@/lib/character-builder';
import { STUDIO_CHARACTER_TYPES, STUDIO_EYES, STUDIO_SCENES } from '@/lib/character-studio-catalog';
import { isStudioColorTrait } from '@/lib/character-studio-colors';

const text = z.string().trim().max(1000);
const choices = (options:readonly {id:string}[],auto=false) =>
  z.enum([...new Set(options.map(option=>option.id)),...(auto?['auto']:[])] as [string,...string[]]);
const trait = <T extends z.ZodType>(value:T) => z.object({value:value.nullable(),source:z.enum(['auto','manual'])}).strict();
function field(key:keyof typeof CHARACTER_TRAIT_OPTION_MAP) {
  const values=choices(CHARACTER_TRAIT_OPTION_MAP[key],true);
  return trait(isStudioColorTrait(key)?z.union([values,z.string().regex(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i)]):values).optional();
}
/** The existing Builder fields, bounded at the private transport boundary. URLs are server-resolved. */
export const characterBuilderAuthoringInput = z.object({
  characterId:z.string().regex(/^[1-9]\d{0,17}$/).optional(),
  qualityMode:z.enum(['draft','final']).optional(),
  formatMode:z.enum(['standard','2k','4k']).optional(),
  outputMode:z.enum(['portrait-reference','character-sheet']).optional(),
  consistencyMode:z.enum(['exploratory','balanced','strict']).optional(),
  referenceStrength:z.enum(['loose','balanced','strong']).nullable().optional(),
  referenceImages:z.array(z.object({assetId:z.string().regex(/^ma_[a-f0-9]{32}$/),role:z.enum(['identity','style'])}).strict()).max(2).optional(),
  traits:z.object({
    characterType:trait(choices(STUDIO_CHARACTER_TYPES,true)).optional(),customCharacterDescription:text.optional(),
    genderPresentation:field('genderPresentation'),customGenderDescription:text.optional(),
    ageRange:field('ageRange'),skinTone:field('skinTone'),faceCues:field('faceCues'),
    hairEnabled:z.boolean().optional(),customHairDescription:text.optional(),hairColor:field('hairColor'),
    hairLength:field('hairLength'),hairstyle:field('hairstyle'),eyeColor:field('eyeColor'),eyeShape:trait(choices(STUDIO_EYES,true)).optional(),
    sceneId:choices(STUDIO_SCENES).nullable().optional(),customSceneDescription:text.optional(),
    bodyBuild:field('bodyBuild'),outfitEnabled:z.boolean().optional(),customOutfitDescription:text.optional(),
    outfitStyle:field('outfitStyle'),accessories:z.array(choices(ACCESSORY_OPTIONS)).max(20).optional(),
    distinctiveFeatures:z.array(choices(DISTINCTIVE_FEATURE_OPTIONS)).max(20).optional(),customDetailsDescription:text.optional(),
    realismStyle:z.enum(['photoreal','cinematic','stylized','animated']).optional(),
  }).strict().optional(),
  outputOptions:z.object({fullBodyRequired:z.boolean().optional(),includeCloseUps:z.boolean().optional(),
    neutralStudioBackground:z.boolean().optional(),preserveFacialDetails:z.boolean().optional(),avoid3dRenderLook:z.boolean().optional(),
  }).strict().optional(),
  advancedNotes:text.optional(),mustRemainVisible:z.array(z.string().trim().max(200)).max(20).optional(),
}).strict().refine(input=>new Set(input.referenceImages?.map(image=>image.role)).size === (input.referenceImages?.length??0),
  'Choose at most one identity and one style image.').refine(input=>!input.characterId || !input.referenceImages?.some(image=>image.role==='identity'),
  'A saved character supplies its own identity image.');
export const characterBuilderQuoteInput = z.object({quoteId:z.uuidv4()}).strict();
export const characterBuilderConfirmationInput = characterBuilderQuoteInput.extend({confirmed:z.literal(true),
  amountCents:z.number().int().nonnegative().max(2_147_483_647),currency:z.literal('USD')}).strict();
export type CharacterBuilderAuthoringInput = z.input<typeof characterBuilderAuthoringInput>;
export type CharacterBuilderConfirmationInput = z.input<typeof characterBuilderConfirmationInput>;
