import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getFalClient } from '@/lib/fal-client';
import { isStorageConfigured } from '@/server/storage';
import { validateToolBlock } from '@/lib/toolbox/contract';
import { matchesAcceptedToolQuote } from '@/lib/toolbox/quote';
import { prepareFinishingTool } from './finishing-prepare';
import { requireFinishingProfileReleased } from './finishing-release';
import { reserveFinishingJob, markFinishingSubmitted, failFinishingJob } from './finishing-jobs';

const requestSchema = z.object({ block: z.unknown(), requestId: z.string().uuid(), acceptedQuote: z.object({ totalCents: z.number().int().positive(), currency: z.literal('USD') }).strict() }).strict();
const defaults = {
  prepare: prepareFinishingTool, requireReleased: requireFinishingProfileReleased, storageReady: isStorageConfigured,
  reserve: reserveFinishingJob, submitted: markFinishingSubmitted, fail: failFinishingJob,
  execute: async (endpoint: string, input: Record<string, unknown>) => getFalClient().queue.submit(endpoint, { input }),
};
/** One server owner for standalone/embedded callers. No debit or provider submission during preparation. */
export async function runFinishingTool(value: unknown, userId: string, dependencies: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...dependencies };
  const request = requestSchema.parse(value);
  const block = validateToolBlock(request.block);
  const prepared = await deps.prepare(block, userId);
  deps.requireReleased(prepared.profile, prepared.settings.quality);
  if (!deps.storageReady()) throw new Error('TOOL_STORAGE_UNAVAILABLE');
  if (!matchesAcceptedToolQuote(request.acceptedQuote, prepared.pricing)) throw new Error('QUOTE_CHANGED');
  const jobId = `tool_finish_${createHash('sha256').update(JSON.stringify([userId, request.requestId])).digest('hex')}`;
  const fingerprint = createHash('sha256').update(JSON.stringify([prepared.block, prepared.profile.id, prepared.source.url, prepared.facts, prepared.pricing.totalCents, prepared.pricing.currency])).digest('hex');
  const reservation = await deps.reserve(userId, jobId, fingerprint, prepared);
  if (!reservation.created) return { ok: true, jobId, status: reservation.status, result: reservation.result };
  let providerRequestId: string | null = null;
  try {
    const response = await deps.execute(prepared.profile.endpoint, prepared.input);
    providerRequestId = response.request_id;
    if (!providerRequestId) throw new Error('Missing provider request ID.');
    await deps.submitted(userId, jobId, providerRequestId);
    return { ok: true, jobId, status: 'queued', result: null };
  } catch (error) {
    await deps.fail(userId, jobId, 'Tool processing failed.', providerRequestId);
    throw error;
  }
}
