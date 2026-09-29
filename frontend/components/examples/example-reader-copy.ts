export function readerCopy(locale: string) {
  return locale === 'fr' ? {
    close: 'Fermer le lecteur', previous: 'Vidéo précédente', next: 'Vidéo suivante', loading: 'Ouverture de la vidéo…', error: 'Cette vidéo est indisponible pour le moment.', retry: 'Réessayer',
    play: 'Lire la vidéo', pause: 'Pause', mute: 'Couper le son', unmute: 'Activer le son', fullscreen: 'Plein écran', timeline: 'Position dans la vidéo', quality: 'Qualité', original: 'Original',
    previousShort: 'Précédente', nextShort: 'Suivante', tools: 'Prompt et création', originalSettings: 'Réglages du rendu original',
    recorded: 'Coût du rendu original', create: 'Utiliser ce prompt dans l’app',
    identical: 'Réglages identiques', adjusted: 'Réglages adaptés', proposed: 'Configuration proposée', compare: 'Créer avec ce prompt', textOnly: 'Prix estimé pour une nouvelle vidéo · texte seul, sans référence', audio: 'Audio activé', silent: 'Sans audio',
    compareNote: 'Durée conservée en priorité. Les réglages en couleur diffèrent de l’original.', unavailable: 'Aucune estimation compatible disponible pour ces réglages.',
    proposedNote: 'Réglages d’origine incomplets. Chaque prix utilise la configuration affichée.',
    priceNote: 'Chaque prix correspond aux réglages affichés. Le prix final est confirmé dans l’app.', use: 'Créer la vidéo', useShort: 'Créer', estimate: 'Estimation', current: 'Modèle original',
    prompt: 'Prompt', copy: 'Copier le prompt', copied: 'Prompt copié', copyError: 'Copie indisponible. Vous pouvez sélectionner le prompt ci-dessous.', manualCopy: 'Prompt à copier manuellement', expand: 'Voir tout le prompt', collapse: 'Réduire',
    watch: 'Voir la page de cette vidéo', model: 'Découvrir le modèle', sources: 'Images de référence', navError: 'Impossible de charger la suite. Réessayez.', reader: 'Lecteur vidéo', playbackError: 'Lecture indisponible. Réessayez.',
  } : locale === 'es' ? {
    close: 'Cerrar el reproductor', previous: 'Vídeo anterior', next: 'Vídeo siguiente', loading: 'Abriendo el vídeo…', error: 'Este vídeo no está disponible por el momento.', retry: 'Reintentar',
    play: 'Reproducir vídeo', pause: 'Pausa', mute: 'Silenciar', unmute: 'Activar sonido', fullscreen: 'Pantalla completa', timeline: 'Posición del vídeo', quality: 'Calidad', original: 'Original',
    previousShort: 'Anterior', nextShort: 'Siguiente', tools: 'Prompt y creación', originalSettings: 'Ajustes del vídeo original',
    recorded: 'Coste del vídeo original', create: 'Usar este prompt en la app',
    identical: 'Mismos ajustes', adjusted: 'Ajustes adaptados', proposed: 'Configuración propuesta', compare: 'Crear con este prompt', textOnly: 'Precio estimado de un nuevo vídeo · solo texto, sin referencias', audio: 'Con audio', silent: 'Sin audio',
    compareNote: 'Priorizamos conservar la duración. Los ajustes en color difieren del original.', unavailable: 'No hay estimaciones compatibles con estos ajustes.',
    proposedNote: 'Los ajustes originales están incompletos. Cada precio usa la configuración mostrada.',
    priceNote: 'Cada precio corresponde a los ajustes mostrados. El precio final se confirma en la app.', use: 'Crear vídeo', useShort: 'Crear', estimate: 'Estimación', current: 'Modelo original',
    prompt: 'Prompt', copy: 'Copiar prompt', copied: 'Prompt copiado', copyError: 'No se pudo copiar. Selecciona el prompt a continuación.', manualCopy: 'Prompt para copiar manualmente', expand: 'Ver el prompt completo', collapse: 'Reducir',
    watch: 'Ver la página de este vídeo', model: 'Descubrir el modelo', sources: 'Imágenes de referencia', navError: 'No se pudo cargar el siguiente vídeo. Reintenta.', reader: 'Reproductor de vídeo', playbackError: 'Vídeo no disponible. Reintenta.',
  } : {
    close: 'Close video player', previous: 'Previous video', next: 'Next video', loading: 'Opening video…', error: 'This video is unavailable right now.', retry: 'Try again',
    play: 'Play video', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', fullscreen: 'Full screen', timeline: 'Video position', quality: 'Quality', original: 'Original',
    previousShort: 'Previous', nextShort: 'Next', tools: 'Prompt and creation', originalSettings: 'Original render settings',
    recorded: 'Original render cost', create: 'Use this prompt in the app',
    identical: 'Same settings', adjusted: 'Adjusted settings', proposed: 'Suggested settings', compare: 'Create with this prompt', textOnly: 'Estimated price for one new video · text only, no references', audio: 'Audio on', silent: 'No audio',
    compareNote: 'Duration kept where possible. Highlighted settings differ from the original.', unavailable: 'No compatible estimates available for these settings.',
    proposedNote: 'Original settings are incomplete. Each price uses the configuration shown.',
    priceNote: 'Each price matches the settings shown. Final price confirmed in the app.', use: 'Create video', useShort: 'Create', estimate: 'Estimate', current: 'Original model',
    prompt: 'Prompt', copy: 'Copy prompt', copied: 'Prompt copied', copyError: 'Copy unavailable. Select the full prompt below.', manualCopy: 'Prompt for manual copying', expand: 'Show full prompt', collapse: 'Show less',
    watch: 'View this video’s page', model: 'Explore the model', sources: 'Reference images', navError: 'Could not load more videos. Try again.', reader: 'Video player', playbackError: 'Playback unavailable. Try again.',
  };
}
export type ReaderCopy = ReturnType<typeof readerCopy>;
