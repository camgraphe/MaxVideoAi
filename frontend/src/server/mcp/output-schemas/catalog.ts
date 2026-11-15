import * as z from 'zod/v4';
import { generationMode, mediaKind, referenceRole, strings } from './common';

const lifecycle = z.enum(['current', 'legacy', 'deep_legacy', 'retired']);
const successor = z.object({ id: z.string(), slug: z.string() }).passthrough().nullable();
const modelIdentity = {
  id: z.string(), label: z.string(), surface: z.enum(['video', 'image']),
  availability: z.string(), generationEnabled: z.boolean(), lifecycle, successor,
  recommendedByDefault: z.boolean(),
};
export const model = z.object({
  ...modelIdentity, modes: z.array(generationMode), aspectRatios: strings, resolutions: strings,
  maxDurationSec: z.number().nullable(), audio: z.boolean(), referenceImages: z.boolean(),
}).passthrough();
export const listModelsOutputSchema = z.object({ models: z.array(model) }).passthrough();
const nextRecommendation = z.enum(['calculate_project_budget', 'discuss_and_choose', 'clarify_requirements']);
export const recommendModelsOutputSchema = z.object({
  recommendations: z.array(z.object({
    rank: z.number(), model, reasons: strings, tradeoffs: strings, nextAction: nextRecommendation,
  }).passthrough()),
  nextAction: nextRecommendation, message: z.string().optional(),
}).passthrough();
const range = z.object({ min: z.number(), max: z.number() }).passthrough();
const reference = z.object({
  type: mediaKind, roles: z.array(referenceRole), assetRequired: z.boolean(),
  maxSizeMB: z.number().optional(), acceptedMimeTypes: strings.optional(), acceptedFileExtensions: strings.optional(),
  imageAspectRatio: range.optional(),
  assetRequiredWhen: z.object({ setting: z.literal('resolution'), values: strings }).passthrough().optional(),
  durationSec: z.object({ min: z.number().nullable(), max: z.number().nullable(), combinedMax: z.number().nullable() }).passthrough().optional(),
  required: z.boolean(), min: z.number().nullable(), max: z.number().nullable(),
}).passthrough();
const modeDetails = z.object({
  mode: generationMode, durationPolicy: z.enum(['requested', 'source_video', 'source_audio', 'source_generation']),
  duration: z.object({ options: z.array(z.number()).nullable(), range: range.nullable() }).passthrough().nullable(),
  resolutions: strings, aspectRatios: strings, fps: z.array(z.number()),
  audio: z.enum(['unavailable', 'optional', 'always_generated']),
  outputCount: range.extend({ default: z.number() }),
  settings: z.array(z.object({
    key: z.string(), type: z.enum(['boolean', 'number', 'text', 'enum', 'multi_prompt']), required: z.boolean(),
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).nullable(),
    min: z.number().nullable(), max: z.number().nullable(),
    default: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }).passthrough()),
  references: z.array(reference),
  referenceRequirement: z.object({ min: z.number(), alternatives: z.array(z.union([
    z.object({ type: mediaKind, roles: z.array(referenceRole) }).passthrough(),
    z.object({ setting: z.string() }).passthrough(),
  ])) }).passthrough().optional(),
}).passthrough();
export const getModelDetailsOutputSchema = z.object({
  ...modelIdentity, slug: z.string(), prelaunch: z.boolean(), modes: z.array(modeDetails),
  guidance: z.object({ engineId: z.string(), strengths: strings, bestFor: strings, considerations: strings, evidenceUrls: strings, reviewedAt: z.string() }).passthrough().nullable(),
  promptingSources: z.array(z.object({ id: z.string(), kind: z.literal('official_provider'), provider: z.string(), title: z.string(), url: z.string(), modes: z.array(generationMode), reviewedAt: z.string() }).passthrough()),
  links: z.object({ model: z.string().nullable(), pricing: z.string().nullable(), examples: z.string().nullable() }).passthrough(),
  catalogUpdatedAt: z.string().nullable(),
}).passthrough();
