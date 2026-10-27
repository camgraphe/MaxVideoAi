import type { EngineInputSchema, Mode } from '@/types/engines';
import { resolveActiveVideoInputField, VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';

export type VideoSourceWorkflow = Extract<Mode, 'extend' | 'v2v' | 'reframe'>;

export function isVideoSourceWorkflow(mode: Mode | undefined): mode is VideoSourceWorkflow {
  return mode === 'extend' || mode === 'v2v' || mode === 'reframe';
}

export function getVideoWorkflowSourceField(inputSchema: EngineInputSchema | undefined, mode: VideoSourceWorkflow | 'retake') {
  return resolveActiveVideoInputField({
    inputSchema, mode, type: 'video', candidateFieldIds: VIDEO_MEDIA_FIELD_CANDIDATES.sourceVideo,
  });
}

/** Presentation eligibility only. Owned media facts and pricing remain server-authoritative. */
export function getVideoWorkflowSourceState(
  inputSchema: EngineInputSchema | undefined,
  assets: Record<string, ({ kind: string; status?: string; excerptEditing?: boolean; durationSec?: number | null } | null)[]>,
  mode: VideoSourceWorkflow,
  limits?: { minDurationSec: number | null; maxDurationSec: number | null } | null,
): 'missing' | 'uploading' | 'error' | 'ready' {
  const field = getVideoWorkflowSourceField(inputSchema, mode);
  if (!field) return 'missing';
  const sources = (assets[field.id] ?? []).filter(asset => asset?.kind === 'video');
  if (sources.some(asset => asset?.status === 'uploading' || asset?.excerptEditing)) return 'uploading';
  if (sources.some(asset => asset?.status === 'error')) return 'error';
  const min = limits?.minDurationSec ?? field.minDurationSec;
  const max = limits?.maxDurationSec ?? field.maxDurationSec;
  if (sources.some(asset => typeof asset?.durationSec === 'number' &&
    ((typeof min === 'number' && asset.durationSec < min) || (typeof max === 'number' && asset.durationSec > max)))) return 'error';
  return sources.filter(asset => asset?.status === 'ready').length >= (field.minCount ?? 1) ? 'ready' : 'missing';
}

export function videoModifyCopy(locale: string, reframe = false) {
  return locale === 'fr' ? {
    source: reframe ? 'Vidéo à recadrer' : 'Vidéo à modifier', references: 'Références facultatives',
    uploadForPrice: 'Importez la vidéo ou choisissez-la dans Médias. Nous vérifierons ses caractéristiques pour calculer le prix selon ce modèle et vos réglages.',
    uploading: 'Import de la vidéo en cours. Le prix sera calculé une fois la vidéo prête.',
    awaitingVideo: 'Ajoutez une vidéo', awaitingUpload: 'Import en cours…',
    action: reframe ? 'Recadrer la vidéo' : 'Modifier la vidéo',
    prompt: reframe ? 'Décrivez le cadrage souhaité…' : 'Décrivez les modifications souhaitées…',
  } : locale === 'es' ? {
    source: reframe ? 'Vídeo que reencuadrar' : 'Vídeo que modificar', references: 'Referencias opcionales',
    uploadForPrice: 'Sube el vídeo o elígelo en Medios. Comprobaremos sus características para calcular el precio según este modelo y tus ajustes.',
    uploading: 'Subiendo el vídeo. Calcularemos el precio cuando esté listo.',
    awaitingVideo: 'Añade un vídeo', awaitingUpload: 'Subiendo…',
    action: reframe ? 'Reencuadrar vídeo' : 'Modificar vídeo',
    prompt: reframe ? 'Describe el encuadre deseado…' : 'Describe los cambios que quieres…',
  } : {
    source: reframe ? 'Video to reframe' : 'Video to modify', references: 'Optional references',
    uploadForPrice: `Upload the video to ${reframe ? 'reframe' : 'modify'} or choose it from Media. We’ll check its properties to calculate the price for this model and your settings.`,
    uploading: 'Uploading your video. We’ll calculate the price once it’s ready.',
    awaitingVideo: 'Add a video', awaitingUpload: 'Uploading…',
    action: reframe ? 'Reframe video' : 'Modify video',
    prompt: reframe ? 'Describe the framing you want…' : 'Describe the changes you want…',
  };
}
