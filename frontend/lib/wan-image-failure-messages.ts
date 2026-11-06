import { isWan3EngineId } from '@/lib/wan3-pricing';

const copy = {
  en: {
    small: 'The reference image is too small: {width} x {height} pixels. Use an image with at least 240 pixels on each side. Upload a larger image or choose another image before trying again.',
    unverified: 'We could not verify the dimensions of this image. Upload the original image again before generating. Each side must be at least 240 pixels.',
    noCharge: 'No credits were charged for video generation.',
    refundUnconfirmed: 'A wallet refund has not been confirmed yet. Check your wallet or contact support.',
  },
  fr: {
    small: 'L’image de référence est trop petite : {width} x {height} pixels. Utilisez une image d’au moins 240 pixels de largeur et de hauteur. Importez une version plus grande ou choisissez une autre image avant de réessayer.',
    unverified: 'Nous n’avons pas pu vérifier les dimensions de cette image. Importez à nouveau l’image originale avant de générer. Chaque côté doit mesurer au moins 240 pixels.',
    noCharge: 'Aucun crédit n’a été débité pour la génération vidéo.',
    refundUnconfirmed: 'Le remboursement des crédits n’est pas encore confirmé. Consultez votre portefeuille ou contactez le support.',
  },
  es: {
    small: 'La imagen de referencia es demasiado pequeña: {width} x {height} píxeles. Utiliza una imagen con al menos 240 píxeles por lado. Sube una versión más grande o elige otra imagen antes de volver a intentarlo.',
    unverified: 'No hemos podido verificar las dimensiones de esta imagen. Vuelve a subir la imagen original antes de generar. Cada lado debe medir al menos 240 píxeles.',
    noCharge: 'No se han descontado créditos por la generación de vídeo.',
    refundUnconfirmed: 'El reembolso de los créditos todavía no se ha confirmado. Consulta tu monedero o contacta con soporte.',
  },
};

function language(locale = 'en') {
  return locale.startsWith('fr') ? copy.fr : locale.startsWith('es') ? copy.es : copy.en;
}

function smallImage(width: unknown, height: unknown): width is number {
  return typeof width === 'number' && typeof height === 'number'
    && Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0 && width < 100_000 && height < 100_000
    && (width < 240 || height < 240);
}

function dimensionMessage(width: number, height: number, locale = 'en'): string {
  return language(locale).small.replace('{width}', String(width)).replace('{height}', String(height));
}

/** Only bounded measurements leave the known diagnostic; never echo its URL, JSON or other text. */
export function getWanImageFailureMessage(message: string | null | undefined, locale = 'en'): string | null {
  const normalized = message?.trim() ?? '';
  const match = /^Error validating image resolution:/i.test(normalized)
    ? normalized.match(/\bresolution must be at least 240x240, got ([1-9]\d{0,4})x([1-9]\d{0,4})(?=[\s"},]|$)/i)
    : normalized.match(/^The reference image is too small: ([1-9]\d{0,4}) x ([1-9]\d{0,4}) pixels\. Use an image with at least 240 pixels on each side\./);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return smallImage(width, height) ? dimensionMessage(width, height, locale) : null;
}

export function getWanImageUnconfirmedRefundMessage(message: string | null | undefined, locale = 'en'): string | null {
  return getWanImageFailureMessage(message) ? language(locale).refundUnconfirmed : null;
}

/** Called only for pre-funding validation errors; terminal failures use confirmed payment state instead. */
export function getWanReferenceValidationMessage(params: {
  engineId: string;
  error?: unknown;
  field?: unknown;
  actualWidth?: unknown;
  actualHeight?: unknown;
  minimumSidePx?: unknown;
  minimumWidth?: unknown;
  minimumHeight?: unknown;
  locale?: string;
}): string | null {
  if (!isWan3EngineId(params.engineId)) return null;
  const imageField = ['start_image_url', 'end_image_url', 'reference_image_urls'].includes(String(params.field));
  const imageError = ['IMAGE_DIMENSIONS_TOO_SMALL', 'IMAGE_DIMENSIONS_UNVERIFIED'].includes(String(params.error));
  if (!imageField && !imageError) return null;
  const text = language(params.locale);
  if (['MEDIA_DIMENSIONS_UNVERIFIED', 'IMAGE_DIMENSIONS_UNVERIFIED', 'MEDIA_METADATA_UNVERIFIED'].includes(String(params.error))) {
    return `${text.unverified} ${text.noCharge}`;
  }
  if (!['MEDIA_DIMENSIONS_TOO_SMALL', 'IMAGE_DIMENSIONS_TOO_SMALL'].includes(String(params.error))
    || !(params.minimumSidePx === 240 || (params.minimumWidth === 240 && params.minimumHeight === 240))
    || !smallImage(params.actualWidth, params.actualHeight)) return null;
  return `${dimensionMessage(params.actualWidth, params.actualHeight as number, params.locale)} ${text.noCharge}`;
}
