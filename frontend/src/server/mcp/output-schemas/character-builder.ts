import { z } from 'zod/v4';
import { generationState } from './common';
import { generationRecoveryOutputSchema, prepareGenerationOutputSchema } from './generation';

const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const recipe = object({
  schemaVersion: z.literal(1), surface: z.literal('character-builder'),
  action: z.enum(['generate', 'full-body-fix', 'lighting-variant']),
  engineId: z.string(), engineLabel: z.string(), inputMode: z.enum(['t2i', 'i2i']), prompt: z.string(),
  builder: object({
    characterId: z.string().nullable().optional(),
    sourceMode: z.enum(['scratch', 'reference-image']),
    outputMode: z.enum(['portrait-reference', 'character-sheet']),
    consistencyMode: z.enum(['exploratory', 'balanced', 'strict']),
    referenceStrength: z.enum(['loose', 'balanced', 'strong']).nullable(),
    qualityMode: z.enum(['draft', 'final']), formatMode: z.enum(['standard', '2k', '4k']),
    referenceImages: z.array(object({ assetId: z.string(), role: z.enum(['identity', 'style']) })),
    traits: z.record(z.string(), z.unknown()),
    outputOptions: object({ fullBodyRequired: z.boolean(), includeCloseUps: z.boolean(),
      neutralStudioBackground: z.boolean(), preserveFacialDetails: z.boolean(), avoid3dRenderLook: z.boolean() }),
    advancedNotes: z.string(), mustRemainVisible: z.array(z.string()),
  }),
  lineage: object({ parentResultId: z.string().nullable().optional(), parentRunId: z.string().nullable().optional(),
    pinnedReferenceResultId: z.string().nullable().optional() }),
});
const retry = object({ tool: z.literal('get_character_builder_status'),
  arguments: object({ quoteId: z.string() }), afterSeconds: z.number() }).nullable();
const recovery = generationRecoveryOutputSchema.partial().extend({
  quoteId: z.string(), jobId: z.string().nullable(),
  status: z.union([generationState, z.literal('no_job')]), retry,
  saveSource: object({ jobId: z.string(), imageUrl: z.string() }).optional(),
}).superRefine((value, context) => {
  if (value.status === 'no_job') {
    if (value.jobId !== null || value.retry !== null || value.saveSource !== undefined)
      context.addIssue({ code: 'custom', message: 'An unsubmitted Builder quote cannot have a job, retry or save source.' });
    return;
  }
  const checked = generationRecoveryOutputSchema.safeParse({ ...value,
    retry: value.retry ? { ...value.retry, tool: 'get_generation_status', arguments: { jobId: value.jobId } } : null,
  });
  if (!checked.success)
    context.addIssue({ code: 'custom', message: 'A Builder job must contain complete generation recovery.' });
  if (value.saveSource && (value.status !== 'completed' || value.surface !== 'image' || value.saveSource.jobId !== value.jobId))
    context.addIssue({ code: 'custom', message: 'Only the completed Builder image can supply its canonical save source.' });
});

export const characterBuilderOutputSchemas = {
  prepare_character_builder: object({ kind: z.literal('wallet'), quoteId: z.string(),
    amountCents: z.number(), currency: z.string(), expiresAt: z.string(), topupRequired: z.boolean(),
    recipe, quote: prepareGenerationOutputSchema }),
  get_character_builder_quote: object({ quoteId: z.string(), amountCents: z.number(), currency: z.string(),
    expiresAt: z.string(), state: z.string(), jobId: z.string().nullable(), recipe }),
  confirm_character_builder: recovery,
  get_character_builder_status: recovery,
} as const;
