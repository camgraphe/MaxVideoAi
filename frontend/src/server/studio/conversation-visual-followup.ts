import { askedToReattach, fileSetAside } from './conversation-model-choice';
import type { StoredStudioDraft } from './project-reference-registry';

// Input has already been lowercased and stripped of accents by the conversation reader.
const topicChange =
  /\b(?:autre (?:question|sujet|projet)|changeons de sujet|another (?:question|topic|project)|new topic|switch topics|otra (?:pregunta|cosa)|otro (?:tema|proyecto)|cambiemos de tema|from scratch|de zero|desde cero)\b/;
const independentWork =
  /\b(?:factur\w*|abonnement|mot de passe|mon compte|billing|invoice|password|subscription|my account|balance|wallet|portefeuille|solde|credit(?:s|os)? (?:il me reste|i have left|do i have|me quedan)|saldo|suscripcion|contrasena|mi cuenta|tradu[ic]\w*|translate|(?:redige|ecris|write|draft|escribe|redacta)\b.{0,55}\b(?:texte|text|message|mensaje|email|mail|script|poem\w*|lettre|letter|carta|prompt)|text[e]? (?:only|seul)|solo texto)\b/;
const dropSource =
  /\b(?:ignor\w*|oublie\w*|forget|skip|olvida\w*|without|sans|sin|don['’]t use|do not use|(?:n['’])?utilise\w* pas|no us\w*)\s+(?:(?:using|utilis\w*|reprendre|usar|utilizar|cette|ces|la|le|les|ma|mon|mes|any|my|the|this|those|that|mi|mis|esa|esta|las?|el|une?)\s+)*(?:l['’])?(?:photo\w*|image\w*|imagen\w*|foto\w*|video\w*|ref\w*|fichier\w*|files?|it|them|tout|everything|todo)\b/;
const newSource =
  /\b(?:new|different|another|nouveau|nouvelle|autre|nuevo|nueva|otro|otra)\s+(?:photo|image|imagen|foto|video|fichier|file|archivo)\b/;

export function leavesVisualBrief(text: string) {
  return (
    topicChange.test(text) ||
    independentWork.test(text) ||
    dropSource.test(text) ||
    (newSource.test(text) && !fileSetAside(text))
  );
}

const framing =
  /\b(?:vertical\w*|horizontal\w*|landscape|widescreen|panoram\w*|square|carre|cuadrad\w*|portrait format|aspect ratio|cadrage|encuadre|\d{1,2}\s*[:/]\s*\d{1,2})\b/;
const priorFile =
  /\b(?:au[- ]dessus|plus haut|deja (?:envoy\w*|joint\w*)|just above|previous message|already (?:sent|attached)|mas arriba|justo arriba|mensaje anterior|ya (?:la |lo )?(?:envie|adjunte))\b/;
// Match how an edit is described (subject, treatment, composition), independently of the theme.
const changeSubject =
  /\b(?:me (?:mett\w*|transform\w*|vestir\w*|puedes? (?:poner|vestir|convertir))|(?:mets|habille|transforme)[- ]moi|(?:put|dress|turn|show|place|depict) me|ponme|visteme|convierteme|(?:my|mon|ma|mes|mi|mis) (?:face|visage|traits|tenue|rostro|cara|rasgos|outfit)|(?:original|same) (?:face|subject|features)|sans (?:changer|modifier) (?:mon |le )?visage)\b/;
const treatment =
  /\b(?:collage|gravure|grabado|engraving|affiche|poster|portrait|retrato|peinture|painting|pintura|illustration|ilustracion|cadrage|framing|encuadre|lumiere|eclairage|lighting|light|luz|iluminacion|contraste?|palette|paleta|arriere[- ]plan|background|fondo|noir et blanc|black and white|blanco y negro)\b/;
const alternative =
  /\b(?:une autre (?:piste|direction)|(?:et si|what if|y si) (?:on |tu |je |we |you |me |lo |la )|(?:en|in) (?:version|style)|(?:ambiance|atmosphere|tenue|outfit|vestuario|decor|estetica|estilo|style|look) (?:de|plus|mas|of|like|in|a|en)|(?:plutot|rather|mejor) (?:en |une? |du |a |an |como ))\b/;

export function visualReplyKind(text: string) {
  if (leavesVisualBrief(text)) return null;
  if (priorFile.test(text)) return 'pointer';
  // A stand-alone question about aspect ratios is help, not a change to the project.
  if (
    /^(?:comment|pourquoi|qu['’]est|quelle est|how (?:do|does|can|is)|what (?:is|are)|why|como|que es|por que)\b/.test(
      text.trim(),
    )
  )
    return null;
  if (framing.test(text) || changeSubject.test(text) || treatment.test(text) || alternative.test(text))
    return 'revision';
  return null;
}

const visualBrief =
  /\b(?:retouch\w*|retoc\w*|edit\w*|modif\w*|portrait\w*|retrato\w*|look|pistes?|direc\w*|ideas?|idees?|cadrage|styl\w*|estilo|visages?|faces?|rostros?|caras?|affiche|poster|[eo]ptions?|opciones)\b/;
const asksForDirection =
  /\?|\b(?:[12][).:]|deux (?:idees|pistes|options)|two (?:ideas|options)|dos (?:ideas|opciones))\s/;

export function hasVisualBrief(message: string, reply: string, draft: StoredStudioDraft) {
  if (draft.image?.mode === 'i2i' || draft.media?.action === 'video.prepare') return true;
  const alreadyBound = Boolean(draft.recalledReferences?.length);
  return (
    (alreadyBound && !!visualReplyKind(message)) ||
    (visualBrief.test(message + ' ' + reply) && (asksForDirection.test(reply) || alreadyBound))
  );
}

export function asksForSameFile(reply: string) {
  return (
    !newSource.test(reply) &&
    (askedToReattach(reply) ||
      /\b(?:joins|joindre|joignez|renvoie|envoyer|attach|upload|adjunt\w*|sube)\b.{0,40}\b(?:photo|image|portrait|video|file|foto|imagen)\b/.test(
        reply,
      ))
  );
}
