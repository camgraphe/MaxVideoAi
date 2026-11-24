import { z } from 'zod';
import { type ImageConversationTurn } from '@/lib/studio/image-conversation-contract';
import {
  conversationQuotePresentation,
  type ConversationLocale,
} from '@/lib/studio/conversation-quote-presentation';
import { canConfirmImageQuote, imageQuoteWalletState } from '@/lib/studio/image-quote-ui';
import type { StudioGeneration, StudioMessage, StudioOutput } from '@/lib/mobile-studio';
import { videoWorkflowNotices } from '@/lib/video-workflow-capabilities';
import { MobileHttpError } from './errors';

export const studioConfirmInput = z
  .object({
    action: z.literal('confirm-generation'),
    confirmed: z.literal(true),
    requestId: z.string().uuid(),
    quoteId: z.string().uuid(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    amountCents: z.number().int().nonnegative().safe(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();

type Quote = NonNullable<ImageConversationTurn['quote']>;

export function mobileStudioQuote(
  quote: Quote,
  locale: ConversationLocale,
  reviewEnabled: boolean,
  renewableTurn = false,
): NonNullable<StudioMessage['quote']> {
  const price = {
    label: quote.modelLabel,
    amountCents: quote.price.amountCents,
    currency: quote.price.currency,
    state: quote.state,
  };
  // Character recipes and recast passages have their own review screens in web Studio.
  if (!reviewEnabled || quote.characterBuilder || quote.recast) return price;
  const view = conversationQuotePresentation(
    quote.summary,
    locale,
    quote.outputDurationSec,
    quote.sourceVideoOutput,
  );
  const notices = videoWorkflowNotices(quote.summary.engineId, quote.summary.mode, locale);
  return {
    ...price,
    review: {
      ...(notices.length ? { notices: notices.map((notice) => notice.message) } : {}),
      ...(renewableTurn && (quote.state === 'expired' ||
        (quote.state === 'prepared' && Date.parse(quote.expiresAt) <= Date.now())) ? {canRenew: true as const} : {}),
      quoteId: quote.quoteId,
      requestHash: quote.requestHash,
      expiresAt: quote.expiresAt,
      wallet: imageQuoteWalletState(quote),
      title: view.title,
      settings: view.settings,
      direction: view.direction,
      operation: view.operation,
      references: quote.sourceReferenceSummary ?? view.referenceSummary,
      outputCount: 'outputCount' in quote.summary ? quote.summary.outputCount : 1,
    },
  };
}

export function mobileStudioGeneration(
  generation: NonNullable<ImageConversationTurn['generation']>,
): StudioGeneration {
  const outputs: StudioOutput[] = [];
  const result = generation.result;
  if (generation.status === 'completed' && result) {
    if (result.surface === 'image') {
      // The thumbnail list is deduplicated independently. Only a single image and thumbnail pair is unambiguous.
      const previewUrl = result.imageUrls.length === 1 && result.thumbnailUrls?.length === 1
        ? result.thumbnailUrls[0]
        : undefined;
      outputs.push(...result.imageUrls.map((url) => ({ kind: 'image' as const, url, ...(previewUrl ? { previewUrl } : {}) })));
    } else {
      if (result.videoUrl)
        outputs.push({
          kind: 'video',
          originalUrl: result.videoUrl,
          url: result.surface === 'video' ? result.playbackVideoUrl || result.videoUrl : result.videoUrl,
        });
      if (result.audioUrl) outputs.push({ kind: 'audio', url: result.audioUrl });
    }
  }
  return { jobId: generation.jobId, status: generation.status, outputs };
}

export function reviewedStudioQuote(
  turn: ImageConversationTurn | undefined,
  input: z.infer<typeof studioConfirmInput>,
) {
  const quote = turn?.quote;
  if (
    !quote ||
    turn.state !== 'ready' ||
    quote.characterBuilder ||
    quote.recast ||
    quote.quoteId !== input.quoteId ||
    quote.requestHash !== input.requestHash ||
    quote.price.amountCents !== input.amountCents ||
    quote.price.currency !== input.currency
  ) {
    throw new MobileHttpError('REVIEW_REQUIRED', 409, 'Review the current project quote.');
  }
  // A repeated tap or a lost response recovers the same submission, including a failed job.
  if (turn.generation) return turn.generation;
  if (quote.state === 'claimed' || quote.state === 'accepted')
    throw new MobileHttpError('CONFIRMATION_PENDING', 409, 'Refresh the project to check this generation.');
  if (quote.state !== 'prepared' || Date.parse(quote.expiresAt) <= Date.now())
    throw new MobileHttpError('QUOTE_EXPIRED', 409, 'This quote is no longer available.');
  if (!canConfirmImageQuote(quote, Date.now(), false))
    throw new MobileHttpError(
      imageQuoteWalletState(quote) === 'insufficient' ? 'INSUFFICIENT_FUNDS' : 'REVIEW_REQUIRED',
      409,
      'Check the wallet and current quote.',
    );
  return null;
}
