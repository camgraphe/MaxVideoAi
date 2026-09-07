export function referencePickerCopy(locale: string) {
  return locale.startsWith('fr') ? {
    title: 'Choisir une référence', choose: 'Choisir', selected: 'Sélectionné', use: 'Utiliser la sélection', cancel: 'Annuler', clear: 'Effacer', empty: 'Choisissez un média', busy: 'Ajout…', error: 'Ajout impossible. Réessayez.', done: 'Terminé', instant: 'Sélection appliquée immédiatement', search: 'Rechercher', source: 'Source', slot: 'Emplacement', capacity: 'Maximum',
  } : locale.startsWith('es') ? {
    title: 'Elegir referencia', choose: 'Elegir', selected: 'Seleccionado', use: 'Usar selección', cancel: 'Cancelar', clear: 'Borrar', empty: 'Elige un medio', busy: 'Añadiendo…', error: 'No se pudo añadir. Inténtalo de nuevo.', done: 'Listo', instant: 'Selección aplicada inmediatamente', search: 'Buscar', source: 'Fuente', slot: 'Posición', capacity: 'Máximo',
  } : {
    title: 'Choose a reference', choose: 'Choose', selected: 'Selected', use: 'Use selection', cancel: 'Cancel', clear: 'Clear', empty: 'Choose a media file', busy: 'Adding…', error: 'Could not add this reference. Try again.', done: 'Done', instant: 'Selection applies immediately', search: 'Search', source: 'Source', slot: 'Slot', capacity: 'Maximum',
  };
}
