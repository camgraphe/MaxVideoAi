import { z } from 'zod/v4';
import { canonicalRequest, generationState } from './common';
import { generationRecoveryOutputSchema, prepareGenerationOutputSchema } from './generation';

const image = z.object({ jobId: z.string(), imageUrl: z.string(), thumbUrl: z.string() }).passthrough();
const summary = z.object({
  id: z.string(), name: z.string(), identity: image,
  lookCount: z.number(), createdAt: z.string(),
}).passthrough();
const character = summary.extend({
  identity: image.extend({ settingsSnapshot: z.record(z.string(), z.unknown()) }),
  looks: z.array(image.extend({
    id: z.string(), name: z.string(), createdAt: z.string(),
    settingsSnapshot: z.record(z.string(), z.unknown()),
  })),
  nextLookCursor: z.string().nullable(),
});
const passage = z.object({
  startSec: z.number(), endSec: z.number(), durationSec: z.number(),
  sourceId: z.string(), excerptId: z.string(),
}).passthrough();
const passages = z.object({ video: passage.optional(), audio: passage.optional() }).passthrough();
const retry = z.object({
  tool: z.literal('get_recast_status'),
  arguments: z.object({ quoteId: z.string() }).passthrough(),
  afterSeconds: z.number(),
}).passthrough().nullable();
// Both the short no-job result and the complete recovery DTO have an object root.
// Complete recovery is validated against the existing generation DTO below.
const recovery = generationRecoveryOutputSchema.partial().extend({
  quoteId: z.string(), jobId: z.string().nullable(),
  status: z.union([generationState, z.literal('no_job')]), retry,
}).superRefine((value, context) => {
  if (value.status === 'no_job') {
    if (value.jobId !== null || value.retry !== null)
      context.addIssue({ code: 'custom', message: 'A no-job Recast cannot have a job or retry.' });
    return;
  }
  const checked = generationRecoveryOutputSchema.safeParse({
    ...value,
    retry: value.retry ? {
      ...value.retry, tool: 'get_generation_status', arguments: { jobId: value.jobId },
    } : null,
  });
  if (!checked.success)
    context.addIssue({ code: 'custom', message: 'A Recast job must contain a complete generation recovery.' });
});

export const characterStudioOutputSchemas = {
  list_saved_characters: z.object({
    characters: z.array(summary), nextCursor: z.string().nullable(), characterBuilderUrl: z.string(),
  }).passthrough(),
  get_saved_character: character,
  save_character: z.object({ character, kind: z.enum(['character', 'look']) }).passthrough(),
  select_saved_character: z.object({
    characterId: z.string(), lookId: z.string().nullable(), name: z.string(),
    lookName: z.string().nullable(), assetId: z.string(), kind: z.literal('image'), jobId: z.string(),
  }).passthrough(),
  prepare_recast: z.object({
    kind: z.literal('wallet'), quoteId: z.string(), expiresAt: z.string(),
    amountCents: z.number(), currency: z.string(), topupRequired: z.boolean(),
    sourceSeconds: z.number(), audioSeconds: z.number(), passages, quote: prepareGenerationOutputSchema,
  }).passthrough(),
  confirm_recast: recovery,
  get_recast_quote: z.object({
    quoteId: z.string(), amountCents: z.number(), currency: z.string(), expiresAt: z.string(),
    state: z.string(), jobId: z.string().nullable(), summary: canonicalRequest,
    requestHash: z.string(), passages,
  }).passthrough(),
  get_recast_status: recovery,
} as const;
