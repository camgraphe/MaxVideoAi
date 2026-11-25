import { studioReferenceDisplayLabel } from '@/lib/mobile-studio';
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
  type RegisteredStudioInput,
} from './project-reference-registry';
import { asksForSameFile, hasVisualBrief, leavesVisualBrief, visualReplyKind } from './conversation-visual-followup';
import { resolveStudioMedia } from './media-resolver';
import { isStudioReferenceError, readStudioPreparationRefusals } from './tasks/preparation-refusals';
import { studioConversationLanguage } from './conversation-language';
import { comparisonSelection, readComparedEdit } from './conversation-comparison-choice';
import { askedToReattach, fileSetAside, offeredStudioModel, sameStudioModelChoice, studioModelChoice, studioOfferedModelId } from './conversation-model-choice';

import {readStudioRevisionRequest, revisionAssetIds, studioQuoteRevision, studioRevisionAlternatives, type StudioQuoteRevision} from './conversation-quote-revision';

type PriorTurn = { state: string; quote_id: string | null; request_id: string; input_json: ImageTurnInput; draft_json: StoredStudioDraft };
type Recall = { input: ImageTurnInput; sources?: StudioRecalledReference[]; selectedModelId?: string; revision?: StudioQuoteRevision; clarification?: string };
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
  if (/^(?:ok(?:ay)?[, ]+go(?: ahead)?|oui[, ]+vas[- ]y|si[, ]+adelante)$/.test(brief)) return 'accept';
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

function whichFile(locale: keyof typeof copy, labels: string[]) {
  const choices = new Intl.ListFormat(locale, {type:'disjunction'}).format(labels.map(label => studioReferenceDisplayLabel(label, locale)));
  return {en:'Which file do you mean, ' + choices + '?', fr:'De quel fichier parles-tu, ' + choices + ' ?', es:'¿A qué archivo te refieres, ' + choices + '?'}[locale];
}

async function previousTurns(actor: StudioGenerationActor, before: string, limit: number, includeFailed: boolean) {
  return query<PriorTurn>(
    `SELECT state,request_id,input_json,draft_json,quote_id FROM studio_image_turns
    WHERE user_id=$1 AND project_id=$2 AND (state='ready' OR ($5 AND state='failed')) AND (created_at,request_id)<(
      SELECT created_at,request_id FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3)
    ORDER BY created_at DESC,request_id DESC LIMIT $4`,
    [actor.userId, actor.projectId, before, limit, includeFailed],
  );
}

/** The effective input is private to this execution. The immutable submitted turn remains the journal source. */
export async function recallStudioReferences(
  actor: StudioGenerationActor,
  input: ImageTurnInput,
  draft: StoredStudioDraft | null,
  labelChanges?: RegisteredStudioInput['referenceLabelChanges'],
): Promise<Recall> {
  if (draft && !draft.recalledReferences) return { input };
  const before = input.renewedFromRequestId ?? input.requestId;
  const text = normalized(input.message);
  const mentioned = requestedLabels(text);
  // The old label in the submitted text could mean either the earlier file or the new attachment.
  const conflicts = labelChanges?.filter(change => mentioned.include.includes(change.from) || mentioned.exclude.has(change.from));
  if (!draft && conflicts?.length) {
    const labels = [...new Set(conflicts.flatMap(change => [change.from,change.to]))];
    return {input, clarification:whichFile(studioConversationLanguage(input.message, [], input.locale), labels)};
  }
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
  // Only strip a trailing, explicitly named replacement. Questions and unrelated text remain ordinary turns.
  const modelText = labels.length ? text.replace(/(?:[,;]?\s+(?:avec|with|con|using|sur|on|en|pour|for|para)\s+)(?:(?:la|le|the|el)\s+)?(?:image|imagen|photo|foto|video|audio)\s+#?\d+[.! ]*$/, '') : text;
  const modelChoice = studioModelChoice(modelText);
  const replacement = labels.length === 1 && /^(?:non[, ]+|no[, ]+)?(?:plutot|rather|instead|use|utilise|usa|mejor)\s+(?:la |le |the |el )?(?:image|imagen|photo|foto|video|audio)\s+#?\d+[.! ]*$/.test(text);
  const mayRevise = !draft && !newWork && !current.length && !mentioned.exclude.size && !!(modelChoice || replacement);
  const comparisonChoice = !draft && !current.length && !newWork && !mentioned.include.length && !mentioned.exclude.size && comparisonSelection(input.message);
  const visualReply = visualReplyKind(text);
  const follow =
    !newWork &&
    !leavesVisualBrief(text) &&
    !current.length &&
    !mentioned.exclude.size &&
    ((!/\b(?:without|sans|sin)\b|\bdo not use\b|\bne .*pas (?:utiliser|reprendre)\b/.test(text) &&
      (followUp(text) || (modelChoice && 'model'))) || (visualReply && 'visual'));
  const unchanged: Recall = filtered ? { input, sources: [] } : { input };
  if (!draft && !labels.length && !follow && !comparisonChoice) return unchanged;
  const accepting = follow === 'accept';
  const history = await previousTurns(actor, before, mayRevise || follow === 'model' || follow === 'visual' || accepting ? 12 : 4, accepting);
  const locale = studioConversationLanguage(
    input.message,
    history.map((t) => ({ message: t.input_json.message })).reverse(),
    input.locale,
  );
  const clarify = (reason: 'missing' | 'ambiguous'): Recall => ({ input, clarification: copy[locale][reason] });
  const clarifyFiles = (refs: StudioRecalledReference[]): Recall => {
    const labels = [...new Set(refs.map(ref => ref.label))];
    if (labels.length < 2 || labels.length !== refs.length) return clarify('ambiguous');
    return {input, clarification:whichFile(locale, labels)};
  };
  let sources: StudioRecalledReference[] = [];
  let selectedModelId: string | undefined;
  let revision:StudioQuoteRevision|undefined;
  if (comparisonChoice) {
    // Only cross the same failed selection. Any other turn starts a different context.
    const prior = history.find(turn => turn.quote_id || !comparisonSelection(turn.input_json.message)
      || originalStudioReferences(turn.input_json, turn.request_id).length || !askedToReattach(turn.draft_json?.reply ?? ''));
    if (!prior || prior.quote_id) return unchanged;
    const bound = [...originalStudioReferences(prior.input_json, prior.request_id), ...(prior.draft_json?.recalledReferences ?? [])];
    const choice = await readComparedEdit(actor, prior.request_id, bound, locale, comparisonChoice);
    if (!choice) return unchanged;
    if ('clarification' in choice) return { input, clarification: choice.clarification };
    ({ sources, revision } = choice);
  } else if (mayRevise) {
    // A new subject, a different attachment or an exclusion ends the old revision context.
    const prior = history.find(turn => turn.quote_id || originalStudioReferences(turn.input_json,turn.request_id).length ||
      !modelChoice || !sameStudioModelChoice(turn.input_json.message,modelChoice) || !askedToReattach(turn.draft_json?.reply ?? ''));
    if (prior?.quote_id && prior.draft_json && !prior.draft_json.recast && !prior.draft_json.characterBuilder) {
      const request = await readStudioRevisionRequest(actor,prior.quote_id,prior.draft_json);
      if (request?.references.length) {
        const receipts = [...originalStudioReferences(prior.input_json,prior.request_id),...(prior.draft_json.recalledReferences ?? [])];
        const bound = revisionAssetIds(request).map(id=>receipts.find(ref=>ref.assetId===id));
        if (bound.every((ref):ref is StudioRecalledReference=>!!ref)) {
          sources=[...bound];
          const substituted=new Set<number>();
          for (const label of labels) {
            const matches=await findStudioProjectReferences(actor,before,[label]);
            if(matches.length!==1) return clarify(matches.length?'ambiguous':'missing');
            const next=matches[0];
            const slots=sources.flatMap((ref,i)=>ref.kind===next.kind?[i]:[]);
            if(slots.length>1) return clarifyFiles(slots.map(index=>sources[index]));
            if(slots.length!==1 || substituted.has(slots[0])) return clarify('ambiguous');
            substituted.add(slots[0]);
            sources[slots[0]]=next;
          }
          revision=studioQuoteRevision(request,prior.draft_json,modelChoice,sources,locale);
          if (modelChoice) revision.alternatives=studioRevisionAlternatives(request,prior.draft_json,sources,locale);
        }
      }
    }
  }
  if (draft?.recalledReferences) {
    sources = draft.recalledReferences;
  } else if (!revision && labels.length) {
    if (labels.length > STUDIO_CONVERSATION_MAX_ATTACHMENTS) return clarify('ambiguous');
    const found = await findStudioProjectReferences(actor, before, labels);
    for (const label of labels) {
      const matches = found.filter((ref) => ref.label === label);
      if (matches.length !== 1) return clarify(matches.length ? 'ambiguous' : 'missing');
      sources.push(matches[0]);
    }
  } else if (!revision && !comparisonChoice && follow === 'visual') {
    // Free directions and corrections only inherit the active visual brief. Never search the whole project.
    let restoring = false;
    for (const prior of history) {
      const message = normalized(prior.input_json.message);
      const reply = normalized(prior.draft_json?.reply ?? '');
      if (leavesVisualBrief(message) || requestedLabels(message).exclude.size) break;
      const direct = originalStudioReferences(prior.input_json, prior.request_id);
      if (direct.length && fileSetAside(message)) continue;
      const bound = [
        ...direct,
        ...(prior.draft_json?.recalledReferences ?? []),
      ];
      if (!bound.length) {
        if (!asksForSameFile(reply) || !(visualReplyKind(message) || followUp(message))) break;
        restoring = true;
        continue;
      }
      if (visualReply === 'pointer' && !restoring && !asksForSameFile(reply)) break;
      if (!prior.draft_json || !hasVisualBrief(message, reply, prior.draft_json)) break;
      const visual = bound.filter((ref) => ref.kind === 'image' || ref.kind === 'video');
      sources = [...new Map(visual.map((ref) => [ref.assetId, ref])).values()];
      if (sources.length > 1) return clarifyFiles(sources);
      break;
    }
  } else if (!revision && !comparisonChoice) {
    const named = text.match(/\b(images?|imagenes|imagen|photos?|fotos?|videos?|audios?)\b/);
    let kind = named && !modelChoice
      ? (names[named[1] as keyof typeof names].toLowerCase() as StudioRecalledReference['kind'])
      : undefined;
    let foundModelOffer = false;
    const interveningFiles: StudioRecalledReference[] = [];
    const refusals = accepting ? await readStudioPreparationRefusals(actor,history.filter(turn=>turn.state==='failed').map(turn=>turn.request_id)) : new Map<string,string>();
    for (const prior of history) {
      const message = normalized(prior.input_json.message);
      const priorExclusions = requestedLabels(message).exclude;
      if (accepting && (leavesVisualBrief(message) || priorExclusions.size)) break;
      if (prior.state === 'failed') {
        // A new confirmation may cross old refusals of this same confirmation, never a new file or unrelated failure.
        if (accepting && followUp(message)==='accept' && !originalStudioReferences(prior.input_json,prior.request_id).length
            && isStudioReferenceError(refusals.get(prior.request_id) ?? '')) continue;
        break;
      }
      const direct = originalStudioReferences(prior.input_json, prior.request_id).filter(
        (ref) => !priorExclusions.has(ref.label),
      );
      const active = [...direct, ...(prior.draft_json?.recalledReferences ?? [])].filter(
        (ref) => !priorExclusions.has(ref.label) && (!kind || ref.kind === kind),
      );
      const reply = normalized(prior.draft_json?.reply ?? '');
      if (follow === 'model' && modelChoice && !foundModelOffer) {
        // A price already prepared or an explicit exclusion ends this offer.
        if (prior.draft_json?.image || prior.draft_json?.media || (priorExclusions.size && !active.length)) return unchanged;
        if (direct.length && fileSetAside(prior.input_json.message)) continue;
        if (!active.length && sameStudioModelChoice(prior.input_json.message, modelChoice) && askedToReattach(reply)) continue;
        if (!offeredStudioModel(reply, modelChoice)) {
          // A different file arrived between the proposed edit and the choice. Only the user can resolve that.
          if (direct.length && !priorExclusions.size) {
            interveningFiles.push(...direct);
            continue;
          }
          return unchanged;
        }
        selectedModelId = studioOfferedModelId(reply, modelChoice);
        foundModelOffer = true;
      }
      if (active.length) {
        if (interveningFiles.length) {
          const candidates = new Map([...active,...interveningFiles].map(ref=>[ref.assetId,ref]));
          if (candidates.size > 1) return clarifyFiles([...candidates.values()]);
        }
        // A bare yes or number follows an actual creative choice or offer.
        if (follow === 'accept' || follow === 'choice') {
          const aboutMedia =
            mediaOffer.test(reply) ||
            mediaOffer.test(normalized(prior.input_json.message)) ||
            !!prior.draft_json?.recalledReferences?.length;
          if (!offer.test(reply) || !aboutMedia) return unchanged;
        }
        if (active.length > 1 && follow !== 'compare') {
          // Bind a named model to the files in its offer. An alternative between files still needs a choice.
          const proposed = requestedLabels(reply).include;
          const named = active.filter(ref => proposed.includes(ref.label));
          if ((foundModelOffer || follow === 'accept') && named.length === proposed.length && named.length &&
              !/\b(?:or|ou|o)\s+(?:(?:la|le|el|the)\s+)?(?:image|imagen|photo|foto|video|audio|#?\d+)\b/.test(reply)) {
            sources = named;
            break;
          }
          return clarifyFiles(active);
        }
        if (follow === 'compare' && active.length === 1) {
          kind = active[0].kind;
        } else {
          sources = active;
        }
        break;
      }
      if (follow === 'edit' && !priorExclusions.size && asksForSameFile(reply) && visualReplyKind(normalized(prior.input_json.message))) continue;
      // Short answers to creative clarifications keep the source of the active brief.
      if (accepting && prior.draft_json && !prior.quote_id && !leavesVisualBrief(reply) && reply.includes('?')
          && hasVisualBrief(message, reply, prior.draft_json)) continue;
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
    revision,
    selectedModelId,
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
