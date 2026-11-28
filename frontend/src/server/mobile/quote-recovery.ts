import { z } from 'zod';
import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { customerDisplayPrice } from '@/lib/customer-price-presentation';
import { AgentApiError } from '@/server/agent-api/errors';
import type { LockedOwnedQuote, OwnedQuoteInput } from '@/server/agent-api/quote-repository';
import { readMobileJob } from './generations';
import { MobileHttpError } from './errors';

export async function recoverScopedMobileQuote<Request>(
  userId: string,
  quoteId: string,
  lockOwnedQuote: (
    owner: OwnedQuoteInput,
    dependencies: { executor: TransactionQueryExecutor },
  ) => Promise<LockedOwnedQuote<Request> | null>,
) {
  if (!z.string().uuid().safeParse(quoteId).success)
    throw new AgentApiError('PARAMETER_INVALID', 'Invalid quote.');
  // Observe after any concurrent reservation. This takes a row lock and reads the database clock
  // without claiming, expiring, repricing, or resubmitting the quote.
  const locked = await withDbTransaction((executor) =>
    lockOwnedQuote({ userId, quoteId, oauthClientId: null }, { executor }),
  );
  if (!locked) throw new MobileHttpError('QUOTE_NOT_FOUND', 404, 'Generation quote not found.');
  const { quote, databaseNow } = locked;
  const job = quote.jobId ? await readMobileJob(userId, quote.jobId) : null;
  const expired =
    quote.state === 'expired' || (quote.state === 'prepared' && quote.expiresAt <= databaseNow);
  return {
    job,
    canConfirm: !expired && !job && quote.state === 'prepared',
    terminal:
      expired ||
      quote.state === 'failed' ||
      job?.status === 'completed' ||
      job?.status === 'failed',
    quote: {
      quoteId,
      expiresAt: quote.expiresAt.toISOString(),
      price: customerDisplayPrice(quote.priceCents, quote.currency),
      summary: quote.request,
    },
  };
}
