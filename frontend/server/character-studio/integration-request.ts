import { z } from 'zod';
import { recastSettingsObject, validRecastDirection, validRecastDuration } from './recast-request';

const id = z.string().regex(/^[1-9]\d{0,17}$/);
const name = z.string().trim().min(1).max(80);
export const characterListInput = z.object({ cursor: id.nullable().optional(), name: name.optional() }).strict();
export const characterGetInput = z.object({ characterId: id, lookCursor: id.nullable().optional(), lookName: name.optional() }).strict();
export const characterSelectionInput = z.object({ characterId: id, lookId: id.nullable().optional() }).strict();
export const characterSaveInput = z.object({ name, jobId: z.string().min(1).max(160), imageUrl: z.string().min(1).max(4096) }).strict();
export const recastQuoteInput = z.object({ quoteId: z.string().uuid() }).strict();
export const recastConfirmationInput = recastQuoteInput.extend({
  confirmed: z.literal(true), amountCents: z.number().int().nonnegative(), currency: z.literal('USD'),
}).strict();
export const integrationRecastSettings = recastSettingsObject.extend({
  portrait: z.union([recastSettingsObject.shape.portrait, characterSelectionInput]),
}).strict().refine(validRecastDirection).refine(validRecastDuration);
export type CharacterStudioRecastInput = z.infer<typeof integrationRecastSettings>;
