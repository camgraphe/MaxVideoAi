import type { AppLocale } from '@/i18n/locales';

type UiLocale = Extract<AppLocale, 'en' | 'fr' | 'es'>;

export type AssetDropzoneCopy = {
  formats: (value: string) => string;
  mbMax: (value: number) => string;
  secondsMax: (value: number) => string;
  secondsRequired: (min: number, max: number) => string;
  videoLengthFollowsAudio: string;
  upToFiles: (count: number) => string;
  atLeastFiles: (count: number) => string;
  slotsRemaining: (count: number) => string;
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

export const ASSET_DROPZONE_COPY: Record<UiLocale, AssetDropzoneCopy> = {
  en: {
    formats: (value) => `Formats: ${value}`,
    mbMax: (value) => `${value} MB max`,
    secondsMax: (value) => `${value}s max`,
    secondsRequired: (min, max) => `${min}–${max}s required`,
    videoLengthFollowsAudio: 'Video length follows audio length',
    upToFiles: (count) => `Up to ${count} files`,
    atLeastFiles: (count) => `At least ${count} files`,
    slotsRemaining: (count) => {
      if (count <= 0) return 'No slots remaining';
      if (count === 1) return '1 slot remaining';
      return `${count} slots remaining`;
    },
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
    slotsRemaining: (count) => {
      if (count <= 0) return 'Plus aucun slot disponible';
      if (count === 1) return 'Encore 1 slot disponible';
      return `Encore ${count} slots disponibles`;
    },
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
    slotsRemaining: (count) => {
      if (count <= 0) return 'No quedan slots';
      if (count === 1) return 'Queda 1 slot';
      return `Quedan ${count} slots`;
    },
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
