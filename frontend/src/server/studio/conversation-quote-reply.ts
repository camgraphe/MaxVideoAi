import { formatCustomerAmount } from '@/lib/customer-price-presentation';
import { projectStudioReply, STUDIO_CONVERSATION_REPLY_MAX_CHARS } from '@/lib/studio/conversation-reply';
import { studioConversationLanguage } from './conversation-language';

type Locale = NonNullable<Parameters<typeof studioConversationLanguage>[2]>;

const quoteCopy = {
  en: 'Generation quote',
  fr: 'Devis de génération',
  es: 'Presupuesto de generación',
} as const;

const monetaryAmount = /\p{Sc}\s*[.,]?\d|\d\s*\p{Sc}|\b(?:USD|EUR|GBP|CAD|AUD|CHF|MXN)\s*[.,]?\d|\d\s*(?:USD|EUR|GBP|CAD|AUD|CHF|MXN)\b|\b(?:dollars?|euros?|pounds?|bucks?|cents?|centimes?|centavos?)\b/iu;
const priceClaim = /\b(?:free of charge|no charge|no cost|no fee|at no cost|(?:is|will be|would be) free|gratis|gratuit(?:e|s|es)?|sin coste|sin costo|price is|current estimate|(?:will|would) cost|it costs|priced at|prix estime|cout estime|estimacion actual|precio (?:es|de))\b/iu;
const limitClaim = /\b(?:(?:under|within|below|above|over|fits?|meets?)\b[^!?\n]{0,44}\b(?:budget|limit|ceiling|cap)|(?:sous|respecte|depasse|dans)\b[^!?\n]{0,44}\b(?:budget|plafond|limite)|(?:dentro|debajo|encima|supera|respeta)\b[^!?\n]{0,44}\b(?:presupuesto|limite))\b/iu;
const quotedCopy = /«[^»\n]+»|“[^”\n]+”|‘[^’\n]+’|"[^"\n]+"|'[^'\n]+'|`[^`\n]+`/g;
const lettering = /\b(?:print|printed|write|lettering|lettrage|inscription|imprime[rz]?|inscris|inscrire|imprimir|escribe|texto|rotulo)\b/iu;

export function projectStudioQuotedReply(
  reply: string,
  input: { message: string; locale?: Locale },
  creativeDirection?: string | null,
  quote?: { priceCents: number; currency: string },
): string {
  const safeReply = projectStudioReply(reply);
  const locale = studioConversationLanguage(input.message, [], input.locale);
  const sentences = new Intl.Segmenter(locale, { granularity: 'sentence' });
  const direction = safeReply.split('\n').map(line => [...sentences.segment(line)].filter(({ segment }) => {
    const text = segment.normalize('NFD').replace(/\p{Mark}/gu, '');
    // A literal already present in the creative direction can be mock-up copy.
    const prose = creativeDirection && lettering.test(text) ? segment.replace(quotedCopy, literal =>
      creativeDirection.includes(literal.slice(1, -1).trim()) ? '' : literal) : segment;
    const claim = prose.normalize('NFD').replace(/\p{Mark}/gu, '');
    return !limitClaim.test(claim) && !monetaryAmount.test(claim) && !priceClaim.test(claim);
  }).map(({ segment }) => segment).join('').trimEnd()).join('\n').trim();
  if (direction === safeReply.trim()) return safeReply;
  if (!quote) return direction;
  const amount = formatCustomerAmount(quote.priceCents, quote.currency, locale);
  if (!amount) return direction;
  const receipt = `${quoteCopy[locale]} · ${amount}.`;
  return [direction.slice(0, STUDIO_CONVERSATION_REPLY_MAX_CHARS - receipt.length - 2), receipt].filter(Boolean).join('\n\n');
}
