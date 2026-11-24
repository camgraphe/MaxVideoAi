import { AUDIO_VOICE_MODEL_LABELS, getAudioPackConfig } from '@/lib/audio-generation';
import { studioReferenceDisplayLabel } from '@/lib/mobile-studio';
import type { ConversationLocale } from '@/lib/studio/conversation-quote-presentation';
import { getBaseEngineIncludingHidden } from '@/lib/engines';
import type { ImageConversationTurn } from '@/lib/studio/image-conversation-contract';
import { originalStudioReferences } from './project-reference-registry';
import type { StoredImageTurn } from './image-conversation-repository';

type QuoteRequest = NonNullable<ImageConversationTurn['quote']>['summary'];

export function studioQuoteModelLabel(request: QuoteRequest) {
  if (request.surface !== 'audio') return getBaseEngineIncludingHidden(request.engineId)?.label ?? request.engineId;
  const pack = getAudioPackConfig(request.mode);
  const voice = pack.includesVoice && request.settings.voiceModel ? AUDIO_VOICE_MODEL_LABELS[request.settings.voiceModel] : undefined;
  if (!voice) return pack.label;
  return request.mode === 'voice_only' ? voice : pack.label + ' · ' + voice;
}

/** Names come from the original turn receipts, in the order of the signed request. */
export function studioQuoteSourceLabels(turn: StoredImageTurn, request: QuoteRequest, locale: ConversationLocale) {
  if (!request.references.length || turn.draft_json?.characterBuilder || turn.draft_json?.recast) return undefined;
  const receipts = [...originalStudioReferences(turn.input_json, turn.request_id), ...(turn.draft_json?.recalledReferences ?? [])];
  const assetIds = request.surface === 'audio'
    ? request.references.map(ref => ref.asset.type === 'asset' ? ref.asset.assetId : undefined)
    : request.references.map(ref => ref.kind === 'asset' ? ref.assetId : undefined);
  const sources = new Set<string>();
  let unnamed = 0;
  for (const assetId of new Set(assetIds.filter((id): id is string => !!id))) {
    const aliases = new Set(receipts.filter(ref => ref.assetId === assetId).map(ref => ref.label));
    const [label] = aliases;
    if (aliases.size === 1 && !receipts.some(ref => ref.label === label && ref.assetId !== assetId)) sources.add(label);
    else unnamed++;
  }
  unnamed += assetIds.filter(id => !id).length;
  if (!sources.size && !(request.surface === 'image' && request.mode === 'i2i')) return undefined;
  const names = [...sources].map(name => studioReferenceDisplayLabel(name, locale));
  if (names.length && unnamed) {
    const other = {en: unnamed === 1 ? 'other reference' : 'other references',
      fr: unnamed === 1 ? 'autre référence' : 'autres références',
      es: unnamed === 1 ? 'referencia más' : 'referencias más'}[locale];
    names.push(unnamed + ' ' + other);
  }
  return {model: studioQuoteModelLabel(request), displayNames: new Intl.ListFormat(locale, {type:'conjunction'}).format(names)};
}
