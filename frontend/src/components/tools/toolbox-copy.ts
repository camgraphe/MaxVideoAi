const en = {
  title: 'Your finishing touches.', subtitle: 'Small changes. A whole new picture.', quick: 'Quick tools', workshops: 'Creative workshops', workshopHint: 'Take an idea further.', all: 'All media', image: 'Image', video: 'Video', audio: 'Audio', open: 'Open tool', workshopOpen: 'Enter workshop', illustration: 'Illustration', noAudio: 'No audio finishing tools yet.', audioHint: 'Create music, voices and sound in the Audio workspace.', audioOpen: 'Open Audio', source: 'Source', import: 'Import a file', library: 'Choose from library', url: 'Paste a media URL', original: 'Original', result: 'Result', preserved: 'Your original stays intact.', advanced: 'Advanced options', implementation: 'Processing method', empty: 'Bring your media into focus.', emptyHint: 'Import a file or choose one from your library.', reuse: 'Use this result', back: 'Toolbox', settings: 'Adjustments', processing: 'Processing your media…', processingHint: 'Waiting for the completed result. You can keep this page open.',
  tools: {
    'upscale-image': { title: 'Upscale image', body: 'Give the details more room.', tag: 'Image → image' },
    'upscale-video': { title: 'Upscale video', body: 'A bigger picture, frame by frame.', tag: 'Video → video' },
    'background-removal': { title: 'Remove background', body: 'Keep the subject. Set the scene.', tag: 'Video → video' },
    'character-builder': { title: 'Character Builder', body: 'One character. Every side of the story.', tag: '01 / Identity' },
    storyboard: { title: 'Storyboard', body: 'Find the rhythm before the first take.', tag: '02 / Sequence' },
    angle: { title: 'Angle', body: 'See your idea from another perspective.', tag: '03 / Perspective' },
  },
};
type Copy = typeof en;
const fr: Copy = { ...en, title: 'Le sens du détail.', subtitle: 'De petits gestes. Une autre image.', quick: 'Outils rapides', workshops: 'Ateliers créatifs', workshopHint: 'Donnez de la suite à vos idées.', all: 'Tous les médias', image: 'Image', video: 'Vidéo', audio: 'Audio', open: 'Ouvrir l’outil', workshopOpen: 'Entrer dans l’atelier', illustration: 'Illustration', noAudio: 'Pas encore d’outil de finition audio.', audioHint: 'Créez musique, voix et sons dans l’espace Audio.', audioOpen: 'Ouvrir Audio', source: 'Source', import: 'Importer un fichier', library: 'Choisir dans la bibliothèque', url: 'Coller une URL de média', original: 'Original', result: 'Résultat', preserved: 'Votre original reste intact.', advanced: 'Options avancées', implementation: 'Méthode de traitement', empty: 'Place à votre média.', emptyHint: 'Importez un fichier ou choisissez dans votre bibliothèque.', reuse: 'Réutiliser ce résultat', back: 'Outils', settings: 'Réglages', processing: 'Traitement du média…', processingHint: 'En attente du résultat final. Gardez cette page ouverte.', tools: {
  'upscale-image': { title: 'Agrandir une image', body: 'Donnez de la place aux détails.', tag: 'Image → image' },
  'upscale-video': { title: 'Agrandir une vidéo', body: 'Voyez plus grand, image par image.', tag: 'Vidéo → vidéo' },
  'background-removal': { title: 'Détourer une vidéo', body: 'Gardez le sujet. Changez le décor.', tag: 'Vidéo → vidéo' },
  'character-builder': { title: 'Character Builder', body: 'Un personnage. Tous les côtés de l’histoire.', tag: '01 / Identité' },
  storyboard: { title: 'Storyboard', body: 'Trouvez le rythme avant la première prise.', tag: '02 / Séquence' },
  angle: { title: 'Angle', body: 'Voyez votre idée sous un autre angle.', tag: '03 / Perspective' },
} };
const es: Copy = { ...en, title: 'El sentido del detalle.', subtitle: 'Pequeños cambios. Otra imagen.', quick: 'Herramientas rápidas', workshops: 'Talleres creativos', workshopHint: 'Lleva tus ideas más lejos.', all: 'Todos los medios', image: 'Imagen', video: 'Vídeo', audio: 'Audio', open: 'Abrir herramienta', workshopOpen: 'Entrar al taller', illustration: 'Ilustración', noAudio: 'Aún no hay herramientas de acabado de audio.', audioHint: 'Crea música, voces y sonidos en Audio.', audioOpen: 'Abrir Audio', source: 'Origen', import: 'Importar archivo', library: 'Elegir de la biblioteca', url: 'Pegar una URL de medios', original: 'Original', result: 'Resultado', preserved: 'Tu original queda intacto.', advanced: 'Opciones avanzadas', implementation: 'Método de procesamiento', empty: 'Espacio para tus medios.', emptyHint: 'Importa un archivo o elige uno de tu biblioteca.', reuse: 'Reutilizar este resultado', back: 'Herramientas', settings: 'Ajustes', processing: 'Procesando el archivo…', processingHint: 'Esperando el resultado final. Mantén esta página abierta.', tools: {
  'upscale-image': { title: 'Ampliar imagen', body: 'Dale espacio a los detalles.', tag: 'Imagen → imagen' },
  'upscale-video': { title: 'Ampliar vídeo', body: 'Una imagen mayor, fotograma a fotograma.', tag: 'Vídeo → vídeo' },
  'background-removal': { title: 'Quitar fondo', body: 'Conserva el sujeto. Cambia la escena.', tag: 'Vídeo → vídeo' },
  'character-builder': { title: 'Character Builder', body: 'Un personaje. Todos los lados de la historia.', tag: '01 / Identidad' },
  storyboard: { title: 'Storyboard', body: 'Encuentra el ritmo antes de la primera toma.', tag: '02 / Secuencia' },
  angle: { title: 'Angle', body: 'Mira tu idea desde otra perspectiva.', tag: '03 / Perspectiva' },
} };
export type ToolboxVisualId = keyof Copy['tools'];
export function toolboxCopy(locale: string): Copy { return locale === 'fr' ? fr : locale === 'es' ? es : en; }
