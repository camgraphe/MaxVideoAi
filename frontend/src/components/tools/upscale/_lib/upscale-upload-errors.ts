import type { UpscaleMediaType } from '@/types/tools-upscale';

const UPLOAD_MESSAGES = {
  en: {
    tooLarge: 'This file is too large to upload.',
    limit: 'Maximum file size: {size} MB.',
    smaller: 'Choose a smaller file and try again.',
    unauthorized: 'Your session expired. Sign in again and retry the upload.',
    videoFormat: 'This video format could not be imported. Export an MP4 or MOV file and try again.',
    imageFormat: 'This image format could not be imported. Export a PNG, JPEG or WebP image and try again.',
    empty: 'This file is empty. Export it again and retry the upload.',
    metadata: 'The video’s duration or dimensions could not be read. Export an MP4 or MOV file and try again.',
    storage: 'The file could not be saved. Please try again in a moment.',
    interrupted: 'The upload was interrupted. Please try again.',
    network: 'The upload could not reach the server. Check your connection and try again.',
    fallback: 'The upload could not be completed. Please try again.',
  },
  fr: {
    tooLarge: 'Ce fichier est trop volumineux pour être importé.',
    limit: 'Taille maximale : {size} Mo.',
    smaller: 'Choisissez un fichier plus petit et réessayez.',
    unauthorized: 'Votre session a expiré. Reconnectez-vous et réessayez l’import.',
    videoFormat: 'Ce format vidéo ne peut pas être importé. Exportez un fichier MP4 ou MOV et réessayez.',
    imageFormat: 'Ce format d’image ne peut pas être importé. Exportez une image PNG, JPEG ou WebP et réessayez.',
    empty: 'Ce fichier est vide. Exportez-le à nouveau et réessayez l’import.',
    metadata: 'La durée ou les dimensions de la vidéo ne peuvent pas être lues. Exportez un fichier MP4 ou MOV et réessayez.',
    storage: 'Le fichier n’a pas pu être enregistré. Réessayez dans un instant.',
    interrupted: 'L’import a été interrompu. Réessayez.',
    network: 'L’import n’a pas pu atteindre le serveur. Vérifiez votre connexion et réessayez.',
    fallback: 'L’import n’a pas pu être terminé. Réessayez.',
  },
  es: {
    tooLarge: 'Este archivo es demasiado grande para subirlo.',
    limit: 'Tamaño máximo: {size} MB.',
    smaller: 'Elige un archivo más pequeño e inténtalo de nuevo.',
    unauthorized: 'Tu sesión ha caducado. Inicia sesión de nuevo y vuelve a subir el archivo.',
    videoFormat: 'No se pudo importar este formato de vídeo. Exporta un archivo MP4 o MOV e inténtalo de nuevo.',
    imageFormat: 'No se pudo importar este formato de imagen. Exporta una imagen PNG, JPEG o WebP e inténtalo de nuevo.',
    empty: 'Este archivo está vacío. Expórtalo de nuevo y vuelve a subirlo.',
    metadata: 'No se pudo leer la duración o las dimensiones del vídeo. Exporta un archivo MP4 o MOV e inténtalo de nuevo.',
    storage: 'No se pudo guardar el archivo. Inténtalo de nuevo en unos instantes.',
    interrupted: 'La subida se interrumpió. Inténtalo de nuevo.',
    network: 'La subida no pudo alcanzar el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    fallback: 'No se pudo completar la subida. Inténtalo de nuevo.',
  },
};

type UploadFailure = Error & { code?: unknown; status?: unknown; maxMB?: unknown };

export function getUpscaleUploadErrorMessage(error: unknown, mediaType: UpscaleMediaType, locale: string): string {
  const language = locale === 'fr' || locale === 'es' ? locale : 'en';
  const copy = UPLOAD_MESSAGES[language];
  if (!(error instanceof Error)) return copy.fallback;
  const failure = error as UploadFailure;
  const code = typeof failure.code === 'string' ? failure.code.trim().toUpperCase() : '';

  if (code === 'UNAUTHORIZED' || failure.status === 401) return copy.unauthorized;
  if (code === 'FILE_TOO_LARGE' || failure.status === 413) {
    const maxMB = failure.maxMB;
    const limit = typeof maxMB === 'number' && Number.isFinite(maxMB) && maxMB > 0
      ? copy.limit.replace('{size}', new Intl.NumberFormat(language).format(maxMB))
      : '';
    return [copy.tooLarge, limit, copy.smaller].filter(Boolean).join(' ');
  }
  if (code === 'UNSUPPORTED_TYPE' || failure.status === 415) return mediaType === 'video' ? copy.videoFormat : copy.imageFormat;
  if (code === 'EMPTY_FILE') return copy.empty;
  if (code === 'METADATA_UNVERIFIED') return copy.metadata;
  if (code === 'UPLOAD_FAILED' || code === 'STORE_FAILED') return copy.storage;
  if (error.name === 'AbortError') return copy.interrupted;
  if (['Failed to fetch', 'Network request failed', 'NetworkError when attempting to fetch resource.'].includes(error.message)) return copy.network;
  return copy.fallback;
}
