export function recentMediaCopy(locale: string) {
  if (locale.startsWith('fr')) return {
    title: 'Récents', activity: 'Activité', open: 'Ouvrir les récents', close: 'Fermer',
    image: 'Images', video: 'Vidéos', audio: 'Audio', use: 'Utiliser en référence',
    loading: 'Chargement des médias…', error: 'Impossible de charger les médias. Réessayez.', retry: 'Réessayer',
    empty: 'Aucun média terminé dans cette catégorie.', auth: 'Connectez-vous pour retrouver vos médias.',
    helper: '12 médias récents · Choisir pour ajouter',
    role: 'Rôle de la référence', required: 'Requis', slot: 'Emplacement', add: 'Ajouter', replace: 'Remplacer',
    noRole: 'Ce modèle et ce mode n’acceptent pas ce type de référence.',
    preparing: 'Préparation…', drop: 'Déposez un média récent ici pour choisir son rôle.',
    issues: { kind: 'Type de média incompatible.', metadata: 'Métadonnées requises indisponibles. Importez le fichier original pour le valider.', duration: 'Durée incompatible avec ce rôle.', size: 'Fichier trop volumineux pour ce rôle.', format: 'Format incompatible avec ce rôle.', field_limit: 'Ce rôle est plein. Choisissez explicitement un emplacement à remplacer.', reference_budget: 'Limite totale des références atteinte.' },
  };
  if (locale.startsWith('es')) return {
    title: 'Recientes', activity: 'Actividad', open: 'Abrir recientes', close: 'Cerrar',
    image: 'Imágenes', video: 'Vídeos', audio: 'Audio', use: 'Usar como referencia',
    loading: 'Cargando medios…', error: 'No se pueden cargar los medios. Inténtalo de nuevo.', retry: 'Reintentar',
    empty: 'No hay medios terminados en esta categoría.', auth: 'Inicia sesión para ver tus medios.',
    helper: '12 medios recientes · Elige para añadir',
    role: 'Rol de la referencia', required: 'Obligatorio', slot: 'Posición', add: 'Añadir', replace: 'Reemplazar',
    noRole: 'Este modelo y modo no aceptan este tipo de referencia.',
    preparing: 'Preparando…', drop: 'Suelta un medio reciente aquí para elegir su rol.',
    issues: { kind: 'Tipo de medio incompatible.', metadata: 'Faltan metadatos requeridos. Importa el archivo original para validarlo.', duration: 'Duración incompatible con este rol.', size: 'Archivo demasiado grande para este rol.', format: 'Formato incompatible con este rol.', field_limit: 'Este rol está lleno. Elige una posición para reemplazar.', reference_budget: 'Se alcanzó el límite total de referencias.' },
  };
  return {
    title: 'Recents', activity: 'Activity', open: 'Open recent media', close: 'Close',
    image: 'Images', video: 'Videos', audio: 'Audio', use: 'Use as reference',
    loading: 'Loading media…', error: 'Unable to load media. Please try again.', retry: 'Retry',
    empty: 'No completed media in this category.', auth: 'Sign in to see your media.',
    helper: '12 recent media · Choose to add',
    role: 'Reference role', required: 'Required', slot: 'Slot', add: 'Add', replace: 'Replace',
    noRole: 'This model and mode do not accept this reference type.',
    preparing: 'Preparing…', drop: 'Drop recent media here to choose its reference role.',
    issues: { kind: 'Incompatible media type.', metadata: 'Required metadata is unavailable. Import the original file to validate it.', duration: 'Duration is incompatible with this role.', size: 'File is too large for this role.', format: 'Format is incompatible with this role.', field_limit: 'This role is full. Explicitly choose a slot to replace.', reference_budget: 'Total reference limit reached.' },
  };
}

/** Display-only filename: relative sources are valid, signed queries never become labels. */
export function recentMediaFilename(url: string, fallback: string): string {
  try {
    const parsed = new URL(url, 'https://local.invalid');
    if (!['https:', 'http:'].includes(parsed.protocol)) return fallback;
    const encoded = parsed.pathname.split('/').pop();
    return encoded ? decodeURIComponent(encoded).slice(0, 100) : fallback;
  } catch { return fallback; }
}
