import {isTransactionQueryExecutor,type TransactionQueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import {requireGenerationActor,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {StoredImageTurn} from './image-conversation-repository';

export type StudioQuoteDiscardResult = {quoteId: string;status: 'discarded'|'already_submitted'|'already_unavailable';message: string};

/** Only prepared consent is withdrawn. Caller checkpoints the action in this same transaction. */
export async function discardStudioPreparedQuote(actor: StudioGenerationActor,turn: StoredImageTurn,quoteId: string,executor: TransactionQueryExecutor): Promise<StudioQuoteDiscardResult> {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED','Studio session required.');
  if (!isTransactionQueryExecutor(executor)) throw new Error('A real transaction is required to discard a Studio quote.');
  await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`studio-image:${actor.userId}`]);
  const current = () => executor.query(`SELECT t.request_id FROM studio_image_turns t
    JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
    WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3 AND t.lease_id=$4
      AND t.state='thinking' AND t.lease_expires_at>clock_timestamp() FOR UPDATE OF t`,[actor.userId,actor.projectId,turn.request_id,turn.lease_id]);
  if (!(await current()).length) throw new AgentApiError('PARAMETER_INVALID','This message has been superseded.');
  const quote = (await executor.query<{state: string;job_id: string|null;claimed_at: Date|null}>(`SELECT state,job_id,claimed_at FROM mcp_generation_quotes
    WHERE quote_id=$1 AND user_id=$2 AND studio_project_id=$3 AND auth_origin='studio-session'
      AND oauth_client_id IS NULL AND funding_mode='wallet' FOR UPDATE`,[quoteId,actor.userId,actor.projectId]))[0];
  if (!quote) throw new AgentApiError('QUOTE_EXPIRED','This quote is not available in this Studio project.');
  // A concurrent confirmation may hold the quote lock past the turn's lease.
  if (!(await current()).length) throw new AgentApiError('PARAMETER_INVALID','This message has been superseded.');
  if (quote.job_id || quote.claimed_at || quote.state === 'claimed' || quote.state === 'accepted') {
    return {quoteId,status: 'already_submitted',message: 'This generation has already been submitted. Discarding its quote cannot cancel the generation.'};
  }
  if (quote.state !== 'prepared') return {quoteId,status: 'already_unavailable',message: 'This quote is already unavailable for confirmation.'};
  const updated = await executor.query(`UPDATE mcp_generation_quotes SET state='expired',updated_at=clock_timestamp()
    WHERE quote_id=$1 AND user_id=$2 AND studio_project_id=$3 AND auth_origin='studio-session'
      AND oauth_client_id IS NULL AND funding_mode='wallet' AND state='prepared' AND job_id IS NULL AND claimed_at IS NULL
      AND EXISTS (SELECT 1 FROM studio_image_turns t WHERE t.user_id=$2 AND t.project_id=$3
        AND t.request_id=$4 AND t.lease_id=$5 AND t.state='thinking' AND t.lease_expires_at>clock_timestamp()) RETURNING quote_id`,[quoteId,actor.userId,actor.projectId,turn.request_id,turn.lease_id]);
  if (!updated.length) throw new AgentApiError('PARAMETER_INVALID','This message has been superseded.');
  return {quoteId,status: 'discarded',message: 'The prepared quote was discarded. It cannot be confirmed, and no generation was started or charged by this action.'};
}
