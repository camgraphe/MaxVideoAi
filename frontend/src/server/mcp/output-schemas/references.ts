import * as z from 'zod/v4';
import { destination, mediaKind, strings } from './common';

const mediaItem = z.object({
  assetId: z.string(), kind: mediaKind, label: z.string().nullable(), width: z.number().nullable(), height: z.number().nullable(), durationSec: z.number().nullable(),
  mimeType: z.string(), previewUrl: z.string().nullable(), source: z.enum(['upload', 'generated', 'imported']), createdAt: z.string(),
}).passthrough();
export const listMediaOutputSchema = z.object({ items: z.array(mediaItem), nextCursor: z.string().nullable(), hasMore: z.boolean() }).passthrough();
export const createReferenceUploadLinkOutputSchema = z.object({
  destination, expiresAt: z.string(), mediaKind, accepted: strings, maxBytes: z.number(), library: destination,
  nextAction: z.object({ tool: z.literal('list_media'), arguments: z.object({ kind: mediaKind }).passthrough() }).passthrough(),
}).passthrough();
export const importReferenceFilesOutputSchema = z.object({
  assets: z.array(z.object({ index: z.number(), assetId: z.string(), kind: mediaKind, fileName: z.string(), mimeType: z.string(), sizeBytes: z.number() }).passthrough()),
  failures: z.array(z.object({ index: z.number(), fileName: z.string().nullable(), code: z.string() }).passthrough()),
  library: destination,
}).passthrough();
