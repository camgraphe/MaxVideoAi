import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';

export const STUDIO_CONVERSATION_MAX_REFERENCES=8;

export const conversationAspectRatioSchema = z.string().regex(/^(?:[1-9]\d{0,2}:[1-9]\d{0,2}|auto)$/);
const settingValue = z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()]);
export const conversationSettingsSchema = z.array(z.object({name: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,63}$/), value: settingValue}).strict()).max(32)
  .refine(values => new Set(values.map(value => value.name)).size === values.length, 'Choose each setting once.');
export function conversationSelectionSettings(values: z.infer<typeof conversationSettingsSchema> | null | undefined) {
  return Object.fromEntries(conversationSettingsSchema.parse(values ?? []).map(({name,value}) => [name,value]));
}
export const conversationReferenceSchema = z.object({
  ref: toolAssetRefSchema.refine(ref => ref.kind === 'image', 'Only image generation references are qualified.'),
  role: z.enum(['reference','source','first_frame','last_frame','mask']),
  slot: z.number().int().min(0).max(49).nullable().optional(),
}).strict();
const selection = {
  modelId: z.string().trim().min(1).max(128).nullable().optional(),
  settings: conversationSettingsSchema.nullable().optional(),
  outputCount: z.literal(1).nullable().optional(),
};
export const conversationSelectionFields = selection;
export const imageSelectionSchema = z.object({
  prompt: z.string().min(1).max(12000), aspectRatio: conversationAspectRatioSchema,
  ...selection, mode: z.enum(['t2i','i2i']).nullable().optional(),
  references: z.array(conversationReferenceSchema.refine(reference => reference.ref.type === 'asset', 'Attach a saved library image.')).max(STUDIO_CONVERSATION_MAX_REFERENCES).nullable().optional(),
}).strict();

const assetProperties = {type: 'string', enum: ['image']};
export const conversationImageRefProperties = {
  type: 'object', additionalProperties: false, required: ['type','assetId','kind'],
  properties: {type: {type: 'string', enum: ['asset']},assetId: {type: 'string'},kind: assetProperties},
};
export const conversationJobImageRefProperties = {
  type: 'object', additionalProperties: false, required: ['type','jobId','outputId','kind'],
  properties: {type: {type: 'string', enum: ['job-output']},jobId: {type: 'string'},outputId: {type: 'string'},kind: assetProperties},
};
export const conversationSelectionProperties = {
  modelId: {type: ['string','null']},
  settings: {type: ['array','null'], items: {type: 'object', additionalProperties: false, required: ['name','value'],
    properties: {name: {type: 'string'}, value: {type: ['string','number','boolean','null']}}}},
  outputCount: {type: ['integer','null'], enum: [1,null]},
};
export function conversationReferencesProperties(jobOutputs: boolean) {
  return {type: ['array','null'], items: {type: 'object', additionalProperties: false, required: ['ref','role','slot'], properties: {
    ref: jobOutputs ? {anyOf: [conversationImageRefProperties,conversationJobImageRefProperties]} : conversationImageRefProperties,
    role: {type: 'string',enum: ['reference','source','first_frame','last_frame','mask']},slot: {type: ['integer','null']},
  }}};
}
export const imageSelectionProperties = {
  prompt: {type: 'string'}, aspectRatio: {type: 'string'}, ...conversationSelectionProperties,
  mode: {type: ['string','null'], enum: ['t2i','i2i',null]}, references: conversationReferencesProperties(false),
};
