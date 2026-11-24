import { z } from 'zod';
import { query } from '@/lib/db';
import { hasDraftCreation, type ImageDraft, type ImageTurnInput } from '@/lib/studio/image-conversation-contract';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import type { createImageConversationService } from '@/server/studio/image-conversation-service';
import { MobileHttpError } from './errors';
import { mobileStudioQuote } from './studio-generation';

export const studioRenewInput = z
  .object({
    action: z.literal('renew-generation'),
    requestId: z.string().uuid(),
    quoteId: z.string().uuid(),
    renewalId: z.string().uuid(),
    locale: z.enum(['en', 'fr', 'es']),
  })
  .strict();

export async function renewMobileStudioQuote(
  actor: StudioGenerationActor,
  input: z.infer<typeof studioRenewInput>,
  service: Pick<ReturnType<typeof createImageConversationService>, 'submit'>,
) {
  if (input.requestId === input.renewalId)
    throw new MobileHttpError('REVIEW_REQUIRED', 409, 'Use a new request ID for the renewal.');

  // The exact originating turn can be older than the last page of the mobile journal.
  const [source] = await query<{ input_json: ImageTurnInput; draft_json: ImageDraft }>(
    `SELECT t.input_json, t.draft_json FROM studio_image_turns t
     JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
     JOIN mcp_generation_quotes q ON q.quote_id=t.quote_id AND q.user_id=t.user_id
       AND q.studio_project_id=t.project_id AND q.auth_origin='studio-session'
     WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3 AND q.quote_id=$4
       AND t.state='ready' AND q.job_id IS NULL
       AND (q.state='expired' OR (q.state='prepared' AND q.expires_at<=clock_timestamp()))`,
    [actor.userId, actor.projectId, input.requestId, input.quoteId],
  );
  if (
    !source ||
    !hasDraftCreation(source.draft_json) ||
    source.draft_json?.characterBuilder ||
    source.draft_json?.recast
  )
    throw new MobileHttpError('REVIEW_REQUIRED', 409, 'Only an expired, unused generation quote can be renewed.');

  // Pricing a frozen preparation needs no assistance budget or new task. Keep the
  // original message locale for identity. The caller's current locale controls its price card.
  const original = { ...source.input_json };
  delete original.taskBudget;
  const renewed = await service.submit(
    {
      ...original,
      requestId: input.renewalId,
      renewedFromRequestId: input.requestId,
    },
    input.quoteId,
  );
  if (renewed.state === 'thinking')
    throw new MobileHttpError(
      'RENEWAL_PENDING',
      409,
      'The price is being refreshed. Retry with the same renewal ID.',
    );
  if (!renewed.quote || renewed.generation || ['accepted', 'claimed'].includes(renewed.quote.state))
    throw new MobileHttpError('REVIEW_REQUIRED', 409, 'Reopen this generation in the project.');
  return {
    projectId: actor.projectId,
    requestId: renewed.requestId,
    quote: mobileStudioQuote(renewed.quote, input.locale, true, renewed.state === 'ready'),
  };
}
