import { formatCustomerAmount } from '@/lib/customer-price-presentation';
import { projectStudioReply } from '@/lib/studio/conversation-reply';
import { studioConversationLanguage } from './conversation-language';

type Locale = NonNullable<Parameters<typeof studioConversationLanguage>[2]>;
const labels = {
  en: { brief: 'Creative brief', price: 'Generation quote' },
  fr: { brief: 'Consigne créative', price: 'Devis de génération' },
  es: { brief: 'Indicación creativa', price: 'Presupuesto de generación' },
} as const;
const previewLength = 220;

export function projectStudioQuotedReply(
  reply: string,
  input: { message: string; locale?: Locale },
  creativeDirection?: string | null,
  quote?: { priceCents: number; currency: string },
): string {
  const locale = studioConversationLanguage(input.message, [], input.locale);
  const label = labels[locale];
  const direction = creativeDirection?.trim() ?? '';
  // Free-form preparation prose cannot attest to a price or a spending limit.
  // Only the recorded creative input can supply the excerpt next to the receipt.
  let brief = '';
  if (direction && projectStudioReply(direction) === direction) {
    const characters = Array.from(direction.replace(/[\r\n\t]+/g, ' '));
    const excerpt = characters.length > previewLength
      ? characters.slice(0, previewLength - 1).join('').trimEnd() + '…'
      : characters.join('');
    brief = label.brief + ' · ' + excerpt;
  }

  // A purely creative reply already has its price in the adjacent quote card.
  if (!quote || (brief && reply.trim() === direction)) return brief;
  const amount = formatCustomerAmount(quote.priceCents, quote.currency, locale);
  return [brief, amount && label.price + ' · ' + amount].filter(Boolean).join('\n\n');
}
