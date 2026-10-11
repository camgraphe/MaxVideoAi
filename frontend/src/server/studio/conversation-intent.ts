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
  if(!/\b(?:creat\w*|make|plan\w*|propos\w*|realise\w*|réalise\w*|faire|fais|quiero|haz|crear|créer|crée|want|like|need|veux|voudrais|souhaite|aimerais|prix|price|cost|budget)\b/i.test(message))return null;
  if(!/\b(?:video|vidéo|film|movie|montage)\b/i.test(message)&&!/\bcreate\s+a\s+\d+[ -]second/i.test(message))return null;
  const values=[...message.matchAll(/\b(\d+(?:[.,]\d+)?)\s*[- ]?\s*(seconds?|secondes?|segundos?|secs?|s|minutes?|mins?)\b/gi)];
  if(values.length!==1)return null;
  const [,amount,unit]=values[0];
  const duration=Number(amount.replace(',','.'))*(/^min/i.test(unit)?60:1);
  return Number.isFinite(duration)&&duration>30&&duration<=1200?duration:null;
}
