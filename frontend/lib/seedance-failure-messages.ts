import {
  SEEDANCE_REFERENCE_IMAGE_BLOCKED,
  SEEDANCE_REFERENCE_MEDIA_BLOCKED,
  SEEDANCE_REFERENCE_VIDEO_BLOCKED,
  SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED,
  SEEDANCE_TASK_TYPE_CONSTRAINT,
} from './video-failure-codes';

type Locale = 'en' | 'fr' | 'es';
const copy = {
  en: {
    image: 'Seedance blocked a reference image because it may contain a recognizable person or private content. Use a non-identifiable, stylized, or generated reference image and try again.',
    video: 'Seedance blocked a reference video because it may contain a recognizable person. Replace that video with a reference without identifiable people before trying again.',
    media: 'Seedance blocked reference media during its safety checks. Review the prompt and reference images, videos, or audio before trying again.',
    duration: 'The combined duration of the reference videos exceeds the Seedance limit of 30 seconds. Trim or remove a reference clip before trying again.',
    task: 'Seedance could not apply the selected edit or extension to the source video. Clarify what should change or continue in the source video, then try again.',
    unsupported: 'Seedance could not accept the selected references or settings. Check the reference files, duration, resolution, and aspect ratio before trying again.',
    refunded: 'Your credits were returned to your wallet.',
    refundAmount: '{amount} was returned to your wallet.',
    refund: 'Refund',
    measured: 'Measured total: {duration} seconds.',
    unverified: 'We could not verify the duration of a reference video. Upload the video again before trying to generate.',
    noCharge: 'No credits were charged.',
  },
  fr: {
    image: 'Seedance a bloqué une image de référence, car elle pourrait contenir une personne reconnaissable ou du contenu privé. Utilisez une autre référence sans personne identifiable avant de réessayer.',
    video: 'Seedance a bloqué une vidéo de référence, car elle pourrait contenir une personne reconnaissable. Remplacez cette vidéo par une référence sans personne identifiable avant de réessayer.',
    media: 'Seedance a bloqué un média de référence lors de ses contrôles de sécurité. Vérifiez le prompt et les images, vidéos ou fichiers audio avant de réessayer.',
    duration: 'La durée cumulée des vidéos de référence dépasse la limite Seedance de 30 secondes. Raccourcissez ou retirez un clip avant de réessayer.',
    task: 'Seedance n’a pas pu appliquer le montage ou la prolongation à la vidéo source. Précisez ce qui doit changer ou se poursuivre dans cette vidéo, puis réessayez.',
    unsupported: 'Seedance n’a pas accepté les références ou les réglages sélectionnés. Vérifiez les fichiers, la durée, la résolution et le format avant de réessayer.',
    refunded: 'Vos crédits ont été recrédités à votre portefeuille.',
    refundAmount: '{amount} ont été recrédités à votre portefeuille.',
    refund: 'Remboursement',
    measured: 'Durée totale mesurée : {duration} secondes.',
    unverified: 'Nous n’avons pas pu vérifier la durée d’une vidéo de référence. Importez-la à nouveau avant de relancer la génération.',
    noCharge: 'Aucun crédit n’a été débité.',
  },
  es: {
    image: 'Seedance ha bloqueado una imagen de referencia porque podría contener una persona reconocible o contenido privado. Utiliza otra referencia sin personas identificables antes de intentarlo de nuevo.',
    video: 'Seedance ha bloqueado un vídeo de referencia porque podría contener una persona reconocible. Sustituye ese vídeo por una referencia sin personas identificables antes de intentarlo de nuevo.',
    media: 'Seedance ha bloqueado un archivo de referencia durante sus controles de seguridad. Revisa el prompt y las imágenes, los vídeos o el audio antes de intentarlo de nuevo.',
    duration: 'La duración total de los vídeos de referencia supera el límite de Seedance de 30 segundos. Recorta o elimina un clip antes de intentarlo de nuevo.',
    task: 'Seedance no ha podido aplicar la edición o ampliación al vídeo original. Especifica qué debe cambiar o continuar en ese vídeo e inténtalo de nuevo.',
    unsupported: 'Seedance no ha aceptado las referencias o los ajustes seleccionados. Revisa los archivos, la duración, la resolución y la relación de aspecto antes de intentarlo de nuevo.',
    refunded: 'Tus créditos se han devuelto a tu monedero.',
    refundAmount: 'Se han devuelto {amount} a tu monedero.',
    refund: 'Reembolso',
    measured: 'Duración total medida: {duration} segundos.',
    unverified: 'No hemos podido verificar la duración de un vídeo de referencia. Vuelve a subirlo antes de generar.',
    noCharge: 'No se han descontado créditos.',
  },
} satisfies Record<Locale, Record<string, string>>;

function localeKey(locale: string): Locale {
  return locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en';
}

// Match only known customer copy for historical jobs without structured codes.
export function seedanceFailureCodeFromMessage(message: string | null | undefined): string | null {
  if (!message || !/seedance/i.test(message)) return null;
  if (/reference videos? (?:was|were) blocked|blocked a reference video/i.test(message)) return SEEDANCE_REFERENCE_VIDEO_BLOCKED;
  if (/reference images? (?:was|were) blocked|blocked a reference image/i.test(message)) return SEEDANCE_REFERENCE_IMAGE_BLOCKED;
  if (/combined duration.*reference videos|reference videos?.*duration.*limit/i.test(message)) return SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED;
  if (/could not identify the intended video edit|could not apply the selected edit/i.test(message)) return SEEDANCE_TASK_TYPE_CONSTRAINT;
  if (/blocked reference media|reference media was blocked/i.test(message)) return SEEDANCE_REFERENCE_MEDIA_BLOCKED;
  if (/selected Seedance prompt, media, or settings were not accepted|Seedance could not accept the selected references/i.test(message)) return 'seedance_inputs_rejected';
  return null;
}

export function getSeedanceFailureMessage(params: {
  failureCode?: string | null;
  message?: string | null;
  locale?: string;
}): string | null {
  const text = copy[localeKey(params.locale ?? 'en')];
  const code = params.failureCode ?? seedanceFailureCodeFromMessage(params.message);
  switch (code) {
    case SEEDANCE_REFERENCE_IMAGE_BLOCKED: return text.image;
    case SEEDANCE_REFERENCE_VIDEO_BLOCKED: return text.video;
    case SEEDANCE_REFERENCE_MEDIA_BLOCKED: return text.media;
    case SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED: return text.duration;
    case SEEDANCE_TASK_TYPE_CONSTRAINT: return text.task;
    case 'seedance_inputs_rejected': return text.unsupported;
    default: return params.failureCode ? getSeedanceFailureMessage({ message: params.message, locale: params.locale }) : null;
  }
}

export function getSeedanceReferenceValidationMessage(params: {
  engineId: string;
  error?: unknown;
  field?: unknown;
  durationSec?: unknown;
  locale: string;
}): string | null {
  if (params.engineId !== 'seedance-2-5' || !['video_url', 'video_urls', 'extension_source_videos'].includes(String(params.field))) return null;
  const locale = localeKey(params.locale);
  const text = copy[locale];
  if (params.error === 'MEDIA_DURATION_UNVERIFIED') return `${text.unverified} ${text.noCharge}`;
  if (params.error !== 'MEDIA_COMBINED_DURATION_EXCEEDED') return null;
  const measured = typeof params.durationSec === 'number' && Number.isFinite(params.durationSec) && params.durationSec > 0
    ? text.measured.replace('{duration}', new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(params.durationSec))
    : '';
  return [text.duration, measured, text.noCharge].filter(Boolean).join(' ');
}

export function appendConfirmedWalletRefund(message: string, params: {
  paymentStatus?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  locale?: string;
}): string {
  if (params.paymentStatus !== 'refunded_wallet') return message;
  const locale = localeKey(params.locale ?? 'en');
  const text = copy[locale];
  let confirmation: string = text.refunded;
  if (typeof params.amountCents === 'number' && Number.isFinite(params.amountCents) && params.amountCents > 0 && /^[A-Z]{3}$/i.test(params.currency ?? '')) {
    const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: params.currency! }).format(params.amountCents / 100);
    confirmation = text.refundAmount.replace('{amount}', amount);
  }
  return `${message} ${confirmation}`;
}

export function localizeSeedanceRefundDescription(description: string | null, locale: string): string | null {
  if (!description) return description;
  const match = description.match(/^Refund (Seedance[^-]*?)(?: - (\d+)s)? - (.+)$/);
  if (!match) return description;
  const reason = getSeedanceFailureMessage({ message: `Seedance ${match[3]}`, locale });
  if (!reason) return description;
  return `${copy[localeKey(locale)].refund} ${match[1].trim()}${match[2] ? ` · ${match[2]} s` : ''} — ${reason}`;
}
