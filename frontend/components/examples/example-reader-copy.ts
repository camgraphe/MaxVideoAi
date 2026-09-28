export function readerCopy(locale: string) {
  return locale === 'fr' ? {
    close: 'Fermer le lecteur', previous: 'Vidéo précédente', next: 'Vidéo suivante', loading: 'Ouverture de la vidéo…', error: 'Cette vidéo est indisponible pour le moment.', retry: 'Réessayer',
    play: 'Lire la vidéo', pause: 'Pause', mute: 'Couper le son', unmute: 'Activer le son', fullscreen: 'Plein écran', timeline: 'Position dans la vidéo', quality: 'Qualité', original: 'Original',
    recorded: 'Coût de cet exemple', create: 'Créer à partir de cette vidéo', createNote: 'Retrouvez le prompt dans le studio et ajustez votre création.',
    compare: 'Ce prompt, avec les mêmes réglages', textOnly: 'Texte → vidéo · sans image de référence', audio: 'Audio activé', silent: 'Sans audio',
    compareNote: 'Chaque estimation ci-dessous utilise exactement ces réglages. Le rendu varie selon le modèle.', unavailable: 'Aucune estimation compatible disponible pour ces réglages.',
    priceNote: 'Prix estimés pour une nouvelle génération. Le prix final est confirmé dans le studio.', use: 'Créer avec ce modèle', current: 'Modèle de cet exemple',
    prompt: 'Le prompt', copy: 'Copier', copied: 'Prompt copié', copyError: 'Copie indisponible — sélectionnez le texte.', expand: 'Voir tout le prompt', collapse: 'Réduire',
    watch: 'Voir la page de cette vidéo', model: 'Découvrir le modèle', sources: 'Images de référence', navError: 'Impossible de charger la suite. Réessayez.', reader: 'Lecteur vidéo', playbackError: 'Lecture indisponible. Réessayez.',
  } : locale === 'es' ? {
    close: 'Cerrar el reproductor', previous: 'Vídeo anterior', next: 'Vídeo siguiente', loading: 'Abriendo el vídeo…', error: 'Este vídeo no está disponible por el momento.', retry: 'Reintentar',
    play: 'Reproducir vídeo', pause: 'Pausa', mute: 'Silenciar', unmute: 'Activar sonido', fullscreen: 'Pantalla completa', timeline: 'Posición del vídeo', quality: 'Calidad', original: 'Original',
    recorded: 'Coste de este ejemplo', create: 'Crear a partir de este vídeo', createNote: 'Abre el prompt en el estudio y ajusta tu creación.',
    compare: 'Este prompt, con los mismos ajustes', textOnly: 'Texto → vídeo · sin imágenes de referencia', audio: 'Con audio', silent: 'Sin audio',
    compareNote: 'Todas las estimaciones utilizan exactamente estos ajustes. El resultado varía según el modelo.', unavailable: 'No hay estimaciones compatibles con estos ajustes.',
    priceNote: 'Precios estimados para una nueva generación. El precio final se confirma en el estudio.', use: 'Crear con este modelo', current: 'Modelo de este ejemplo',
    prompt: 'El prompt', copy: 'Copiar', copied: 'Prompt copiado', copyError: 'No se pudo copiar — selecciona el texto.', expand: 'Ver el prompt completo', collapse: 'Reducir',
    watch: 'Ver la página de este vídeo', model: 'Descubrir el modelo', sources: 'Imágenes de referencia', navError: 'No se pudo cargar el siguiente vídeo. Reintenta.', reader: 'Reproductor de vídeo', playbackError: 'Vídeo no disponible. Reintenta.',
  } : {
    close: 'Close video player', previous: 'Previous video', next: 'Next video', loading: 'Opening video…', error: 'This video is unavailable right now.', retry: 'Try again',
    play: 'Play video', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', fullscreen: 'Full screen', timeline: 'Video position', quality: 'Quality', original: 'Original',
    recorded: 'Cost of this example', create: 'Create from this video', createNote: 'Open the prompt in the studio and make it your own.',
    compare: 'This prompt, with the same settings', textOnly: 'Text → video · no reference images', audio: 'Audio on', silent: 'No audio',
    compareNote: 'Every estimate below uses exactly these settings. Results vary by model.', unavailable: 'No compatible estimates available for these settings.',
    priceNote: 'Estimated prices for a new generation. Final price confirmed in the studio.', use: 'Create with this model', current: 'Model used in this example',
    prompt: 'The prompt', copy: 'Copy', copied: 'Prompt copied', copyError: 'Copy unavailable — select the text.', expand: 'Show full prompt', collapse: 'Show less',
    watch: 'View this video’s page', model: 'Explore the model', sources: 'Reference images', navError: 'Could not load more videos. Try again.', reader: 'Video player', playbackError: 'Playback unavailable. Try again.',
  };
}
export type ReaderCopy = ReturnType<typeof readerCopy>;
