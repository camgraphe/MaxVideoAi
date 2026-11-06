import { z } from 'zod';
import { recastSettingsObject, validRecastDirection, validRecastDuration } from './recast-request';

const id = z.string().regex(/^[1-9]\d{0,17}$/);
const name = z.string().trim().min(1).max(80);
export const characterListInput = z.object({ cursor: id.nullable().optional(), name: name.optional(), search: name.optional() }).strict();
export const characterGetInput = z.object({ characterId: id, lookCursor: id.nullable().optional(), lookName: name.optional() }).strict();
export const characterSelectionInput = z.object({ characterId: id, lookId: id.nullable().optional() }).strict();
export const characterSaveInput = z.object({ name, jobId: z.string().min(1).max(160), imageUrl: z.string().min(1).max(4096) }).strict();
export const RECAST_MAX_AMOUNT_CENTS = 2_147_483_647;
const quoteId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
export const recastQuoteInput = z.object({ quoteId }).strict();
export const recastConfirmationInput = recastQuoteInput.extend({
  confirmed: z.literal(true), amountCents: z.number().int().nonnegative().max(RECAST_MAX_AMOUNT_CENTS), currency: z.literal('USD'),
}).strict();
export const integrationRecastSettings = recastSettingsObject.extend({
  portrait: z.union([recastSettingsObject.shape.portrait, characterSelectionInput]),
}).strict().refine(validRecastDirection).refine(validRecastDuration);
export type CharacterStudioRecastInput = z.infer<typeof integrationRecastSettings>;
