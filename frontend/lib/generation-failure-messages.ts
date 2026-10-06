import { getSeedanceFailureMessage } from './seedance-failure-messages';

type Locale = 'en' | 'fr' | 'es';
const copy = {
  en: {
    outputImage: 'A generated image was blocked by safety checks. Change the prompt before trying again.',
    refund: 'Refund',
    duration: 'A reference video exceeds the input limit of 15 seconds. Shorten or replace the reference video before trying again. Changing the output duration does not shorten the reference video.',
    combined: 'The combined duration of the reference videos exceeds the input limit of 15 seconds. Shorten or remove a reference video before trying again.',
    safety: 'This request was blocked by safety checks. Review the prompt and any reference images, video, or audio before trying again.',
    unverified: 'We could not verify the duration of a reference video. Upload it again before generating.',
    measured: 'Measured duration: {duration} seconds.',
    noCharge: 'No credits were charged.',
  },
  fr: {
    outputImage: 'Une image générée a été bloquée par les contrôles de sécurité. Modifiez le prompt avant de réessayer.',
    refund: 'Remboursement',
    duration: 'Une vidéo de référence dépasse la limite d’entrée de 15 secondes. Raccourcissez ou remplacez cette vidéo avant de réessayer. Modifier la durée de sortie ne raccourcit pas la vidéo de référence.',
    combined: 'La durée cumulée des vidéos de référence dépasse la limite d’entrée de 15 secondes. Raccourcissez ou retirez une vidéo de référence avant de réessayer.',
    safety: 'Cette demande a été bloquée par les contrôles de sécurité. Vérifiez le prompt et les images, vidéos ou fichiers audio de référence avant de réessayer.',
    unverified: 'Nous n’avons pas pu vérifier la durée d’une vidéo de référence. Importez-la à nouveau avant de générer.',
    measured: 'Durée mesurée : {duration} secondes.',
    noCharge: 'Aucun crédit n’a été débité.',
  },
  es: {
    outputImage: 'Una imagen generada ha sido bloqueada por los controles de seguridad. Cambia el prompt antes de intentarlo de nuevo.',
    refund: 'Reembolso',
    duration: 'Un vídeo de referencia supera el límite de entrada de 15 segundos. Recorta o sustituye ese vídeo antes de intentarlo de nuevo. Cambiar la duración de salida no acorta el vídeo de referencia.',
    combined: 'La duración total de los vídeos de referencia supera el límite de entrada de 15 segundos. Recorta o elimina un vídeo de referencia antes de intentarlo de nuevo.',
    safety: 'Esta solicitud ha sido bloqueada por los controles de seguridad. Revisa el prompt y las imágenes, los vídeos o el audio de referencia antes de intentarlo de nuevo.',
    unverified: 'No hemos podido verificar la duración de un vídeo de referencia. Vuelve a subirlo antes de generar.',
    measured: 'Duración medida: {duration} segundos.',
    noCharge: 'No se han descontado créditos.',
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
  const match = description.match(/^Refund (.+?)(?: - (\d+)s)? - (.+)$/);
  if (!match) return description;
  const reason = getKnownGenerationFailureMessage({ failureCode, message: `${match[1]} ${match[3]}`, locale })
    ?? getKnownGenerationFailureMessage({ failureCode, message: match[3], locale });
  if (!reason) return description;
  const language = localeKey(locale);
  return language === 'en'
    ? `Refund ${match[1]}${match[2] ? ` - ${match[2]}s` : ''} - ${reason}`
    : `${copy[language].refund} ${match[1]}${match[2] ? ` · ${match[2]} s` : ''} — ${reason}`;
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
  // Known historical H3 input rejection; no conclusion about a stored clip's actual duration.
  if (/^Video duration exceeds the maximum allowed\. Maximum is 15(?:\.0+)? seconds\.$/i.test(message)) return text.duration;
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
  if (params.engineId !== 'minimax-h3' || params.field !== 'reference_video_urls') return null;
  const locale = localeKey(params.locale);
  const text = copy[locale];
  if (params.error === 'MEDIA_DURATION_UNVERIFIED') return `${text.unverified} ${text.noCharge}`;
  if (!['MEDIA_DURATION_UNSUPPORTED', 'MEDIA_COMBINED_DURATION_EXCEEDED'].includes(String(params.error))
    || typeof params.durationSec !== 'number' || !Number.isFinite(params.durationSec) || params.durationSec <= 15) return null;
  const reason = params.error === 'MEDIA_COMBINED_DURATION_EXCEEDED' ? text.combined : text.duration;
  const measured = text.measured.replace('{duration}', new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(params.durationSec));
  return `${reason} ${measured} ${text.noCharge}`;
}
