import type { AppLocale } from '@/i18n/locales';

// Exact capability phrases only: unknown values keep their original meaning.
const CAPABILITY_COPY: Record<string, { fr: string; es: string }> = {
  'optional end frame': { fr: 'image de fin facultative', es: 'imagen final opcional' },
  'single start image plus optional end frame': { fr: 'Une image de départ et une image de fin facultative', es: 'Una imagen inicial y una imagen final opcional' },
  'supported through synchronized audio and audio-to-video workflows': { fr: 'Via l’audio synchronisé et la génération audio-vers-vidéo', es: 'Mediante audio sincronizado y generación de audio a video' },
  'dolly, jib, static and focus-shift presets': { fr: 'Préréglages : travelling, grue, plan fixe et changement de mise au point', es: 'Preajustes: travelling, grúa, plano fijo y cambio de enfoque' },
  'no visible maxvideoai watermark': { fr: 'Aucun filigrane MaxVideoAI visible', es: 'Sin marca de agua visible de MaxVideoAI' },
  'no visible maxvideoai watermark; provider provenance markers may apply': { fr: 'Aucun filigrane MaxVideoAI visible ; des marqueurs de provenance du fournisseur peuvent être présents', es: 'Sin marca de agua visible de MaxVideoAI; puede haber marcadores de procedencia del proveedor' },
  'prompt-directed native dialogue': { fr: 'Dialogue natif guidé par le prompt', es: 'Diálogo nativo guiado por el prompt' },
  'prompt-based; native multi-shot storyboard support': { fr: 'Guidage par prompt et storyboard de plusieurs plans', es: 'Guía por prompt y storyboard de varias tomas' },
  'supported by provider for editing and extension through reference video': { fr: 'Le fournisseur permet la modification et l’extension à partir d’une vidéo de référence', es: 'El proveedor permite editar y extender a partir de un video de referencia' },
  'native stereo audio': { fr: 'Audio stéréo natif', es: 'Audio estéreo nativo' },
  'native audio': { fr: 'Audio natif', es: 'Audio nativo' },
  'optional native audio': { fr: 'Audio natif en option', es: 'Audio nativo opcional' },
  'supported as a reference-to-video input': { fr: 'Vidéo acceptée comme référence pour la génération', es: 'Video aceptado como referencia para la generación' },
  'start image + optional end image': { fr: 'image de départ et image de fin facultative', es: 'imagen inicial e imagen final opcional' },
  'prompt-based camera and multi-shot control': { fr: 'Caméra et séquence de plans guidées par le prompt', es: 'Cámara y secuencia de tomas guiadas por el prompt' },
  'prompt-based camera control': { fr: 'Caméra guidée par le prompt', es: 'Cámara guiada por el prompt' },
};

/** Shared exact capability translation for model and comparison pages. */
export function localizeCapabilityDetail(value: string, locale: AppLocale): string | null {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (locale !== 'en') {
    const exact = CAPABILITY_COPY[lower];
    if (exact) return exact[locale];
    const unavailable = normalized.match(/^Not exposed in current (.+) endpoint set$/i);
    if (unavailable) return locale === 'fr' ? `Non disponible actuellement avec ${unavailable[1]}` : `No disponible actualmente con ${unavailable[1]}`;
    const clips = lower.match(/^up to (\d+) clips, (\d+)s total$/);
    if (clips) return locale === 'fr' ? `Jusqu’à ${clips[1]} clips, ${clips[2]} s au total` : `Hasta ${clips[1]} clips, ${clips[2]} s en total`;
    const images = lower.match(/^up to (\d+) (?:image references|reference images)$/);
    if (images) return locale === 'fr' ? `Jusqu’à ${images[1]} images de référence` : `Hasta ${images[1]} imágenes de referencia`;
    const videos = lower.match(/^up to (\d+) video references; (\d+)-(\d+)s each and (\d+)s combined$/);
    if (videos) return locale === 'fr'
      ? `Jusqu’à ${videos[1]} vidéos de référence ; ${videos[2]}–${videos[3]} s chacune, ${videos[4]} s au total`
      : `Hasta ${videos[1]} videos de referencia; ${videos[2]}–${videos[3]} s cada uno, ${videos[4]} s en total`;
  }
  return null;
}
