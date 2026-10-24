import { VIDEO_EXCERPT_PREPARATION_LIMITS as limits, type VideoExcerptLimits } from '@/lib/video-excerpt';

export function videoExcerptCopy(locale: string, kind: 'video' | 'audio' = 'video') {
  const copy = locale === 'fr'
    ? {
        close: 'Fermer',
        timeline: 'PASSAGE',
        play: 'Lire le passage',
        pause: 'Pause',
        seek: 'Position de lecture',
        move: 'Déplacer le passage',
        zoom: 'Zoom sur le passage',
        fullView: 'Vue complète',
        whole: 'Vidéo entière',
        dragHint: 'Glissez les poignées pour ajuster',
        inPoint: 'Début',
        outPoint: 'Fin',
        timelineHelp: 'Flèches : 0,1 seconde ; Maj + flèche : 1 seconde. Début et Fin : limites. Glissez la sélection pour la déplacer ou la règle pour lire une autre position.',
        loadingPreview: 'Ouverture de la vidéo originale…',
        editing: 'Choix du passage…',
        requires: 'Choisissez un passage respectant les limites du modèle pour calculer le prix.',
        choose: 'Choisir un passage',
        title: 'Quel passage souhaitez-vous utiliser ?',
        start: 'Début (secondes)',
        end: 'Fin (secondes)',
        cancel: 'Annuler',
        apply: 'Utiliser ce passage',
        busy: 'Préparation…',
        length: 'Durée sélectionnée',
        limits: 'Limites du modèle',
        invalid: 'Choisissez un début et une fin valides dans la vidéo, en respectant les limites du modèle.',
        quote: 'La préparation est gratuite. Le prix de génération sera recalculé pour ce passage.',
        failed: 'Impossible de préparer ce passage. Réessayez.',
        network: 'Vérifiez votre connexion, puis réessayez de préparer le passage.',
        malformed: 'Le passage préparé n’a pas pu être vérifié. Réessayez.',
        budget: `Utilisez une source de ${limits.maxBytes / 1024 / 1024} Mio et ${limits.maxSourceSec} s maximum, et un passage de ${limits.maxExcerptSec} s maximum. Réduisez aussi la taille d’image ou la fréquence si nécessaire et respectez les limites du modèle. La génération avec la vidéo entière reste disponible selon le modèle.`,
        auth: 'Connectez-vous de nouveau, puis choisissez la vidéo à préparer.',
        source: 'Cette vidéo a changé ou n’est plus disponible. Choisissez-la de nouveau.',
        model: 'Ce modèle ou ce mode n’est plus disponible. Choisissez-en un autre.',
        busyFailure: 'Une préparation est déjà en cours. Réessayez dans un instant.',
      }
    : locale === 'es'
      ? {
          close: 'Cerrar',
          timeline: 'FRAGMENTO',
          play: 'Reproducir fragmento',
          pause: 'Pausa',
          seek: 'Posición de reproducción',
          move: 'Mover fragmento',
          zoom: 'Ampliar fragmento',
          fullView: 'Vista completa',
          whole: 'Vídeo completo',
          dragHint: 'Arrastra los controles para ajustar',
          inPoint: 'Inicio',
          outPoint: 'Fin',
          timelineHelp: 'Flechas: 0,1 segundos; Mayús + flecha: 1 segundo. Inicio y Fin: límites. Arrastra la selección para moverla o la regla para buscar.',
          loadingPreview: 'Abriendo el vídeo original…',
          editing: 'Eligiendo fragmento…',
          requires: 'Elige un fragmento dentro de los límites del modelo para calcular el precio.',
          choose: 'Elegir fragmento',
          title: '¿Qué parte quieres usar?',
          start: 'Inicio (segundos)',
          end: 'Fin (segundos)',
          cancel: 'Cancelar',
          apply: 'Usar este fragmento',
          busy: 'Preparando…',
          length: 'Duración seleccionada',
          limits: 'Límites del modelo',
          invalid: 'Elige un inicio y un final válidos dentro del vídeo y de los límites del modelo.',
          quote: 'Preparar es gratis. Recalcularemos el precio de generación para este fragmento.',
          failed: 'No se pudo preparar el fragmento. Inténtalo de nuevo.',
          network: 'Comprueba tu conexión e intenta preparar el fragmento de nuevo.',
          malformed: 'No se pudo verificar el fragmento preparado. Inténtalo de nuevo.',
          budget: `Usa un vídeo de ${limits.maxBytes / 1024 / 1024} MiB y ${limits.maxSourceSec} s como máximo, y un fragmento de ${limits.maxExcerptSec} s como máximo. Reduce también el tamaño de imagen o los fps si es necesario y respeta los límites del modelo. La generación con el vídeo completo sigue disponible según el modelo.`,
          auth: 'Inicia sesión de nuevo y vuelve a elegir el vídeo.',
          source: 'El vídeo ha cambiado o ya no está disponible. Vuelve a elegirlo.',
          model: 'Este modelo o modo ya no está disponible. Elige otro.',
          busyFailure: 'Ya hay una preparación en curso. Inténtalo dentro de un momento.',
        }
      : {
          close: 'Close',
          timeline: 'SECTION',
          play: 'Play section',
          pause: 'Pause',
          seek: 'Playback position',
          move: 'Move section',
          zoom: 'Zoom to section',
          fullView: 'Full view',
          whole: 'Whole video',
          dragHint: 'Drag the handles to trim',
          inPoint: 'In',
          outPoint: 'Out',
          timelineHelp: 'Arrow keys: 0.1 seconds; Shift + arrow: 1 second. Home and End: bounds. Drag the selection to move it, or the time ruler to seek.',
          loadingPreview: 'Opening original video…',
          editing: 'Choosing section…',
          requires: 'Choose a section within this model’s limits to calculate the price.',
          choose: 'Choose section',
          title: 'Which part would you like to use?',
          start: 'Start (seconds)',
          end: 'End (seconds)',
          cancel: 'Cancel',
          apply: 'Use this section',
          busy: 'Preparing…',
          length: 'Selected length',
          limits: 'Model limits',
          invalid: 'Choose a valid start and end within the video and this model’s duration limits.',
          quote: 'Preparation is free. Generation pricing will be recalculated for this section.',
          failed: 'Unable to prepare the section. Try again.',
          network: 'Check your connection, then try preparing the section again.',
          malformed: 'The prepared section could not be verified. Try again.',
          budget: `Use a source up to ${limits.maxBytes / 1024 / 1024} MiB and ${limits.maxSourceSec} s, and a section up to ${limits.maxExcerptSec} s. Also reduce dimensions or frame rate if needed and respect the model’s limits. Full-video generation remains available where the model supports it.`,
          auth: 'Sign in again, then select the source video.',
          source: 'This video changed or is no longer available. Select it again.',
          model: 'This model or mode is no longer available. Choose another one.',
          busyFailure: 'A preparation is already running. Try again shortly.',
        };
  return kind === 'audio' ? { ...copy,
    auth: locale === 'fr' ? 'Connectez-vous de nouveau, puis choisissez l’audio à préparer.' : locale === 'es' ? 'Inicia sesión de nuevo y vuelve a elegir el audio.' : 'Sign in again, then select the source audio.',
    source: locale === 'fr' ? 'Cet audio a changé ou n’est plus disponible. Choisissez-le de nouveau.' : locale === 'es' ? 'El audio ha cambiado o ya no está disponible. Vuelve a elegirlo.' : 'This audio changed or is no longer available. Select it again.',
    budget: locale === 'fr'
      ? `Utilisez un audio mono ou stéréo de ${limits.maxBytes / 1024 / 1024} Mio et ${limits.maxSourceSec} s maximum, et un passage de ${limits.maxExcerptSec} s maximum, en respectant les limites du modèle.`
      : locale === 'es' ? `Usa un audio mono o estéreo de hasta ${limits.maxBytes / 1024 / 1024} MiB y ${limits.maxSourceSec} s, y un fragmento de hasta ${limits.maxExcerptSec} s, dentro de los límites del modelo.`
      : `Use mono or stereo audio up to ${limits.maxBytes / 1024 / 1024} MiB and ${limits.maxSourceSec} s, and a passage up to ${limits.maxExcerptSec} s, within the model’s limits.`,
    whole: locale === 'fr' ? 'Audio entier' : locale === 'es' ? 'Audio completo' : 'Whole audio',
    loadingPreview: locale === 'fr' ? 'Ouverture de l’audio original…' : locale === 'es' ? 'Abriendo el audio original…' : 'Opening original audio…',
    invalid: locale === 'fr' ? 'Choisissez un début et une fin dans l’audio, en respectant les limites du modèle.' : locale === 'es' ? 'Elige inicio y final dentro del audio y de los límites del modelo.' : 'Choose a start and end within the audio and this model’s limits.',
  } : copy;
}

/** Distinguish a source that cannot be repaired by trimming from an editable selection. */
export function videoExcerptDurationMessage(
  issue: 'too-short' | 'too-long',
  limits: Pick<VideoExcerptLimits, 'minDurationSec' | 'maxDurationSec'>,
  locale: string,
  kind: 'video' | 'audio' = 'video',
  selection = false,
): string {
  const seconds = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 })
    .format((issue === 'too-short' ? limits.minDurationSec : limits.maxDurationSec) ?? 0);
  if (locale === 'fr') {
    if (issue === 'too-long') return `Choisissez un passage de ${seconds} s maximum pour calculer le prix.`;
    if (selection) return `Allongez le passage sélectionné pour atteindre au moins ${seconds} s.`;
    return kind === 'audio'
      ? `Cet audio est trop court. Choisissez un audio d’au moins ${seconds} s pour calculer le prix.`
      : `Cette vidéo est trop courte. Choisissez une vidéo d’au moins ${seconds} s pour calculer le prix.`;
  }
  if (locale === 'es') {
    if (issue === 'too-long') return `Elige un fragmento de ${seconds} s como máximo para calcular el precio.`;
    if (selection) return `Amplía el fragmento seleccionado hasta al menos ${seconds} s.`;
    return kind === 'audio'
      ? `Este audio es demasiado corto. Elige un audio de al menos ${seconds} s para calcular el precio.`
      : `Este vídeo es demasiado corto. Elige un vídeo de al menos ${seconds} s para calcular el precio.`;
  }
  if (issue === 'too-long') return `Choose a section of ${seconds} s or less to calculate the price.`;
  if (selection) return `Extend the selected section to at least ${seconds} s.`;
  return `This ${kind} is too short. Choose ${kind === 'audio' ? 'audio' : 'a video'} at least ${seconds} s long to calculate the price.`;
}

/** Never render raw server/browser messages, which may be English or contain private details. */
export function videoExcerptFailureMessage(failure: unknown, locale: string, kind: 'video' | 'audio' = 'video'): string {
  const copy = videoExcerptCopy(locale, kind);
  const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null;
  switch (code) {
    case 'PARAMETER_INVALID':
      return copy.invalid;
    case 'PREPARATION_LIMIT':
      return copy.budget;
    case 'PREPARATION_BUSY':
      return copy.busyFailure;
    case 'AUTH_REQUIRED':
    case 'UNAUTHORIZED':
      return copy.auth;
    case 'SOURCE_UNAVAILABLE':
    case 'SOURCE_CHANGED':
      return copy.source;
    case 'ENGINE_UNAVAILABLE':
      return copy.model;
    case 'NETWORK_ERROR':
      return copy.network;
    case 'MALFORMED_RESPONSE':
      return copy.malformed;
    default:
      return copy.failed;
  }
}
