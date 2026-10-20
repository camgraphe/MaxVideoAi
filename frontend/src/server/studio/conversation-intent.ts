import type {ImageDraft} from '@/lib/studio/image-conversation-contract';

/** Only standalone salutations qualify; a greeting plus a brief must reach the director. */
export function studioGreetingReply(message:string,hasReferences:boolean):ImageDraft|null {
  if(hasReferences||message.length>80)return null;
  const text=message.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').trim().replace(/\s+/g,' ');
  const match=/^(hey|hi|hello|bonjour|bonsoir|salut|coucou|hola|buenos dias|buenas tardes|buenas noches)(?: studio)?$/.exec(text);
  if(!match)return null;
  const greeting=match[1];
  const reply=['bonjour','bonsoir','salut','coucou'].includes(greeting)
    ? 'Bonjour ! Que souhaitez-vous créer aujourd’hui ?'
    : ['hola','buenos dias','buenas tardes','buenas noches'].includes(greeting)
      ? '¡Hola! ¿Qué te gustaría crear hoy?'
      : 'Hey! What would you like to create today?';
  return {image:null,reply};
}

/** A narrow routing hint, never a replacement for the director's reading of a creative brief. */
export function studioExplicitFilmDuration(message:string):number|null {
  if(/\b(?:export\w*|trim\w*|shorten\w*|edit\w*|synopsis|summar\w*|résum\w*|narrat\w*|script|retake|reprice|monter|assemble\w*|raccour\w*|ralent\w*|acc[eé]l[eé]r\w*|couper|recadr\w*|slow\w*|speed\w*|crop\w*|resize\w*)\b/i.test(message))return null;
  const filmObject=/^\s*(?:(?:a|an|un|une|una|des)\s+)?(?:(?:new|nouveau|nouvelle|nuevo|nueva)\s+)?(?:\d+(?:[.,]\d+)?\s*[- ]?\s*(?:seconds?|secondes?|segundos?|secs?|s|minutes?|mins?)\s+(?:(?!\b(?:for|of|pour|para|de|my|mon|mi)\b)[\p{L}\p{N}'’"-]+\s+){0,8})?(?:film|video|vidéo|vídeo|movie|montage|montaje|película)\b(?=\s*(?:$|[.!?,—-]|\d|(?:of|about|with|for|on|using|that|inspired|showing|de|sur|avec|pour|con|sobre|para)\b))/iu;
  const creation=/^\s*(?:(?:please|bonjour|hello|salut|hola)[\s,!]+)?(?:(?:can|could|would)\s+you\s+|(?:i|we)\s+(?:want|need|would like)\s+to\s+|(?:je|nous)\s+(?:veux|voudrais|souhaite|aimerais|voulons)\s+|quiero\s+)?(?:create|make|produce|plan|propose|créer|crée|réaliser|réalise|faire|fais|crear|crea|haz|proponer|planificar)\s+(.+)$/i.exec(message);
  const budget=/\b(?:prix|price|cost|budget|co[uû]t(?:e|s)?|precio|presupuesto)\s+(?:(?:for|of|pour|de|para)\s+)?(.+)$/i.exec(message);
  const wants=/^\s*(?:(?:(?:i|we)\s+|i['’]d\s+)?(?:want|need|(?:would\s+)?like)|(?:je\s+)?(?:veux|voudrais|souhaite|aimerais)|(?:yo\s+)?(?:quiero|necesito))\s+(.+)$/i.exec(message);
  // The original bare "Create a 100-second — [subject]" brief implies a new film.
  const implicitFilm=/^\s*create\s+a\s+\d+[ -]second\s*[-—:]\s*\S/i.test(message);
  if(!implicitFilm&&![creation?.[1],budget?.[1],wants?.[1]].some(object=>object&&filmObject.test(object)))return null;
  const values=[...message.matchAll(/\b(\d+(?:[.,]\d+)?)\s*[- ]?\s*(seconds?|secondes?|segundos?|secs?|s|minutes?|mins?)\b/gi)];
  if(values.length!==1)return null;
  const [,amount,unit]=values[0];
  const duration=Number(amount.replace(',','.'))*(/^min/i.test(unit)?60:1);
  return Number.isFinite(duration)&&duration>30&&duration<=1200?duration:null;
}
