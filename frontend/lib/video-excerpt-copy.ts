export function videoExcerptCopy(locale: string) {
  return locale === 'fr'
    ? {
        editing: 'Choix de l’extrait…',
        requires: 'Choisissez un extrait respectant les limites du modèle pour calculer le prix.',
        choose: 'Choisir un extrait',
        title: 'Choisir un extrait vidéo',
        start: 'Début (secondes)',
        end: 'Fin (secondes)',
        cancel: 'Annuler',
        apply: 'Utiliser cet extrait',
        busy: 'Préparation…',
        length: 'Durée sélectionnée',
        limits: 'Limites du modèle',
        invalid: 'Choisissez un début et une fin valides dans la vidéo, en respectant les limites du modèle.',
        quote: 'La préparation est gratuite. Le prix de génération sera recalculé pour cet extrait.',
        failed: 'Impossible de préparer cet extrait. Réessayez.',
      }
    : locale === 'es'
      ? {
          editing: 'Eligiendo fragmento…',
          requires: 'Elige un fragmento dentro de los límites del modelo para calcular el precio.',
          choose: 'Elegir un fragmento',
          title: 'Elegir un fragmento de vídeo',
          start: 'Inicio (segundos)',
          end: 'Fin (segundos)',
          cancel: 'Cancelar',
          apply: 'Usar fragmento',
          busy: 'Preparando…',
          length: 'Duración seleccionada',
          limits: 'Límites del modelo',
          invalid: 'Elige un inicio y un final válidos dentro del vídeo y de los límites del modelo.',
          quote: 'Preparar es gratis. Recalcularemos el precio de generación para este fragmento.',
          failed: 'No se pudo preparar el fragmento. Inténtalo de nuevo.',
        }
      : {
          editing: 'Choosing excerpt…',
          requires: 'Choose an excerpt within this model’s limits to calculate the price.',
          choose: 'Choose excerpt',
          title: 'Choose a video excerpt',
          start: 'Start (seconds)',
          end: 'End (seconds)',
          cancel: 'Cancel',
          apply: 'Use excerpt',
          busy: 'Preparing…',
          length: 'Selected length',
          limits: 'Model limits',
          invalid: 'Choose a valid start and end within the video and this model’s duration limits.',
          quote: 'Preparation is free. Generation pricing will be recalculated for this excerpt.',
          failed: 'Unable to prepare the excerpt. Try again.',
        };
}
