/** Fallbacks for picker keys that are not yet present in the route translation bundles. */
export function assetLibraryLocaleDefaults(locale: string) {
  if (locale === 'fr') return {
    searchPlaceholder: 'Rechercher des médias…', import: 'Importer', importing: 'Importation…', importFailed: 'Échec de l’importation. Réessayez.',
    sourcesTitle: 'Bibliothèque', toolsTitle: 'Créer ou transformer', toolsDescription: 'Préparez une source dans un autre outil, puis importez-la ici.', emptySearch: 'Aucun média ne correspond à cette recherche.',
    emptyRecent: 'Aucune sortie récente disponible.', emptyStoryboard: 'Aucun storyboard enregistré.', emptyCharacter: 'Aucun personnage enregistré.', emptyAngle: 'Aucune vue enregistrée.', emptyUpscale: 'Aucun agrandissement enregistré.',
    tabs: { recent: 'Sorties récentes', storyboard: 'Storyboard', character: 'Personnages', angle: 'Angles', upscale: 'Agrandissements' },
    shortcuts: { createImage: 'Créer une image', storyboard: 'Storyboard', changeAngle: 'Changer l’angle', characterBuilder: 'Créer un personnage', upscale: 'Agrandir' },
  };
  if (locale === 'es') return {
    searchPlaceholder: 'Buscar medios…', import: 'Importar', importing: 'Importando…', importFailed: 'Error al importar. Inténtalo de nuevo.',
    sourcesTitle: 'Biblioteca', toolsTitle: 'Crear o transformar', toolsDescription: 'Prepara una fuente en otra herramienta e impórtala aquí.', emptySearch: 'Ningún medio coincide con esta búsqueda.',
    emptyRecent: 'No hay salidas recientes.', emptyStoryboard: 'No hay storyboards guardados.', emptyCharacter: 'No hay personajes guardados.', emptyAngle: 'No hay vistas guardadas.', emptyUpscale: 'No hay ampliaciones guardadas.',
    tabs: { recent: 'Salidas recientes', storyboard: 'Storyboard', character: 'Personajes', angle: 'Ángulos', upscale: 'Ampliaciones' },
    shortcuts: { createImage: 'Crear imagen', storyboard: 'Storyboard', changeAngle: 'Cambiar ángulo', characterBuilder: 'Crear personaje', upscale: 'Ampliar' },
  };
  return {};
}
export function assetLibraryActionsCopy(locale: string) {
  return locale === 'fr'
    ? { use: 'Utiliser', delete: 'Supprimer', deleting: 'Suppression…', loadError: 'Impossible de charger la bibliothèque. Réessayez avec Actualiser.' }
    : locale === 'es'
      ? { use: 'Usar', delete: 'Eliminar', deleting: 'Eliminando…', loadError: 'No se puede cargar la biblioteca. Pulsa Actualizar para reintentar.' }
      : { use: 'Use', delete: 'Delete', deleting: 'Deleting…', loadError: 'Unable to load your library. Select Refresh to try again.' };
}
