type Locale='en'|'fr'|'es';
export type StudioTurnLanguageInput = { message: string; locale?: Locale | null };
export type StudioQuoteLanguageContext = {
  recent: readonly StudioTurnLanguageInput[];
  precedingCommand?: Locale;
};
export const STUDIO_QUOTE_LANGUAGE_HISTORY_LIMIT = 30;

export const studioOutputLimitMessage = {
  en: 'Milo reached the output limit before it could deliver a complete reply. Ask for a shorter section in a new message, such as shots 1–3.',
  fr: 'Milo a atteint la limite de longueur avant de pouvoir livrer une réponse complète. Demandez une partie plus courte dans un nouveau message, par exemple les plans 1 à 3.',
  es: 'Milo alcanzó el límite de longitud antes de poder entregar una respuesta completa. Pide una sección más corta en un mensaje nuevo, por ejemplo los planos 1 a 3.',
} as const;

function normalizedLanguageText(message: string) {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const languageNames = '(english|anglais|ingles|french|francais|frances|spanish|espagnol|espanol)';
// A broad screen on accent-folded text. Only the authored-command parser decides whether a match is a preference.
export const STUDIO_REPLY_LANGUAGE_SQL_PREFILTER = '(in|en)[^[:alnum:]]+' + languageNames;
const replyLanguageCommand = new RegExp(String.raw`(?:^|[.!?]\s*)(?:(?:now|ahora|maintenant)\s*,?\s+)?(?:(?:please|por favor|s'il vous plait)\s*,?\s+)?(?:reply|respond|answer|speak(?: to me)?|reponds?(?:-moi)?|repondez(?:-moi)?|parle(?:-moi)?|parlez(?:-moi)?|responde(?:me)?|habla(?:me)?)\s+(?:in|en)\s+${languageNames}\b`);
const standaloneReplyLanguage = new RegExp(String.raw`^\s*(?:in|en)\s+${languageNames}(?:\s*[,!.]?\s*(?:please|por favor|s'il vous plait))?[.!]?\s*$`);

export function requestedStudioReplyLanguage(message: string): Locale | undefined {
  const text = normalizedLanguageText(message);
  // A narration/subtitle language is not an instruction to change our replies.
  if(/(?:^|[.!?]\s*)no me (?:hables|respondas) en ingles\b/.test(text))return 'es';
  const replyRequest=text.match(replyLanguageCommand) ?? text.match(standaloneReplyLanguage);
  const requested=replyRequest?.[1];
  if(requested)return /english|anglais|ingles/.test(requested)?'en':/french|francais|frances/.test(requested)?'fr':'es';
}

const shortBriefMarkers = { es: ['crea', 'imagen'], fr: ['cree', 'creer'], en: ['create', 'make', 'image'] } as const;

/** Lexical evidence only, with no requested-language or interface-locale fallback. */
export function detectStudioLexicalLanguage(message: string, shortBrief = false): Locale | undefined {
  const words=new Set(normalizedLanguageText(message).match(/[a-z]+/g)??[]);
  const scores=([
    ['es',['quiero','necesito','presupuesto','entiendo','hablar','hablame','puedes','para','tienda','imagenes','voz','adelante','perfecto','generar','genera','tengo','pero','que','una','por','favor']],
    ['fr',['veux','voudrais','besoin','devis','comprends','peux','pour','boutique','images','voix','continue','parfait','generer','genere','avec','mais','une','bonjour','merci']],
    ['en',['want','need','budget','understand','please','can','for','shop','images','voice','continue','perfect','generate','with','this','the','would','could','hello','thanks']],
  ] as const).map(([locale,markers])=>({
    locale, score: [...markers, ...(shortBrief ? shortBriefMarkers[locale] : [])].filter(word=>words.has(word)).length,
  })).sort((a,b)=>b.score-a.score);
  if(scores[0].score>=2&&scores[0].score>scores[1].score)return scores[0].locale;
}

/** Resolve server-authored replies from authored client messages, never assistant/tool text. */
export function studioConversationLanguage(message:string,history:readonly {message:string}[],fallback:Locale='en'):Locale {
  for(const value of [message,...history.slice(-12).reverse().map(turn=>turn.message)]) {
    const locale = requestedStudioReplyLanguage(value) ?? detectStudioLexicalLanguage(value);
    if (locale) return locale;
  }
  return fallback;
}

/** Prior authored inputs arrive newest first and are scoped to this quote's turn. */
export function studioQuoteReplyLanguage(input: StudioTurnLanguageInput, context: StudioQuoteLanguageContext): Locale {
  const command = requestedStudioReplyLanguage(input.message) ?? context.precedingCommand;
  if (command) return command;
  for (const turn of [input, ...context.recent]) {
    const locale = detectStudioLexicalLanguage(turn.message, true);
    if (locale) return locale;
  }
  for (const { locale } of [...context.recent, input]) {
    if (locale === 'en' || locale === 'fr' || locale === 'es') return locale;
  }
  return 'en';
}
