import * as z from 'zod/v4';
import { canonicalRequest, destination, generationState, mediaKind, preparedQuoteFields, strings } from './common';

export const prepareGenerationOutputSchema = z.object({ ...preparedQuoteFields, summary: canonicalRequest, fundingMode: z.enum(['wallet', 'trial']) }).passthrough();
const generationResult = z.discriminatedUnion('surface', [
  z.object({ surface: z.literal('video'), videoUrl: z.string(), previewUrl: z.string().nullable(), thumbnailUrl: z.string().nullable(), audioUrl: z.string().nullable() }).passthrough(),
  z.object({ surface: z.literal('image'), imageUrls: strings, thumbnailUrls: strings }).passthrough(),
  z.object({ surface: z.literal('audio'), audioUrl: z.string().nullable(), videoUrl: z.string().nullable(), thumbnailUrl: z.string().nullable(), mimeType: z.string(), durationSec: z.number().nullable() }).passthrough(),
]);
export const generationStatusFields = {
  jobId: z.string(), surface: mediaKind, status: generationState, progress: z.number().nullable(),
  message: z.string().nullable(), priceCents: z.number().nullable(), currency: z.string().nullable(), paymentStatus: z.string().nullable(),
  needsAttention: z.boolean().optional(),
};
export const generationRecoveryOutputSchema = z.object({
  openUrl: z.string().url().optional(),
  ...generationStatusFields, failureCode: z.string().optional(), funding: z.literal('included_trial').optional(),
  entitlementState: z.enum(['reserved', 'consumed', 'released']).optional(), result: generationResult.nullable(),
  library: destination, workspace: destination, savedToLibrary: z.boolean(),
  retry: z.object({ tool: z.literal('get_generation_status'), arguments: z.object({ jobId: z.string() }).passthrough(), afterSeconds: z.number() }).passthrough().nullable(),
}).passthrough();
export const listRecentGenerationsOutputSchema = z.object({ items: z.array(generationRecoveryOutputSchema), nextCursor: z.string().nullable() }).passthrough();
export const generationDownload = z.object({ url: z.string(), filename: z.string(), expiresAt: z.string() }).passthrough().nullable();
export const presentGenerationOutputSchema = generationRecoveryOutputSchema.extend({ download: generationDownload });
