import * as z from 'zod/v4';
import { canonicalRequest, generationMode, money, strings } from './common';

const editorialSummary = z.object({
  policyVersion: z.string(), basis: z.literal('product_editorial_preference'),
  level: z.enum(['reference', 'alternative', 'on_request']), rationale: z.string(),
  reviewedAt: z.string().nullable(),
  reviewStatus: z.enum(['current', 'review_due', 'unreviewed', 'not_yet_reviewed']),
}).passthrough();

const option = z.object({
  modelId: z.string(), modelLabel: z.string(), surface: z.enum(['image', 'video']), mode: generationMode,
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  outputCount: z.literal(1), outputDurationSec: z.number().optional(), referenceCount: z.number(),
  price: money.extend({ formattedAmount: z.string().optional() }),
  estimatedAt: z.string(), quoteRequired: z.literal(true),
  audio: z.enum(['optional', 'always_generated', 'unavailable']),
  references: canonicalRequest.shape.references, defaultedSettings: strings,
  editorialGuidance: editorialSummary, bestFor: strings,
  savings: z.object({
    baselineModelId: z.string(), amountCents: z.number(), percent: z.number(), configurationDiffers: z.boolean(),
  }).passthrough().optional(),
}).passthrough();

// Estimates share the canonical pricing DTO; output validation must retain all
// disclosed settings, currency exclusions and additive data in both results.
export const compareGenerationPricesOutputSchema = z.object({
  options: z.array(option), baseline: option.nullable(), comparisonCurrency: z.string().optional(),
  excludedCurrencies: z.array(z.object({ modelId: z.string(), currency: z.string() }).passthrough()).optional(),
  unavailable: z.array(z.object({ modelId: z.string(), code: z.string(), baseline: z.literal(true).optional() }).passthrough()),
  estimatedAt: z.string(), quoteRequired: z.literal(true),
}).passthrough();
