import type { AppLocale } from '@/i18n/locales';

// Exact capability phrases only: unknown values keep their original meaning.
const CAPABILITY_COPY: Record<string, { fr: string; es: string }> = {
  "up to 10 images total, including the opening image": { fr: "Jusqu’à 10 images au total, image de départ comprise", es: "Hasta 10 imágenes en total, incluida la imagen inicial" },
  "up to 5 reference videos; 30s combined with video elements": { fr: "Jusqu’à 5 vidéos de référence ; 30 s au total avec les éléments vidéo", es: "Hasta 5 videos de referencia; 30 s en total con los elementos de video" },
  "provider-set; no fps selector": { fr: "Cadence définie par le fournisseur ; aucun sélecteur FPS", es: "Cadencia definida por el proveedor; sin selector de FPS" },
  "native audio directed by prompt; no audio switch": { fr: "Audio natif guidé par le prompt ; aucun interrupteur audio", es: "Audio nativo guiado por el prompt; sin interruptor de audio" },
  "provider-selected image format": { fr: "Format d’image choisi par le fournisseur", es: "Formato de imagen elegido por el proveedor" },
  "video editing": { fr: "modification vidéo", es: "edición de video" },
  "optional generated audio": { fr: "Audio généré facultatif", es: "Audio generado opcional" },
  "optional": { fr: "Facultatif", es: "Opcional" },
  'recast / relight; specialized source tools': { fr: 'Recast / Relight ; outils spécialisés sur vidéo source', es: 'Recast / Relight; herramientas especializadas sobre video de origen' },
  'fast edit; source timing and framing': { fr: 'FAST Edit ; durée et cadrage de la source', es: 'FAST Edit; duración y encuadre del origen' },
  'enhance draft; owned paired draft cache': { fr: 'Enhance Draft ; cache apparié d’un Draft de votre compte', es: 'Enhance Draft; caché emparejada de un Draft de tu cuenta' },
  'reference / edit; source timing and framing for edit': { fr: 'Reference / Edit ; durée et cadrage hérités pour Edit', es: 'Reference / Edit; duración y encuadre heredados para Edit' },
  'modify / reframe / owned-generation extend': { fr: 'Modify / Reframe / Extend depuis une génération de votre compte', es: 'Modify / Reframe / Extend desde una generación propia' },
  'generate 5s/10s; modify source up to 18s; reframe source up to 10s; extend five new seconds': { fr: 'Génération 5s/10s ; source Modify jusqu’à 18s ; source Reframe jusqu’à 10s ; Extend : cinq nouvelles secondes', es: 'Generación 5s/10s; origen Modify hasta 18s; origen Reframe hasta 10s; Extend: cinco segundos nuevos' },
  'start image, first/last frames, or 1–10 indexed keyframe images': { fr: 'Image de départ, première/dernière image ou 1–10 images clés indexées', es: 'Imagen inicial, primera/última imagen o 1–10 fotogramas clave indexados' },
  'native extend; fast edit': { fr: 'Extend natif ; FAST Edit', es: 'Extend nativo; FAST Edit' },
  'native draft extend; enhance requires an owned paired draft cache': { fr: 'Extend natif de Draft ; Enhance exige un cache Draft apparié de votre compte', es: 'Extend nativo de Draft; Enhance exige una caché Draft emparejada propia' },
  '720p native draft; 1080p paired-cache enhance': { fr: 'Draft natif 720p ; Enhance avec cache apparié 1080p', es: 'Draft nativo 720p; Enhance con caché emparejada 1080p' },
  'extend / retake / reframe': { fr: 'Extend / Retake / Reframe', es: 'Extend / Retake / Reframe' },
  'generate 6–10s; audio/extend/retake up to 20s; reframe source up to 60s': { fr: 'Génération 6–10s ; Audio/Extend/Retake jusqu’à 20s ; source Reframe jusqu’à 60s', es: 'Generación 6–10s; Audio/Extend/Retake hasta 20s; origen Reframe hasta 60s' },
  '4k on t2v/i2v generate; reframe 720p/1080p; other workflow-specific limits': { fr: '4K en génération texte/image ; Reframe 720p/1080p ; autres limites selon le workflow', es: '4K en generación de texto/imagen; Reframe 720p/1080p; otros límites según el flujo' },
  'edit, extend, and conversational refine': { fr: 'modification, extension et retouches par conversation', es: 'edición, extensión y refinamiento mediante conversación' },
  'extend from one source video': { fr: 'extension à partir d’une vidéo source', es: 'extensión a partir de un video de origen' },
  'short source video for edit; previous interaction id for refine': { fr: 'courte vidéo source pour la modification ; interaction précédente pour les retouches par conversation', es: 'video de origen corto para editar; interacción anterior para refinar mediante conversación' },
  'one source clip for extend': { fr: 'un clip source pour l’extension', es: 'un clip de origen para la extensión' },
  'image-to-video: 1 start image; reference-to-video: 1-3 stills': { fr: 'Image vers vidéo : 1 image de départ ; génération avec références : 1 à 3 images', es: 'Imagen a video: 1 imagen inicial; generación con referencias: de 1 a 3 imágenes' },
  'supported in current omni 1.1 route': { fr: 'Pris en charge avec Omni 1.1 dans MaxVideoAI', es: 'Compatible con Omni 1.1 en MaxVideoAI' },
  'supported through native dialogue and audio generation': { fr: 'Pris en charge via le dialogue et l’audio natifs', es: 'Compatible mediante diálogo y audio nativos' },
  'prompt-based sound, camera and edit directions': { fr: 'Son, caméra et modifications guidés par le prompt', es: 'Sonido, cámara y edición guiados por el prompt' },
  'no visible maxvideoai watermark; provider/model provenance markers may apply': { fr: 'Aucun filigrane MaxVideoAI visible ; des marqueurs de provenance du fournisseur ou du modèle peuvent être présents', es: 'Sin marca de agua visible de MaxVideoAI; puede haber marcadores de procedencia del proveedor o del modelo' },
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
  'start image, end image, or both': { fr: 'image de début, image de fin ou les deux', es: 'imagen inicial, imagen final o ambas' },
  'video editing and extension': { fr: 'modification et extension vidéo', es: 'edición y extensión de video' },
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
