const en = {
  workspace: 'Creative toolbox', title: 'Tools', subtitle: 'Finish a clip, refine an image, or build the next part of your project.', quick: 'Quick tools', workshops: 'Workshops', workshopHint: 'Take an idea further.', filtersLabel: 'Filter tools by media type', available: 'Available', resultCountSingular: 'tool', results: 'tools', all: 'All', image: 'Image', video: 'Video', audio: 'Audio', open: 'Open tool', workshopOpen: 'Enter workshop', illustration: 'Illustration', noAudio: 'No audio finishing tools yet.', audioHint: 'Create music, voices and sound in the Audio workspace.', audioOpen: 'Open Audio', source: 'Source', import: 'Import', library: 'Choose from Media', url: 'Paste URL', original: 'Original', result: 'Result', preserved: 'Your original stays intact.', advanced: 'Options', implementation: 'Processing method', empty: 'Bring your media into focus.', emptyHint: 'Import a file or choose one from Media.', reuse: 'Use this result', back: 'Toolbox', settings: 'Adjustments', retryPrice: 'Retry price', upscale: 'Upscale', removeBackground: 'Remove background', priceLoading: 'Calculating price…', size: 'Size', format: 'Format', background: 'Background', keepAudio: 'Keep audio', done: 'Done', compare: 'Compare', signIn: 'Sign in', processing: 'Processing your media…', processingHint: 'Waiting for the completed result. You can keep this page open.',
  tools: {
    'restore-video': { title: 'Restore video', body: 'Repair a worn or compressed clip.', tag: 'Video → video' },
    denoise: { title: 'Denoise video', body: 'Reduce noise and grain.', tag: 'Video → video' },
    'fix-blur': { title: 'Fix motion blur', body: 'Recover clearer movement.', tag: 'Video → video' },
    'smooth-motion': { title: 'Smooth motion', body: 'Make movement more fluid.', tag: 'Video → video' },
    'upscale-image': { title: 'Upscale image', body: 'Give the details more room.', tag: 'Image → image' },
    'upscale-video': { title: 'Upscale video', body: 'A bigger picture, frame by frame.', tag: 'Video → video' },
    'background-removal': { title: 'Remove background', body: 'Keep the subject. Set the scene.', tag: 'Video → video' },
    'character-builder': { title: 'Character Builder', body: 'One character. Every side of the story.', tag: '01 / Identity' },
    storyboard: { title: 'Storyboard', body: 'Find the rhythm before the first take.', tag: '02 / Sequence' },
    angle: { title: 'Angle', body: 'See your idea from another perspective.', tag: '03 / Perspective' },
  },
};
type Copy = typeof en;
const fr: Copy = { ...en, workspace: 'Boîte à outils créative', title: 'Outils', subtitle: 'Finalisez une vidéo, affinez une image ou développez votre projet.', quick: 'Outils rapides', workshops: 'Ateliers', workshopHint: 'Donnez de la suite à vos idées.', filtersLabel: 'Filtrer les outils par type de média', available: 'Disponible', resultCountSingular: 'outil', results: 'outils', all: 'Tous', image: 'Image', video: 'Vidéo', audio: 'Audio', open: 'Ouvrir l’outil', workshopOpen: 'Entrer dans l’atelier', illustration: 'Illustration', noAudio: 'Pas encore d’outil de finition audio.', audioHint: 'Créez musique, voix et sons dans l’espace Audio.', audioOpen: 'Ouvrir Audio', source: 'Source', import: 'Importer', library: 'Choisir dans Médias', url: 'Coller une URL', original: 'Original', result: 'Résultat', preserved: 'Votre original reste intact.', advanced: 'Options', implementation: 'Méthode de traitement', empty: 'Place à votre média.', emptyHint: 'Importez un fichier ou choisissez-le dans Médias.', reuse: 'Réutiliser ce résultat', back: 'Outils', settings: 'Réglages', retryPrice: 'Actualiser le prix', upscale: 'Agrandir', removeBackground: 'Détourer', priceLoading: 'Calcul du prix…', size: 'Taille', format: 'Format', background: 'Fond', keepAudio: 'Garder le son', done: 'Terminé', compare: 'Comparer', signIn: 'Se connecter', processing: 'Traitement du média…', processingHint: 'En attente du résultat final. Gardez cette page ouverte.', tools: {
  'upscale-image': { title: 'Agrandir une image', body: 'Donnez de la place aux détails.', tag: 'Image → image' },
  'restore-video': { title: 'Restaurer une vidéo', body: 'Réparer une vidéo dégradée.', tag: 'Vidéo → vidéo' },
  denoise: { title: 'Débruiter une vidéo', body: 'Réduire le bruit et le grain.', tag: 'Vidéo → vidéo' },
  'fix-blur': { title: 'Corriger le flou', body: 'Corriger le flou de mouvement.', tag: 'Vidéo → vidéo' },
  'smooth-motion': { title: 'Fluidifier une vidéo', body: 'Des mouvements plus fluides.', tag: 'Vidéo → vidéo' },
  'upscale-video': { title: 'Agrandir une vidéo', body: 'Voyez plus grand, image par image.', tag: 'Vidéo → vidéo' },
  'background-removal': { title: 'Détourer une vidéo', body: 'Gardez le sujet. Changez le décor.', tag: 'Vidéo → vidéo' },
  'character-builder': { title: 'Character Builder', body: 'Un personnage. Tous les côtés de l’histoire.', tag: '01 / Identité' },
  storyboard: { title: 'Storyboard', body: 'Trouvez le rythme avant la première prise.', tag: '02 / Séquence' },
  angle: { title: 'Angle', body: 'Voyez votre idée sous un autre angle.', tag: '03 / Perspective' },
} };
const es: Copy = { ...en, workspace: 'Caja de herramientas creativa', title: 'Herramientas', subtitle: 'Termina un vídeo, mejora una imagen o desarrolla la siguiente parte del proyecto.', quick: 'Herramientas rápidas', workshops: 'Talleres', workshopHint: 'Lleva tus ideas más lejos.', filtersLabel: 'Filtrar herramientas por tipo de medio', available: 'Disponible', resultCountSingular: 'herramienta', results: 'herramientas', all: 'Todos', image: 'Imagen', video: 'Vídeo', audio: 'Audio', open: 'Abrir herramienta', workshopOpen: 'Entrar al taller', illustration: 'Ilustración', noAudio: 'Aún no hay herramientas de acabado de audio.', audioHint: 'Crea música, voces y sonidos en Audio.', audioOpen: 'Abrir Audio', source: 'Origen', import: 'Importar', library: 'Elegir en Medios', url: 'Pegar URL', original: 'Original', result: 'Resultado', preserved: 'Tu original queda intacto.', advanced: 'Opciones', implementation: 'Método de procesamiento', empty: 'Espacio para tus medios.', emptyHint: 'Importa un archivo o elige uno en Medios.', reuse: 'Reutilizar este resultado', back: 'Herramientas', settings: 'Ajustes', retryPrice: 'Actualizar precio', upscale: 'Ampliar', removeBackground: 'Quitar fondo', priceLoading: 'Calculando precio…', size: 'Tamaño', format: 'Formato', background: 'Fondo', keepAudio: 'Mantener audio', done: 'Listo', compare: 'Comparar', signIn: 'Iniciar sesión', processing: 'Procesando el archivo…', processingHint: 'Esperando el resultado final. Mantén esta página abierta.', tools: {
  'upscale-image': { title: 'Ampliar imagen', body: 'Dale espacio a los detalles.', tag: 'Imagen → imagen' },
  'restore-video': { title: 'Restaurar vídeo', body: 'Reparar un vídeo deteriorado.', tag: 'Vídeo → vídeo' },
  denoise: { title: 'Reducir ruido', body: 'Reducir ruido y grano.', tag: 'Vídeo → vídeo' },
  'fix-blur': { title: 'Corregir desenfoque', body: 'Corregir el desenfoque de movimiento.', tag: 'Vídeo → vídeo' },
  'smooth-motion': { title: 'Suavizar movimiento', body: 'Movimientos más fluidos.', tag: 'Vídeo → vídeo' },
  'upscale-video': { title: 'Ampliar vídeo', body: 'Una imagen mayor, fotograma a fotograma.', tag: 'Vídeo → vídeo' },
  'background-removal': { title: 'Quitar fondo', body: 'Conserva el sujeto. Cambia la escena.', tag: 'Vídeo → vídeo' },
  'character-builder': { title: 'Character Builder', body: 'Un personaje. Todos los lados de la historia.', tag: '01 / Identidad' },
  storyboard: { title: 'Storyboard', body: 'Encuentra el ritmo antes de la primera toma.', tag: '02 / Secuencia' },
  angle: { title: 'Angle', body: 'Mira tu idea desde otra perspectiva.', tag: '03 / Perspectiva' },
} };
export type ToolboxVisualId = keyof Copy['tools'];
export function toolboxCopy(locale: string): Copy { return locale === 'fr' ? fr : locale === 'es' ? es : en; }
