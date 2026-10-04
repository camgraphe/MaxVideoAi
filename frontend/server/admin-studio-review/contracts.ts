import { z } from 'zod';

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
export const reviewScopeSchema = z.object({ userId: identity, projectId: identity, requestId: z.string().uuid() }).strict();
export const reviewListSchema = z.object({
  userId: identity.optional(), projectId: identity.optional(), state: z.enum(['thinking', 'ready', 'failed']).optional(),
  page: z.coerce.number().int().min(0).max(100).default(0), limit: z.coerce.number().int().min(1).max(50).default(50),
}).strict();
export type ReviewScope = z.infer<typeof reviewScopeSchema>;
export type ReviewListFilter = z.infer<typeof reviewListSchema>;
export type ReviewTurn = ReviewScope & { state: string; attempts: number; createdAt: string; quoteId: string | null };
export type ReviewList = { status: 'available'; turns: ReviewTurn[]; hasMore: boolean } | { status: 'unavailable' };
export type ReviewSource<T> = { status: 'available'; items: T[]; truncated: boolean } | { status: 'unavailable'; items: []; truncated: false };
export type ReviewAction = { action: string | null; state: string | null; ok: boolean | null; observedRevision: number | null; modelId: string | null; errorCode: string | null; createdAt: string };
export type ReviewUsage = { source: 'conversation' | 'legacy'; state: string | null; model: string | null; inputTokens: number | null; cachedTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; elapsedMs: number | null; createdAt: string };
export type ReviewAssistance = { state: string | null; model: string | null; returnedModel: string | null; mode: string | null; policyVersion: string | null; rateVersion: string | null; tariffVersion: string | null; reservedNanoUsd: string | null; providerMinNanoUsd: string | null; providerMaxNanoUsd: string | null; reservedCents: number | null; chargedCents: number | null; createdAt: string };
export type ReviewDetail = {
  turn: ReviewTurn; message: string | null; reply: string | null;
  actions: ReviewSource<ReviewAction>; responses: ReviewSource<ReviewUsage>; legacyUsage: ReviewSource<ReviewUsage>; assistance: ReviewSource<ReviewAssistance>;
  accessId: string; coverage: 'partial';
};
export class StudioReviewError extends Error {
  constructor(public code: 'not_found' | 'unavailable' | 'invalid_request', public status: number) { super(code); }
}
