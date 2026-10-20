import {z} from 'zod';
import type {MediaFacts} from '@/lib/media-identity';
import {STUDIO_CONVERSATION_MAX_ATTACHMENTS} from './conversation-creation-contract';

export const conversationReferencePreviewsSchema = z.object({
  refs: z.array(z.object({
    type: z.literal('asset'),
    assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u),
    kind: z.enum(['image', 'video', 'audio']),
  }).strict()).min(1).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS),
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
