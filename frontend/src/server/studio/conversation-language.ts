type Locale='en'|'fr'|'es';

/** Resolve server-authored replies from authored client messages, never assistant/tool text. */
export function studioConversationLanguage(message:string,history:readonly {message:string}[],fallback:Locale='en'):Locale {
  for(const value of [message,...history.slice(-12).reverse().map(turn=>turn.message)]) {
    const text=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // A narration/subtitle language is not an instruction to change our replies.
    if(/(?:^|[.!?]\s*)no me (?:hables|respondas) en ingles\b/.test(text))return 'es';
    const replyRequest=text.match(/(?:^|[.!?]\s*)(?:(?:please|por favor|s'il vous plait)\s+)?(?:reply|respond|answer|speak(?: to me)?|reponds?(?:-moi)?|repondez(?:-moi)?|parle(?:-moi)?|parlez(?:-moi)?|responde(?:me)?|habla(?:me)?)\s+(?:in|en)\s+(english|anglais|ingles|french|francais|frances|spanish|espagnol|espanol)\b/)
      ??text.match(/^\s*(?:in|en)\s+(english|anglais|ingles|french|francais|frances|spanish|espagnol|espanol)(?:\s*[,!.]?\s*(?:please|por favor|s'il vous plait))?[.!]?\s*$/);
    const requested=replyRequest?.[1];
    if(requested)return /english|anglais|ingles/.test(requested)?'en':/french|francais|frances/.test(requested)?'fr':'es';
    const words=new Set(text.match(/[a-z]+/g)??[]);
    const scores=([
      ['es',['quiero','necesito','presupuesto','entiendo','hablar','hablame','puedes','para','tienda','imagenes','adelante','perfecto','generar','genera','tengo','pero','que','una','por','favor']],
      ['fr',['veux','voudrais','besoin','devis','comprends','peux','pour','boutique','images','continue','parfait','generer','genere','avec','mais','une','bonjour','merci']],
      ['en',['want','need','budget','understand','please','can','for','shop','images','continue','perfect','generate','with','this','the','would','could','hello','thanks']],
    ] as const).map(([locale,markers])=>({locale,score:markers.filter(word=>words.has(word)).length})).sort((a,b)=>b.score-a.score);
    if(scores[0].score>=2&&scores[0].score>scores[1].score)return scores[0].locale;
  }
  return fallback;
}
