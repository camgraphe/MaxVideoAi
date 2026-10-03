import {z} from 'zod';
import type {MediaFacts} from '@/lib/media-identity';

export const conversationReferencePreviewsSchema = z.object({
  refs: z.array(z.object({
    type: z.literal('asset'),
    assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u),
    kind: z.enum(['image', 'video', 'audio']),
  }).strict()).min(1).max(8),
}).strict();

/** Transient display access only. Never persist these URLs in requests or projects. */
export type ConversationReferencePreview = {
  assetId: string;
  kind: 'image' | 'video' | 'audio';
  name?: string;
  url: string;
  thumbUrl: string | null;
  expiresAt: string | null;
  durationSec: number | null;
  mediaFacts: MediaFacts | null;
};
