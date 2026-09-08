/** Concise interface labels take precedence over older workspace message bundles. */
export function upscaleWorkspaceLabels(locale: string) {
  if (locale === 'fr') return {
    previewSource: 'Original', previewResult: 'Résultat', previewCompare: 'Comparer', previewZoom: 'Zoom', previewZoomFit: 'Adapter',
    save: 'Enregistrer', saved: 'Enregistré dans Médias.', saveFailed: 'Impossible d’enregistrer le média.', download: 'Télécharger', recentTitle: 'Récents',
    library: 'Médias', libraryChoose: 'Choisir dans Médias', libraryTitle: 'Choisir dans Médias', libraryBody: '', librarySearch: 'Rechercher…', librarySourcesTitle: 'Médias',
    libraryEmpty: 'Aucun média.', libraryEmptyImages: 'Aucune image.', libraryEmptyVideos: 'Aucune vidéo.', libraryEmptySearch: 'Aucun résultat.', libraryError: 'Impossible de charger Médias.', libraryRefresh: 'Actualiser', libraryLoadMore: 'Afficher plus', libraryUse: 'Choisir', libraryCount: '{count} médias',
    libraryTabs: { all: 'Tous', upload: 'Imports', generated: 'Créations', character: 'Personnages', angle: 'Angles', upscale: 'Agrandissements' },
    uploadFailed: 'Échec de l’import.', priceUnavailable: 'Prix indisponible', priceLoading: 'Calcul du prix…',
  };
  if (locale === 'es') return {
    previewSource: 'Original', previewResult: 'Resultado', previewCompare: 'Comparar', previewZoom: 'Zoom', previewZoomFit: 'Ajustar',
    save: 'Guardar', saved: 'Guardado en Medios.', saveFailed: 'No se pudo guardar el archivo.', download: 'Descargar', recentTitle: 'Recientes',
    library: 'Medios', libraryChoose: 'Elegir en Medios', libraryTitle: 'Elegir en Medios', libraryBody: '', librarySearch: 'Buscar…', librarySourcesTitle: 'Medios',
    libraryEmpty: 'Sin archivos.', libraryEmptyImages: 'Sin imágenes.', libraryEmptyVideos: 'Sin vídeos.', libraryEmptySearch: 'Sin resultados.', libraryError: 'No se pudo cargar Medios.', libraryRefresh: 'Actualizar', libraryLoadMore: 'Mostrar más', libraryUse: 'Elegir', libraryCount: '{count} archivos',
    libraryTabs: { all: 'Todos', upload: 'Importados', generated: 'Creaciones', character: 'Personajes', angle: 'Ángulos', upscale: 'Ampliaciones' },
    uploadFailed: 'Error al importar.', priceUnavailable: 'Precio no disponible', priceLoading: 'Calculando precio…',
  };
  return { libraryTitle: 'Choose from Media', libraryBody: '', librarySearch: 'Search…', libraryLoadMore: 'Load more', libraryUse: 'Choose', libraryCount: '{count} files', recentTitle: 'Recent', previewZoom: 'Zoom' };
}
