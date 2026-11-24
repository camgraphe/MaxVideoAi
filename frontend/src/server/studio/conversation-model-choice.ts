import { getModelRoster } from '@/lib/model-roster';
import { AUDIO_PACK_VALUES, AUDIO_VOICE_MODEL_LABELS, getAudioPackConfig } from '@/lib/audio-generation';

// Compare user-visible names, family names and engine IDs on word boundaries.
function words(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const roster = getModelRoster();
const names = new Set(roster.flatMap(model =>
  [model.engineId, model.marketingName, model.family ?? ''].filter(Boolean).map(words),
));
const modelIds = new Set(roster.map(model => model.engineId));
const spellings = new Map<string, Set<string>>();
for (const model of roster) {
  for (const spelling of [words(model.engineId), words(model.marketingName)]) {
    const ids = spellings.get(spelling) ?? new Set<string>();
    ids.add(model.engineId);
    spellings.set(spelling, ids);
  }
}

/** A full name may differ in punctuation. A family alone never substitutes for a model ID. */
export function studioModelIdFromSpelling(value: string) {
  if (modelIds.has(value)) return value;
  const matches = spellings.get(words(value));
  return matches?.size === 1 ? [...matches][0] : value;
}

for (const mode of AUDIO_PACK_VALUES) {
  const pack = getAudioPackConfig(mode);
  names.add(words(pack.engineId));
  names.add(words(pack.label));
}
for (const label of Object.values(AUDIO_VOICE_MODEL_LABELS)) {
  names.add(words(label));
  names.add(words(label.replace(/\s+\d+(?:\.\d+)*$/, '')));
}

export function studioModelChoice(message: string) {
  if (message.length > 160) return null;
  const choice = words(message)
    .replace(/^(?:oui|yes|si|ok) /, '')
    .replace(/^(?:je (?:choisis|prends|prefere|veux)|allons y avec|partons sur|va pour|avec|i (?:choose|prefer|want)|let s (?:use|go with)|go with|use|elijo|prefiero|quiero|con) /, '')
    .replace(/ (?:s il (?:te|vous) plait|svp|merci|please|por favor|gracias)$/, '');
  return names.has(choice) ? choice : null;
}

export function offeredStudioModel(reply: string, choice: string) {
  const normalized = ' ' + words(reply) + ' ';
  if (!normalized.includes(' ' + choice + ' ') || askedToReattach(reply)) return false;
  return /\b(?:lequel|laquelle|quel modele|choisi\w*|choix|prefer\w*|souhait\w*|veux tu|voulez vous|which|choose|pick|select|would you like|shall i|should i|quieres|prefier\w*|cual|elige|elegir|que modelo)\b/.test(normalized)
    || (reply.includes('?') && /\b(?:prepar\w*|go with|on part sur)\b/.test(normalized));
}

export function studioOfferedModelId(reply: string, choice: string) {
  const offer = ' ' + words(reply) + ' ';
  const matches = roster.filter(model => {
    const identifiers = [words(model.marketingName), words(model.engineId)];
    const chosen = identifiers.some(name => name === choice || name.startsWith(choice + ' ')) || words(model.family ?? '') === choice;
    return chosen && identifiers.some(name => offer.includes(' ' + name + ' '));
  });
  return matches.length === 1 ? matches[0].engineId : undefined;
}

export function sameStudioModelChoice(message: string, choice: string) {
  const previous = studioModelChoice(message);
  return !!previous && (previous === choice || choice.startsWith(previous + ' ') || previous.startsWith(choice + ' '));
}

export function askedToReattach(reply: string) {
  const text = words(reply);
  return /\b(?:renvoy\w*|renvoi\w*|rattache\w*|reattach\w*|reupload\w*|resend)\b/.test(text)
    || /\b(?:joindre|joins|joignez|attacher|attach|upload|adjunt\w*|subir)\b.{0,65}\b(?:a nouveau|encore|again|de nuevo|otra vez)\b/.test(text)
    || /\b(?:veuillez|merci de|please|can you|could you|vuelve a|puedes|por favor)\b.{0,28}\b(?:joindre|attach|upload|adjuntar|subir)\b/.test(text);
}

export function fileSetAside(message: string) {
  const text = words(message);
  return /\b(?:pour plus tard|for later|para (?:mas tarde|despues))\b/.test(text) &&
    !/\b(?:mais|but|pero|maintenant|now|ahora|plutot|instead|en vez)\b/.test(text);
}
