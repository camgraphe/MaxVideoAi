import { query } from '@/lib/db';
import { STUDIO_CONVERSATION_MAX_ATTACHMENTS } from '@/lib/studio/conversation-creation-contract';
import type { ImageTurnInput } from '@/lib/studio/image-conversation-contract';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import {
  findStudioProjectReferences,
  findStudioProjectReferencesByKind,
  originalStudioReferences,
  projectStillContainsReferences,
  type StoredStudioDraft,
  type StudioRecalledReference,
} from './project-reference-registry';
import { resolveStudioMedia } from './media-resolver';
import { studioConversationLanguage } from './conversation-language';
import { askedToReattach, fileSetAside, offeredStudioModel, sameStudioModelChoice, studioModelChoice } from './conversation-model-choice';

type PriorTurn = { request_id: string; input_json: ImageTurnInput; draft_json: StoredStudioDraft };
type Recall = { input: ImageTurnInput; sources?: StudioRecalledReference[]; clarification?: string };
const normalized = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const names = {
  image: 'Image',
  images: 'Image',
  imagen: 'Image',
  imagenes: 'Image',
  photo: 'Image',
  photos: 'Image',
  foto: 'Image',
  fotos: 'Image',
  video: 'Video',
  videos: 'Video',
  audio: 'Audio',
  audios: 'Audio',
} as const;
const explicitLabel =
  /\b(imagenes|images?|imagen|photos?|fotos?|videos?|audios?)\s*#?\s*([1-9]\d{0,5})\b(?![:./]\d|\s*(?:s|sec\w*|seg\w*|min\w*|fps|pixels?|px|k|p)\b)/g;
function requestedLabels(text: string) {
  const include = new Set<string>();
  const exclude = new Set<string>();
  let previousEnd = 0;
  let excludeList = false;
  for (const match of text.matchAll(explicitLabel)) {
    const lead = text.slice(0, match.index).trimEnd().replace(/@$/, '').trimEnd();
    if (/\bgpt[- ]?$/.test(lead)) continue;
    const continuesList = /^(?:\s|,|&|@|\b(?:et|and|y|ni|nor)\b)+$/.test(text.slice(previousEnd, match.index));
    const negative: boolean =
      (excludeList && continuesList) ||
      /\b(?:ignor(?:e[rz]?|a)|skip|omit|omets?|omite|exclud(?:e|ing)|exclu[ers]?|excluye|(?:don['’]t|do not) use|no (?:uses|utilices)|except|excepto|sauf|without|sans|sin|not|pas|ni|no uses)(?:\s+(?:using|utiliser|usar))?(?:\s+(?:the|la|le))?\s*(?:l['’])?$/.test(
        lead,
      );
    previousEnd = match.index + match[0].length;
    excludeList = negative;
    const labels = negative ? exclude : include;
    const kind = names[match[1] as keyof typeof names];
    labels.add(kind + ' ' + match[2]);
    const rest = text.slice(match.index + match[0].length);
    for (const number of (rest.match(/^(?:\s*(?:,|&|and\b|et\b|y\b)\s*#?[1-9]\d{0,5}\b)+/)?.[0] ?? '').match(
      /\d+/g,
    ) ?? [])
      labels.add(kind + ' ' + number);
  }
  return { include: [...include].filter((label) => !exclude.has(label)), exclude };
}

function followUp(text: string) {
  const brief = text
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
  if (
    /^(?:(?:je choisis|i choose|elijo)\s+)?(?:(?:option|version|choix|opcion|choice)\s*)?#?[1-9](?:\s*(?:st|nd|rd|th|ere|eme))?$/.test(
      brief,
    )
  )
    return 'choice';
  if (
    /^(?:(?:the|la|le|el)\s+)?(?:first|second|premier(?:e)?|deuxieme|seconde?|primer[oa]?|segund[oa])(?:\s+(?:one|option|version|opcion))?$/.test(
      brief,
    )
  )
    return 'choice';
  if (
    /^(?:oui|ouais|yes|yep|si|vale|ok(?:ay)?|d['’ ]accord|go ahead|vas[- ]y|adelante)(?:\s*[,!]?\s*(?:merci|please|por favor|s['’]il te plait))?$/.test(
      brief,
    )
  )
    return 'accept';
  if (/^(?:oui|ok|yes|si|vale)[, !]+(?:prepare(?:r|z)?(?:[- ]la| cette retouche| le devis| it| the (?:edit|quote))|go ahead|prepara(?:la| el (?:retoque|presupuesto)))[.! ]*$/.test(brief))
    return 'accept';
  if (
    /^(?:(?:un peu|a bit|un poco)\s+)?(?:plus|more|mas)\s+(?:clair\w*|sombre\w*|contrast\w*|chaud\w*|lumineu\w*|dark\w*|light\w*|bright\w*|warm\w*|oscur\w*|clar\w*)\b/.test(
      brief,
    )
  )
    return 'edit';
  if (
    /\b(compare|compara\w*|compar\w*)\b.*\b(both|them|les deux|las dos|ambas|photos?|images?|imagenes|fotos?)\b/.test(
      text,
    )
  )
    return 'compare';
  if (/\b(?:utilise[rz]?|prends?|use|take|usa|utiliza)\s+(?:les deux|both(?: of them)?|(?:las|los) dos|amb[ao]s)\b/.test(text))
    return 'compare';
  if (
    /\b(retouch\w*|retoc\w*|edit\w*|modifi\w*|chang\w*|cambi\w*|remplac\w*|replace|make|rends?|pon|rework|reprends|reutilis\w*|reuse|reutiliz\w*)\b/.test(
      text,
    ) &&
    /\b(it|this|that|same|photo|image|video|audio|fond|background|fondo|cette|celle|meme|la|esa|esta|misma|foto)\b/.test(
      text,
    )
  )
    return 'edit';
  return null;
}

const mediaOffer =
  /\b(retouch\w*|retoc\w*|edit\w*|modif\w*|image\w*|photo\w*|foto\w*|video\w*|audio\w*|fond|background|fondo|color\w*|couleur\w*)\b/;
const offer = /\?|(?:^|\s)[12][).:\s-]|\b(?:option\w*|choi\w*|opcion\w*|prefer\w*|devis|quote|presupuesto)\b/;
const copy = {
  en: {
    ambiguous: 'Which file do you mean? Give its unique label or select the file in your library.',
    missing: 'I can’t read that reference in this project. Choose another available file or attach it again.',
  },
  fr: {
    ambiguous:
      'De quel fichier s’agit-il ? Indique son libellé s’il est unique, ou sélectionne le fichier dans ta bibliothèque.',
    missing:
      'Je ne peux pas lire cette référence dans ce projet. Choisis un autre fichier disponible ou joins-la à nouveau.',
  },
  es: {
    ambiguous: '¿A qué archivo te refieres? Indica una etiqueta única o selecciona el archivo en tu biblioteca.',
    missing: 'No puedo leer esa referencia en este proyecto. Elige otro archivo disponible o vuelve a adjuntarlo.',
  },
};

async function previousTurns(actor: StudioGenerationActor, before: string, limit: number) {
  return query<PriorTurn>(
    `SELECT request_id,input_json,draft_json FROM studio_image_turns
    WHERE user_id=$1 AND project_id=$2 AND state='ready' AND (created_at,request_id)<(
      SELECT created_at,request_id FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3)
    ORDER BY created_at DESC,request_id DESC LIMIT $4`,
    [actor.userId, actor.projectId, before, limit],
  );
}

/** The effective input is private to this execution. The immutable submitted turn remains the journal source. */
export async function recallStudioReferences(
  actor: StudioGenerationActor,
  input: ImageTurnInput,
  draft: StoredStudioDraft | null,
): Promise<Recall> {
  if (draft && !draft.recalledReferences) return { input };
  const before = input.renewedFromRequestId ?? input.requestId;
  const text = normalized(input.message);
  const mentioned = requestedLabels(text);
  let filtered = false;
  if (mentioned.exclude.size) {
    const entered = originalStudioReferences(input, input.requestId);
    const omitted = new Set(entered.filter((ref) => mentioned.exclude.has(ref.label)).map((ref) => ref.assetId));
    filtered = omitted.size > 0;
    if (filtered)
      input = {
        ...input,
        references: input.references.filter((id) => !omitted.has(id)),
        attachments: input.attachments?.filter((ref) => ref.type !== 'asset' || !omitted.has(ref.assetId)),
        referenceMentions: entered
          .filter((ref) => !omitted.has(ref.assetId))
          .map(({ label, assetId }) => ({ label, assetId })),
      };
  }
  const current = originalStudioReferences(input, input.requestId);
  if (
    !draft &&
    /\b(?:how (?:do|can) i (?:attach|upload|remove)|comment (?:joindre|ajouter|retirer|importer)|como (?:adjunto|subo|quito))\b/.test(
      text,
    )
  )
    return { input };
  const labels = mentioned.include.filter((label) => !current.some((ref) => ref.label === label));
  const newWork =
    /\b(?:from scratch|de zero|desde cero|(?:new|nouvelle?|nueva?) (?:photo|image|imagen|video|audio)|(?:image|photo|video) (?:neuve|nouvelle|nueva))\b/.test(
      text,
    );
  const modelChoice = studioModelChoice(text);
  const follow =
    !newWork &&
    !current.length &&
    !mentioned.exclude.size &&
    !/\b(?:without|sans|sin)\b|\bdo not use\b|\bne .*pas (?:utiliser|reprendre)\b/.test(text) &&
    (followUp(text) || (modelChoice && 'model'));
  const unchanged: Recall = filtered ? { input, sources: [] } : { input };
  if (!draft && !labels.length && !follow) return unchanged;
  const history = await previousTurns(actor, before, follow === 'model' ? 12 : 4);
  const locale = studioConversationLanguage(
    input.message,
    history.map((t) => ({ message: t.input_json.message })).reverse(),
    input.locale,
  );
  const clarify = (reason: 'missing' | 'ambiguous'): Recall => ({ input, clarification: copy[locale][reason] });
  const clarifyFiles = (refs: StudioRecalledReference[]): Recall => {
    const labels = [...new Set(refs.map(ref => ref.label))];
    if (labels.length < 2 || labels.length !== refs.length) return clarify('ambiguous');
    const choices = new Intl.ListFormat(locale, {type:'disjunction'}).format(labels);
    return {input, clarification: {en:'Which file should I use, ' + choices + '?', fr:'Quel fichier veux-tu utiliser, ' + choices + ' ?', es:'¿Qué archivo quieres usar, ' + choices + '?'}[locale]};
  };
  let sources: StudioRecalledReference[] = [];
  if (draft?.recalledReferences) {
    sources = draft.recalledReferences;
  } else if (labels.length) {
    if (labels.length > STUDIO_CONVERSATION_MAX_ATTACHMENTS) return clarify('ambiguous');
    const found = await findStudioProjectReferences(actor, before, labels);
    for (const label of labels) {
      const matches = found.filter((ref) => ref.label === label);
      if (matches.length !== 1) return clarify(matches.length ? 'ambiguous' : 'missing');
      sources.push(matches[0]);
    }
  } else {
    const named = text.match(/\b(images?|imagenes|imagen|photos?|fotos?|videos?|audios?)\b/);
    let kind = named && !modelChoice
      ? (names[named[1] as keyof typeof names].toLowerCase() as StudioRecalledReference['kind'])
      : undefined;
    let foundModelOffer = false;
    for (const prior of history) {
      const priorExclusions = requestedLabels(normalized(prior.input_json.message)).exclude;
      const direct = originalStudioReferences(prior.input_json, prior.request_id).filter(
        (ref) => !priorExclusions.has(ref.label),
      );
      const active = [...direct, ...(prior.draft_json?.recalledReferences ?? [])].filter(
        (ref) => !kind || ref.kind === kind,
      );
      const reply = normalized(prior.draft_json?.reply ?? '');
      if (follow === 'model' && modelChoice && !foundModelOffer) {
        // A price already prepared or an explicit exclusion ends this offer.
        if (prior.draft_json?.image || prior.draft_json?.media || priorExclusions.size) return unchanged;
        if (direct.length && fileSetAside(prior.input_json.message)) continue;
        if (!active.length && sameStudioModelChoice(prior.input_json.message, modelChoice) && askedToReattach(reply)) continue;
        if (!offeredStudioModel(reply, modelChoice)) return unchanged;
        foundModelOffer = true;
      }
      if (active.length) {
        // A bare yes or number follows an actual creative choice or offer.
        if (follow === 'accept' || follow === 'choice') {
          const aboutMedia =
            mediaOffer.test(reply) ||
            mediaOffer.test(normalized(prior.input_json.message)) ||
            !!prior.draft_json?.recalledReferences?.length;
          if (!offer.test(reply) || !aboutMedia) return unchanged;
        }
        if (active.length > 1 && follow !== 'compare') return clarifyFiles(active);
        if (follow === 'compare' && active.length === 1) {
          kind = active[0].kind;
        } else {
          sources = active;
        }
        break;
      }
      // Bridge old option/acceptance replies written before sources were saved on drafts.
      if (!followUp(normalized(prior.input_json.message))) break;
    }
    if (!sources.length && kind && (follow === 'edit' || follow === 'compare')) {
      const found = await findStudioProjectReferencesByKind(actor, before, kind);
      if (follow === 'compare' ? found.length !== 2 : found.length > 1) return clarifyFiles(found);
      sources = found;
    }
  }
  const selected = [
    ...new Map(
      sources
        .filter((ref) => !current.some((attached) => attached.assetId === ref.assetId))
        .map((ref) => [ref.assetId, ref]),
    ).values(),
  ];
  if (!selected.length) return unchanged;
  if (selected.length + current.length > STUDIO_CONVERSATION_MAX_ATTACHMENTS) return clarify('ambiguous');
  if (!(await projectStillContainsReferences(actor, before, selected))) return clarify('missing');
  for (const ref of selected) {
    try {
      await resolveStudioMedia(actor.userId, { type: 'asset', assetId: ref.assetId, kind: ref.kind });
    } catch (error) {
      if (error instanceof Error && ['MEDIA_NOT_AVAILABLE', 'MEDIA_DELETED'].includes(error.message))
        return clarify('missing');
      throw error;
    }
  }
  return {
    sources: selected,
    input: {
      ...input,
      references: [
        ...input.references,
        ...selected.filter((ref) => ref.kind === 'image').map((ref) => ref.assetId),
      ],
      attachments: [
        ...(input.attachments ?? []),
        ...selected.flatMap((ref) =>
          ref.kind === 'image' ? [] : [{ type: 'asset' as const, assetId: ref.assetId, kind: ref.kind }],
        ),
      ],
      referenceMentions: [
        ...(input.referenceMentions ?? []),
        ...selected.map(({ assetId, label }) => ({ assetId, label })),
      ],
    },
  };
}
