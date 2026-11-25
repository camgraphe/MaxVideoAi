/** Studio's contextual preference for a person in a source edit, independent of the general Modify review. */
export const portraitEditModels = [
  { id: 'wan-3-prime', label: 'Wan 3 Prime' },
  { id: 'wan-3', label: 'Wan 3' },
  { id: 'luma-ray-3-2', label: 'Luma Ray 3.2' },
] as const;

export const studioVideoEditAdvice = `For an edit involving a recognizable person in the source, prefer ${portraitEditModels[0].label}, then ${portraitEditModels[1].label}, then ${portraitEditModels[2].label}, only when available and compatible with the operation and file. Honor an explicit model choice. Seedance 2.5 can reject recognizable faces in video or image references, including generated images. This preference does not apply to text-only or product/ad shots without recognizable people.`;

/** For a quote-only revision there is no model call. Use only positive evidence from the saved brief. */
export function mentionsPersonToPreserve(brief: string) {
  const text = brief.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (
    /\b(?:without|no|sans|aucun[es]*|sin|ningun[ao]?)\s+(?:(?:a|any|une?|de|des|personas?|personne[s]?|recognizable|recognisable|identifiable|visible|real)\s+){0,3}(?:faces?|people|persons?|humans?|visages?|personnes?|rostros?|caras?|personas?)\b/.test(
      text,
    )
  )
    return false;
  return /\b(?:(?:my|his|her|their|the same) (?:face|likeness|identity)|(?:mon|son|le meme) visage|(?:mi|su|el mismo) (?:rostro|cara)|recogniz[ae]ble (?:people|person|face)|recognisable (?:people|person|face)|(?:personne|visage|persona|rostro) (?:reconnaissable|reconocible)|(?:keep|preserve|retain|garde[rz]?|conserve[rz]?|mant[eé]n|conserva) (?:the|le|el) (?:face|visage|rostro)|(?:video|clip) (?:of me|de moi|de mi))\b/.test(
    text,
  );
}
