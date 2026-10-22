import type { EngineInputSchema } from '@/types/engines';
import { resolveActiveVideoInputField, VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';

export function getVideoExtensionSourceField(inputSchema: EngineInputSchema | undefined) {
  return resolveActiveVideoInputField({
    inputSchema, mode: 'extend', type: 'video', candidateFieldIds: VIDEO_MEDIA_FIELD_CANDIDATES.sourceVideo,
  });
}

/** Upload state is presentation/quote eligibility only; the server still verifies duration and ownership. */
export function getVideoExtensionSourceState(
  inputSchema: EngineInputSchema | undefined,
  assets: Record<string, ({ kind: string; status?: string } | null)[]>,
): 'missing' | 'uploading' | 'error' | 'ready' {
  const field = getVideoExtensionSourceField(inputSchema);
  if (!field) return 'missing';
  const sources = (assets[field.id] ?? []).filter(asset => asset?.kind === 'video');
  if (sources.some(asset => asset?.status === 'uploading')) return 'uploading';
  if (sources.some(asset => asset?.status === 'error')) return 'error';
  return sources.filter(asset => asset?.status === 'ready').length >= (field.minCount ?? 1) ? 'ready' : 'missing';
}

export function videoExtensionCopy(locale: string) {
  return locale === 'fr' ? {
    source: 'Vidéo à prolonger', sources: 'Vidéos à prolonger', references: 'Références facultatives',
    uploadForPrice: 'Importez la vidéo à prolonger ou choisissez-la dans Médias. Nous vérifierons sa durée pour calculer le prix.',
    uploading: 'Import de la vidéo en cours. Le prix sera calculé une fois la vidéo prête.',
    awaitingVideo: 'Ajoutez une vidéo', awaitingUpload: 'Import en cours…',
    duration: 'Durée générée', extend: 'Prolonger la vidéo',
    prompt: 'Décrivez la suite de la vidéo…',
  } : locale === 'es' ? {
    source: 'Vídeo que prolongar', sources: 'Vídeos que prolongar', references: 'Referencias opcionales',
    uploadForPrice: 'Sube el vídeo que quieres prolongar o elígelo en Medios. Comprobaremos su duración para calcular el precio.',
    uploading: 'Subiendo el vídeo. Calcularemos el precio cuando esté listo.',
    awaitingVideo: 'Añade un vídeo', awaitingUpload: 'Subiendo…',
    duration: 'Duración generada', extend: 'Prolongar vídeo',
    prompt: 'Describe cómo continúa el vídeo…',
  } : {
    source: 'Video to extend', sources: 'Videos to extend', references: 'Optional references',
    uploadForPrice: 'Upload the video to extend or choose it from Media. We’ll check its duration to calculate the price.',
    uploading: 'Uploading your video. We’ll calculate the price once it’s ready.',
    awaitingVideo: 'Add a video', awaitingUpload: 'Uploading…',
    duration: 'Generated duration', extend: 'Extend video',
    prompt: 'Describe what happens next in the video…',
  };
}
