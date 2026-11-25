import type {StudioCreatorPreparation} from '@/lib/studio/conversation-creator-contract';
import type {ResolvedReference} from '@/server/agent-api/reference-types';

/** Studio recommends source edits separately from the manual Create selector. */
export const videoEditModels = [
  { id: 'wan-3', label: 'Wan 3' },
  { id: 'wan-3-prime', label: 'Wan 3 Prime' },
  { id: 'luma-ray-3-2', label: 'Luma Ray 3.2' },
] as const;

export function studioEditComparisonPolicy(message: string) {
  const text = message.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const economic = /\b(?:cheap\w*|lowest|least expensive|save money|econom\w*|moins (?:cher\w*|cout\w*)|meilleur prix|petit (?:prix|budget)|prix (?:mini\w*|le plus bas)|mas barat\w*|menor (?:precio|coste)|asequible|(?:tight|limited|small) budget|budget (?:serre|limite)|presupuesto (?:limitado|ajustado))\b/;
  const negated = /\b(?:no|not|never|don't|dont|isn't|isnt|pas|sans|aucun|peu importe|indiferente|sin)\b/;
  const clauses = text.split(/[,;.!?]|\b(?:mais|but|pero|plutot|instead|sino)\b/);
  const byPrice = clauses.some(clause=>economic.test(clause) && !negated.test(clause));
  return { preferred: byPrice ? [] : videoEditModels.map(m=>m.id) };
}

export const studioVideoEditAdvice = `For ordinary source-video edits, including a recognizable person, recommend ${videoEditModels.map(m=>m.label).join(', then ')}, only when available and compatible with the operation, source and requested settings. Honor an explicit model choice or lowest-price request. Use accepted output settings independently of measured input duration and retain the frame when possible. Seedance 2.5 can reject recognizable faces in reference media, including generated images. This face restriction does not apply to text-only or product/ad shots without recognizable people.`;

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

export function portraitMisroutedToProduct(
  action: StudioCreatorPreparation, recentClientBrief: string, references: readonly ResolvedReference[],
) {
  if (action.action !== 'creator.prepare' || action.toolId !== 'product-video-editor' || action.inputs.length !== 1) return false;
  const [{source,role,segment}] = action.inputs;
  if (source.type !== 'asset' || source.kind !== 'video' || role !== 'source' || segment ||
      !references.some(ref => ref.assetId === source.assetId && ref.mediaKind === 'video')) return false;
  // Product campaigns can include people. Preserve an explicitly requested product workflow.
  if (/\b(?:product|produit|producto|advertising|commercial|publicit\w*|anuncio|campaign|campagne|campa[ñn]a)\b/i.test(recentClientBrief)) return false;
  const instruction = action.settings?.find(s => s.name === 'instruction')?.value;
  return typeof instruction === 'string' && mentionsPersonToPreserve(recentClientBrief + ' ' + instruction);
}

/** A request for model advice with one active source should use verified options. */
export function asksForVideoEditModels(message:string) {
  const text=message.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return /\b(?:which|what|quel[s]?|que|cual(?:es)?)\s+(?:(?:video|editing|de|los|les|meilleur|best)\s+){0,2}(?:model\w*|moteurs?)\b|\b(?:recommend\w*|recommand\w*|recomiend\w*)\b.{0,36}\b(?:model\w*|moteurs?)\b/.test(text);
}
