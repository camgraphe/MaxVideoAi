import { VideoExcerptError } from './video-excerpts/media';
import { AgentApiError } from '@/server/agent-api/errors';
import { resolveOwnedFluxDraftSource } from './flux-draft-cache-store';
import { recoverOwnedFluxDraftCache } from './flux-draft-cache-recovery';

/** Explicit preparation only. Never call from catalog, pricing.read, preflight or history GET. */
export async function prepareOwnedFluxDraftSource(input:Parameters<typeof resolveOwnedFluxDraftSource>[0],dependencies={
  resolve:resolveOwnedFluxDraftSource,recover:recoverOwnedFluxDraftCache,
}) {
  try {return await dependencies.resolve(input);} catch { /* Historical native Draft may be recoverable. */ }
  try {
    const result=await dependencies.recover(input);
    if(!result.enhanceable)throw new Error('Cache missing');
    // Recovery does not authorize a quote: resolve the exact current owner/output again.
    return await dependencies.resolve(input);
  } catch (error) {
    if (error instanceof VideoExcerptError && error.code === 'PREPARATION_BUSY') throw new AgentApiError('RATE_LIMITED', error.message, true);
    throw new AgentApiError('REFERENCE_INVALID','This Draft has no usable paired cache. The original Draft remains available.');
  }
}
