import * as z from 'zod/v4';
import { CANONICAL_GENERATION_MODES } from '@/server/agent-api/generation-types';

// Validate the authored DTO, while preserving additive fields in both response
// representations. The SDK validates without replacing the returned object.
export const strings = z.array(z.string());
export const mediaKind = z.enum(['image', 'video', 'audio']);
export const generationMode = z.enum(CANONICAL_GENERATION_MODES);
export const referenceRole = z.enum(['source', 'reference', 'first_frame', 'middle_frame', 'last_frame', 'mask']);
export const money = z.object({ amountCents: z.number(), currency: z.string() }).passthrough();
export const destination = z.object({
  type: z.literal('open_url'),
  purpose: z.enum(['account_connections', 'billing', 'media_library', 'video_workspace', 'image_workspace', 'support', 'generation', 'reference_upload']),
  label: z.string(), url: z.string(),
}).passthrough();
export const generationState = z.enum(['accepted', 'running', 'completed', 'failed']);
export const settingValue = z.union([
  z.string(), z.number(), z.boolean(), z.null(),
  z.array(z.object({ prompt: z.string(), durationSec: z.number() }).passthrough()),
]);
const referenceBase = { role: referenceRole, slot: z.number().optional() };
export const canonicalRequest = z.object({
  schemaVersion: z.literal(1), surface: z.enum(['video', 'image']),
  engineId: z.string(), mode: generationMode, prompt: z.string(),
  settings: z.record(z.string(), settingValue),
  references: z.array(z.discriminatedUnion('kind', [
    z.object({ ...referenceBase, kind: z.literal('asset'), assetId: z.string() }).passthrough(),
    z.object({ ...referenceBase, kind: z.literal('https'), url: z.string(), mediaKind }).passthrough(),
  ])),
  outputCount: z.number(),
}).passthrough();
export const preparedQuoteFields = {
  quoteId: z.string(), expiresAt: z.string(), requestHash: z.string(), price: money,
  balance: z.object({ beforeCents: z.number(), afterCents: z.number() }).passthrough(),
  confirmationRequired: z.literal(true), topupRequired: z.boolean(),
};
