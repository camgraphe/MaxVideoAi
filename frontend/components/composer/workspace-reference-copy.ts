import type { AssetFieldRole } from '@/components/asset-dropzone/asset-dropzone-types';
import type { EngineInputField } from '@/types/engines';

export function workspaceReferenceCopy(locale: string) {
  return locale === 'fr' ? {
    calculating: 'Calcul…', priceUnavailable: 'Prix indisponible', kinds: { image: 'Images', video: 'Vidéos', audio: 'Audio' },
    start: 'Départ', end: 'Fin', title: 'Références', add: 'Ajouter des références', manage: 'Gérer', close: 'Fermer', replace: 'Remplacer', remove: 'Retirer', upload: 'Importer', library: 'Bibliothèque', required: 'Requis', unavailable: 'Indisponible pour ce modèle', details: 'Formats et conseils', options: 'Options', placeholder: 'Décrivez votre création…',
  } : locale === 'es' ? {
    calculating: 'Calculando…', priceUnavailable: 'Precio no disponible', kinds: { image: 'Imágenes', video: 'Vídeos', audio: 'Audio' },
    start: 'Inicio', end: 'Fin', title: 'Referencias', add: 'Añadir referencias', manage: 'Gestionar', close: 'Cerrar', replace: 'Reemplazar', remove: 'Quitar', upload: 'Subir', library: 'Biblioteca', required: 'Obligatorio', unavailable: 'No disponible para este modelo', details: 'Formatos y consejos', options: 'Opciones', placeholder: 'Describe tu creación…',
  } : {
    calculating: 'Calculating…', priceUnavailable: 'Price unavailable', kinds: { image: 'Images', video: 'Videos', audio: 'Audio' },
    start: 'Start', end: 'End', title: 'References', add: 'Add references', manage: 'Manage', close: 'Close', replace: 'Replace', remove: 'Remove', upload: 'Upload', library: 'Library', required: 'Required', unavailable: 'Unavailable for this model', details: 'Formats and guidance', options: 'Options', placeholder: 'Describe your creation…',
  };
}

export function resolveWorkspaceReferenceFieldTitle(
  field: EngineInputField,
  role: AssetFieldRole,
  locale: string
): string {
  if (locale !== 'fr' && locale !== 'es') return field.label;
  const label = field.label.trim();
  const capacity = typeof field.maxCount === 'number' && Number.isFinite(field.maxCount) && field.maxCount > 1
    ? Math.floor(field.maxCount)
    : null;
  const suffix = capacity == null ? '' : locale === 'fr' ? ` (jusqu’à ${capacity})` : ` (hasta ${capacity})`;

  if (field.id === 'video_url' && /^source video$/i.test(label)) {
    return locale === 'fr' ? 'Vidéo source' : 'Video fuente';
  }
  if (role !== 'reference') return field.label;
  if (field.id === 'image_urls' && /^reference images(?:\s*\([^)]*\))?$/i.test(label)) {
    return locale === 'fr' ? `Images de référence${suffix}` : `Imágenes de referencia${suffix}`;
  }
  if (field.id === 'video_urls' && /^reference video clips(?:\s*\([^)]*\))?$/i.test(label)) {
    return locale === 'fr' ? `Clips vidéo de référence${suffix}` : `Clips de vídeo de referencia${suffix}`;
  }
  if (field.id === 'audio_urls' && /^reference audio clips(?:\s*\([^)]*\))?$/i.test(label)) {
    return locale === 'fr' ? `Clips audio de référence${suffix}` : `Clips de audio de referencia${suffix}`;
  }
  return field.label;
}
