/** Concise interface labels take precedence over older workspace message bundles. */
export function upscaleWorkspaceLabels(locale: string) {
  if (locale === 'fr') return {
    previewSource: 'Original', previewResult: 'Résultat', previewCompare: 'Comparer', previewZoom: 'Zoom', previewZoomFit: 'Adapter',
    save: 'Enregistrer', saved: 'Enregistré dans la bibliothèque.', saveFailed: 'Impossible d’enregistrer le média.', download: 'Télécharger', recentTitle: 'Récents',
    library: 'Bibliothèque', libraryChoose: 'Choisir dans la bibliothèque', libraryTitle: 'Choisir un média', libraryBody: '', librarySearch: 'Rechercher…', librarySourcesTitle: 'Bibliothèque',
    libraryEmpty: 'Aucun média.', libraryEmptyImages: 'Aucune image.', libraryEmptyVideos: 'Aucune vidéo.', libraryEmptySearch: 'Aucun résultat.', libraryError: 'Impossible de charger la bibliothèque.', libraryRefresh: 'Actualiser', libraryUse: 'Choisir', libraryCount: '{count} médias',
    libraryTabs: { all: 'Tous', upload: 'Imports', generated: 'Créations', character: 'Personnages', angle: 'Angles', upscale: 'Agrandissements' },
    uploadFailed: 'Échec de l’import.', priceUnavailable: 'Prix indisponible', priceLoading: 'Calcul du prix…',
  };
  if (locale === 'es') return {
    previewSource: 'Original', previewResult: 'Resultado', previewCompare: 'Comparar', previewZoom: 'Zoom', previewZoomFit: 'Ajustar',
    save: 'Guardar', saved: 'Guardado en la biblioteca.', saveFailed: 'No se pudo guardar el archivo.', download: 'Descargar', recentTitle: 'Recientes',
    library: 'Biblioteca', libraryChoose: 'Elegir de la biblioteca', libraryTitle: 'Elegir un archivo', libraryBody: '', librarySearch: 'Buscar…', librarySourcesTitle: 'Biblioteca',
    libraryEmpty: 'Sin archivos.', libraryEmptyImages: 'Sin imágenes.', libraryEmptyVideos: 'Sin vídeos.', libraryEmptySearch: 'Sin resultados.', libraryError: 'No se pudo cargar la biblioteca.', libraryRefresh: 'Actualizar', libraryUse: 'Elegir', libraryCount: '{count} archivos',
    libraryTabs: { all: 'Todos', upload: 'Importados', generated: 'Creaciones', character: 'Personajes', angle: 'Ángulos', upscale: 'Ampliaciones' },
    uploadFailed: 'Error al importar.', priceUnavailable: 'Precio no disponible', priceLoading: 'Calculando precio…',
  };
  return { libraryTitle: 'Choose media', libraryBody: '', librarySearch: 'Search…', libraryUse: 'Choose', libraryCount: '{count} files', recentTitle: 'Recent', previewZoom: 'Zoom' };
}
