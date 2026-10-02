import type {ImageConversationTurn} from './image-conversation-contract';
export type ConversationLocale = 'en' | 'fr';
export function conversationFailurePresentation(
  generation: ImageConversationTurn['generation'],
  locale: ConversationLocale,
): string {
  const failure = locale === 'fr' ? 'La création a échoué.' : 'Creation failed.';
  const refund = generation?.paymentStatus === 'refunded_wallet'
    ? locale === 'fr' ? ' Le paiement a été remboursé sur votre wallet.' : ' Your payment was refunded to your wallet.'
    : '';
  const next = locale === 'fr' ? ' Une nouvelle tentative nécessite un nouveau devis.' : ' A new attempt needs a new quote.';
  return failure + refund + next;
}
export function conversationQuotePresentation(request: NonNullable<ImageConversationTurn['quote']>['summary'], locale: ConversationLocale) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  if (request.surface === 'audio') {
    const voice = request.mode === 'voice_only';
    return {title: voice ? t('Voiceover', 'Voix off') : t('Music', 'Musique'),
      create: voice ? t('Create voiceover', 'Créer la voix') : t('Create music', 'Créer la musique'),
      direction: voice ? request.settings.script ?? '' : request.prompt,
      settings: voice ? [request.settings.language, request.settings.voiceModel, request.settings.seedAudioOutputFormat].filter(Boolean).join(' · ')
        : [request.settings.durationSec ? `${request.settings.durationSec} s` : '', request.settings.musicModel, request.settings.mood].filter(Boolean).join(' · ')};
  }
  const video = request.surface === 'video';
  return {title: video ? t('Video', 'Vidéo') : t('Image', 'Une image'), create: video ? t('Create video', 'Créer la vidéo') : t('Create image', 'Créer l’image'),
    direction: request.prompt,
    settings: [request.settings.aspectRatio, request.settings.resolution,
      video && request.settings.durationSec ? `${request.settings.durationSec} s` : '',
      video ? request.settings.audio === false ? t('silent', 'sans audio') : '' : request.settings.outputFormat ?? 'PNG'].filter(Boolean).join(' · ')};
}
