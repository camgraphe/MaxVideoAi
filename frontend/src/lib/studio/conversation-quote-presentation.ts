import { findElevenVoice } from '@/lib/audio-eleven-voices';
import type {SeedanceEditSourceFacts} from '../seedance-edit-source';
import {seedanceEditSourceLabel} from '../seedance-edit-source-copy';
import type {ImageConversationTurn} from './image-conversation-contract';
import {isFlux3MaxEngineId,parseFlux3MaxKeyframeIndexes} from '@/lib/flux-3-max';
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
export function conversationQuotePresentation(request: NonNullable<ImageConversationTurn['quote']>['summary'], locale: ConversationLocale, outputDurationSec?:number, sourceVideoOutput?:SeedanceEditSourceFacts) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const referenceLabels = (request.references ?? []).map(reference => {
    switch(reference.role) {
      case 'source_video': return t('source video','vidéo source');
      case 'voice_sample': return t('voice sample','échantillon de voix');
      case 'first_frame': return t('start frame','image de départ');
      case 'last_frame': return t('end frame','image de fin');
      case 'mask': return t('mask','masque');
      case 'source': return request.mode==='a2v' ? t('source audio','audio source')
        : ['extend','v2v','r2v','retake','reframe'].includes(request.mode) ? t('source clip','clip source') : t('source image','image source');
      default: return t('reference','référence');
    }
  });
  const referenceCounts=new Map<string,number>();
  for(const label of referenceLabels)referenceCounts.set(label,(referenceCounts.get(label)??0)+1);
  const referenceSummary=[...referenceCounts].map(([label,count])=>count>1?`${count} × ${label}`:label).join(' · ');
  if (request.surface === 'audio') {
    const voice = request.mode === 'voice_only';
    const titles={
      voice_only:t('Voiceover','Voix off'), music_only:t('Music','Musique'),
      sfx_only:t('Sound effect','Effet sonore'), song:t('Song','Chanson'), ambience_only:t('Ambience','Ambiance sonore'),
      cinematic:t('Video soundtrack','Bande-son vidéo'), cinematic_voice:t('Video soundtrack with voice','Bande-son vidéo avec voix'),
    };
    const cloned=request.references?.some(reference=>reference.role==='voice_sample');
    return {title: titles[request.mode],operation:'',
      create: voice ? t('Create voiceover', 'Créer la voix') : request.mode==='music_only' ? t('Create music','Créer la musique')
        : request.mode==='cinematic'||request.mode==='cinematic_voice' ? t('Create soundtrack','Créer la bande-son') : t('Create audio','Créer le son'),
      direction: voice ? request.settings.script ?? '' : [request.prompt,
        request.settings.script ? `${t('Narration','Narration')}: ${request.settings.script}` : '',
        request.settings.lyrics ? `${t('Lyrics','Paroles')}: ${request.settings.lyrics}` : ''].filter(Boolean).join('\n\n'),
      referenceSummary,
      settings: [voice ? '' : request.settings.durationSec ? `${request.settings.durationSec} s` : '',
        request.settings.language, findElevenVoice(request.settings.elevenVoiceId)?.name, cloned ? t('cloned voice','voix clonée') : request.settings.voiceModel,
        voice ? request.settings.seedAudioOutputFormat : request.settings.musicModel, request.settings.mood,
        request.settings.musicEnabled===false ? t('no music','sans musique') : ''].filter(Boolean).join(' · ')};
  }
  const subjects = request.subjects?.map((subject,index)=>{
    const slots=subject.kind==='video'?[subject.referenceSlot]:[subject.frontalReferenceSlot,...subject.referenceSlots];
    return `${t('Subject','Sujet')} ${index+1} · ${subject.kind==='video'?t('video','vidéo'):t('image views','vues image')} · ${t('reference positions','positions des références')} ${slots.map(slot=>slot+1).join(', ')}`;
  }).join('\n');
  const video = request.surface === 'video';
  const fluxMax = video && isFlux3MaxEngineId(request.engineId);
  const keyframeIndexes = fluxMax && request.mode === 'ref2v' ? parseFlux3MaxKeyframeIndexes(request.settings.keyframeIndexes) : null;
  const keyframeTimes = keyframeIndexes?.map(index => `${new Intl.NumberFormat(locale, {maximumFractionDigits:3}).format(index / 24)} s`).join(', ');
  const maxControls = fluxMax ? [
    keyframeTimes ? `${t('keyframes','images clés')} ${keyframeTimes}` : '',
    request.settings.reasoningLevel === 'low' || request.settings.reasoningLevel === 'high'
      ? `${t('reasoning','analyse')} ${request.settings.reasoningLevel === 'high' ? t('high','approfondie') : t('low','rapide')}` : '',
    typeof request.settings.seed === 'number' ? `${t('seed','graine')} ${request.settings.seed}` : '',
  ] : [];
  const duration=typeof outputDurationSec==='number'&&Number.isFinite(outputDurationSec)&&outputDurationSec>0
    ? outputDurationSec : request.settings.durationSec;
  const dimensions=!video&&typeof request.settings.imageWidth==='number'&&typeof request.settings.imageHeight==='number'
    ? `${request.settings.imageWidth} × ${request.settings.imageHeight} px` : '';
  const segment=video&&request.mode==='retake'&&typeof request.settings.startTimeSec==='number'&&typeof request.settings.durationSec==='number'
    ? `${t('segment','passage')} ${request.settings.startTimeSec}–${request.settings.startTimeSec+request.settings.durationSec} s` : '';
  const videoTitle=request.mode==='extend' ? t('Clip extension','Extension du clip') : request.mode==='v2v' ? t('Video edit','Modification vidéo')
    : request.mode==='r2v' ? t('Video from clips','Vidéo depuis des clips') : request.mode==='a2v' ? t('Audio-driven video','Vidéo guidée par le son')
      : request.mode==='retake' ? t('Clip retake','Reprise du clip') : request.mode==='reframe' ? t('Reframed video','Vidéo recadrée') : t('Video','Vidéo');
  const operation=!video?'':request.mode==='extend'
    ? t('This quote generates an extension. If delivered as a separate continuation, it needs assembly with the original to play the full sequence.','Ce devis génère une prolongation. Si elle est livrée dans un clip distinct, elle doit être assemblée avec l’original pour lire la séquence complète.')
    : request.mode==='v2v'
      ? t('This quote regenerates visuals using the source video as guidance.','Ce devis régénère les images à partir de la vidéo source.')
      : request.mode==='t2v'
        ? t('This quote creates a new video from your description.','Ce devis crée une nouvelle vidéo à partir de votre description.') : '';
  return {title: video ? videoTitle : t('Image', 'Une image'),operation, create: video ? request.mode==='extend' ? t('Extend clip','Prolonger le clip') : t('Create video', 'Créer la vidéo') : t('Create image', 'Créer l’image'),
    direction: [Array.isArray(request.settings.multiPrompt)
      ? request.settings.multiPrompt.map((shot,index)=>`${t('Shot','Plan')} ${index+1} · ${shot.durationSec} s\n${shot.prompt}`).join('\n\n')
      : request.prompt, subjects].filter(Boolean).join('\n\n'),

    referenceSummary,
    settings: [video&&sourceVideoOutput?seedanceEditSourceLabel(sourceVideoOutput,locale):request.settings.aspectRatio, dimensions,dimensions&&request.settings.resolution==='custom'?'':request.settings.resolution,
      segment || (video && duration && !sourceVideoOutput ? `${duration} s` : ''),
      video ? request.settings.audio === false ? t('silent', 'sans audio') : '' : request.settings.outputFormat ?? 'PNG', ...maxControls].filter(Boolean).join(' · ')};
}
