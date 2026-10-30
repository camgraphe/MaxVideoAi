import { z } from 'zod';
import type { ReviewProjection } from '@/server/assistant-review/context';

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
export const reviewIssues = ['context', 'references', 'model_guidance', 'settings', 'quality', 'tool_failure', 'latency', 'cost', 'other'] as const;
export const assistantReviewSource = z.enum(['composer', 'studio', 'mcp']);
export const assistantReviewScope = z.object({ source: assistantReviewSource, userId: identity, scopeId: identity, requestId: z.string().uuid() }).strict();
export const assistantReviewFilter = z.object({
  source: assistantReviewSource.default('composer'), userId: identity.optional(), scopeId: identity.optional(),
  mediaModel: identity.optional(), state: identity.optional(),
  verdict: z.enum(['unreviewed', 'useful', 'needs_work']).optional(), issue: z.enum(reviewIssues).optional(),
  page: z.coerce.number().int().min(0).max(100).default(0), limit: z.coerce.number().int().min(1).max(50).default(25),
}).strict();
export const assistantReviewAnnotation = assistantReviewScope.extend({ id: z.string().uuid(), verdict: z.enum(['unreviewed', 'useful', 'needs_work']), issues: z.array(z.enum(reviewIssues)).max(9), note: z.string().trim().max(2000) }).strict();
export type AssistantReviewScope = z.infer<typeof assistantReviewScope>;
export type AssistantReviewFilter = z.infer<typeof assistantReviewFilter>;
export type AssistantReviewAnnotation = z.infer<typeof assistantReviewAnnotation>;
export type ReviewItem = AssistantReviewScope & { createdAt: string; state: string | null; surface: string | null; mediaModel: string | null; assistantModel: string | null; reviewVerdict?: string | null };
export type ReviewList = { status: 'available'; items: ReviewItem[]; hasMore: boolean } | { status: 'unavailable' };
export type Annotation = { id: string; actorId: string; verdict: string; issues: string[]; note: string; createdAt: string };
export type Evidence = { title: string; status: 'available' | 'unavailable'; data: ReviewProjection; rowsTruncated?: boolean };
export type AssistantReviewDetail = { item: ReviewItem; accessId: string; message: string | null; reply: string | null; proposal: string | null; evidence: Evidence[]; annotations: { status: 'available' | 'unavailable'; items: Annotation[]; truncated: boolean }; limitations: string[] };
export class AssistantReviewError extends Error {
  constructor(public code: 'not_found' | 'unavailable' | 'invalid_request' | 'conflict' | 'review_expired', public status: number) { super(code); }
}
