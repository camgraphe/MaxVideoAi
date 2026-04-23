import type { AppLocale } from '@/i18n/locales';
import type { EngineInputField, Mode } from '@/types/engines';

type UiLocale = Extract<AppLocale, 'en' | 'fr' | 'es'>;

type FieldCopy = {
  label: string;
  description?: string;
};

type AssetDropzoneCopy = {
  formats: (value: string) => string;
  mbMax: (value: number) => string;
  secondsMax: (value: number) => string;
  secondsRequired: (min: number, max: number) => string;
  videoLengthFollowsAudio: string;
  upToFiles: (count: number) => string;
  atLeastFiles: (count: number) => string;
  primaryImageFallback: string;
  additionalReferencesFallback: string;
  frameFallback: string;
  primaryRoleDescription: string;
  referenceRoleDescription: string;
  frameRoleDescription: string;
  startImageSlot: string;
  endImageSlot: string;
  firstFrameSlot: string;
  lastFrameSlot: string;
  referenceImageSlot: (index: number) => string;
  referenceVideoSlot: (index: number) => string;
  referenceAudioSlot: (index: number) => string;
  sourceVideoSlot: string;
  sourceAudioSlot: string;
  slotSuffix: (label: string) => string;
  addFile: (details: string) => string;
  neededBeforeGenerating: string;
  upload: string;
  selectAsset: string;
  createImage: string;
  changeAngle: string;
  characterBuilder: string;
  info: string;
  library: string;
  remove: string;
  required: string;
  optional: string;
  uploading: string;
  uploadFailed: string;
  imageSlot: string;
  videoIncludesAudio: string;
  dropImageFile: string;
  dropVideoFile: string;
  dropAudioFile: string;
  formatNotSupported: (value: string) => string;
  unableToReadAudioDuration: string;
  audioMinDuration: (seconds: number) => string;
  audioMaxDuration: (seconds: number) => string;
  fileTooLarge: (size: number) => string;
};

type WorkflowCopy = {
  generateVideo: string;
  removeAudioToUnlock: string;
  audioUnsupported: string;
  audioLocked: string;
  audioLockedFallback: string;
  removeAudioToUseEdit: string;
  clearReferencesToUseStartEnd: string;
  clearStartEndToUseReferences: string;
  addReferenceMediaBeforeAudio: string;
  addSourceVideo: (modeLabel: string) => string;
  workflowOptionsTitle: string;
  workflowOptionsSubtitle: string;
  selectOption: string;
  defaultOption: string;
};

const MODE_LABELS: Record<UiLocale, Record<Mode, string>> = {
  en: {
    t2v: 'Text → Video',
    i2v: 'Image → Video',
    ref2v: 'Reference → Video',
    fl2v: 'First/Last',
    v2v: 'Modify Video',
    r2v: 'Video → Video',
    a2v: 'Audio → Video',
    extend: 'Extend Video',
    retake: 'Retake Video',
    reframe: 'Reframe Video',
    t2i: 'Text → Image',
    i2i: 'Image → Image',
  },
  fr: {
    t2v: 'Texte → Vidéo',
    i2v: 'Image → Vidéo',
    ref2v: 'Références → Vidéo',
    fl2v: 'Première / Dernière image',
    v2v: 'Modifier la vidéo',
    r2v: 'Vidéo → Vidéo',
    a2v: 'Audio → Vidéo',
    extend: 'Étendre la vidéo',
    retake: 'Retake vidéo',
    reframe: 'Recadrer la vidéo',
    t2i: 'Texte → Image',
    i2i: 'Image → Image',
  },
  es: {
    t2v: 'Texto → Video',
    i2v: 'Imagen → Video',
    ref2v: 'Referencias → Video',
    fl2v: 'Primer / Último frame',
    v2v: 'Modificar video',
    r2v: 'Video → Video',
    a2v: 'Audio → Video',
    extend: 'Extender video',
    retake: 'Retake de video',
    reframe: 'Reencuadrar video',
    t2i: 'Texto → Imagen',
    i2i: 'Imagen → Imagen',
  },
};

const LTX_FIELD_COPY: Record<UiLocale, Record<string, FieldCopy>> = {
  en: {
    prompt: { label: 'Prompt' },
    negative_prompt: { label: 'Negative prompt' },
    image_url: {
      label: 'Start image',
      description: 'Use this still as the first frame that anchors the motion.',
    },
    end_image_url: {
      label: 'End image',
      description: 'Optional final frame for start-to-end transitions in Image → Video.',
    },
    audio_url: {
      label: 'Source audio',
      description: 'Required for Audio → Video. Video length follows the audio file duration.',
    },
    video_url: {
      label: 'Source video',
      description: 'Upload or reuse a previous render to extend it or retake a section.',
    },
    guidance_scale: {
      label: 'Guidance scale',
      description: 'Adjust how strongly the result should follow the prompt.',
    },
    context: {
      label: 'Context window',
      description: 'Controls how much of the source video is considered during the extension.',
    },
    mode: {
      label: 'Extend position',
      description: 'Choose whether the extension is added before the clip or after it.',
    },
    start_time: {
      label: 'Start time',
      description: 'Set where the retake begins inside the source video.',
    },
    retake_mode: {
      label: 'Retake mode',
      description: 'Choose how the source segment should be replaced.',
    },
  },
  fr: {
    prompt: { label: 'Prompt' },
    negative_prompt: { label: 'Prompt négatif' },
    image_url: {
      label: 'Image de départ',
      description: "Utilisez cette image comme première frame pour ancrer le mouvement.",
    },
    end_image_url: {
      label: 'Image de fin',
      description: "Frame finale optionnelle pour les transitions début → fin en Image → Vidéo.",
    },
    audio_url: {
      label: 'Audio source',
      description: "Obligatoire en Audio → Vidéo. La durée vidéo suit la durée du fichier audio.",
    },
    video_url: {
      label: 'Vidéo source',
      description: 'Importez ou réutilisez un rendu précédent pour l’étendre ou refaire une section.',
    },
    guidance_scale: {
      label: 'Force du guidage',
      description: 'Ajuste à quel point le résultat doit suivre le prompt.',
    },
    context: {
      label: 'Fenêtre de contexte',
      description: 'Détermine quelle portion de la vidéo source est prise en compte pendant l’extension.',
    },
    mode: {
      label: 'Position de l’extension',
      description: 'Choisissez si l’extension est ajoutée avant le clip ou après.',
    },
    start_time: {
      label: 'Temps de départ',
      description: 'Définissez le point de départ du retake dans la vidéo source.',
    },
    retake_mode: {
      label: 'Mode de retake',
      description: 'Choisissez comment la portion source doit être remplacée.',
    },
  },
  es: {
    prompt: { label: 'Prompt' },
    negative_prompt: { label: 'Prompt negativo' },
    image_url: {
      label: 'Imagen inicial',
      description: 'Usa esta imagen como primer frame para anclar el movimiento.',
    },
    end_image_url: {
      label: 'Imagen final',
      description: 'Frame final opcional para transiciones inicio → fin en Imagen → Video.',
    },
    audio_url: {
      label: 'Audio fuente',
      description: 'Obligatorio en Audio → Video. La duración del video sigue la duración del audio.',
    },
    video_url: {
      label: 'Video fuente',
      description: 'Sube o reutiliza un render previo para extenderlo o rehacer una sección.',
    },
    guidance_scale: {
      label: 'Intensidad de guía',
      description: 'Ajusta cuánto debe seguir el resultado al prompt.',
    },
    context: {
      label: 'Ventana de contexto',
      description: 'Controla cuánto del video fuente se toma en cuenta durante la extensión.',
    },
    mode: {
      label: 'Posición de extensión',
      description: 'Elige si la extensión se agrega antes del clip o después.',
    },
    start_time: {
      label: 'Tiempo de inicio',
      description: 'Define dónde empieza el retake dentro del video fuente.',
    },
    retake_mode: {
      label: 'Modo de retake',
      description: 'Elige cómo debe reemplazarse el segmento fuente.',
    },
  },
};

const WORKFLOW_COPY: Record<UiLocale, WorkflowCopy> = {
  en: {
    generateVideo: 'Generate Video',
    removeAudioToUnlock: 'Remove the audio source to unlock Extend Video and Retake Video.',
    audioUnsupported: 'This engine does not support Audio → Video. Remove the audio source or switch to LTX 2.3 Pro.',
    audioLocked:
      'Audio source detected. LTX 2.3 Pro is now locked to Audio → Video. Extend Video and Retake Video will unlock again when you remove the audio source.',
    audioLockedFallback:
      'Audio source detected. The available controls are now limited to Audio → Video settings until you remove the audio source.',
    removeAudioToUseEdit: 'Remove the audio source to use Extend Video or Retake Video.',
    clearReferencesToUseStartEnd: 'Clear the Seedance reference files to use start and end images.',
    clearStartEndToUseReferences: 'Clear the start or end images to use Seedance reference files.',
    addReferenceMediaBeforeAudio: 'Add at least one reference image or reference video before using reference audio.',
    addSourceVideo: (modeLabel) => `Add a source video before running ${modeLabel}.`,
    workflowOptionsTitle: 'Workflow options',
    workflowOptionsSubtitle: 'Settings specific to this workflow.',
    selectOption: 'Select an option',
    defaultOption: 'Default',
  },
  fr: {
    generateVideo: 'Générer la vidéo',
    removeAudioToUnlock: "Retirez l'audio source pour réactiver Étendre la vidéo et Retake vidéo.",
    audioUnsupported:
      "Ce moteur ne prend pas en charge Audio → Vidéo. Retirez l'audio source ou passez sur LTX 2.3 Pro.",
    audioLocked:
      "Audio source détecté. LTX 2.3 Pro est maintenant verrouillé sur Audio → Vidéo. Étendre la vidéo et Retake vidéo se réactiveront quand vous retirerez l'audio source.",
    audioLockedFallback:
      'Audio source détecté. Les contrôles disponibles sont désormais limités aux réglages Audio → Vidéo jusqu’au retrait du fichier audio.',
    removeAudioToUseEdit: "Retirez l'audio source pour utiliser Étendre la vidéo ou Retake vidéo.",
    clearReferencesToUseStartEnd: 'Retirez les fichiers de référence Seedance pour utiliser les images de départ et de fin.',
    clearStartEndToUseReferences: 'Retirez l’image de départ ou de fin pour utiliser les fichiers de référence Seedance.',
    addReferenceMediaBeforeAudio: 'Ajoutez au moins une image ou une vidéo de référence avant d’utiliser un audio de référence.',
    addSourceVideo: (modeLabel) => `Ajoutez une vidéo source avant d’utiliser ${modeLabel}.`,
    workflowOptionsTitle: 'Options du workflow',
    workflowOptionsSubtitle: 'Réglages spécifiques à ce workflow.',
    selectOption: 'Sélectionner une option',
    defaultOption: 'Par défaut',
  },
  es: {
    generateVideo: 'Generar video',
    removeAudioToUnlock: 'Quita el audio fuente para desbloquear Extender video y Retake de video.',
    audioUnsupported:
      'Este motor no admite Audio → Video. Quita el audio fuente o cambia a LTX 2.3 Pro.',
    audioLocked:
      'Se detectó audio fuente. LTX 2.3 Pro ahora queda bloqueado en Audio → Video. Extender video y Retake de video volverán a habilitarse cuando quites el audio fuente.',
    audioLockedFallback:
      'Se detectó audio fuente. Los controles disponibles ahora se limitan a los ajustes de Audio → Video hasta que quites el audio.',
    removeAudioToUseEdit: 'Quita el audio fuente para usar Extender video o Retake de video.',
    clearReferencesToUseStartEnd: 'Quita los archivos de referencia de Seedance para usar las imágenes inicial y final.',
    clearStartEndToUseReferences: 'Quita la imagen inicial o final para usar los archivos de referencia de Seedance.',
    addReferenceMediaBeforeAudio: 'Añade al menos una imagen o un video de referencia antes de usar audio de referencia.',
    addSourceVideo: (modeLabel) => `Añade un video fuente antes de ejecutar ${modeLabel}.`,
    workflowOptionsTitle: 'Opciones del workflow',
    workflowOptionsSubtitle: 'Ajustes específicos de este workflow.',
    selectOption: 'Selecciona una opción',
    defaultOption: 'Predeterminado',
  },
};

const ASSET_DROPZONE_COPY: Record<UiLocale, AssetDropzoneCopy> = {
  en: {
    formats: (value) => `Formats: ${value}`,
    mbMax: (value) => `${value} MB max`,
    secondsMax: (value) => `${value}s max`,
    secondsRequired: (min, max) => `${min}–${max}s required`,
    videoLengthFollowsAudio: 'Video length follows audio length',
    upToFiles: (count) => `Up to ${count} files`,
    atLeastFiles: (count) => `At least ${count} files`,
    primaryImageFallback: 'Primary reference image',
    additionalReferencesFallback: 'Additional references',
    frameFallback: 'Frame',
    primaryRoleDescription: 'This still is used as the start image / first frame that drives the motion.',
    referenceRoleDescription: 'Optional supporting stills to guide style or lighting.',
    frameRoleDescription: 'Defines the transition frame for this engine.',
    startImageSlot: 'Start image',
    endImageSlot: 'End image',
    firstFrameSlot: 'First frame',
    lastFrameSlot: 'Last frame',
    referenceImageSlot: (index) => `Reference image ${index}`,
    referenceVideoSlot: (index) => `Reference video ${index}`,
    referenceAudioSlot: (index) => `Reference audio ${index}`,
    sourceVideoSlot: 'Source video',
    sourceAudioSlot: 'Source audio',
    slotSuffix: (label) => `${label} slot`,
    addFile: (details) => `Drag & drop or click to add.${details ? ` ${details}` : ''}`,
    neededBeforeGenerating: 'Needed before generating.',
    upload: 'Upload',
    selectAsset: 'Select asset',
    createImage: 'Create image',
    changeAngle: 'Change angle',
    characterBuilder: 'Character builder',
    info: 'Field details',
    library: 'Library',
    remove: 'Remove',
    required: 'Required',
    optional: 'Optional',
    uploading: 'Uploading…',
    uploadFailed: 'Upload failed',
    imageSlot: 'Image',
    videoIncludesAudio: 'Video includes audio',
    dropImageFile: 'Please drop an image file (PNG, JPG, WebP...).',
    dropVideoFile: 'Please drop a video file (MP4, MOV...).',
    dropAudioFile: 'Please drop an audio file (MP3, WAV...).',
    formatNotSupported: (value) => `Format not supported. Allowed: ${value}`,
    unableToReadAudioDuration: 'Unable to read audio duration. Please try another file.',
    audioMinDuration: (seconds) => `Audio must be at least ${seconds}s long.`,
    audioMaxDuration: (seconds) => `Audio must be ${seconds}s or shorter.`,
    fileTooLarge: (size) => `File exceeds the ${size} MB limit.`,
  },
  fr: {
    formats: (value) => `Formats : ${value}`,
    mbMax: (value) => `${value} Mo max`,
    secondsMax: (value) => `${value}s max`,
    secondsRequired: (min, max) => `${min}–${max}s requis`,
    videoLengthFollowsAudio: "La durée vidéo suit la durée de l'audio",
    upToFiles: (count) => `Jusqu'à ${count} fichiers`,
    atLeastFiles: (count) => `Au moins ${count} fichiers`,
    primaryImageFallback: 'Image de référence principale',
    additionalReferencesFallback: 'Références additionnelles',
    frameFallback: 'Frame',
    primaryRoleDescription: "Cette image sert d'image de départ / première frame pour piloter le mouvement.",
    referenceRoleDescription: 'Images complémentaires optionnelles pour guider le style ou la lumière.',
    frameRoleDescription: 'Définit la frame de transition pour ce moteur.',
    startImageSlot: 'Image de départ',
    endImageSlot: 'Image de fin',
    firstFrameSlot: 'Première frame',
    lastFrameSlot: 'Dernière frame',
    referenceImageSlot: (index) => `Image de référence ${index}`,
    referenceVideoSlot: (index) => `Vidéo de référence ${index}`,
    referenceAudioSlot: (index) => `Audio de référence ${index}`,
    sourceVideoSlot: 'Vidéo source',
    sourceAudioSlot: 'Audio source',
    slotSuffix: (label) => `Slot ${label}`,
    addFile: (details) => `Glissez-déposez ou cliquez pour ajouter.${details ? ` ${details}` : ''}`,
    neededBeforeGenerating: 'Nécessaire avant génération.',
    upload: 'Upload',
    selectAsset: 'Sélectionner un asset',
    createImage: 'Créer une image',
    changeAngle: 'Changer l’angle',
    characterBuilder: 'Character Builder',
    info: 'Détails du champ',
    library: 'Bibliothèque',
    remove: 'Retirer',
    required: 'Obligatoire',
    optional: 'Optionnel',
    uploading: 'Upload…',
    uploadFailed: 'Échec de l’upload',
    imageSlot: 'Image',
    videoIncludesAudio: 'La vidéo inclut de l’audio',
    dropImageFile: 'Déposez un fichier image (PNG, JPG, WebP...).',
    dropVideoFile: 'Déposez un fichier vidéo (MP4, MOV...).',
    dropAudioFile: 'Déposez un fichier audio (MP3, WAV...).',
    formatNotSupported: (value) => `Format non pris en charge. Autorisés : ${value}`,
    unableToReadAudioDuration: "Impossible de lire la durée audio. Essayez un autre fichier.",
    audioMinDuration: (seconds) => `L'audio doit faire au moins ${seconds}s.`,
    audioMaxDuration: (seconds) => `L'audio doit faire ${seconds}s ou moins.`,
    fileTooLarge: (size) => `Le fichier dépasse la limite de ${size} Mo.`,
  },
  es: {
    formats: (value) => `Formatos: ${value}`,
    mbMax: (value) => `${value} MB máx.`,
    secondsMax: (value) => `${value}s máx.`,
    secondsRequired: (min, max) => `${min}–${max}s requeridos`,
    videoLengthFollowsAudio: 'La duración del video sigue la duración del audio',
    upToFiles: (count) => `Hasta ${count} archivos`,
    atLeastFiles: (count) => `Al menos ${count} archivos`,
    primaryImageFallback: 'Imagen de referencia principal',
    additionalReferencesFallback: 'Referencias adicionales',
    frameFallback: 'Frame',
    primaryRoleDescription: 'Esta imagen se usa como imagen inicial / primer frame que impulsa el movimiento.',
    referenceRoleDescription: 'Stills opcionales de apoyo para guiar estilo o iluminación.',
    frameRoleDescription: 'Define el frame de transición para este motor.',
    startImageSlot: 'Imagen inicial',
    endImageSlot: 'Imagen final',
    firstFrameSlot: 'Primer frame',
    lastFrameSlot: 'Último frame',
    referenceImageSlot: (index) => `Imagen de referencia ${index}`,
    referenceVideoSlot: (index) => `Video de referencia ${index}`,
    referenceAudioSlot: (index) => `Audio de referencia ${index}`,
    sourceVideoSlot: 'Video fuente',
    sourceAudioSlot: 'Audio fuente',
    slotSuffix: (label) => `Slot de ${label}`,
    addFile: (details) => `Arrastra y suelta o haz clic para añadir.${details ? ` ${details}` : ''}`,
    neededBeforeGenerating: 'Necesario antes de generar.',
    upload: 'Subir',
    selectAsset: 'Seleccionar asset',
    createImage: 'Crear imagen',
    changeAngle: 'Cambiar ángulo',
    characterBuilder: 'Character Builder',
    info: 'Detalles del campo',
    library: 'Biblioteca',
    remove: 'Eliminar',
    required: 'Obligatorio',
    optional: 'Opcional',
    uploading: 'Subiendo…',
    uploadFailed: 'La subida falló',
    imageSlot: 'Imagen',
    videoIncludesAudio: 'El video incluye audio',
    dropImageFile: 'Suelta un archivo de imagen (PNG, JPG, WebP...).',
    dropVideoFile: 'Suelta un archivo de video (MP4, MOV...).',
    dropAudioFile: 'Suelta un archivo de audio (MP3, WAV...).',
    formatNotSupported: (value) => `Formato no compatible. Permitidos: ${value}`,
    unableToReadAudioDuration: 'No se pudo leer la duración del audio. Prueba con otro archivo.',
    audioMinDuration: (seconds) => `El audio debe durar al menos ${seconds}s.`,
    audioMaxDuration: (seconds) => `El audio debe durar ${seconds}s o menos.`,
    fileTooLarge: (size) => `El archivo supera el límite de ${size} MB.`,
  },
};

const MODEL_CARD_USE_CASES: Record<UiLocale, Record<string, string>> = {
  en: {
    'gpt-image-2': 'text-heavy stills, product photography, and controlled edits',
    'ltx-2-3': 'all-in-one LTX video workflows with audio and retakes',
    'ltx-2-3-fast': 'quick LTX 2.3 iterations for text and image video',
  },
  fr: {
    'gpt-image-2': 'images riches en texte, packshots produit et edits controles',
    'ltx-2-3': 'workflows vidéo LTX tout-en-un avec audio, extend et retake',
    'ltx-2-3-fast': 'itérations LTX 2.3 rapides pour la génération texte et image vers vidéo',
  },
  es: {
    'gpt-image-2': 'imagenes con texto, producto y edits controlados',
    'ltx-2-3': 'workflows de video LTX todo en uno con audio, extend y retake',
    'ltx-2-3-fast': 'iteraciones rápidas de LTX 2.3 para texto e imagen a video',
  },
};

const MODEL_CARD_CAPABILITY_KEYWORDS: Record<UiLocale, Record<string, string>> = {
  en: {
    T2V: 'text-to-video',
    I2V: 'image-to-video',
    V2V: 'video-to-video',
    'Lip sync': 'lip sync',
    Audio: 'native audio',
    'First/Last': 'first/last frame control',
    Extend: 'extend workflows',
  },
  fr: {
    T2V: 'texte-vers-vidéo',
    I2V: 'image-vers-vidéo',
    V2V: 'vidéo-vers-vidéo',
    'Lip sync': 'lip sync',
    Audio: 'audio natif',
    'First/Last': 'contrôle première / dernière frame',
    Extend: "workflows d'extension",
  },
  es: {
    T2V: 'texto a video',
    I2V: 'imagen a video',
    V2V: 'video a video',
    'Lip sync': 'lip sync',
    Audio: 'audio nativo',
    'First/Last': 'control de primer / último frame',
    Extend: 'workflows de extensión',
  },
};

const HERO_CHIP_LABELS: Record<UiLocale, Record<string, string>> = {
  en: {
    textToImage: 'Text→Image',
    imageToImage: 'Image→Image',
    textToVideo: 'Text→Video',
    imageToVideo: 'Image→Video',
    audio: 'Audio',
  },
  fr: {
    textToImage: 'Texte→Image',
    imageToImage: 'Image→Image',
    textToVideo: 'Texte→Vidéo',
    imageToVideo: 'Image→Vidéo',
    audio: 'Audio',
  },
  es: {
    textToImage: 'Texto→Imagen',
    imageToImage: 'Imagen→Imagen',
    textToVideo: 'Texto→Video',
    imageToVideo: 'Imagen→Video',
    audio: 'Audio',
  },
};

const MODEL_META_LABELS: Record<UiLocale, { price: string; duration: string; format: string }> = {
  en: { price: 'Price', duration: 'Duration', format: 'Format' },
  fr: { price: 'Prix', duration: 'Durée', format: 'Format' },
  es: { price: 'Precio', duration: 'Duración', format: 'Formato' },
};

export function normalizeUiLocale(locale?: string | null): UiLocale {
  if (locale === 'fr' || locale === 'es') return locale;
  return 'en';
}

export function getLocalizedModeLabel(mode: Mode, locale?: string | null): string {
  const uiLocale = normalizeUiLocale(locale);
  return MODE_LABELS[uiLocale][mode] ?? MODE_LABELS.en[mode] ?? mode.toUpperCase();
}

export function localizeLtxField(field: EngineInputField, locale?: string | null, engineId?: string | null): EngineInputField {
  if (!engineId?.startsWith('ltx-2-3')) return field;
  const uiLocale = normalizeUiLocale(locale);
  const copy = LTX_FIELD_COPY[uiLocale][field.id];
  if (!copy) return field;
  return {
    ...field,
    label: copy.label,
    description: copy.description ?? field.description,
  };
}

export function getLocalizedWorkflowCopy(locale?: string | null): WorkflowCopy {
  return WORKFLOW_COPY[normalizeUiLocale(locale)];
}

export function getLocalizedAssetDropzoneCopy(locale?: string | null): AssetDropzoneCopy {
  return ASSET_DROPZONE_COPY[normalizeUiLocale(locale)];
}

export function getLocalizedModelUseCases(locale?: string | null): Record<string, string> {
  return MODEL_CARD_USE_CASES[normalizeUiLocale(locale)];
}

export function getLocalizedCapabilityKeywords(locale?: string | null): Record<string, string> {
  return MODEL_CARD_CAPABILITY_KEYWORDS[normalizeUiLocale(locale)];
}

export function getLocalizedHeroChipLabels(locale?: string | null): Record<string, string> {
  return HERO_CHIP_LABELS[normalizeUiLocale(locale)];
}

export function getLocalizedModelMetaLabels(locale?: string | null) {
  return MODEL_META_LABELS[normalizeUiLocale(locale)];
}
