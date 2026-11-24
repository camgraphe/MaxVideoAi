import { formatCustomerAmount } from '@/lib/customer-price-presentation';
import { projectStudioReply } from '@/lib/studio/conversation-reply';
import { conversationQuotePresentation } from '@/lib/studio/conversation-quote-presentation';
import { detectStudioLexicalLanguage, studioConversationLanguage } from './conversation-language';

type Locale = NonNullable<Parameters<typeof studioConversationLanguage>[2]>;
const labels = {
  en: { brief: 'Creative brief', price: 'Generation quote' },
  fr: { brief: 'Consigne créative', price: 'Devis de génération' },
  es: { brief: 'Indicación creativa', price: 'Presupuesto de generación' },
} as const;
const previewLength = 220;
// Short art directions often contain too few words for conversational language
// detection. Strong grammatical cues can still validate a short excerpt.
const excerptLanguageCues = {
  en: /\b(?:the|and|with|on|keep|print)\b/iu,
  fr: /\b(?:le|les|des|du|sur|avec|et|deux)\b/iu,
  es: /\b(?:el|los|las|del|con|una|en la|y)\b/iu,
} as const;

function conversationExcerpt(direction: string, reply: string, message: string, locale: Locale) {
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim().toLocaleLowerCase(locale);
  const assistantText = normalize(reply);
  const userText = normalize(message);
  const sentences = new Intl.Segmenter(locale, { granularity: 'sentence' });
  const segments = Array.from(sentences.segment(direction), part => part.segment);
  const excerpt = segments.filter(sentence => {
    const phrase = normalize(sentence).replace(/[.!?…]+$/u, '').trimEnd();
    if (!phrase) return false;
    const hint = detectStudioLexicalLanguage(sentence);
    if (hint && hint !== locale) return false;
    if (userText.includes(phrase)) return true;
    if (!assistantText.includes(phrase)) return false;
    return hint === locale || !/\p{L}/u.test(phrase) || excerptLanguageCues[locale].test(phrase);
  }).join('').trim();
  const characters = Array.from(excerpt.replace(/[\r\n\t]+/g, ' '));
  if (characters.length <= previewLength) return characters.join('');
  return characters.slice(0, previewLength - 1).join('').trimEnd() + '…';
}

export function projectStudioQuotedReply(
  reply: string,
  input: { message: string; locale?: Locale },
  creativeDirection?: string | null,
  quote?: { priceCents: number; currency: string; request?: Parameters<typeof conversationQuotePresentation>[0];
    sources?: {model: string; displayNames: string} },
  resolvedLocale?: Locale,
): string {
  const locale = resolvedLocale ?? studioConversationLanguage(input.message, [], input.locale);
  const label = labels[locale];
  const direction = creativeDirection?.trim() ?? '';
  // Free-form preparation prose cannot attest to a price or a spending limit.
  // Only the recorded creative input can supply the excerpt next to the receipt.
  let brief = '';
  if (direction && projectStudioReply(direction) === direction) {
    // Provider prompts often use a different language. Only preview recorded phrases
    // that also appeared in the conversation. The quote detail keeps the full prompt.
    const excerpt = conversationExcerpt(direction, reply, input.message, locale);
    if (excerpt) brief = label.brief + ' · ' + excerpt;
  }

  // A purely creative reply already has its price in the adjacent quote card.
  if (!quote || (!quote.sources && brief && reply.trim() === direction)) return brief;
  const amount = formatCustomerAmount(quote.priceCents, quote.currency, locale);
  if (quote.sources && quote.request) {
    const source = quote.sources.displayNames;
    const edit = quote.request.surface === 'image' && quote.request.mode === 'i2i';
    const operation = edit ? {en:'Edit', fr:'Retouche', es:'Retoque'}[locale] : conversationQuotePresentation(quote.request, locale).title;
    const model = quote.sources.model;
    const title = {
      en: operation + ' with ' + model + (source ? ' using ' + source : ''),
      fr: operation + ' avec ' + model + (source ? (/^[IA]/.test(source) ? ' à partir d’' : ' à partir de ') + source : ''),
      es: operation + ' con ' + model + (source ? ' a partir de ' + source : ''),
    }[locale];
    return [title + '.', brief, amount && label.price + ' · ' + amount].filter(Boolean).join('\n\n');
  }
  let description = brief;
  if (!description && quote.request) {
    const request = quote.request;
    const title = conversationQuotePresentation(request, locale).title;
    const ratio = request.surface === 'audio' ? undefined : request.settings.aspectRatio;
    description = [title, ratio].filter(Boolean).join(' · ');
  }
  return [description, amount && label.price + ' · ' + amount].filter(Boolean).join('\n\n');
}
