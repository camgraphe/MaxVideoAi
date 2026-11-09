export function referencePickerCopy(locale: string) {
  return locale.startsWith('fr') ? {
    add: 'Ajouter', loadError: 'Impossible de charger les médias. Réessayez.',
    clickHint: 'Cliquez sur un média pour ajouter cette référence.',
    multipleHint: 'Cliquez pour ajouter une référence. Cochez les cases pour en ajouter plusieurs ensemble.',
    compatibility: 'Compatibilité', compatible: 'Médias utilisables', allMedia: 'Tous les médias',
    noCompatible: 'Aucun média chargé ne convient à cet emplacement. Affichez « Tous les médias » pour voir pourquoi.',
    searchMore: 'D’autres médias sont disponibles. Chargez la suite pour étendre la recherche.',
    title: 'Choisir une référence', choose: 'Choisir', selected: 'Sélectionné', use: 'Utiliser la sélection', cancel: 'Annuler', clear: 'Effacer', empty: 'Choisissez un média', busy: 'Ajout…', error: 'Ajout impossible. Réessayez.', done: 'Terminé', instant: 'Sélection appliquée immédiatement', search: 'Rechercher', source: 'Source', slot: 'Emplacement', capacity: 'Maximum',
  } : locale.startsWith('es') ? {
    add: 'Añadir', loadError: 'No se pudieron cargar los medios. Inténtalo de nuevo.',
    clickHint: 'Haz clic en un medio para añadir esta referencia.',
    multipleHint: 'Haz clic para añadir una referencia. Marca las casillas para añadir varias juntas.',
    compatibility: 'Compatibilidad', compatible: 'Medios utilizables', allMedia: 'Todos los medios',
    noCompatible: 'Ningún medio cargado sirve para esta posición. Elige « Todos los medios » para ver el motivo.',
    searchMore: 'Hay más medios disponibles. Carga más para ampliar la búsqueda.',
    title: 'Elegir referencia', choose: 'Elegir', selected: 'Seleccionado', use: 'Usar selección', cancel: 'Cancelar', clear: 'Borrar', empty: 'Elige un medio', busy: 'Añadiendo…', error: 'No se pudo añadir. Inténtalo de nuevo.', done: 'Listo', instant: 'Selección aplicada inmediatamente', search: 'Buscar', source: 'Fuente', slot: 'Posición', capacity: 'Máximo',
  } : {
    add: 'Add', loadError: 'Could not load media. Try again.',
    clickHint: 'Click a media file to add this reference.',
    multipleHint: 'Click to add one reference. Use checkboxes to add several together.',
    compatibility: 'Compatibility', compatible: 'Usable media', allMedia: 'All media',
    noCompatible: 'None of the loaded media fit this slot. Choose “All media” to see why.',
    searchMore: 'More media are available. Load more to extend your search.',
    title: 'Choose a reference', choose: 'Choose', selected: 'Selected', use: 'Use selection', cancel: 'Cancel', clear: 'Clear', empty: 'Choose a media file', busy: 'Adding…', error: 'Could not add this reference. Try again.', done: 'Done', instant: 'Selection applies immediately', search: 'Search', source: 'Source', slot: 'Slot', capacity: 'Maximum',
  };
}

export function referencePickerBatchLabel(locale: string, count: number) {
  if (locale.startsWith('fr')) return count ? `Ajouter ${count} référence${count > 1 ? 's' : ''}` : 'Ajouter les références';
  if (locale.startsWith('es')) return count ? `Añadir ${count} referencia${count > 1 ? 's' : ''}` : 'Añadir referencias';
  return count ? `Add ${count} reference${count > 1 ? 's' : ''}` : 'Add references';
}
