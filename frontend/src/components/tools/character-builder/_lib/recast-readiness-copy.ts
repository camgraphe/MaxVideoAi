const en = {
  required: 'Required',
  complete: 'Before generating',
  character: 'Choose a character',
  characterHint: 'Choose a saved character or upload a portrait.',
  direction: 'Add a direction or a passage',
  directionLabel: 'What should the character do?',
  directionHint: 'Add at least one: a scene direction, dialogue, a video passage or an audio passage.',
  reading: 'Reading the media duration…',
  passage: 'Choose and apply the video or audio passage.',
  choosePassage: 'Choose a passage',
  duration: 'Choose a valid output duration',
  completeInputs: 'Complete the required inputs',
  estimating: 'Estimating…',
  estimateFailed: 'The price estimate is unavailable. Retry; your inputs are kept.',
  retryEstimate: 'Retry estimate',
  invalidSettings: 'Check the duration, resolution and format, then request a new quote.',
  preparing: 'Preparing your references and selected passages for the exact quote. Nothing is charged before confirmation.',
};

const fr: typeof en = {
  required: 'Requis',
  complete: 'Avant de générer',
  character: 'Choisir un personnage',
  characterHint: 'Choisis un personnage enregistré ou importe un portrait.',
  direction: 'Ajouter une consigne ou un passage',
  directionLabel: 'Que doit faire le personnage ?',
  directionHint: 'Ajoute au moins un élément : une consigne, du dialogue, un passage vidéo ou un passage audio.',
  reading: 'Lecture de la durée du média…',
  passage: 'Choisis et valide le passage vidéo ou audio.',
  choosePassage: 'Choisir le passage',
  duration: 'Choisir une durée de sortie valide',
  completeInputs: 'Complète les éléments requis',
  estimating: 'Estimation en cours…',
  estimateFailed: 'L’estimation du prix est indisponible. Réessaie ; tes choix sont conservés.',
  retryEstimate: 'Relancer l’estimation',
  invalidSettings: 'Vérifie la durée, la résolution et le format, puis demande un nouveau devis.',
  preparing: 'Préparation de tes références et des passages sélectionnés pour le devis exact. Rien n’est débité avant confirmation.',
};

const es: typeof en = {
  required: 'Obligatorio',
  complete: 'Antes de generar',
  character: 'Elegir un personaje',
  characterHint: 'Elige un personaje guardado o sube un retrato.',
  direction: 'Añadir una indicación o un fragmento',
  directionLabel: '¿Qué debe hacer el personaje?',
  directionHint: 'Añade al menos una opción: una indicación, diálogo, un fragmento de vídeo o uno de audio.',
  reading: 'Leyendo la duración del archivo…',
  passage: 'Elige y aplica el fragmento de vídeo o audio.',
  choosePassage: 'Elegir el fragmento',
  duration: 'Elegir una duración de salida válida',
  completeInputs: 'Completa los campos obligatorios',
  estimating: 'Estimando…',
  estimateFailed: 'La estimación del precio no está disponible. Reinténtalo; tus opciones se conservan.',
  retryEstimate: 'Reintentar estimación',
  invalidSettings: 'Comprueba la duración, la resolución y el formato, y solicita un nuevo presupuesto.',
  preparing: 'Preparando tus referencias y los fragmentos seleccionados para el presupuesto exacto. No se cobra nada antes de confirmar.',
};

export function getRecastReadinessCopy(locale: string) {
  return locale.startsWith('fr') ? fr : locale.startsWith('es') ? es : en;
}
