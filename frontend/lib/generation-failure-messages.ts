import { getSeedanceFailureMessage } from './seedance-failure-messages';

type Locale = 'en' | 'fr' | 'es';
const copy = {
  en: {
    outputImage: 'A generated image was blocked by safety checks. Change the prompt before trying again.',
    refund: 'Refund',
    duration: 'A reference video exceeds the input limit of 15 seconds. Shorten or replace the reference video before trying again. Changing the output duration does not shorten the reference video.',
    combined: 'The combined duration of the reference videos exceeds the input limit of 15 seconds. Shorten or remove a reference video before trying again.',
    safety: 'This request was blocked by safety checks. Review the prompt and any reference images, video, or audio before trying again.',
    googleSafety: 'Google blocked this request during safety checks. Review the prompt and reference media before trying again.',
    unverified: 'We could not verify the duration of a reference video. Upload it again before generating.',
    measured: 'Measured duration: {duration} seconds.',
    noCharge: 'No credits were charged.',
    referenceLink: 'This reference link cannot be used. Import the original file into MaxVideoAI before preparing a new request.',
    imageSmall: 'The reference image is too small. Use an image with each side at least 256 pixels before trying again.',
    imageRatio: 'The reference image is too wide or too tall. Crop or pad it to a width/height ratio between 0.4 and 2.5 before trying again.',
    modeUnavailable: 'This video editing mode is currently unavailable. Choose another model or contact support.',
    start: 'MaxVideoAI could not start this render. Choose another model or contact support with your request ID if the problem continues.',
    generic: 'MaxVideoAI could not complete this render. Contact support with your request ID if the problem continues.',
    promptBlocked: 'The prompt was blocked by safety checks. Change the prompt before trying again.',
    referenceBlocked: 'A reference image was blocked by safety checks. Replace the reference image before trying again.',
    image: 'image',
    images: 'images',
  },
  fr: {
    outputImage: 'Une image générée a été bloquée par les contrôles de sécurité. Modifiez le prompt avant de réessayer.',
    refund: 'Remboursement',
    duration: 'Une vidéo de référence dépasse la limite d’entrée de 15 secondes. Raccourcissez ou remplacez cette vidéo avant de réessayer. Modifier la durée de sortie ne raccourcit pas la vidéo de référence.',
    combined: 'La durée cumulée des vidéos de référence dépasse la limite d’entrée de 15 secondes. Raccourcissez ou retirez une vidéo de référence avant de réessayer.',
    safety: 'Cette demande a été bloquée par les contrôles de sécurité. Vérifiez le prompt et les images, vidéos ou fichiers audio de référence avant de réessayer.',
    googleSafety: 'Google a refusé cette demande lors de ses contrôles de modération. Vérifiez le prompt et les médias de référence avant de réessayer.',
    unverified: 'Nous n’avons pas pu vérifier la durée d’une vidéo de référence. Importez-la à nouveau avant de générer.',
    measured: 'Durée mesurée : {duration} secondes.',
    noCharge: 'Aucun crédit n’a été débité.',
    referenceLink: 'Ce lien de référence ne peut pas être utilisé. Importez le fichier original dans MaxVideoAI avant de préparer une nouvelle demande.',
    imageSmall: 'L’image de référence est trop petite. Utilisez une image dont chaque côté mesure au moins 256 pixels avant de réessayer.',
    imageRatio: 'L’image de référence est trop large ou trop haute. Recadrez-la ou ajoutez des marges pour obtenir un rapport largeur/hauteur compris entre 0,4 et 2,5 avant de réessayer.',
    modeUnavailable: 'Ce mode de modification vidéo est actuellement indisponible. Choisissez un autre modèle ou contactez le support.',
    start: 'MaxVideoAI n’a pas pu démarrer ce rendu. Choisissez un autre modèle ou contactez le support avec l’identifiant de la demande si le problème persiste.',
    generic: 'MaxVideoAI n’a pas pu terminer ce rendu. Contactez le support avec l’identifiant de la demande si le problème persiste.',
    promptBlocked: 'Le prompt a été bloqué par les contrôles de sécurité. Modifiez le prompt avant de réessayer.',
    referenceBlocked: 'Une image de référence a été bloquée par les contrôles de sécurité. Remplacez cette image avant de réessayer.',
    image: 'image',
    images: 'images',
  },
  es: {
    outputImage: 'Una imagen generada ha sido bloqueada por los controles de seguridad. Cambia el prompt antes de intentarlo de nuevo.',
    refund: 'Reembolso',
    duration: 'Un vídeo de referencia supera el límite de entrada de 15 segundos. Recorta o sustituye ese vídeo antes de intentarlo de nuevo. Cambiar la duración de salida no acorta el vídeo de referencia.',
    combined: 'La duración total de los vídeos de referencia supera el límite de entrada de 15 segundos. Recorta o elimina un vídeo de referencia antes de intentarlo de nuevo.',
    safety: 'Esta solicitud ha sido bloqueada por los controles de seguridad. Revisa el prompt y las imágenes, los vídeos o el audio de referencia antes de intentarlo de nuevo.',
    googleSafety: 'Google ha rechazado esta solicitud durante sus controles de moderación. Revisa el prompt y los medios de referencia antes de intentarlo de nuevo.',
    unverified: 'No hemos podido verificar la duración de un vídeo de referencia. Vuelve a subirlo antes de generar.',
    measured: 'Duración medida: {duration} segundos.',
    noCharge: 'No se han descontado créditos.',
    referenceLink: 'Este enlace de referencia no se puede utilizar. Importa el archivo original en MaxVideoAI antes de preparar una nueva solicitud.',
    imageSmall: 'La imagen de referencia es demasiado pequeña. Utiliza una imagen con al menos 256 píxeles por lado antes de intentarlo de nuevo.',
    imageRatio: 'La imagen de referencia es demasiado ancha o alta. Recórtala o añade márgenes para obtener una relación de ancho/alto entre 0,4 y 2,5 antes de intentarlo de nuevo.',
    modeUnavailable: 'Este modo de edición de vídeo no está disponible actualmente. Elige otro modelo o contacta con soporte.',
    start: 'MaxVideoAI no ha podido iniciar este renderizado. Elige otro modelo o contacta con soporte con el identificador de la solicitud si el problema persiste.',
    generic: 'MaxVideoAI no ha podido completar este renderizado. Contacta con soporte con el identificador de la solicitud si el problema persiste.',
    promptBlocked: 'El prompt ha sido bloqueado por los controles de seguridad. Cambia el prompt antes de intentarlo de nuevo.',
    referenceBlocked: 'Una imagen de referencia ha sido bloqueada por los controles de seguridad. Sustituye esa imagen antes de intentarlo de nuevo.',
    image: 'imagen',
    images: 'imágenes',
  },
} satisfies Record<Locale, Record<string, string>>;

function localeKey(locale = 'en'): Locale {
  return locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en';
}

export function getGeneratedImageFailureMessage(message: string | null | undefined, locale = 'en'): string | null {
  return /^(?:Green net check rejected image \(output\)|(?:A )?generated image was blocked by safety checks\.(?: Change the prompt before trying again\.)?)$/i.test(message?.trim() ?? '')
    ? copy[localeKey(locale)].outputImage : null;
}

/** Project known refund reasons without changing any ledger fields or inventing a refund. */
export function localizeGenerationRefundDescription(description: string | null, locale: string, failureCode?: string | null): string | null {
  if (!description) return description;
  const match = description.match(/^Refund (.+?)(?: - (\d+)s| - (\d+) images?)? - (.+)$/);
  if (!match) return description;
  // Short Seedance reasons need the model context; exact output-image reasons must stay unprefixed.
  const reason = getSeedanceFailureMessage({ failureCode, message: `${match[1]} ${match[4]}`, locale })
    ?? getKnownGenerationFailureMessage({ failureCode, message: match[4], locale })
    ?? getGenerationFailureFallbackMessage(locale);
  const language = localeKey(locale);
  const quantity = match[3] ? `${match[3]} ${copy[language][match[3] === '1' ? 'image' : 'images']}` : null;
  return language === 'en'
    ? `Refund ${match[1]}${match[2] ? ` - ${match[2]}s` : quantity ? ` - ${quantity}` : ''} - ${reason}`
    : `${copy[language].refund} ${match[1]}${match[2] ? ` · ${match[2]} s` : quantity ? ` · ${quantity}` : ''} — ${reason}`;
}

export function getGenerationFailureFallbackMessage(locale = 'en'): string {
  return copy[localeKey(locale)].generic;
}

/** Return fixed public copy only. Never echo a provider body or interpolate its fields. */
export function getKnownGenerationFailureMessage(params: {
  failureCode?: string | null;
  message?: string | null;
  locale?: string;
}): string | null {
  const seedance = getSeedanceFailureMessage(params);
  if (seedance) return seedance;
  const outputImage = getGeneratedImageFailureMessage(params.message, params.locale);
  if (outputImage) return outputImage;
  const text = copy[localeKey(params.locale)];
  const message = params.message?.trim() ?? '';
  if (['reference_link_unsupported', 'IMAGE_HOST_NOT_ALLOWED'].includes(params.failureCode ?? '')
    || /^This reference link cannot be used\./i.test(message)) return text.referenceLink;
  if (params.failureCode === 'LUMA_MODE_UNAVAILABLE'
    || /^This video editing mode is currently unavailable\./i.test(message)) return text.modeUnavailable;
  if (/^Image dimensions are too small\. Minimum dimensions are 256x256 pixels\.$/i.test(message)
    || /^The reference image is too small\./i.test(message)) return text.imageSmall;
  if (/^The aspect ratio of the image should be between 0\.4 and 2\.5\.$/i.test(message)
    || /^The reference image is too wide or too tall\./i.test(message)) return text.imageRatio;
  if (/^(?:Seedream blocked the prompt during safety checks\.|Prompt was blocked by safety checks\.|The prompt was blocked by safety checks\.)/i.test(message)) return text.promptBlocked;
  if (/^(?:Seedream blocked the reference image during safety checks\.|Reference image was blocked by safety checks\.|A reference image was blocked by safety checks\.)/i.test(message)) return text.referenceBlocked;
  if (/^(?:MaxVideoAI could not start this render\.|Render could not start\.)/i.test(message)) return text.start;
  if (/^(?:MaxVideoAI could not complete this render\.|Render could not be completed\.)/i.test(message)) return text.generic;
  // Known historical H3 input rejection; no conclusion about a stored clip's actual duration.
  if (/^Video duration exceeds the maximum allowed\. Maximum is 15(?:\.0+)? seconds\.$/i.test(message)) return text.duration;
  if (/^Google blocked this request during safety checks\./i.test(message)) return text.googleSafety;
  if (/responsible ai|sensitive words|content policy|policy violation|safety|moderation|prohibited|blocked/i.test(message)) return text.safety;
  return null;
}

export function getMinimaxReferenceValidationMessage(params: {
  engineId: string;
  error?: unknown;
  field?: unknown;
  durationSec?: unknown;
  locale: string;
}): string | null {
  if (params.engineId !== 'minimax-h3') return null;
  const locale = localeKey(params.locale);
  const text = copy[locale];
  if (['image_url', 'end_image_url', 'reference_image_urls'].includes(String(params.field))) {
    if (params.error === 'MEDIA_DIMENSIONS_TOO_SMALL') return `${text.imageSmall} ${text.noCharge}`;
    if (params.error === 'MEDIA_ASPECT_RATIO_UNSUPPORTED') return `${text.imageRatio} ${text.noCharge}`;
  }
  if (params.field !== 'reference_video_urls') return null;
  if (params.error === 'MEDIA_DURATION_UNVERIFIED') return `${text.unverified} ${text.noCharge}`;
  if (!['MEDIA_DURATION_UNSUPPORTED', 'MEDIA_COMBINED_DURATION_EXCEEDED'].includes(String(params.error))
    || typeof params.durationSec !== 'number' || !Number.isFinite(params.durationSec) || params.durationSec <= 15) return null;
  const reason = params.error === 'MEDIA_COMBINED_DURATION_EXCEEDED' ? text.combined : text.duration;
  const measured = text.measured.replace('{duration}', new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(params.durationSec));
  return `${reason} ${measured} ${text.noCharge}`;
}
